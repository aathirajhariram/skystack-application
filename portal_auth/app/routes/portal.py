import csv
import io
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app import activity, db, deps
from app.config import settings
from app.services import dashboard, entry, storage, tables, visibility

router = APIRouter(prefix="/portal", tags=["portal"])


def _source_or_404(client_code: str, source: str) -> dict:
    rows = db.query("SELECT SourceId, SourceName, FileFormat FROM portal.vw_ClientSources "
                    "WHERE ClientCode = ? AND SourceName = ?", (client_code, source))
    if not rows:
        raise HTTPException(404, "Unknown data source.")
    return rows[0]


@router.get("/sources")
def sources(user: dict = Depends(deps.active_user)):
    rows = db.query("SELECT SourceName FROM portal.vw_ClientSources WHERE ClientCode = ? ORDER BY SourceName",
                    (user["client_code"],))
    hidden = visibility.hidden_sources(user)
    return [r["SourceName"] for r in rows if r["SourceName"] not in hidden]


@router.get("/sources/{source}/template")
def template(source: str, user: dict = Depends(deps.active_user)):
    """A ready-to-fill file: the exact column headers the platform expects for this source."""
    src = _source_or_404(user["client_code"], source)
    cols = db.query("SELECT SourceColumn FROM cfg.ColumnMapping WHERE SourceId = ? ORDER BY ColumnOrder", (src["SourceId"],))
    buf = io.StringIO()
    csv.writer(buf).writerow([c["SourceColumn"] for c in cols])
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{source}_template.csv"'})


@router.post("/upload/{source}", dependencies=[Depends(deps.require_csrf_header)])
async def upload(source: str, file: UploadFile = File(...), user: dict = Depends(deps.upload_user)):
    _source_or_404(user["client_code"], source)                       # must be one of THIS client's sources
    if source in visibility.hidden_sources(user):
        raise HTTPException(404, "Unknown data source.")
    name = file.filename or ""
    ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in settings.allowed_extensions:
        raise HTTPException(400, f"Please upload one of: {', '.join(settings.allowed_extensions)}")
    data = await file.read()
    if not data:
        raise HTTPException(400, "The file is empty.")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"The file is larger than {settings.max_upload_mb} MB.")
    stored = storage.put_file(user["client_code"], source, re.sub(r"[^A-Za-z0-9._-]", "_", name), data)
    activity.record(user["client_id"], user["user_id"], user["email"], "UPLOAD", f"{source}: {name}")
    return {"uploaded": stored, "source": source}


# ---- data-entry table (Pro / Elite): the table becomes a CSV and goes through the SAME pipeline as an uploaded file ----
# One person at a time per data type (an editing lock), validation per column data type, and a full audit trail.
GRID_PLANS = {"pro", "elite"}
GRID_MAX_ROWS = 5000


def _client_plan(user: dict):
    row = db.query("SELECT PlanCode FROM cfg.Client WHERE ClientId = ?", (user["client_id"],))
    return row[0]["PlanCode"] if row else None


def _grid_allowed(user: dict) -> bool:
    """Pro and Elite. A client with no plan (created by staff in the Ops console) is allowed too."""
    plan = _client_plan(user)
    return plan is None or str(plan).lower() in GRID_PLANS


def _entry_source(user: dict, source: str) -> dict:
    if not _grid_allowed(user):
        raise HTTPException(403, "plan_required")
    src = _source_or_404(user["client_code"], source)
    if source in visibility.hidden_sources(user):
        raise HTTPException(404, "Unknown data source.")
    return src


def _columns(source_id: int) -> list:
    rows = db.query("SELECT SourceColumn, DataType, DateFormat, IsBusinessKey, IsNullable FROM cfg.ColumnMapping "
                    "WHERE SourceId = ? ORDER BY ColumnOrder", (source_id,))
    return [{"name": c["SourceColumn"], "type": c["DataType"], "date_format": c["DateFormat"],
             "key": bool(c["IsBusinessKey"]), "required": (not c["IsNullable"]) or bool(c["IsBusinessKey"])} for c in rows]


@router.get("/features")
def features(user: dict = Depends(deps.active_user)):
    return {"data_entry": _grid_allowed(user)}


@router.get("/sources/{source}/columns")
def source_columns(source: str, user: dict = Depends(deps.upload_user)):
    return _columns(_entry_source(user, source)["SourceId"])


@router.get("/entry/{source}/lock")
def entry_status(source: str, user: dict = Depends(deps.upload_user)):
    """Who holds the editing slot right now (read only - does not take it)."""
    _entry_source(user, source)
    return entry.current(user["client_id"], source, user["user_id"])


@router.post("/entry/{source}/lock", dependencies=[Depends(deps.require_csrf_header)])
def entry_lock(source: str, user: dict = Depends(deps.upload_user)):
    """Asks for the editing slot (also renews it). If someone else holds it, the caller waits and asks again."""
    _entry_source(user, source)
    before = entry.current(user["client_id"], source, user["user_id"])
    state = entry.acquire(user["client_id"], source, user)
    if state["mine"] and not before["mine"]:
        activity.record(user["client_id"], user["user_id"], user["email"], "GRID_LOCK", f"{source}: started editing")
    return state


@router.post("/entry/{source}/release", dependencies=[Depends(deps.require_csrf_header)])
def entry_release(source: str, force: bool = False, user: dict = Depends(deps.upload_user)):
    _entry_source(user, source)
    if force and not user["permissions"]["admin"]:
        raise HTTPException(403, "forbidden")
    held = entry.release(user["client_id"], source, user["user_id"], force=force)
    if held and force and held["UserEmail"].lower() != user["email"].lower():
        activity.record(user["client_id"], user["user_id"], user["email"], "GRID_TAKEOVER",
                        f"{source}: released the lock of {held['UserEmail']}")
    return {"released": True}


class GridBody(BaseModel):
    rows: list[list[str]] = Field(..., max_length=GRID_MAX_ROWS)


@router.post("/entry/{source}", dependencies=[Depends(deps.require_csrf_header)])
def submit_grid(source: str, body: GridBody, user: dict = Depends(deps.upload_user)):
    src = _entry_source(user, source)
    state = entry.current(user["client_id"], source, user["user_id"])
    if not state["mine"]:                                   # only the person who holds the editing slot may send
        raise HTTPException(409, "lock_required" if state["free"] else "locked_by_other")
    cols = _columns(src["SourceId"])
    rows = [[(c or "").strip() for c in r] for r in body.rows]
    rows = [r for r in rows if any(r)]                      # drop completely empty lines
    if not rows:
        raise HTTPException(400, "There is no data to send yet.")
    if any(len(r) != len(cols) for r in rows):
        raise HTTPException(400, "The table does not match the columns of this data type.")
    errors = entry.validate(cols, rows)                     # column-level validation by data type, checked again here
    if errors:
        activity.record(user["client_id"], user["user_id"], user["email"], "GRID_REJECTED",
                        f"{source}: {len(errors)} validation problem(s) in {len(rows)} rows")
        return JSONResponse(status_code=422, content={"detail": "validation_failed", "errors": errors})
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c["name"] for c in cols])
    w.writerows(rows)
    data = buf.getvalue().encode("utf-8")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"The data is larger than {settings.max_upload_mb} MB.")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")        # file name = table name + date + time (UTC)
    stored = storage.put_file(user["client_code"], source, f"{source}_{stamp}.csv", data, stamp=False)
    activity.record(user["client_id"], user["user_id"], user["email"], "GRID_SENT", f"{source}: {len(rows)} rows -> {stored}")
    entry.release(user["client_id"], source, user["user_id"])   # slot is free for the next person
    return {"uploaded": stored, "source": source, "rows": len(rows)}


MANUAL_FOLDER = "manual_entry"          # landing/<client>/manual_entry/<table>_<date>_<time>.csv


class ColumnDef(BaseModel):
    name: str = Field(..., max_length=80)
    type: str = "text"                    # text | whole | decimal | date | datetime | yesno
    decimals: int = 4
    date_format: str | None = None


class CustomGrid(BaseModel):
    name: str = Field(..., max_length=60)
    columns: list[ColumnDef] = Field(..., max_length=tables.MAX_COLUMNS)
    rows: list[list[str]] = Field(..., max_length=GRID_MAX_ROWS)


@router.post("/entry-custom", dependencies=[Depends(deps.require_csrf_header)])
def submit_custom(body: CustomGrid, user: dict = Depends(deps.upload_user)):
    """The client's own table (name + columns typed in the browser): checked by data type, then delivered as one CSV."""
    if not _grid_allowed(user):
        raise HTTPException(403, "plan_required")
    name = tables.slug(body.name)
    if len(name) < 2:
        raise HTTPException(400, "Give the table a name of at least 2 letters or numbers.")
    mapping = tables.build_mapping([c.model_dump() for c in body.columns], 0, allow_key=False)
    cols = [{"name": m["source_col"], "type": m["dtype"], "date_format": m["fmt"], "key": False, "required": False} for m in mapping]
    rows = [[(c or "").strip() for c in r] for r in body.rows]
    rows = [r for r in rows if any(r)]
    if not rows:
        raise HTTPException(400, "There is no data to send yet.")
    if any(len(r) != len(cols) for r in rows):
        raise HTTPException(400, "The rows do not match the columns of the table.")
    errors = entry.validate(cols, rows)
    if errors:
        activity.record(user["client_id"], user["user_id"], user["email"], "GRID_REJECTED",
                        f"{name} (own table): {len(errors)} validation problem(s) in {len(rows)} rows")
        return JSONResponse(status_code=422, content={"detail": "validation_failed", "errors": errors})
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c["name"] for c in cols])
    w.writerows(rows)
    data = buf.getvalue().encode("utf-8")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"The data is larger than {settings.max_upload_mb} MB.")
    filename = f"{name}_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}.csv"
    stored = storage.put_file(user["client_code"], MANUAL_FOLDER, filename, data, stamp=False)
    activity.record(user["client_id"], user["user_id"], user["email"], "GRID_SENT",
                    f"{name} (own table): {len(rows)} rows, {len(cols)} columns -> {stored}")
    return {"uploaded": stored, "table": name, "rows": len(rows)}


@router.get("/entry-history")
def entry_history(user: dict = Depends(deps.upload_user)):
    """Who entered what and when (the audit trail for table entry), newest first."""
    rows = db.query("SELECT TOP 30 Actor, Action, Detail, At FROM portal.ActivityLog "
                    "WHERE ClientId = ? AND Action IN ('GRID_SENT','GRID_REJECTED','GRID_TAKEOVER','GRID_LOCK') "
                    "ORDER BY At DESC", (user["client_id"],))
    return [{"who": r["Actor"], "action": r["Action"], "detail": r["Detail"], "at": r["At"].isoformat() + "Z"} for r in rows]


def _friendly(status: str, message: str) -> str:
    """Clients get plain language, never internals/stack traces."""
    if status == "NO_FILES":
        return "No new files."
    if status == "FAILED":
        if message and message.startswith("Missing expected columns"):
            return message                                          # actionable: tells which headers are missing
        return "We could not process this file. SkyStack support has been notified."
    if status == "WARNING":
        return "Processed with warnings."
    return "Processed."


@router.get("/runs")
def runs(user: dict = Depends(deps.active_user)):
    rows = db.query("SELECT TOP 20 SourceName, Status, StartedAt, EndedAt, RowsRead, RowsLoaded, RowsRejected, Message "
                    "FROM audit.vw_RunSummary WHERE ClientCode = ? AND Status <> 'NO_FILES' ORDER BY StartedAt DESC",
                    (user["client_code"],))
    return [{"source": r["SourceName"], "status": r["Status"], "started_at": r["StartedAt"].isoformat() + "Z",
             "rows_read": r["RowsRead"], "rows_loaded": r["RowsLoaded"], "rows_rejected": r["RowsRejected"],
             "message": _friendly(r["Status"], r["Message"] or "")} for r in rows]


@router.get("/dashboard")
def dashboard_data(user: dict = Depends(deps.active_user)):
    hidden = visibility.hidden_sources(user)
    return {"sources": [s for s in dashboard.load_dashboard(user["client_code"]) if s["source"] not in hidden]}

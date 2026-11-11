import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app import activity, db, deps
from app.config import settings
from app.services import client_tables as ct, dashboard, entry, storage, visibility

router = APIRouter(prefix="/portal", tags=["portal"])


# ---- the client's own tables --------------------------------------------------------------------------------------
# A table is just a name (and, once defined, its columns with data types). Files - uploaded or typed in the table
# screen - are named <table>_<date>_<time> and delivered to landing/<client>/<table>/. Every one is logged with the user.
GRID_PLANS = {"pro", "elite"}
GRID_MAX_ROWS = 5000


def _stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")              # UTC


def _client_plan(user: dict):
    row = db.query("SELECT PlanCode FROM cfg.Client WHERE ClientId = ?", (user["client_id"],))
    return row[0]["PlanCode"] if row else None


def _grid_allowed(user: dict) -> bool:
    """Pro and Elite. A client with no plan (created by staff in the Ops console) is allowed too."""
    plan = _client_plan(user)
    return plan is None or str(plan).lower() in GRID_PLANS


@router.get("/tables")
def list_tables(user: dict = Depends(deps.active_user)):
    """The client's saved tables (also the names offered when uploading a file)."""
    return ct.listing(user["client_id"])


@router.post("/upload", dependencies=[Depends(deps.require_csrf_header)])
async def upload(table: str = Form(...), file: UploadFile = File(...), user: dict = Depends(deps.upload_user)):
    """Any file, for a table name the client chooses. The file is renamed <table>_<date>_<time>.<ext>."""
    name = ct.table_name(table)
    original = file.filename or ""
    ext = "." + original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if ext not in settings.allowed_extensions:
        raise HTTPException(400, f"Please upload one of: {', '.join(settings.allowed_extensions)}")
    data = await file.read()
    if not data:
        raise HTTPException(400, "The file is empty.")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"The file is larger than {settings.max_upload_mb} MB.")
    ct.ensure_name(user["client_id"], name, table.strip(), user["email"])
    stored = storage.put_file(user["client_code"], name, f"{name}_{_stamp()}{ext}", data, stamp=False)
    activity.record(user["client_id"], user["user_id"], user["email"], "UPLOAD", f"{name}: {original} -> {stored}")
    return {"uploaded": stored, "table": name}


# ---- table entry (Pro / Elite): type rows in the browser, checked by data type, delivered as one CSV ----
def _entry_table(user: dict, name: str) -> dict:
    if not _grid_allowed(user):
        raise HTTPException(403, "plan_required")
    row = ct.get(user["client_id"], name)
    if not row or not row["ColumnsJson"]:
        raise HTTPException(404, "Unknown table.")
    return row


@router.get("/features")
def features(user: dict = Depends(deps.active_user)):
    return {"data_entry": _grid_allowed(user)}


@router.get("/entry/{table}/lock")
def entry_status(table: str, user: dict = Depends(deps.upload_user)):
    """Who holds the editing slot right now (read only - does not take it)."""
    _entry_table(user, table)
    return entry.current(user["client_id"], table, user["user_id"])


@router.post("/entry/{table}/lock", dependencies=[Depends(deps.require_csrf_header)])
def entry_lock(table: str, user: dict = Depends(deps.upload_user)):
    """Asks for the editing slot (also renews it). If someone else holds it, the caller waits and asks again."""
    _entry_table(user, table)
    before = entry.current(user["client_id"], table, user["user_id"])
    state = entry.acquire(user["client_id"], table, user)
    if state["mine"] and not before["mine"]:
        activity.record(user["client_id"], user["user_id"], user["email"], "GRID_LOCK", f"{table}: started editing")
    return state


@router.post("/entry/{table}/release", dependencies=[Depends(deps.require_csrf_header)])
def entry_release(table: str, force: bool = False, user: dict = Depends(deps.upload_user)):
    _entry_table(user, table)
    if force and not user["permissions"]["admin"]:
        raise HTTPException(403, "forbidden")
    held = entry.release(user["client_id"], table, user["user_id"], force=force)
    if held and force and held["UserEmail"].lower() != user["email"].lower():
        activity.record(user["client_id"], user["user_id"], user["email"], "GRID_TAKEOVER",
                        f"{table}: released the lock of {held['UserEmail']}")
    return {"released": True}


class ColumnDef(BaseModel):
    name: str = Field(..., max_length=80)
    type: str = "text"                    # text | whole | decimal | date | yesno
    decimals: int = 4
    date_format: str | None = None


class TableBody(BaseModel):
    name: str = Field(..., max_length=60)
    columns: list[ColumnDef] = Field(..., max_length=ct.MAX_COLUMNS)


class EntryBody(TableBody):
    rows: list[list[str]] = Field(..., max_length=GRID_MAX_ROWS)


def _may_change(user: dict, name: str, existing) -> bool:
    """A table that already has columns can only be changed by the person who holds its editing slot."""
    if not (existing and existing["ColumnsJson"]):
        return False
    state = entry.current(user["client_id"], name, user["user_id"])
    if not state["mine"]:
        raise HTTPException(409, "lock_required" if state["free"] else "locked_by_other")
    return True


@router.post("/tables", dependencies=[Depends(deps.require_csrf_header)])
def save_table(body: TableBody, user: dict = Depends(deps.upload_user)):
    """Saves a table (name + columns) so it is there next time."""
    if not _grid_allowed(user):
        raise HTTPException(403, "plan_required")
    name = ct.table_name(body.name)
    _may_change(user, name, ct.get(user["client_id"], name))
    mapping = ct.build_mapping([c.model_dump() for c in body.columns])
    ct.save_definition(user["client_id"], name, body.name.strip(), ct.to_defs(mapping), user["email"])
    activity.record(user["client_id"], user["user_id"], user["email"], "TABLE_SAVED", f"{name}: {len(mapping)} columns")
    return {"name": name}


@router.post("/entry", dependencies=[Depends(deps.require_csrf_header)])
def submit_entry(body: EntryBody, user: dict = Depends(deps.upload_user)):
    """Checks the rows by data type, saves the table definition and delivers the rows as <table>_<date>_<time>.csv."""
    if not _grid_allowed(user):
        raise HTTPException(403, "plan_required")
    name = ct.table_name(body.name)
    existing = ct.get(user["client_id"], name)
    held = _may_change(user, name, existing)                 # only the person holding the editing slot may send
    mapping = ct.build_mapping([c.model_dump() for c in body.columns])
    cols = ct.to_checks(mapping)
    rows = [[(c or "").strip() for c in r] for r in body.rows]
    rows = [r for r in rows if any(r)]                      # drop completely empty lines
    if not rows:
        raise HTTPException(400, "There is no data to send yet.")
    if any(len(r) != len(cols) for r in rows):
        raise HTTPException(400, "The rows do not match the columns of the table.")
    errors = entry.validate(cols, rows)                     # column-level validation by data type, checked again here
    if errors:
        activity.record(user["client_id"], user["user_id"], user["email"], "GRID_REJECTED",
                        f"{name}: {len(errors)} validation problem(s) in {len(rows)} rows")
        return JSONResponse(status_code=422, content={"detail": "validation_failed", "errors": errors})
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c["name"] for c in cols])
    w.writerows(rows)
    data = buf.getvalue().encode("utf-8")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"The data is larger than {settings.max_upload_mb} MB.")
    ct.save_definition(user["client_id"], name, body.name.strip(), ct.to_defs(mapping), user["email"])
    stored = storage.put_file(user["client_code"], name, f"{name}_{_stamp()}.csv", data, stamp=False)
    activity.record(user["client_id"], user["user_id"], user["email"], "GRID_SENT", f"{name}: {len(rows)} rows -> {stored}")
    if held:
        entry.release(user["client_id"], name, user["user_id"])   # slot is free for the next person
    return {"uploaded": stored, "table": name, "rows": len(rows)}


@router.get("/entry-history")
def entry_history(user: dict = Depends(deps.upload_user)):
    """Who uploaded or entered what, and when (newest first). The table is the text before the first colon."""
    rows = db.query("SELECT TOP 100 Actor, Action, Detail, At FROM portal.ActivityLog "
                    "WHERE ClientId = ? AND Action IN ('UPLOAD','GRID_SENT','GRID_REJECTED','GRID_TAKEOVER','GRID_LOCK','TABLE_SAVED') "
                    "ORDER BY At DESC", (user["client_id"],))
    return [{"who": r["Actor"], "action": r["Action"], "table": (r["Detail"] or "").split(":", 1)[0],
             "detail": (r["Detail"] or "").split(":", 1)[-1].strip(), "at": r["At"].isoformat() + "Z"} for r in rows]


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

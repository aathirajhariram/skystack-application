import csv
import io
import re

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile

from app import activity, db, deps
from app.config import settings
from app.services import dashboard, storage, visibility

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

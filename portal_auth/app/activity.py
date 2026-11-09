import logging

from app import db

log = logging.getLogger("skystack.activity")


def record(client_id, user_id, actor: str, action: str, detail: str = "") -> None:
    """Audit trail for the client's admin screen. Never breaks the request if logging fails."""
    try:
        db.query("INSERT portal.ActivityLog (ClientId, UserId, Actor, Action, Detail) VALUES (?,?,?,?,?)",
                 (client_id, str(user_id) if user_id else None, actor, action, (detail or "")[:500]))
    except Exception as exc:                       # noqa: BLE001
        log.error("activity log failed: %s", exc)

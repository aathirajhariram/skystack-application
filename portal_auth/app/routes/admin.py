import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

import pyodbc

from app import activity, db, deps, security, vaults
from app.config import settings
from app.services.credentials import issue_one_time_password

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(deps.require_csrf_header)])
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ROLES = {"admin", "uploader", "viewer"}


class UnlockBody(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class NewUser(BaseModel):
    email: str = Field(max_length=200)
    display_name: str = Field(min_length=1, max_length=200)
    role: str = "viewer"


class UserPatch(BaseModel):
    role: Optional[str] = None
    is_enabled: Optional[bool] = None
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=200)


# ---- step-up: the Admin tab is locked until the admin re-enters their password ----------------------
@router.get("/status")
def status(request_user: dict = Depends(deps.active_user)):
    return {"is_admin": request_user["permissions"]["admin"]}


@router.post("/unlock")
def unlock(body: UnlockBody, response: Response, user: dict = Depends(deps.active_user)):
    if not user["permissions"]["admin"]:
        raise HTTPException(403, "forbidden")
    if not security.verify_password(vaults.get_password_hash(user["user_id"]), body.password):
        activity.record(user["client_id"], user["user_id"], user["email"], "ADMIN_UNLOCK_FAILED")
        raise HTTPException(401, "That password is not correct.")
    response.set_cookie(settings.elevated_cookie_name, security.issue_elevated(user["user_id"]), httponly=True,
                        secure=settings.cookie_secure, samesite="lax", max_age=settings.elevated_minutes * 60, path="/")
    return {"unlocked_minutes": settings.elevated_minutes}


@router.post("/lock")
def lock(response: Response, user: dict = Depends(deps.active_user)):
    response.delete_cookie(settings.elevated_cookie_name, path="/")
    return {"ok": True}


# ---- employees --------------------------------------------------------------------------------------
@router.get("/users")
def list_users(admin: dict = Depends(deps.admin_user)):
    rows = db.query("SELECT UserId, Email, DisplayName, Role, IsEnabled, MustChangePassword, LastLoginAt "
                    "FROM portal.PortalUser WHERE ClientId = ? ORDER BY CreatedAt", (admin["client_id"],))
    return [{"id": str(r["UserId"]), "email": r["Email"], "display_name": r["DisplayName"], "role": r["Role"],
             "is_enabled": bool(r["IsEnabled"]), "pending_first_login": bool(r["MustChangePassword"]),
             "last_login_at": r["LastLoginAt"].isoformat() + "Z" if r["LastLoginAt"] else None} for r in rows]


@router.post("/users", status_code=201)
def invite_user(body: NewUser, admin: dict = Depends(deps.admin_user)):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter a valid email address.")
    if body.role not in ROLES:
        raise HTTPException(400, "Unknown role.")
    limit = db.query("SELECT p.MaxUsers, p.Name FROM cfg.Client c JOIN cfg.Plan p ON p.PlanCode = c.PlanCode WHERE c.ClientId = ?",
                     (admin["client_id"],))
    if limit:
        used = db.query("SELECT COUNT(*) AS n FROM portal.PortalUser WHERE ClientId = ?", (admin["client_id"],))[0]["n"]
        if used >= limit[0]["MaxUsers"]:
            raise HTTPException(400, f"Your {limit[0]['Name']} plan includes up to {limit[0]['MaxUsers']} users. Please contact SkyStack to upgrade.")
    try:
        rows = db.query("INSERT portal.PortalUser (ClientId, Email, DisplayName, Role, CreatedBy) "
                        "OUTPUT inserted.UserId VALUES (?,?,?,?,?)",
                        (admin["client_id"], email, body.display_name.strip(), body.role, admin["email"]))
    except pyodbc.IntegrityError:
        raise HTTPException(409, "This email address is already registered.")
    user_id = str(rows[0]["UserId"])
    emailed = issue_one_time_password(user_id, email, body.display_name.strip(), admin["client_name"])
    activity.record(admin["client_id"], user_id, admin["email"], "USER_INVITED", f"{email} as {body.role}")
    return {"id": user_id, "emailed": emailed}


def _target(admin: dict, user_id: str) -> dict:
    rows = db.query("SELECT UserId, Email, DisplayName, Role, IsEnabled FROM portal.PortalUser "
                    "WHERE UserId = ? AND ClientId = ?", (user_id, admin["client_id"]))     # tenant guard
    if not rows:
        raise HTTPException(404, "User not found.")
    return rows[0]


def _would_remove_last_admin(admin: dict, target: dict) -> bool:
    if target["Role"] != "admin" or not target["IsEnabled"]:
        return False
    others = db.query("SELECT COUNT(*) AS n FROM portal.PortalUser WHERE ClientId = ? AND Role = 'admin' "
                      "AND IsEnabled = 1 AND UserId <> ?", (admin["client_id"], str(target["UserId"])))
    return others[0]["n"] == 0


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UserPatch, admin: dict = Depends(deps.admin_user)):
    target = _target(admin, user_id)
    if body.role is not None and body.role not in ROLES:
        raise HTTPException(400, "Unknown role.")
    demoting = body.role is not None and body.role != "admin"
    disabling = body.is_enabled is False
    if (demoting or disabling) and str(target["UserId"]) == admin["user_id"]:
        raise HTTPException(400, "You cannot remove your own admin access or disable yourself.")
    if (demoting or disabling) and _would_remove_last_admin(admin, target):
        raise HTTPException(400, "At least one enabled admin is required.")

    db.query("UPDATE portal.PortalUser SET Role = COALESCE(?, Role), IsEnabled = COALESCE(?, IsEnabled), "
             "DisplayName = COALESCE(?, DisplayName) WHERE UserId = ? AND ClientId = ?",
             (body.role, None if body.is_enabled is None else int(body.is_enabled), body.display_name,
              user_id, admin["client_id"]))
    deps.invalidate(user_id)
    if body.role is not None:
        activity.record(admin["client_id"], user_id, admin["email"], "ROLE_CHANGED", f"{target['Email']} -> {body.role}")
    if body.is_enabled is not None:
        activity.record(admin["client_id"], user_id, admin["email"],
                        "USER_ENABLED" if body.is_enabled else "USER_DISABLED", target["Email"])
    return {"ok": True}


@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: str, admin: dict = Depends(deps.admin_user)):
    """New one-time password by email; the old password stops working immediately."""
    target = _target(admin, user_id)
    emailed = issue_one_time_password(user_id, target["Email"], target["DisplayName"], admin["client_name"])
    deps.invalidate(user_id)
    activity.record(admin["client_id"], user_id, admin["email"], "PASSWORD_RESET", target["Email"])
    return {"emailed": emailed}


@router.get("/activity")
def recent_activity(admin: dict = Depends(deps.admin_user)):
    rows = db.query("SELECT TOP 50 Actor, Action, Detail, At FROM portal.ActivityLog WHERE ClientId = ? "
                    "ORDER BY At DESC", (admin["client_id"],))
    return [{"actor": r["Actor"], "action": r["Action"], "detail": r["Detail"], "at": r["At"].isoformat() + "Z"} for r in rows]


class VisibilityBody(BaseModel):
    hidden: list[str] = []


@router.get("/users/{user_id}/visibility")
def get_visibility(user_id: str, admin: dict = Depends(deps.admin_user)):
    _target(admin, user_id)
    sources = db.query("SELECT SourceName FROM portal.vw_ClientSources WHERE ClientCode = ? ORDER BY SourceName", (admin["client_code"],))
    hidden = {r["SourceName"] for r in db.query(
        "SELECT s.SourceName FROM portal.UserHiddenSource h JOIN cfg.Source s ON s.SourceId = h.SourceId WHERE h.UserId = ?", (user_id,))}
    return [{"source": r["SourceName"], "visible": r["SourceName"] not in hidden} for r in sources]


@router.put("/users/{user_id}/visibility")
def set_visibility(user_id: str, body: VisibilityBody, admin: dict = Depends(deps.admin_user)):
    """Replaces the list of dashboards hidden from this employee. Source names are validated against THIS client's sources."""
    target = _target(admin, user_id)
    valid = {r["SourceName"] for r in db.query("SELECT SourceName FROM portal.vw_ClientSources WHERE ClientCode = ?", (admin["client_code"],))}
    unknown = [h for h in body.hidden if h not in valid]
    if unknown:
        raise HTTPException(400, "Unknown data source.")
    db.query("DELETE FROM portal.UserHiddenSource WHERE UserId = ?", (user_id,))
    for name in body.hidden:
        db.query("INSERT portal.UserHiddenSource (UserId, SourceId) SELECT ?, s.SourceId FROM cfg.Source s "
                 "JOIN cfg.Client c ON c.ClientId = s.ClientId WHERE c.ClientCode = ? AND s.SourceName = ?",
                 (user_id, admin["client_code"], name))
    deps.invalidate(user_id)
    activity.record(admin["client_id"], user_id, admin["email"], "VISIBILITY_CHANGED",
                    f"{target['Email']} hidden: {', '.join(body.hidden) or 'none'}")
    return {"ok": True}

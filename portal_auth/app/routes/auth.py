from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app import activity, db, deps, security, vaults
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


def set_session_cookie(response: Response, user_id: str) -> None:
    response.set_cookie(settings.cookie_name, security.issue_session(user_id), httponly=True,
                        secure=settings.cookie_secure, samesite="lax", max_age=settings.session_minutes * 60, path="/")


@router.post("/login", dependencies=[Depends(deps.require_csrf_header)])
def login(body: LoginBody, response: Response):
    email = body.email.strip().lower()
    rows = db.query("SELECT * FROM portal.vw_UserAccount WHERE Email = ?", (email,))
    user = rows[0] if rows else None
    now = datetime.utcnow()

    if user and user["LockedUntil"] and user["LockedUntil"] > now:
        raise HTTPException(429, "Too many attempts. Please try again later.")

    # password hash comes from Key Vault; verification runs even for unknown users (constant time)
    stored = vaults.get_password_hash(user["UserId"]) if user else None
    if not (user and security.verify_password(stored, body.password)):
        if user:
            db.query("UPDATE portal.PortalUser SET FailedAttempts = FailedAttempts + 1, "
                     "LockedUntil = CASE WHEN FailedAttempts + 1 >= ? THEN DATEADD(MINUTE, ?, SYSUTCDATETIME()) "
                     "ELSE LockedUntil END WHERE UserId = ?",
                     (settings.max_failed_attempts, settings.lockout_minutes, str(user["UserId"])))
        raise HTTPException(401, "Invalid email or password")

    # only after a correct password do we say why access is refused (no account enumeration)
    if not user["IsEnabled"] or not user["ClientActive"]:
        raise HTTPException(403, "This account is disabled. Please contact your administrator.")
    if user["MustChangePassword"] and user["TempPasswordExpiresAt"] and user["TempPasswordExpiresAt"] < now:
        raise HTTPException(403, "Your one-time password has expired. Please ask your administrator for a new one.")

    db.query("UPDATE portal.PortalUser SET FailedAttempts = 0, LockedUntil = NULL, LastLoginAt = SYSUTCDATETIME() "
             "WHERE UserId = ?", (str(user["UserId"]),))
    activity.record(user["ClientId"], user["UserId"], user["Email"], "LOGIN")
    set_session_cookie(response, str(user["UserId"]))
    return {"redirect": f"/portal/{user['ClientCode']}", "must_change_password": bool(user["MustChangePassword"])}


@router.get("/me")
def me(user: dict = Depends(deps.current_user)):
    return {"client_code": user["client_code"], "client_name": user["client_name"], "email": user["email"],
            "display_name": user["name"], "role": user["role"], "permissions": user["permissions"],
            "must_change_password": user["must_change_password"]}


@router.post("/logout", dependencies=[Depends(deps.require_csrf_header)])
def logout(response: Response):
    response.delete_cookie(settings.cookie_name, path="/")
    response.delete_cookie(settings.elevated_cookie_name, path="/")
    return {"ok": True}

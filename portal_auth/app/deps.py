"""Who is calling, and may they? The token only says WHO; role/enabled/client status are read from the
database (cached ~20 s) so disabling a user or a client takes effect almost immediately."""
import time
from typing import Dict, Tuple

import jwt
from fastapi import Depends, Header, HTTPException, Request

from app import db, security
from app.config import settings

_CACHE: Dict[str, Tuple[float, dict]] = {}
_TTL = 20.0

PERMISSIONS = {
    "admin": {"view": True, "upload": True, "admin": True},
    "uploader": {"view": True, "upload": True, "admin": False},
    "viewer": {"view": True, "upload": False, "admin": False},
}


def invalidate(user_id: str) -> None:
    _CACHE.pop(str(user_id), None)


def _load(user_id: str):
    hit = _CACHE.get(user_id)
    if hit and hit[0] > time.time():
        return hit[1]
    rows = db.query("SELECT * FROM portal.vw_UserAccount WHERE UserId = ?", (user_id,))
    row = rows[0] if rows else None
    _CACHE[user_id] = (time.time() + _TTL, row)
    return row


def current_user(request: Request) -> dict:
    token = request.cookies.get(settings.cookie_name)
    if not token:
        raise HTTPException(401, "not_signed_in")
    try:
        user_id = security.decode(token, "session")["sub"]
    except jwt.PyJWTError:
        raise HTTPException(401, "session_expired")
    row = _load(user_id)
    if not row or not row["IsEnabled"] or not row["ClientActive"]:
        raise HTTPException(401, "account_disabled")
    return {"user_id": str(row["UserId"]), "client_id": row["ClientId"], "client_code": row["ClientCode"],
            "client_name": row["ClientName"], "email": row["Email"], "name": row["DisplayName"],
            "role": row["Role"], "must_change_password": bool(row["MustChangePassword"]),
            "permissions": PERMISSIONS[row["Role"]]}


def active_user(user: dict = Depends(current_user)) -> dict:
    """Signed in AND past the forced first-login password change."""
    if user["must_change_password"]:
        raise HTTPException(403, "password_change_required")
    return user


def upload_user(user: dict = Depends(active_user)) -> dict:
    if not user["permissions"]["upload"]:
        raise HTTPException(403, "forbidden")
    return user


def admin_user(request: Request, user: dict = Depends(active_user)) -> dict:
    """Admin role + a fresh password re-entry (step-up) within the last few minutes."""
    if not user["permissions"]["admin"]:
        raise HTTPException(403, "forbidden")
    token = request.cookies.get(settings.elevated_cookie_name)
    try:
        if not token or security.decode(token, "elevated")["sub"] != user["user_id"]:
            raise HTTPException(403, "elevation_required")
    except jwt.PyJWTError:
        raise HTTPException(403, "elevation_required")
    return user


def require_csrf_header(x_requested_with: str = Header(default="")) -> None:
    if x_requested_with != "skystack":
        raise HTTPException(403, "csrf")

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app import activity, db, deps, security, vaults
from app.routes.auth import set_session_cookie

router = APIRouter(prefix="/account", tags=["account"], dependencies=[Depends(deps.require_csrf_header)])


class ChangePasswordBody(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=1, max_length=200)


@router.post("/password")
def change_password(body: ChangePasswordBody, response: Response, user: dict = Depends(deps.current_user)):
    """Works for the forced first-login change (one-time password) and for later voluntary changes.
    The new hash becomes a new version of the user's secret in Key Vault."""
    stored = vaults.get_password_hash(user["user_id"])
    if not security.verify_password(stored, body.current_password):
        raise HTTPException(400, "Your current password is not correct.")
    if body.new_password == body.current_password:
        raise HTTPException(400, "Choose a password you have not used just now.")
    problem = security.policy_error(body.new_password, user["email"])
    if problem:
        raise HTTPException(400, problem)

    vaults.set_password_hash(user["user_id"], security.hash_password(body.new_password))
    db.query("UPDATE portal.PortalUser SET MustChangePassword = 0, TempPasswordExpiresAt = NULL WHERE UserId = ?",
             (user["user_id"],))
    deps.invalidate(user["user_id"])
    activity.record(user["client_id"], user["user_id"], user["email"], "PASSWORD_CHANGED")
    set_session_cookie(response, user["user_id"])               # fresh session after the change
    return {"ok": True}

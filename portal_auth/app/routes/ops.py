"""Internal Ops API for SkyStack staff (Entra ID app role Platform.Admin). Deployed separately."""
import logging
import re

import pyodbc
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import activity, db
from app.entra import require_platform_admin
from app.services import onboarding
from app.services.credentials import issue_one_time_password

log = logging.getLogger("skystack.ops")
router = APIRouter(prefix="/ops", tags=["ops"])
INDUSTRIES = ["logistics", "manufacturing", "real_estate", "construction", "marketing", "legal"]
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Subscribe(BaseModel):
    company_name: str = Field(min_length=2, max_length=200)
    industry: str
    admin_email: str = Field(max_length=200)
    admin_name: str = Field(min_length=2, max_length=200)
    plan: str | None = None


class ActiveBody(BaseModel):
    is_active: bool


@router.get("/industries")
def industries(_: dict = Depends(require_platform_admin)):
    return INDUSTRIES


@router.post("/clients", status_code=201)
def subscribe_client(body: Subscribe, ops: dict = Depends(require_platform_admin)):
    """Manual subscription by staff (e.g. after an invoice/bank-transfer deal). Self-service signups go through payment instead."""
    if body.industry not in INDUSTRIES:
        raise HTTPException(400, "Unknown industry.")
    if not EMAIL_RE.match(body.admin_email.strip()):
        raise HTTPException(400, "Enter a valid admin email.")
    try:
        return onboarding.onboard(body.company_name, body.industry, body.admin_email, body.admin_name, body.plan, ops["actor"])
    except onboarding.OnboardingError as exc:
        raise HTTPException(409, str(exc))


@router.get("/subscriptions")
def list_subscriptions(_: dict = Depends(require_platform_admin)):
    rows = db.query("SELECT TOP 100 RequestId, CompanyName, Email, PlanCode, Status, ClientCode, LastError, CreatedAt, PaidAt "
                    "FROM portal.SubscriptionRequest ORDER BY CreatedAt DESC")
    return [{"id": str(r["RequestId"]), "company": r["CompanyName"], "email": r["Email"], "plan": r["PlanCode"],
             "status": r["Status"], "client_code": r["ClientCode"], "last_error": r["LastError"],
             "created_at": r["CreatedAt"].isoformat() + "Z"} for r in rows]


@router.post("/subscriptions/{request_id}/retry")
def retry_activation(request_id: str, _: dict = Depends(require_platform_admin)):
    """Re-queue a failed activation; the worker picks it up within seconds."""
    rows = db.query("UPDATE portal.SubscriptionRequest SET Status = 'PAID', LastError = NULL "
                    "OUTPUT inserted.RequestId WHERE RequestId = ? AND Status = 'ACTIVATION_FAILED'", (request_id,))
    if not rows:
        raise HTTPException(404, "No failed activation with that id.")
    return {"ok": True}


@router.get("/clients")
def list_clients(_: dict = Depends(require_platform_admin)):
    rows = db.query(
        "SELECT c.ClientCode, c.ClientName, c.Industry, c.IsActive, c.CreatedAt, "
        "(SELECT COUNT(*) FROM portal.PortalUser u WHERE u.ClientId = c.ClientId) AS Users, "
        "(SELECT MAX(r.EndedAt) FROM audit.vw_RunSummary r WHERE r.ClientCode = c.ClientCode "
        " AND r.Status IN ('SUCCESS','WARNING')) AS LastProcessed "
        "FROM cfg.Client c ORDER BY c.CreatedAt DESC")
    return [{"client_code": r["ClientCode"], "name": r["ClientName"], "industry": r["Industry"],
             "is_active": bool(r["IsActive"]), "users": r["Users"],
             "created_at": r["CreatedAt"].isoformat() + "Z",
             "last_processed_at": r["LastProcessed"].isoformat() + "Z" if r["LastProcessed"] else None} for r in rows]


@router.post("/clients/{client_code}/active")
def set_active(client_code: str, body: ActiveBody, ops: dict = Depends(require_platform_admin)):
    """Switches a whole client on/off: portal sign-in and scheduled processing both stop."""
    try:
        db.query("EXEC cfg.usp_SetClientActive ?,?,?", (client_code, int(body.is_active), ops["actor"]))
    except pyodbc.Error:
        raise HTTPException(404, "Client not found.")
    return {"ok": True}


@router.post("/clients/{client_code}/resend-otp")
def resend_otp(client_code: str, ops: dict = Depends(require_platform_admin)):
    rows = db.query("SELECT TOP 1 u.UserId, u.Email, u.DisplayName, c.ClientName, c.ClientId FROM portal.PortalUser u "
                    "JOIN cfg.Client c ON c.ClientId = u.ClientId WHERE c.ClientCode = ? AND u.Role = 'admin' "
                    "ORDER BY u.CreatedAt", (client_code,))
    if not rows:
        raise HTTPException(404, "Client not found.")
    r = rows[0]
    emailed = issue_one_time_password(str(r["UserId"]), r["Email"], r["DisplayName"], r["ClientName"])
    activity.record(r["ClientId"], r["UserId"], ops["actor"], "PASSWORD_RESET", r["Email"])
    return {"emailed": emailed}

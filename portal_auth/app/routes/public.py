"""Endpoints for visitors who are NOT signed in: pricing popup, subscribe, Stripe webhook."""
import json
import logging
import re
import time

import stripe
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app import db, deps, mailer, ratelimit
from app.config import settings
from app.services import billing

log = logging.getLogger("skystack.public")
router = APIRouter(prefix="/public", tags=["public"])
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
INDUSTRIES = ["logistics", "manufacturing", "real_estate", "construction", "marketing", "legal"]


class SubscribeBody(BaseModel):
    company_name: str = Field(min_length=2, max_length=200)
    contact_name: str = Field(min_length=2, max_length=200)
    email: str = Field(max_length=200)
    industry: str
    plan: str = Field(max_length=20)
    website: str = ""                      # honeypot: real visitors never fill this hidden field


_PLANS_CACHE = {"data": None, "at": 0.0}


@router.get("/plans")
def plans(response: Response):
    response.headers["Cache-Control"] = "public, max-age=300"
    if _PLANS_CACHE["data"] is not None and time.time() - _PLANS_CACHE["at"] < 300:
        return _PLANS_CACHE["data"]
    rows = db.query("SELECT * FROM portal.vw_Plan ORDER BY DisplayOrder")
    data = [{"code": r["PlanCode"], "name": r["Name"], "price": float(r["PriceMonthly"]), "currency": r["Currency"],
             "tagline": r["Tagline"], "features": json.loads(r["Features"]), "popular": bool(r["IsPopular"])} for r in rows]
    _PLANS_CACHE.update(data=data, at=time.time())
    return data


@router.get("/industries")
def industries():
    return INDUSTRIES


@router.post("/subscribe", dependencies=[Depends(deps.require_csrf_header)])
def subscribe(body: SubscribeBody, request: Request, bg: BackgroundTasks):
    """1) store the request  2) e-mail SkyStack with the customer's login details  3) e-mail the customer a payment link.
    The reply is identical whether or not the e-mail already has an account (no account enumeration)."""
    email = body.email.strip().lower()
    ip = request.client.host if request.client else "unknown"
    if not (ratelimit.allow(f"ip:{ip}", settings.subscribe_per_ip_per_hour)
            and ratelimit.allow(f"mail:{email}", settings.subscribe_per_email_per_hour)):
        raise HTTPException(429, "Too many requests. Please try again later.")
    if body.website:                                       # bot filled the honeypot: pretend success
        return {"ok": True}
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter a valid email address.")
    if body.industry not in INDUSTRIES:
        raise HTTPException(400, "Please choose your industry.")
    plan_rows = db.query("SELECT * FROM portal.vw_Plan WHERE PlanCode = ?", (body.plan,))
    if not plan_rows:
        raise HTTPException(400, "Please choose a plan.")
    plan = plan_rows[0]

    if db.query("SELECT 1 AS x FROM portal.PortalUser WHERE Email = ?", (email,)):
        bg.add_task(mailer.notify_business, "Subscription attempt by an existing user", [f"{email} tried to subscribe but already has an account."])
        return {"ok": True}

    # re-submitting while a payment is pending re-uses the request and sends a fresh link (links expire after 24 h)
    pending = db.query("SELECT TOP 1 RequestId FROM portal.SubscriptionRequest WHERE Email = ? AND Status = 'PENDING_PAYMENT' "
                       "ORDER BY CreatedAt DESC", (email,))
    if pending:
        request_id = str(pending[0]["RequestId"])
        db.query("UPDATE portal.SubscriptionRequest SET CompanyName=?, ContactName=?, Industry=?, PlanCode=? WHERE RequestId=?",
                 (body.company_name.strip(), body.contact_name.strip(), body.industry, body.plan, request_id))
    else:
        request_id = str(db.query(
            "INSERT portal.SubscriptionRequest (Email, ContactName, CompanyName, Industry, PlanCode) OUTPUT inserted.RequestId "
            "VALUES (?,?,?,?,?)", (email, body.contact_name.strip(), body.company_name.strip(), body.industry, body.plan))[0]["RequestId"])

    bg.add_task(mailer.notify_business, f"New subscription request: {body.company_name.strip()} ({plan['Name']})", [
        "A visitor requested a subscription.",
        f"Login e-mail (user id): {email}",
        f"Contact: {body.contact_name.strip()}", f"Company: {body.company_name.strip()}",
        f"Industry: {body.industry}", f"Plan: {plan['Name']} - {plan['Currency']} {float(plan['PriceMonthly']):,.2f} / month",
        f"Request id: {request_id}",
        "A payment link was sent to the customer automatically. The workspace and one-time password are created only after payment."])
    try:
        checkout = billing.create_checkout(request_id, email, plan)
        db.query("UPDATE portal.SubscriptionRequest SET PaymentRef = ? WHERE RequestId = ?", (checkout["session_id"], request_id))
        mailer.send_payment_link(email, body.contact_name.strip(), plan["Name"], plan["PriceMonthly"], plan["Currency"], checkout["url"])
    except Exception:                                      # noqa: BLE001
        log.exception("could not create/send payment link for %s", request_id)
        mailer.notify_business("Payment link FAILED - follow up manually", [f"Request {request_id} / {email}: the payment link could not be created or sent."])
        raise HTTPException(502, "We could not send your payment link. Our team has been notified and will contact you.")
    return {"ok": True}


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    try:
        event = billing.parse_webhook(payload, request.headers.get("stripe-signature", ""))
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(400, "invalid_signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        request_id = (session.get("metadata") or {}).get("request_id")
        if request_id and session.get("payment_status") == "paid":
            # only the first delivery flips the status; Stripe may retry the same event
            rows = db.query("UPDATE portal.SubscriptionRequest SET Status='PAID', PaidAt=SYSUTCDATETIME(), PaymentRef=? "
                            "OUTPUT inserted.Email, inserted.CompanyName, inserted.PlanCode "
                            "WHERE RequestId=? AND Status='PENDING_PAYMENT'", (session.get("id"), request_id))
            if rows:
                r = rows[0]
                mailer.notify_business(f"Payment received: {r['CompanyName']} ({r['PlanCode']})",
                                       [f"{r['Email']} paid for the {r['PlanCode']} plan.", f"Request id: {request_id}",
                                        "The workspace is being created and the one-time password will be emailed automatically."])
    return {"received": True}

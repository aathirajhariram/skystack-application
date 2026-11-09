"""Activation worker (runs in the internal OPS deployment, privileged identity):
    python -m app.worker
Picks up PAID subscription requests, creates the workspace and e-mails the one-time password."""
import logging
import time

from app import db, mailer
from app.config import settings
from app.services import onboarding

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("skystack.worker")


def activate_next() -> bool:
    # claim one PAID request atomically so two workers never process the same one
    rows = db.query("UPDATE TOP (1) portal.SubscriptionRequest SET Status = 'ACTIVATING' "
                    "OUTPUT inserted.RequestId, inserted.Email, inserted.ContactName, inserted.CompanyName, "
                    "inserted.Industry, inserted.PlanCode WHERE Status = 'PAID'")
    if not rows:
        return False
    r = rows[0]
    rid = str(r["RequestId"])
    try:
        out = onboarding.onboard(r["CompanyName"], r["Industry"], r["Email"], r["ContactName"], r["PlanCode"], f"payment:{rid}")
        db.query("UPDATE portal.SubscriptionRequest SET Status='ACTIVATED', ActivatedAt=SYSUTCDATETIME(), ClientCode=?, LastError=NULL "
                 "WHERE RequestId=?", (out["client_code"], rid))
        mailer.notify_business(f"Workspace activated: {r['CompanyName']}", [
            f"Client code: {out['client_code']}", f"Admin: {out['admin_email']}",
            "One-time password emailed." if out["emailed"] else "WARNING: the one-time password email failed - use Ops > Resend password.",
            "Next step: schedule the discovery call, collect sample data and finalise this client's cfg.* configuration."])
    except Exception as exc:                                   # noqa: BLE001
        log.exception("activation failed for %s", rid)
        db.query("UPDATE portal.SubscriptionRequest SET Status='ACTIVATION_FAILED', LastError=? WHERE RequestId=?",
                 (str(exc)[:480], rid))
        mailer.notify_business(f"ACTIVATION FAILED: {r['CompanyName']}", [
            f"Request {rid} ({r['Email']}) is PAID but the workspace could not be created.", f"Reason: {str(exc)[:300]}",
            "Fix the cause, then use Ops > Subscriptions > Retry."])
    return True


def main() -> None:
    log.info("activation worker started")
    while True:
        try:
            while activate_next():
                pass
        except Exception:                                      # noqa: BLE001
            log.exception("worker loop error")
        time.sleep(settings.worker_interval_seconds)


if __name__ == "__main__":
    main()

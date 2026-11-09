"""Creates a complete client workspace. Used by the Ops console AND by the activation worker after payment.
Needs the privileged Ops identity (database creation, Key Vault write)."""
import logging
import re

import pyodbc

from app import db
from app.services import provisioning, storage
from app.services.credentials import issue_one_time_password

log = logging.getLogger("skystack.onboarding")


class OnboardingError(Exception):
    pass


def _slug(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:26] or "client"
    code, n = base, 1
    while db.query("SELECT 1 AS x FROM cfg.Client WHERE ClientCode = ?", (code,)):
        n += 1
        code = f"{base[:26]}-{n}"
    return code


def onboard(company: str, industry: str, admin_email: str, admin_name: str, plan_code: str | None, actor: str) -> dict:
    email = admin_email.strip().lower()
    if db.query("SELECT 1 AS x FROM portal.PortalUser WHERE Email = ?", (email,)):
        raise OnboardingError("This email is already registered.")

    code = _slug(company)
    target = provisioning.provision_client_database(code)
    try:
        rows = db.query("EXEC cfg.usp_OnboardClient ?,?,?,?,?,?,?,?,?,?",
                        (code, company.strip(), industry, email, admin_name.strip(),
                         target["server"], target["database"], target["etl_secret"], actor, plan_code))
    except pyodbc.Error as exc:
        log.error("onboarding failed for %s: %s", code, exc)
        raise OnboardingError("Onboarding failed; nothing was activated. The client database may need manual clean-up.")
    user_id = str(rows[0]["UserId"])

    sources = [r["SourceName"] for r in db.query(
        "SELECT SourceName FROM portal.vw_ClientSources WHERE ClientCode = ?", (code,))]
    try:
        storage.ensure_folders(code, sources)
    except Exception as exc:                                  # noqa: BLE001 - uploads create folders anyway
        log.warning("could not pre-create folders for %s: %s", code, exc)

    emailed = issue_one_time_password(user_id, email, admin_name.strip(), company.strip())
    return {"client_code": code, "admin_email": email, "emailed": emailed, "sources": sources, "user_id": user_id}

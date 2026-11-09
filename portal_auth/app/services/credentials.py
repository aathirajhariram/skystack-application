"""One-time passwords: used when a client is subscribed, when an admin invites someone, and on reset."""
import logging
import secrets

from app import db, mailer, security, vaults
from app.config import settings

log = logging.getLogger("skystack.credentials")
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"        # no 0/O/1/I to avoid typing mistakes


def generate_one_time_password() -> str:
    raw = "".join(secrets.choice(_ALPHABET) for _ in range(16))
    return "-".join(raw[i:i + 4] for i in range(0, 16, 4))


def issue_one_time_password(user_id: str, email: str, name: str, client_name: str) -> bool:
    """Stores the OTP hash in Key Vault, forces a password change, e-mails the OTP. Returns True if e-mailed.
    The OTP itself is never stored or returned anywhere else."""
    otp = generate_one_time_password()
    vaults.set_password_hash(user_id, security.hash_password(otp))
    db.query("UPDATE portal.PortalUser SET MustChangePassword = 1, FailedAttempts = 0, LockedUntil = NULL, "
             "TempPasswordExpiresAt = DATEADD(HOUR, ?, SYSUTCDATETIME()) WHERE UserId = ?",
             (settings.otp_valid_hours, str(user_id)))
    try:
        mailer.send_one_time_password(email, name, client_name, otp)
        return True
    except Exception as exc:                              # noqa: BLE001
        log.error("could not e-mail one-time password to %s: %s", email, exc)
        return False

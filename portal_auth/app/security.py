import re
import time
import uuid

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import settings
from app.vaults import jwt_key

_hasher = PasswordHasher()
_DUMMY_HASH = _hasher.hash("dummy-password-for-constant-time")     # checked when the user does not exist


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(stored_hash, password: str) -> bool:
    try:
        _hasher.verify(stored_hash or _DUMMY_HASH, password)
        return stored_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def policy_error(password: str, email: str = "") -> str | None:
    """Returns a human-readable reason if the password is too weak, else None."""
    if len(password) < settings.min_password_length:
        return f"Use at least {settings.min_password_length} characters."
    if len(password) > 128:
        return "Use at most 128 characters."
    classes = sum(bool(re.search(p, password)) for p in (r"[a-z]", r"[A-Z]", r"\d", r"[^A-Za-z0-9]"))
    if classes < 3:
        return "Mix at least three of: lowercase, uppercase, numbers, symbols."
    local = email.split("@")[0].lower()
    if len(local) >= 4 and local in password.lower():
        return "The password must not contain your email name."
    return None


def _issue(typ: str, user_id: str, minutes: int) -> str:
    now = int(time.time())
    return jwt.encode({"iss": settings.jwt_issuer, "typ": typ, "sub": str(user_id), "iat": now,
                       "exp": now + minutes * 60, "jti": str(uuid.uuid4())}, jwt_key(), algorithm="HS256")


def issue_session(user_id: str) -> str:
    return _issue("session", user_id, settings.session_minutes)


def issue_elevated(user_id: str) -> str:
    return _issue("elevated", user_id, settings.elevated_minutes)


def decode(token: str, typ: str) -> dict:
    payload = jwt.decode(token, jwt_key(), algorithms=["HS256"], issuer=settings.jwt_issuer)
    if payload.get("typ") != typ:
        raise jwt.InvalidTokenError("wrong token type")
    return payload

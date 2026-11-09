"""SkyStack staff authenticate with Microsoft Entra ID. Access is an Entra APP ROLE (Platform.Admin),
assigned in Azure to named people/groups - that is the Azure RBAC for the Ops side."""
from functools import lru_cache

import jwt
from fastapi import Header, HTTPException
from jwt import PyJWKClient

from app.config import settings


@lru_cache(maxsize=1)
def _jwks() -> PyJWKClient:
    return PyJWKClient(f"https://login.microsoftonline.com/{settings.entra_tenant_id}/discovery/v2.0/keys")


def require_platform_admin(authorization: str = Header(default="")) -> dict:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "missing_token")
    try:
        key = _jwks().get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["RS256"], audience=settings.entra_audience,
                            issuer=f"https://login.microsoftonline.com/{settings.entra_tenant_id}/v2.0")
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid_token")
    if settings.ops_required_role not in claims.get("roles", []):
        raise HTTPException(403, "forbidden")
    return {"actor": claims.get("preferred_username") or claims.get("oid", "ops")}

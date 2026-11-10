"""SkyStack staff authenticate with Microsoft Entra ID. Access is an Entra APP ROLE (Platform.Admin),
assigned in Azure to named people/groups - that is the Azure RBAC for the Ops side."""
import logging
from functools import lru_cache

import jwt
from fastapi import Header, HTTPException
from jwt import PyJWKClient

from app.config import settings

log = logging.getLogger("entra")


@lru_cache(maxsize=1)
def _jwks() -> PyJWKClient:
    return PyJWKClient(f"https://login.microsoftonline.com/{settings.entra_tenant_id}/discovery/v2.0/keys")


def require_platform_admin(authorization: str = Header(default="")) -> dict:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "missing_token")
    try:
        key = _jwks().get_signing_key_from_jwt(token).key
        # Entra issues v1 or v2 tokens depending on the app's accessTokenAcceptedVersion: v2 tokens carry the client id
        # as audience and the login.microsoftonline.com issuer, v1 tokens carry the api:// URI and the sts.windows.net issuer.
        aud = settings.entra_audience
        audiences = [aud, aud.removeprefix("api://")] if aud.startswith("api://") else [aud, f"api://{aud}"]
        issuers = [f"https://login.microsoftonline.com/{settings.entra_tenant_id}/v2.0",
                   f"https://sts.windows.net/{settings.entra_tenant_id}/"]
        claims = jwt.decode(token, key, algorithms=["RS256"], audience=audiences, issuer=issuers)
    except Exception as exc:                               # noqa: BLE001
        log.warning("Entra token rejected: %s: %s", type(exc).__name__, exc)
        raise HTTPException(401, f"invalid_token [{type(exc).__name__}: {str(exc)[:160]}] aud={settings.entra_audience[:8]}.. tenant={settings.entra_tenant_id[:8]}.. v2")
    if settings.ops_required_role not in claims.get("roles", []):
        raise HTTPException(403, "forbidden")
    return {"actor": claims.get("preferred_username") or claims.get("oid", "ops")}

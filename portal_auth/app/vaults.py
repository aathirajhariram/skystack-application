"""Two Key Vaults on purpose:
  VIEWERS vault    - every portal user's password hash (secret "pw-<UserId>"). Written when a user sets/changes a password.
  DEVELOPERS vault - platform secrets only developers manage: JWT key, SMTP, Stripe keys, client DB credentials, API ids."""
import json
from functools import lru_cache
from typing import Optional

from azure.core.exceptions import ResourceNotFoundError
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

from app.config import settings


@lru_cache(maxsize=1)
def _viewers() -> SecretClient:
    return SecretClient(settings.viewers_vault_url, DefaultAzureCredential())


@lru_cache(maxsize=1)
def _developers() -> SecretClient:
    return SecretClient(settings.developers_vault_url, DefaultAzureCredential())


def _pw_name(user_id: str) -> str:
    return f"pw-{user_id}"


def get_password_hash(user_id: str) -> Optional[str]:
    try:
        return _viewers().get_secret(_pw_name(str(user_id))).value
    except ResourceNotFoundError:
        return None


def set_password_hash(user_id: str, password_hash: str) -> None:
    """Every change creates a new secret VERSION in Key Vault, so there is a full history."""
    _viewers().set_secret(_pw_name(str(user_id)), password_hash, content_type="text/plain",
                        tags={"type": "portal-password-hash"})


@lru_cache(maxsize=1)
def jwt_key() -> str:
    return _developers().get_secret(settings.jwt_secret_name).value


@lru_cache(maxsize=16)
def developer_secret(name: str) -> str:
    return _developers().get_secret(name).value


def set_developer_secret(name: str, value: str) -> None:        # Ops service only (needs Secrets Officer)
    _developers().set_secret(name, value, content_type="application/json")

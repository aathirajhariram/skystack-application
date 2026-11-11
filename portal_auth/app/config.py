from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SKY_")

    # Key Vaults (two on purpose: the API may WRITE password hashes, but only READ platform secrets)
    viewers_vault_url: str
    developers_vault_url: str
    jwt_secret_name: str = "portal-jwt-signing-key"

    control_db_server: str
    control_db_name: str = "skystack_control"

    storage_account: str
    landing_container: str = "landing"

    portal_base_url: str = "https://www.skystack.global"
    cors_origins: List[str] = ["https://www.skystack.global"]
    cookie_secure: bool = True
    cookie_name: str = "sky_session"
    elevated_cookie_name: str = "sky_admin"
    jwt_issuer: str = "skystack-portal"
    session_minutes: int = 30
    elevated_minutes: int = 10

    otp_valid_hours: int = 72
    min_password_length: int = 12
    max_failed_attempts: int = 5
    lockout_minutes: int = 15

    max_upload_mb: int = 50
    allowed_extensions: List[str] = [".csv", ".xlsx", ".json", ".txt"]

    # ---- In-portal assistant (Claude) ----
    anthropic_secret_name: str = "anthropic-api-key"          # secret in the DEVELOPERS vault
    assistant_model: str = "claude-sonnet-5-5"
    assistant_max_tokens: int = 700
    assistant_per_user_per_hour: int = 30

    # ---- Subscriptions & payment ----
    business_email: str = ""                       # SkyStack inbox that is notified of requests, payments, failures
    stripe_secret_name: str = "stripe-secret-key"            # secret names in the DEVELOPERS vault
    stripe_webhook_secret_name: str = "stripe-webhook-secret"
    subscribe_per_ip_per_hour: int = 6
    subscribe_per_email_per_hour: int = 3
    worker_interval_seconds: int = 30

    # ---- Ops service (internal) ----
    enable_ops: bool = False
    entra_tenant_id: str = ""
    entra_audience: str = ""
    ops_required_role: str = "Platform.Admin"
    provision_db: bool = False
    subscription_id: str = ""
    resource_group: str = ""
    azure_location: str = "westeurope"
    target_sql_server_name: str = ""
    target_sql_server_fqdn: str = ""
    db_sku_name: str = "S0"
    db_sku_tier: str = "Standard"
    api_identity_name: str = ""
    dev_target_database: str = ""
    dev_etl_secret_name: str = ""


settings = Settings()

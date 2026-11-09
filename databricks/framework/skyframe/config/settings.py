"""Platform-level settings. Client-specific settings live in the control DB, not here."""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # Databricks secret scope backed by Azure Key Vault
    secret_scope: str = os.getenv("SKY_SECRET_SCOPE", "skystack-kv")

    # ADLS Gen2
    storage_account: str = os.getenv("SKY_STORAGE_ACCOUNT", "<storage-account>")
    landing_container: str = "landing"
    archive_container: str = "archive"      # processed files + rejected files
    bronze_container: str = "bronze"
    silver_container: str = "silver"        # also holds quarantine (rejected rows)
    gold_container: str = "gold"            # used by DELTA targets

    # Control DB (Azure SQL) - credentials are read from Key Vault, never hard-coded
    control_db_server: str = os.getenv("SKY_CONTROL_DB_SERVER", "<server>.database.windows.net")
    control_db_name: str = os.getenv("SKY_CONTROL_DB_NAME", "skystack_control")
    control_db_user_secret: str = "control-db-user"
    control_db_password_secret: str = "control-db-password"

    # Alert e-mail (SMTP credentials are Key Vault secrets)
    smtp_host_secret: str = "smtp-host"
    smtp_port_secret: str = "smtp-port"
    smtp_user_secret: str = "smtp-user"
    smtp_password_secret: str = "smtp-password"
    smtp_from_secret: str = "smtp-from"


settings = Settings()

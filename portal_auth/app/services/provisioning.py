"""Creates the client's own Azure SQL database. Runs ONLY in the internal Ops deployment, whose managed
identity is (a) Contributor on the SQL server's resource group, (b) Entra admin of the SQL server,
(c) Key Vault Secrets Officer on the platform vault. The customer-facing API never has these rights."""
import json
import re
import secrets
import string

from azure.identity import DefaultAzureCredential

from app import db, vaults
from app.config import settings

_SAFE = re.compile(r"^[a-z0-9][a-z0-9-]{1,29}$")


def provision_client_database(client_code: str) -> dict:
    """Returns {"server", "database", "etl_secret"} for cfg.TargetConnection."""
    if not _SAFE.match(client_code):
        raise ValueError("invalid client code")
    if not settings.provision_db:                          # dev / shared test database
        return {"server": settings.target_sql_server_fqdn, "database": settings.dev_target_database,
                "etl_secret": settings.dev_etl_secret_name}

    from azure.mgmt.sql import SqlManagementClient         # imported lazily: only Ops needs it

    database = f"cl-{client_code}"
    SqlManagementClient(DefaultAzureCredential(), settings.subscription_id).databases.begin_create_or_update(
        settings.resource_group, settings.target_sql_server_name, database,
        {"location": settings.azure_location, "sku": {"name": settings.db_sku_name, "tier": settings.db_sku_tier}},
    ).result()

    etl_user = "etl_" + client_code.replace("-", "_")
    etl_password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(40))
    statements = [
        # the customer API reads dashboards with its own identity - read-only
        f"CREATE USER [{settings.api_identity_name}] FROM EXTERNAL PROVIDER",
        f"ALTER ROLE db_datareader ADD MEMBER [{settings.api_identity_name}]",
        # Databricks writes with a dedicated SQL user (password only lives in Key Vault)
        f"CREATE USER [{etl_user}] WITH PASSWORD = '{etl_password}'",
        f"ALTER ROLE db_datareader ADD MEMBER [{etl_user}]",
        f"ALTER ROLE db_datawriter ADD MEMBER [{etl_user}]",
        f"ALTER ROLE db_ddladmin ADD MEMBER [{etl_user}]",
    ]
    with db.connect(settings.target_sql_server_fqdn, database) as conn:
        cur = conn.cursor()
        for sql in statements:
            cur.execute(sql)

    secret_name = f"target-{client_code}-sql"
    vaults.set_developer_secret(secret_name, json.dumps({"user": etl_user, "password": etl_password}))
    return {"server": settings.target_sql_server_fqdn, "database": database, "etl_secret": secret_name}

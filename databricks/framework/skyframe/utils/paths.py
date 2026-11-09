"""One place that knows how ADLS paths are laid out: <container>/<client>/<source>/..."""
from datetime import datetime

from skyframe.config.settings import settings


def abfss(container: str, *parts: str) -> str:
    tail = "/".join(p.strip("/") for p in parts if p)
    return f"abfss://{container}@{settings.storage_account}.dfs.core.windows.net/{tail}"


def landing_path(client: str, source: str) -> str:
    return abfss(settings.landing_container, client, source)


def bronze_path(client: str, source: str) -> str:
    return abfss(settings.bronze_container, client, source)


def silver_path(client: str, source: str) -> str:
    return abfss(settings.silver_container, client, source)


def quarantine_path(client: str, source: str) -> str:
    return abfss(settings.silver_container, "_quarantine", client, source)


def gold_path(client: str, table: str) -> str:
    return abfss(settings.gold_container, client, table)


def archive_path(client: str, source: str, file_name: str, rejected: bool = False) -> str:
    bucket = "rejected" if rejected else "processed"
    return abfss(settings.archive_container, bucket, client, source,
                 datetime.utcnow().strftime("%Y/%m/%d"), file_name)

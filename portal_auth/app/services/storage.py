"""ADLS Gen2 landing zone: landing/<client>/<source>/ - exactly where the ADF pipelines look."""
from datetime import datetime
from functools import lru_cache
from typing import Iterable

from azure.identity import DefaultAzureCredential
from azure.storage.filedatalake import DataLakeServiceClient

from app.config import settings


@lru_cache(maxsize=1)
def _landing():
    service = DataLakeServiceClient(f"https://{settings.storage_account}.dfs.core.windows.net", DefaultAzureCredential())
    return service.get_file_system_client(settings.landing_container)


def put_file(client_code: str, source: str, safe_name: str, data: bytes) -> str:
    stamped = f"{datetime.utcnow():%Y%m%dT%H%M%S}_{safe_name}"
    _landing().get_file_client(f"{client_code}/{source}/{stamped}").upload_data(data, overwrite=False)
    return stamped


def ensure_folders(client_code: str, sources: Iterable[str]) -> None:
    for source in sources:
        _landing().get_directory_client(f"{client_code}/{source}").create_directory()

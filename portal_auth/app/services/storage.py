"""ADLS Gen2 landing zone: landing/<client>/<source>/ - exactly where the ADF pipelines look."""
import logging
from datetime import datetime
from functools import lru_cache
from typing import Iterable

from azure.identity import DefaultAzureCredential
from azure.storage.filedatalake import DataLakeServiceClient

from app.config import settings

log = logging.getLogger("skystack.storage")


@lru_cache(maxsize=1)
def _landing():
    service = DataLakeServiceClient(f"https://{settings.storage_account}.dfs.core.windows.net", DefaultAzureCredential())
    return service.get_file_system_client(settings.landing_container)


def put_file(client_code: str, source: str, safe_name: str, data: bytes, stamp: bool = True) -> str:
    """Creates the folder, creates the file, appends the bytes and flushes - each step explicit, so a failure names its step."""
    stamped = f"{datetime.utcnow():%Y%m%dT%H%M%S}_{safe_name}" if stamp else safe_name   # stamp=False: the caller already named the file
    folder = f"{client_code}/{source}"
    path = f"{folder}/{stamped}"
    fs = _landing()
    try:
        directory = fs.get_directory_client(folder)
        directory.create_directory()                              # no-op when it already exists
        file = directory.create_file(stamped)
        file.append_data(data, offset=0, length=len(data))
        file.flush_data(len(data))
    except Exception:                                              # noqa: BLE001
        log.exception("upload to %s/%s failed (account=%s)", settings.landing_container, path, settings.storage_account)
        raise
    return stamped


def ensure_folders(client_code: str, sources: Iterable[str]) -> None:
    for source in sources:
        _landing().get_directory_client(f"{client_code}/{source}").create_directory()

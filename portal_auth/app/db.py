"""SQL access with Microsoft Entra tokens (managed identity) - no SQL passwords in the API."""
import struct
from contextlib import contextmanager
from typing import Any, List, Optional, Sequence

import pyodbc
from azure.identity import DefaultAzureCredential

from app.config import settings

_credential = DefaultAzureCredential()
_SQL_COPT_SS_ACCESS_TOKEN = 1256


def _token_attrs() -> dict:
    raw = _credential.get_token("https://database.windows.net/.default").token.encode("utf-16-le")
    return {_SQL_COPT_SS_ACCESS_TOKEN: struct.pack(f"<I{len(raw)}s", len(raw), raw)}


@contextmanager
def connect(server: str, database: str):
    conn = pyodbc.connect(
        f"Driver={{ODBC Driver 18 for SQL Server}};Server=tcp:{server},1433;Database={database};"
        "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=15",
        attrs_before=_token_attrs(), autocommit=True)
    try:
        yield conn
    finally:
        conn.close()


def _dicts(cursor) -> List[dict]:
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def query(sql: str, params: Sequence[Any] = (), server: Optional[str] = None,
          database: Optional[str] = None) -> List[dict]:
    """Runs a statement and returns rows as dicts ([] when the statement returns no result set)."""
    with connect(server or settings.control_db_server, database or settings.control_db_name) as conn:
        cur = conn.cursor()
        cur.execute(sql, tuple(params))
        return _dicts(cur) if cur.description else []

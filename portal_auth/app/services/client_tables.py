"""A client's own tables. The client names a table and its columns (with data types) in the portal; we keep only that
definition (portal.ClientTable). The data itself never lands in a database table here: every upload or table entry is
delivered as one file named <table>_<date>_<time> into landing/<client>/<table>/."""
import json
import re
from typing import Dict, List, Optional

from fastapi import HTTPException

from app import db

MAX_COLUMNS = 60
MAX_TABLES = 100
TYPES = {"text", "whole", "decimal", "date", "datetime", "yesno"}
DATE_FORMATS = {"yyyy-MM-dd", "dd-MM-yyyy", "dd/MM/yyyy", "MM/dd/yyyy"}
DATETIME_FORMATS = {"yyyy-MM-dd HH:mm", "dd-MM-yyyy HH:mm", "dd/MM/yyyy HH:mm", "MM/dd/yyyy HH:mm"}
RESERVED = {"con", "prn", "aux", "nul"}


def slug(text: str, limit: int = 40) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")
    if not s:
        return ""
    if not s[0].isalpha():
        s = "t_" + s
    return s[:limit].rstrip("_")


def table_name(title: str) -> str:
    name = slug(title)
    if len(name) < 2 or name in RESERVED:
        raise HTTPException(400, "Give the table a name of at least 2 letters or numbers.")
    return name


def _clean_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", (raw or "").strip())
    if not name or len(name) > 60 or re.search(r"[\x00-\x1f\"]", name):
        raise HTTPException(400, "Column names must be 1 to 60 characters, without quotes.")
    return name


def build_mapping(columns: List[dict]) -> List[Dict]:
    """Checks the column definitions typed by the client and turns each into what the cell checks need."""
    if not columns:
        raise HTTPException(400, "Add at least one column.")
    if len(columns) > MAX_COLUMNS:
        raise HTTPException(400, f"A table can have up to {MAX_COLUMNS} columns.")
    seen = set()
    out = []
    for c in columns:
        name = _clean_name(c.get("name"))
        target = slug(name, 60)
        if not target:
            raise HTTPException(400, f'Column "{name}" needs at least one letter or number.')
        if target in seen:
            raise HTTPException(400, f'There are two columns called "{name}".')
        seen.add(target)
        kind = (c.get("type") or "text").lower()
        if kind not in TYPES:
            raise HTTPException(400, f'Column "{name}": choose text, whole number, decimal number, date or yes/no.')
        fmt, scale = None, None
        if kind == "text":
            dtype = "string"
        elif kind == "whole":
            dtype = "bigint"
        elif kind == "decimal":
            try:
                scale = int(c.get("decimals", 4))
            except (TypeError, ValueError):
                scale = 0
            if not 1 <= scale <= 6:
                raise HTTPException(400, f'Column "{name}": decimals must be between 1 and 6.')
            dtype = f"decimal(18,{scale})"
        elif kind == "date":
            fmt = c.get("date_format") or "yyyy-MM-dd"
            if fmt not in DATE_FORMATS:
                raise HTTPException(400, f'Column "{name}": unsupported date format.')
            dtype = "date"
        elif kind == "datetime":
            fmt = c.get("date_format") or "yyyy-MM-dd HH:mm"
            if fmt not in DATETIME_FORMATS:
                raise HTTPException(400, f'Column "{name}": unsupported date and time format.')
            dtype = "timestamp"
        else:
            dtype = "boolean"
        out.append({"name": name, "kind": kind, "scale": scale, "dtype": dtype, "fmt": fmt})
    return out


def to_defs(mapping: List[Dict]) -> List[Dict]:
    """The form that is stored and shown in the column headings."""
    return [{"name": m["name"], "type": m["kind"], "decimals": m["scale"] or 4, "date_format": m["fmt"]} for m in mapping]


def to_checks(mapping: List[Dict]) -> List[Dict]:
    """The form entry.validate() understands."""
    return [{"name": m["name"], "type": m["dtype"], "date_format": m["fmt"], "key": False, "required": False} for m in mapping]


# ---------------------------------------------------------------- storage of the definitions
def get(client_id: int, name: str) -> Optional[Dict]:
    rows = db.query("SELECT TableName, Title, ColumnsJson, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt "
                    "FROM portal.ClientTable WHERE ClientId = ? AND TableName = ?", (client_id, name))
    return rows[0] if rows else None


def listing(client_id: int) -> List[Dict]:
    rows = db.query("SELECT TableName, Title, ColumnsJson, CreatedBy, CreatedAt, UpdatedAt "
                    "FROM portal.ClientTable WHERE ClientId = ? ORDER BY Title", (client_id,))
    return [{"name": r["TableName"], "title": r["Title"], "created_by": r["CreatedBy"],
             "defs": json.loads(r["ColumnsJson"]) if r["ColumnsJson"] else None,
             "updated_at": ((r["UpdatedAt"] or r["CreatedAt"]).isoformat() + "Z")} for r in rows]


def _check_limit(client_id: int) -> None:
    n = db.query("SELECT COUNT(*) AS n FROM portal.ClientTable WHERE ClientId = ?", (client_id,))[0]["n"]
    if n >= MAX_TABLES:
        raise HTTPException(403, f"You can have up to {MAX_TABLES} tables.")


def save_definition(client_id: int, name: str, title: str, defs: List[Dict], email: str) -> None:
    """Creates the table, or replaces its column definitions."""
    if get(client_id, name) is None:
        _check_limit(client_id)
    db.query(
        "SET NOCOUNT ON; MERGE portal.ClientTable WITH (HOLDLOCK) AS t "
        "USING (SELECT ? AS ClientId, ? AS TableName) AS s ON t.ClientId = s.ClientId AND t.TableName = s.TableName "
        "WHEN MATCHED THEN UPDATE SET ColumnsJson = ?, UpdatedBy = ?, UpdatedAt = SYSUTCDATETIME() "
        "WHEN NOT MATCHED THEN INSERT (ClientId, TableName, Title, ColumnsJson, CreatedBy) VALUES (?, ?, ?, ?, ?);",
        (client_id, name, json.dumps(defs), email, client_id, name, title[:80], json.dumps(defs), email))


def ensure_name(client_id: int, name: str, title: str, email: str) -> None:
    """Uploads only need the name; the table is remembered so it can be picked next time."""
    if get(client_id, name) is not None:
        return
    _check_limit(client_id)
    db.query("SET NOCOUNT ON; MERGE portal.ClientTable WITH (HOLDLOCK) AS t "
             "USING (SELECT ? AS ClientId, ? AS TableName) AS s ON t.ClientId = s.ClientId AND t.TableName = s.TableName "
             "WHEN NOT MATCHED THEN INSERT (ClientId, TableName, Title, CreatedBy) VALUES (?, ?, ?, ?);",
             (client_id, name, client_id, name, title[:80], email))

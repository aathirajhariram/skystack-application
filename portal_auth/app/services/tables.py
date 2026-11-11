"""Helpers for a client's own ad-hoc table in Data entry: the client names the table and its columns (with data types)
in the browser. Nothing is created in any database - the validated rows are sent to us as one CSV file."""
import re
from typing import Dict, List, Optional

from fastapi import HTTPException

MAX_COLUMNS = 60
# what the client sees -> what the pipeline stores
TYPES = {"text", "whole", "decimal", "date", "datetime", "yesno"}
DATE_FORMATS = {"yyyy-MM-dd", "dd-MM-yyyy", "dd/MM/yyyy", "MM/dd/yyyy"}
DATETIME_FORMATS = {"yyyy-MM-dd HH:mm", "dd-MM-yyyy HH:mm", "dd/MM/yyyy HH:mm", "MM/dd/yyyy HH:mm"}
RESERVED = {"con", "prn", "aux", "nul", "template", "templates"}


def slug(text: str, limit: int = 40) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")
    if not s:
        return ""
    if not s[0].isalpha():
        s = "t_" + s
    return s[:limit].rstrip("_")


def _clean_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", (raw or "").strip())
    if not name or len(name) > 60 or re.search(r"[\x00-\x1f\"]", name):
        raise HTTPException(400, "Column names must be 1 to 60 characters, without quotes.")
    return name


def build_mapping(columns: List[dict], first_order: int, allow_key: bool, taken: Optional[set] = None) -> List[Dict]:
    """Validates the client's column definitions and turns them into cfg.ColumnMapping values."""
    if not columns:
        raise HTTPException(400, "Add at least one column.")
    if len(columns) + first_order > MAX_COLUMNS:
        raise HTTPException(400, f"A table can have up to {MAX_COLUMNS} columns.")
    seen = set(taken or ())
    out = []
    for i, c in enumerate(columns):
        name = _clean_name(c.get("name"))
        target = slug(name, 60)
        if not target:
            raise HTTPException(400, f'Column "{name}" needs at least one letter or number.')
        if target in seen or name.lower() in seen:
            raise HTTPException(400, f'There are two columns called "{name}".')
        seen.update({target, name.lower()})
        kind = (c.get("type") or "text").lower()
        if kind not in TYPES:
            raise HTTPException(400, f'Column "{name}": choose text, whole number, decimal number, date, date and time or yes/no.')
        fmt = None
        if kind == "text":
            dtype = "string"
        elif kind == "whole":
            dtype = "bigint"
        elif kind == "decimal":
            try:
                scale = int(c.get("decimals", 2))
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
        key = bool(c.get("key")) and allow_key
        out.append({"source_col": name, "target_col": target, "dtype": dtype, "fmt": fmt, "key": key,
                    "nullable": not (key or bool(c.get("required"))), "order": first_order + i + 1})
    return out

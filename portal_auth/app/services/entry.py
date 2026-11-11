"""Table-entry support: an editing lock per (client, data type) and server-side column validation.
The lock is what keeps two people from entering data into the same data type at the same time."""
import math
import re
from datetime import datetime
from typing import Dict, List, Optional

from app import db

LOCK_MINUTES = 10          # a lock expires by itself if its owner disappears (the page renews it every 2 minutes)
MAX_ERRORS = 100


# ---------------------------------------------------------------- locking
def acquire(client_id: int, source: str, user: dict) -> dict:
    """Takes the editing slot for this data type, or renews it when the caller already holds it.
    Atomic: the MERGE runs under HOLDLOCK, so two simultaneous callers can never both win."""
    uid = str(user["user_id"])
    db.query(
        "SET NOCOUNT ON; "
        "MERGE portal.EntryLock WITH (HOLDLOCK) AS t "
        "USING (SELECT ? AS ClientId, ? AS SourceName) AS s ON t.ClientId = s.ClientId AND t.SourceName = s.SourceName "
        "WHEN MATCHED AND (t.UserId = ? OR t.ExpiresAt < SYSUTCDATETIME()) THEN UPDATE SET "
        "  LockedAt = CASE WHEN t.UserId = ? THEN t.LockedAt ELSE SYSUTCDATETIME() END, "
        "  UserId = ?, UserEmail = ?, DisplayName = ?, ExpiresAt = DATEADD(MINUTE, ?, SYSUTCDATETIME()) "
        "WHEN NOT MATCHED THEN INSERT (ClientId, SourceName, UserId, UserEmail, DisplayName, LockedAt, ExpiresAt) "
        "  VALUES (?, ?, ?, ?, ?, SYSUTCDATETIME(), DATEADD(MINUTE, ?, SYSUTCDATETIME()));",
        (client_id, source, uid, uid, uid, user["email"], user["name"], LOCK_MINUTES,
         client_id, source, uid, user["email"], user["name"], LOCK_MINUTES))
    return current(client_id, source, uid)


def current(client_id: int, source: str, my_user_id: str) -> dict:
    rows = db.query("SELECT UserId, UserEmail, DisplayName, LockedAt, ExpiresAt, "
                    "CASE WHEN ExpiresAt < SYSUTCDATETIME() THEN 1 ELSE 0 END AS Expired "
                    "FROM portal.EntryLock WHERE ClientId = ? AND SourceName = ?", (client_id, source))
    if not rows or rows[0]["Expired"]:
        return {"mine": False, "free": True, "holder": None}
    r = rows[0]
    mine = str(r["UserId"]).lower() == str(my_user_id).lower()
    return {"mine": mine, "free": False,
            "holder": {"name": r["DisplayName"], "email": r["UserEmail"],
                       "since": r["LockedAt"].isoformat() + "Z", "expires": r["ExpiresAt"].isoformat() + "Z"}}


def release(client_id: int, source: str, user_id: str, force: bool = False) -> Optional[dict]:
    """Gives the slot back. force=True (admins only) removes someone else's lock; returns who held it."""
    before = db.query("SELECT UserEmail, DisplayName FROM portal.EntryLock WHERE ClientId = ? AND SourceName = ?",
                      (client_id, source))
    if force:
        db.query("DELETE FROM portal.EntryLock WHERE ClientId = ? AND SourceName = ?", (client_id, source))
    else:
        db.query("DELETE FROM portal.EntryLock WHERE ClientId = ? AND SourceName = ? AND UserId = ?",
                 (client_id, source, str(user_id)))
    return before[0] if before else None


def holds(client_id: int, source: str, user_id: str) -> bool:
    rows = db.query("SELECT 1 AS ok FROM portal.EntryLock WHERE ClientId = ? AND SourceName = ? AND UserId = ? "
                    "AND ExpiresAt >= SYSUTCDATETIME()", (client_id, source, str(user_id)))
    return bool(rows)


# ---------------------------------------------------------------- validation by data type
_JAVA_TO_PY = (("yyyy", "%Y"), ("MM", "%m"), ("dd", "%d"), ("HH", "%H"), ("mm", "%M"), ("ss", "%S"))


def _py_format(java_fmt: str) -> Optional[str]:
    out = java_fmt
    for j, p in _JAVA_TO_PY:
        out = out.replace(j, p)
    return out if "%" in out and not re.search(r"[A-Za-z]", re.sub(r"%[YmdHMS]", "", out)) else None


def check_cell(col: dict, value: str) -> Optional[str]:
    v = (value or "").strip()
    if not v:
        return "Required" if col["required"] else None
    t = (col["type"] or "string").lower().strip()
    if t == "string":
        return "Too long (max 4000 characters)" if len(v) > 4000 else None
    if t == "int":
        return None if re.fullmatch(r"-?\d{1,9}", v) or (re.fullmatch(r"-?\d+", v) and abs(int(v)) < 2**31) else "Whole number expected"
    if t == "bigint":
        return None if re.fullmatch(r"-?\d+", v) and abs(int(v)) < 2**63 else "Whole number expected"
    if t == "double":
        try:
            return None if math.isfinite(float(v)) else "Number expected"
        except ValueError:
            return "Number expected"
    m = re.fullmatch(r"decimal\((\d+),\s*(\d+)\)", t)
    if m:
        p, s = int(m.group(1)), int(m.group(2))
        d = re.fullmatch(r"-?(\d+)(?:\.(\d+))?", v)
        if not d:
            return f"Number expected, e.g. 1250.50"
        if len(d.group(1).lstrip("0") or "0") > p - s:
            return f"Too large (max {p - s} digits before the decimal point)"
        if d.group(2) and len(d.group(2)) > s:
            return f"Max {s} decimal places"
        return None
    if t == "boolean":
        return None if v.lower() in {"true", "false", "yes", "no", "1", "0", "y", "n"} else "Use yes/no or true/false"
    if t in ("date", "timestamp"):
        fmt = col.get("date_format")
        py = _py_format(fmt) if fmt else None
        candidates = [py] if py else ["%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"]
        for f in candidates:
            try:
                datetime.strptime(v, f)
                return None
            except ValueError:
                continue
        return f"Use the format {fmt}" if fmt else "Use yyyy-MM-dd"
    return None                                            # unknown type: the processing step decides


def validate(cols: List[dict], rows: List[List[str]]) -> List[Dict]:
    """Returns every problem found: [{row, column, message}] (row numbers start at 1)."""
    errors: List[Dict] = []
    key_idx = [i for i, c in enumerate(cols) if c.get("key")]
    seen: Dict[tuple, int] = {}
    for n, row in enumerate(rows, 1):
        for c, v in zip(cols, row):
            msg = check_cell(c, v)
            if msg:
                errors.append({"row": n, "column": c["name"], "message": msg})
        if key_idx:
            key = tuple((row[i] or "").strip().lower() for i in key_idx)
            if all(key):
                if key in seen:
                    errors.append({"row": n, "column": cols[key_idx[0]]["name"],
                                   "message": f"Duplicate of row {seen[key]} (these values must be unique)"})
                else:
                    seen[key] = n
        if len(errors) >= MAX_ERRORS:
            break
    return errors[:MAX_ERRORS]

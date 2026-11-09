"""Which data sources may this user see? Admins see everything; others lose only what an admin hid for them."""
from typing import Set

from app import db


def hidden_sources(user: dict) -> Set[str]:
    if user["permissions"]["admin"]:
        return set()
    rows = db.query("SELECT s.SourceName FROM portal.UserHiddenSource h JOIN cfg.Source s ON s.SourceId = h.SourceId "
                    "WHERE h.UserId = ?", (user["user_id"],))
    return {r["SourceName"] for r in rows}

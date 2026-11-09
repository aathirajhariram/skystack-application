"""Turns cfg.DashboardTile rows into safe SQL against the client's OWN database.
Nothing user-controlled reaches SQL: identifiers must match a strict pattern AND exist in the source's
column mapping; aggregations come from a whitelist."""
import logging
import re
from collections import defaultdict
from decimal import Decimal
from typing import Dict, List, Set

import pyodbc

from app import db

log = logging.getLogger("skystack.dashboard")
_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,127}$")
_AGGS = {"SUM", "COUNT", "AVG", "MIN", "MAX"}


def _ident(name: str, allowed: Set[str]) -> str:
    if not name or not _IDENT.match(name) or name.lower() not in allowed:
        raise ValueError(f"column '{name}' is not allowed")
    return f"[{name}]"


def _safe_name(name: str) -> str:
    if not name or not _IDENT.match(name):
        raise ValueError(f"invalid identifier '{name}'")
    return f"[{name}]"


def build_query(tile: dict, allowed_columns: Set[str]) -> str:
    agg = tile["Aggregation"].upper()
    if agg not in _AGGS:
        raise ValueError("bad aggregation")
    table = f"{_safe_name(tile['SchemaName'])}.{_safe_name(tile['TargetTable'])}"
    allowed = {c.lower() for c in allowed_columns}

    if tile["MeasureColumn"]:
        measure = f"{agg}({_ident(tile['MeasureColumn'], allowed)})"
    elif agg == "COUNT":
        measure = "COUNT(*)"
    else:
        raise ValueError("measure column required")

    kind = tile["TileType"]
    if kind == "KPI":
        return f"SELECT {measure} AS [value] FROM {table}"
    if kind == "BAR":
        g = _ident(tile["GroupColumn"], allowed)
        return (f"SELECT TOP 12 CAST({g} AS NVARCHAR(200)) AS [label], {measure} AS [value] FROM {table} "
                f"WHERE {g} IS NOT NULL GROUP BY {g} ORDER BY [value] DESC")
    if kind == "LINE":
        d = _ident(tile["DateColumn"], allowed)
        month = f"FORMAT({d}, 'yyyy-MM')"
        return (f"SELECT TOP 24 {month} AS [label], {measure} AS [value] FROM {table} "
                f"WHERE {d} IS NOT NULL GROUP BY {month} ORDER BY [label] DESC")
    raise ValueError("bad tile type")


def _num(v):
    return float(v) if isinstance(v, (Decimal, int, float)) else None


def _run_tile(cur, tile: dict, allowed: Set[str]) -> dict:
    base = {"id": tile["TileId"], "title": tile["Title"], "type": tile["TileType"], "format": tile["NumberFormat"]}
    try:
        cur.execute(build_query(tile, allowed))
        rows = cur.fetchall()
    except pyodbc.Error as exc:
        status = "no_data" if "Invalid object name" in str(exc) else "error"
        if status == "error":
            log.error("tile %s failed: %s", tile["TileId"], exc)
        return {**base, "status": status}
    except ValueError as exc:
        log.error("tile %s misconfigured: %s", tile["TileId"], exc)
        return {**base, "status": "error"}

    if tile["TileType"] == "KPI":
        value = _num(rows[0][0]) if rows else None
        return {**base, "status": "ok" if value is not None else "no_data", "value": value}
    data = [{"label": r[0], "value": _num(r[1])} for r in rows if r[1] is not None]
    if tile["TileType"] == "LINE":
        data.reverse()                                        # query returns newest first (TOP 24)
    return {**base, "status": "ok" if data else "no_data", "data": data}


def load_dashboard(client_code: str) -> List[dict]:
    tiles = db.query("SELECT * FROM cfg.vw_DashboardTile WHERE ClientCode = ? ORDER BY SourceName, DisplayOrder",
                     (client_code,))
    columns: Dict[str, Set[str]] = defaultdict(set)
    for r in db.query("SELECT s.SourceName, m.TargetColumn FROM cfg.ColumnMapping m "
                      "JOIN cfg.Source s ON s.SourceId = m.SourceId JOIN cfg.Client c ON c.ClientId = s.ClientId "
                      "WHERE c.ClientCode = ?", (client_code,)):
        columns[r["SourceName"]].add(r["TargetColumn"])
    last_run = {r["SourceName"]: r["LastRun"] for r in db.query(
        "SELECT SourceName, MAX(EndedAt) AS LastRun FROM audit.vw_RunSummary "
        "WHERE ClientCode = ? AND Status IN ('SUCCESS','WARNING') GROUP BY SourceName", (client_code,))}

    by_source: Dict[str, List[dict]] = defaultdict(list)
    for t in tiles:
        by_source[t["SourceName"]].append(t)

    result = []
    for source, source_tiles in by_source.items():
        first = source_tiles[0]
        out_tiles = []
        try:
            with db.connect(first["ServerName"], first["DatabaseName"]) as conn:
                cur = conn.cursor()
                out_tiles = [_run_tile(cur, t, columns[source]) for t in source_tiles]
        except pyodbc.Error as exc:
            log.error("cannot reach client database for %s: %s", client_code, exc)
            out_tiles = [{"id": t["TileId"], "title": t["Title"], "type": t["TileType"],
                          "format": t["NumberFormat"], "status": "error"} for t in source_tiles]
        stamp = last_run.get(source)
        result.append({"source": source, "last_processed_at": stamp.isoformat() + "Z" if stamp else None,
                       "tiles": out_tiles})
    return result

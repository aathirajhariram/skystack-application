"""Applies cfg.ColumnMapping: rename, default, cast.
Failed casts become NULL and are listed in `_cast_errors` - they never crash the job.
Uses Spark SQL try_cast / try_to_timestamp (Spark 3.5+, Databricks Runtime 14+)."""
from typing import List

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from skyframe.config.models import ColumnMap

NUMERIC_PREFIXES = ("int", "bigint", "smallint", "tinyint", "double", "float", "decimal")
META_COLUMNS = ("_source_file", "_run_id", "_ingested_at")


def _raw_sql(actual: str, cm: ColumnMap) -> str:
    col = f"`{actual}`"
    if cm.default_value is not None:
        return f"coalesce({col}, '{cm.default_value.replace(chr(39), chr(39) * 2)}')"
    return col


def _numeric_sql(raw: str, decimal_comma: bool) -> str:
    """'1,234.50' / '₹ 1,234.50' / '(250)'  ->  '1234.50' / '-250'"""
    s = f"regexp_replace({raw}, '\\\\s*/?-+\\\\s*$', '')"                # Rs4788/-  or  4788-  ->  Rs4788
    s = f"regexp_replace({s}, '^\\\\((.*)\\\\)$', '-$1')"                    # (250) -> -250
    if decimal_comma:                                                   # 1.234,50 -> 1234.50
        s = f"replace(regexp_replace({s}, '\\\\.', ''), ',', '.')"
    return f"regexp_replace({s}, '[^0-9.\\\\-]', '')"


def _cast_sql(raw: str, cm: ColumnMap, decimal_comma: bool) -> str:
    dtype = cm.data_type.lower()
    if dtype == "string":
        return raw
    if dtype.startswith(NUMERIC_PREFIXES):
        return f"try_cast({_numeric_sql(raw, decimal_comma)} AS {dtype})"
    if dtype in ("date", "timestamp"):
        fmts = [cm.date_format] if cm.date_format else []
        fmts += [f for f in ("yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd") if f not in fmts]
        parsed = "coalesce(" + ", ".join(f"try_to_timestamp({raw}, '{f}')" for f in fmts) + ")"
        return f"to_date({parsed})" if dtype == "date" else parsed
    if dtype == "boolean":
        low = f"lower({raw})"
        return (f"CASE WHEN {low} IN ('true','yes','y','1') THEN true "
                f"WHEN {low} IN ('false','no','n','0') THEN false END")
    return f"try_cast({raw} AS {dtype})"


def apply_mapping(df: DataFrame, columns: List[ColumnMap], decimal_comma: bool = False) -> DataFrame:
    """Returns target-named, typed columns + metadata + `_cast_errors` (array<string>)."""
    lookup = {c.lower(): c for c in df.columns}
    out_cols, error_flags = [], []

    for cm in sorted(columns, key=lambda c: c.column_order):
        actual = lookup.get(cm.source_column.strip().lower())
        if actual is None:
            raise ValueError(f"Column '{cm.source_column}' not found after extraction")
        raw = _raw_sql(actual, cm)
        typed = F.expr(_cast_sql(raw, cm, decimal_comma))
        out_cols.append(typed.alias(cm.target_column))
        error_flags.append(F.when(F.expr(raw).isNotNull() & typed.isNull(), F.lit(cm.target_column)))

    meta = [F.col(c) for c in META_COLUMNS if c in df.columns]
    errors = F.filter(F.array(*error_flags), lambda x: x.isNotNull()).alias("_cast_errors")
    return df.select(*out_cols, *meta, errors)

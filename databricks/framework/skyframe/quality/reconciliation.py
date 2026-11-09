"""Reconciliation: does what we loaded equal what we should have loaded?
  SOURCE_TO_SILVER : typed rows == valid + rejected (nothing lost while validating)
  SILVER_TO_TARGET : rows/sums published == rows/sums found in the target after writing"""
from typing import Dict, List, Optional

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from skyframe.config.models import SourceConfig


def column_sums(df: DataFrame, columns: List[str]) -> Dict[str, float]:
    if not columns:
        return {}
    row = df.agg(*[F.sum(F.col(f"`{c}`").cast("double")).alias(c) for c in columns]).first().asDict()
    return {c: float(v or 0.0) for c, v in row.items()}


def _compare(stage, check, column, expected, actual, tolerance_pct) -> dict:
    if actual is None:
        return {"Stage": stage, "CheckType": check, "ColumnName": column, "ExpectedValue": expected,
                "ActualValue": None, "DiffPct": None, "Status": "SKIPPED"}
    diff = abs(expected - actual) / abs(expected) * 100.0 if expected else (0.0 if actual == 0 else 100.0)
    return {"Stage": stage, "CheckType": check, "ColumnName": column, "ExpectedValue": expected,
            "ActualValue": actual, "DiffPct": diff, "Status": "MATCH" if diff <= tolerance_pct else "MISMATCH"}


def reconcile(cfg: SourceConfig, typed_df: DataFrame, typed_count: int, valid_df: DataFrame, valid_count: int,
              rejected_df: DataFrame,
              rejected_count: int, published_df: DataFrame, published_count: int,
              target_readback: Optional[dict]) -> List[dict]:
    def tol(stage, check, col=""):
        return next((r.tolerance_pct for r in cfg.recon_rules
                     if r.stage == stage and r.check_type == check and r.column == col), 0.0)

    results = [
        _compare("SOURCE_TO_SILVER", "ROW_COUNT", "", float(typed_count),
                 float(valid_count + rejected_count), tol("SOURCE_TO_SILVER", "ROW_COUNT")),
        _compare("SILVER_TO_TARGET", "ROW_COUNT", "", float(published_count),
                 float(target_readback["rows"]) if target_readback else None, tol("SILVER_TO_TARGET", "ROW_COUNT")),
    ]

    for rule in (r for r in cfg.recon_rules if r.check_type == "SUM" and r.column):
        if rule.stage == "SOURCE_TO_SILVER":
            expected = column_sums(typed_df, [rule.column])[rule.column]
            actual = column_sums(valid_df, [rule.column])[rule.column] + column_sums(rejected_df, [rule.column])[rule.column]
            results.append(_compare(rule.stage, "SUM", rule.column, expected, actual, rule.tolerance_pct))
        else:
            expected = column_sums(published_df, [rule.column])[rule.column]
            actual = target_readback["sums"].get(rule.column) if target_readback else None
            results.append(_compare(rule.stage, "SUM", rule.column, expected, actual, rule.tolerance_pct))
    return results

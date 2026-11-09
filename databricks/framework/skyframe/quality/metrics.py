"""Run metrics that are stored in audit.MetricHistory and compared against earlier runs."""
from typing import List

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from skyframe.config.models import ThresholdRuleCfg


def compute_metrics(valid_df: DataFrame, valid_count: int, rejected_count: int,
                    rules: List[ThresholdRuleCfg]) -> List[dict]:
    total = valid_count + rejected_count
    metrics = [
        {"MetricName": "ROW_COUNT", "ColumnName": "", "MetricValue": float(total)},
        {"MetricName": "REJECT_PCT", "ColumnName": "", "MetricValue": (rejected_count / total * 100.0) if total else 0.0},
    ]

    wanted = {(r.metric, r.column) for r in rules if r.metric in ("NULL_PCT", "SUM", "AVG") and r.column}
    if not wanted:
        return metrics

    aggs = []
    for metric, col in sorted(wanted):
        c = F.col(f"`{col}`")
        alias = f"{metric}__{col}"
        if metric == "NULL_PCT":
            aggs.append((F.sum(F.when(c.isNull(), 1).otherwise(0)) * 100.0 / F.count(F.lit(1))).alias(alias))
        elif metric == "SUM":
            aggs.append(F.sum(c.cast("double")).alias(alias))
        else:
            aggs.append(F.avg(c.cast("double")).alias(alias))
    row = valid_df.agg(*aggs).first().asDict()
    for alias, value in row.items():
        metric, col = alias.split("__", 1)
        metrics.append({"MetricName": metric, "ColumnName": col,
                        "MetricValue": float(value) if value is not None else None})
    return metrics

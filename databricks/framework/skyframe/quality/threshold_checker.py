"""Compares today's metrics to the average of previous runs. WARN -> e-mail, ERROR -> block the load."""
from typing import List

from skyframe.config.models import ThresholdRuleCfg


def check_thresholds(current: List[dict], rules: List[ThresholdRuleCfg], baseline_rows: List[dict]) -> List[dict]:
    results = []
    for rule in rules:
        now = next((m["MetricValue"] for m in current
                    if m["MetricName"] == rule.metric and m["ColumnName"] == rule.column), None)
        history = [r["MetricValue"] for r in baseline_rows
                   if r["MetricName"] == rule.metric and r["ColumnName"] == rule.column
                   and r["RunRank"] <= rule.baseline_runs and r["MetricValue"] is not None]

        result = {"MetricName": rule.metric, "ColumnName": rule.column, "CurrentValue": now,
                  "BaselineValue": None, "DeviationPct": None,
                  "MaxDeviationPct": rule.max_deviation_pct, "Status": "NO_BASELINE", "Severity": rule.severity}
        if now is not None and history:
            base = sum(history) / len(history)
            if base == 0:
                deviation = 0.0 if now == 0 else 100.0
            else:
                deviation = abs(now - base) / abs(base) * 100.0
            result.update(BaselineValue=base, DeviationPct=deviation,
                          Status=rule.severity if deviation > rule.max_deviation_pct else "OK")
        results.append(result)
    return results

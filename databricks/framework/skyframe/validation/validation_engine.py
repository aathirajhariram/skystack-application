"""Runs all configured rules (plus automatic ones) and splits the data into valid / rejected."""
from dataclasses import dataclass
from typing import List, Tuple

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from skyframe.config.models import SourceConfig
from skyframe.validation.rules import RULES


@dataclass
class RuleSpec:
    name: str
    rule_type: str
    column: str
    params: dict
    severity: str


def build_rule_specs(cfg: SourceConfig) -> List[RuleSpec]:
    specs = [RuleSpec(f"{r.rule_type}:{r.column}", r.rule_type, r.column, r.params, r.severity)
             for r in cfg.validations]

    # Automatic rules derived from the column mapping
    for c in cfg.columns:
        if not c.is_nullable or c.is_business_key:
            specs.append(RuleSpec(f"NOT_NULL:{c.target_column}(auto)", "NOT_NULL", c.target_column, {}, "ERROR"))
    if cfg.scd_type in (1, 2) and cfg.business_keys:       # SCD merges need one row per key per batch
        keys = ",".join(cfg.business_keys)
        specs.append(RuleSpec(f"UNIQUE:{keys}(auto)", "UNIQUE", keys, {}, "ERROR"))
    return specs


def run_validations(df: DataFrame, cfg: SourceConfig) -> Tuple[DataFrame, DataFrame, List[dict]]:
    """Returns (valid_df, rejected_df, results). Rejected rows carry `_dq_errors` explaining why."""
    specs = build_rule_specs(cfg)
    flagged = df
    for i, s in enumerate(specs):
        flagged = flagged.withColumn(f"_f{i}", RULES[s.rule_type](s.column, s.params))

    error_labels = [F.when(F.col(f"_f{i}"), F.lit(s.name)) for i, s in enumerate(specs) if s.severity == "ERROR"]
    warn_labels = [F.when(F.col(f"_f{i}"), F.lit(s.name)) for i, s in enumerate(specs) if s.severity == "WARN"]
    cast_err = F.transform(F.col("_cast_errors"), lambda c: F.concat(F.lit("TYPE_CAST:"), c))

    flagged = (flagged
               .withColumn("_dq_errors", F.array_union(cast_err, F.filter(F.array(*error_labels), lambda x: x.isNotNull()))
                           if error_labels else cast_err)
               .withColumn("_dq_warnings", F.filter(F.array(*warn_labels), lambda x: x.isNotNull())
                           if warn_labels else F.array().cast("array<string>"))
               .cache())

    # one pass to count failures per rule
    aggs = [F.count(F.lit(1)).alias("_total")] + [
        F.sum(F.col(f"_f{i}").cast("int")).alias(f"_c{i}") for i in range(len(specs))]
    counts = flagged.agg(*aggs).first().asDict()
    total = int(counts["_total"])
    results = [{"RuleName": s.name, "RuleType": s.rule_type, "ColumnName": s.column, "Severity": s.severity,
                "FailedRows": int(counts[f"_c{i}"] or 0), "TotalRows": total} for i, s in enumerate(specs)]

    drop_flags = [f"_f{i}" for i in range(len(specs))]
    clean = flagged.drop(*drop_flags)
    valid = clean.filter(F.size("_dq_errors") == 0).drop("_dq_errors", "_cast_errors")
    rejected = clean.filter(F.size("_dq_errors") > 0).drop("_cast_errors")
    return valid, rejected, results

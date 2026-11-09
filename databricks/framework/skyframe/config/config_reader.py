"""Loads a SourceConfig (and all its rules) from the control DB views."""
import json
from typing import List

from skyframe.config.models import (ColumnMap, ReconRuleCfg, SourceConfig, TargetConn,
                                    ThresholdRuleCfg, ValidationRuleCfg)
from skyframe.utils.control_db import ControlDb


def _rows(df) -> List[dict]:
    return [r.asDict() for r in df.collect()]


class ConfigReader:
    def __init__(self, control_db: ControlDb):
        self.db = control_db

    def load(self, source_id: int) -> SourceConfig:
        rows = _rows(self.db.query(f"SELECT * FROM cfg.vw_SourceConfig WHERE SourceId = {int(source_id)}"))
        if not rows:
            raise ValueError(f"Source {source_id} not found or inactive in cfg.vw_SourceConfig")
        s = rows[0]

        target = TargetConn(s["TargetType"], s["ServerName"], s["DatabaseName"], s["SchemaName"],
                            s["ContainerName"], s["CredentialSecretName"])
        cfg = SourceConfig(
            source_id=s["SourceId"], client_code=s["ClientCode"], client_name=s["ClientName"],
            source_name=s["SourceName"], file_format=s["FileFormat"], file_pattern=s["FilePattern"],
            file_options=json.loads(s["FileOptions"]) if s["FileOptions"] else {},
            target=target, target_table=s["TargetTable"], write_mode=s["WriteMode"],
            scd_type=int(s["ScdType"]), min_row_count=int(s["MinRowCount"]),
        )

        cfg.columns = [ColumnMap(
            r["SourceColumn"], r["TargetColumn"], r["DataType"], r["DateFormat"],
            bool(r["IsBusinessKey"]), bool(r["IsNullable"]), r["DefaultValue"],
            bool(r["TrackChanges"]), r["ColumnOrder"], r["FixedStart"], r["FixedLength"])
            for r in _rows(self.db.query(f"SELECT * FROM cfg.vw_ColumnMapping WHERE SourceId = {int(source_id)}"))]

        cfg.validations = [ValidationRuleCfg(
            r["RuleId"], r["RuleType"], r["ColumnName"],
            json.loads(r["RuleParams"]) if r["RuleParams"] else {}, r["Severity"])
            for r in _rows(self.db.query(f"SELECT * FROM cfg.vw_ValidationRule WHERE SourceId = {int(source_id)}"))]

        cfg.thresholds = [ThresholdRuleCfg(
            r["MetricName"], r["ColumnName"], float(r["MaxDeviationPct"]), int(r["BaselineRuns"]), r["Severity"])
            for r in _rows(self.db.query(f"SELECT * FROM cfg.vw_ThresholdRule WHERE SourceId = {int(source_id)}"))]

        cfg.recon_rules = [ReconRuleCfg(r["Stage"], r["CheckType"], r["ColumnName"], float(r["TolerancePct"]))
                           for r in _rows(self.db.query(
                               f"SELECT * FROM cfg.vw_ReconciliationRule WHERE SourceId = {int(source_id)}"))]

        cfg.recipients = sorted({r["Email"] for r in _rows(self.db.query(
            f"SELECT Email FROM cfg.vw_AlertRecipient WHERE SourceId = {int(source_id)}"))})
        return cfg

    def metric_baseline(self, source_id: int) -> List[dict]:
        return _rows(self.db.query(
            "SELECT MetricName, ColumnName, CAST(MetricValue AS FLOAT) AS MetricValue, RunRank "
            f"FROM audit.vw_MetricBaseline WHERE SourceId = {int(source_id)} AND RunRank <= 30"))

    def processed_fingerprints(self, source_id: int) -> set:
        return {r["FileFingerprint"] for r in _rows(self.db.query(
            f"SELECT FileFingerprint FROM audit.vw_ProcessedFiles WHERE SourceId = {int(source_id)}"))}

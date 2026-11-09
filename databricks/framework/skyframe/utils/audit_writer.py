"""Writes run details (files, validations, metrics, thresholds, reconciliation) to the audit tables."""
from typing import List

from skyframe.utils.control_db import ControlDb

SCHEMAS = {
    "audit.FileIngestion": "RunId string, SourceId int, FileName string, FileFingerprint string, "
                           "FileSizeBytes long, Status string, Reason string",
    "audit.ValidationResult": "RunId string, RuleName string, RuleType string, ColumnName string, "
                              "Severity string, FailedRows long, TotalRows long",
    "audit.MetricHistory": "RunId string, SourceId int, MetricName string, ColumnName string, MetricValue double",
    "audit.ThresholdResult": "RunId string, MetricName string, ColumnName string, CurrentValue double, "
                             "BaselineValue double, DeviationPct double, MaxDeviationPct double, Status string",
    "audit.ReconciliationResult": "RunId string, Stage string, CheckType string, ColumnName string, "
                                  "ExpectedValue double, ActualValue double, DiffPct double, Status string",
}


class AuditWriter:
    def __init__(self, spark, db: ControlDb, run_id: str, source_id: int):
        self.spark, self.db, self.run_id, self.source_id = spark, db, run_id, source_id

    def _append(self, table: str, rows: List[dict]) -> None:
        if not rows:
            return
        schema = SCHEMAS[table]
        names = [c.split()[0] for c in schema.split(",")]
        data = [tuple(r.get(n) for n in names) for r in rows]
        self.db.append(self.spark.createDataFrame(data, schema), table)

    def files(self, files, status: str, reason: str = None) -> None:
        self._append("audit.FileIngestion", [
            {"RunId": self.run_id, "SourceId": self.source_id, "FileName": f.name,
             "FileFingerprint": f.fingerprint, "FileSizeBytes": f.size, "Status": status, "Reason": reason}
            for f in files])

    def validations(self, results: List[dict]) -> None:
        self._append("audit.ValidationResult", [{**r, "RunId": self.run_id} for r in results])

    def metrics(self, metrics: List[dict]) -> None:
        self._append("audit.MetricHistory", [{**m, "RunId": self.run_id, "SourceId": self.source_id} for m in metrics])

    def thresholds(self, results: List[dict]) -> None:
        self._append("audit.ThresholdResult", [{**r, "RunId": self.run_id} for r in results])

    def reconciliation(self, results: List[dict]) -> None:
        self._append("audit.ReconciliationResult", [{**r, "RunId": self.run_id} for r in results])

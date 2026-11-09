"""Orchestrates one source end-to-end:
   landing -> ingestion checks -> BRONZE -> cleanse/type/validate -> threshold gate -> SILVER (SCD)
   -> GOLD -> client target -> reconciliation -> audit -> archive files -> alerts"""
from typing import List

from pyspark.sql import SparkSession

from skyframe.alerts.email_alert import send_alert
from skyframe.config.config_reader import ConfigReader
from skyframe.config.models import SourceConfig
from skyframe.extraction.extractor_factory import get_extractor
from skyframe.ingestion.ingestion_checks import (IngestionError, check_expected_columns,
                                                 check_min_rows, classify_files)
from skyframe.layers import bronze, gold, silver
from skyframe.quality.metrics import compute_metrics
from skyframe.quality.reconciliation import reconcile
from skyframe.quality.threshold_checker import check_thresholds
from skyframe.utils.audit_writer import AuditWriter
from skyframe.utils.control_db import ControlDb
from skyframe.utils.file_io import FileInfo, list_files
from skyframe.utils.logger import get_logger
from skyframe.utils.paths import archive_path, landing_path
from skyframe.utils.secrets import get_dbutils
from skyframe.writers.writer_factory import get_writer

log = get_logger("skyframe.pipeline")


class PipelineBlocked(Exception):
    """The run was stopped on purpose (blocking threshold, nothing valid to load ...)."""


class PipelineRunner:
    def __init__(self, spark: SparkSession, source_id: int, run_id: str):
        self.spark, self.source_id, self.run_id = spark, int(source_id), run_id
        self.db = ControlDb(spark)
        self.reader = ConfigReader(self.db)
        self.audit = AuditWriter(spark, self.db, run_id, self.source_id)
        self.dbutils = get_dbutils(spark)
        self._in_flight: List[FileInfo] = []

    # ------------------------------------------------------------------ public
    def run(self) -> dict:
        cfg = None
        try:
            cfg = self.reader.load(self.source_id)
            return self._execute(cfg)
        except PipelineBlocked:
            self._archive(cfg, self._in_flight, rejected=True)
            raise
        except Exception as exc:                                    # noqa: BLE001
            log.exception("Run %s failed", self.run_id)
            if self._in_flight and cfg:
                reason = str(exc)[:480]
                self.audit.files(self._in_flight, "REJECTED", reason)
                self._archive(cfg, self._in_flight, rejected=True)
            if cfg:
                send_alert(cfg, self.run_id, "FAILED", "Pipeline run failed", [str(exc)[:1500]])
            raise

    # ------------------------------------------------------------------ steps
    def _execute(self, cfg: SourceConfig) -> dict:
        log.info("Run %s | %s/%s | %s -> %s", self.run_id, cfg.client_code, cfg.source_name,
                 cfg.file_format, cfg.target.target_type)

        # 1. discover + ingestion checks (duplicates, empty files)
        files = list_files(self.spark, landing_path(cfg.client_code, cfg.source_name), cfg.file_pattern)
        decision = classify_files(files, self.reader.processed_fingerprints(self.source_id))
        self.audit.files(decision.duplicates, "DUPLICATE", "File already processed")
        self.audit.files(decision.empty, "REJECTED", "Empty file")
        self._archive(cfg, decision.duplicates + decision.empty, rejected=True)
        if not decision.to_process:
            return self._summary("NO_FILES", message="No new files in landing")
        self._in_flight = decision.to_process

        # 2. extract (raw, all strings) + structural checks
        extractor = get_extractor(cfg.file_format, self.spark, cfg.file_options)
        raw = extractor.extract([f.path for f in self._in_flight], cfg.columns)
        check_expected_columns(raw, cfg)
        raw_count = raw.count()
        check_min_rows(raw_count, cfg)

        # 3. BRONZE
        bronze.write_bronze(raw, cfg, self.run_id)
        bronze_df = bronze.read_bronze_batch(self.spark, cfg, self.run_id)

        # 4. SILVER preparation: cleanse -> type -> validate
        typed = silver.build_typed(bronze_df, cfg).cache()
        typed_count = typed.count()
        valid, rejected, validation_results = silver.validate(typed, cfg)
        valid_count, rejected_count = valid.count(), rejected.count()
        self.audit.validations(validation_results)

        # 5. threshold gate (compare with previous runs BEFORE anything is published)
        metrics = compute_metrics(valid, valid_count, rejected_count, cfg.thresholds)
        thresholds = check_thresholds(metrics, cfg.thresholds, self.reader.metric_baseline(self.source_id))
        self.audit.metrics(metrics)
        self.audit.thresholds(thresholds)
        threshold_warnings = [t for t in thresholds if t["Status"] == "WARN"]
        threshold_blockers = [t for t in thresholds if t["Status"] == "ERROR"]

        if rejected_count:
            silver.write_quarantine(rejected, cfg)

        if threshold_blockers or valid_count == 0:
            findings = ([self._describe_threshold(t) for t in threshold_blockers]
                        or ["No valid rows left after validation"])
            self.audit.files(self._in_flight, "REJECTED", "; ".join(findings)[:480])
            send_alert(cfg, self.run_id, "FAILED", "Load blocked", findings)
            raise PipelineBlocked("; ".join(findings))

        # 6. SILVER write (SCD) -> GOLD -> client target
        silver.write_silver(valid, self.spark, cfg)
        published = gold.build_gold_frame(self.spark, cfg, valid, self.run_id).cache()
        published_count = published.count()
        writer = get_writer(self.spark, cfg)
        writer.write(published, self.run_id)

        # 7. reconciliation
        sum_cols = sorted({r.column for r in cfg.recon_rules if r.check_type == "SUM" and r.stage == "SILVER_TO_TARGET"})
        readback = writer.read_back(self.run_id, sum_cols)
        recon = reconcile(cfg, typed, typed_count, valid, valid_count, rejected, rejected_count,
                          published, published_count, readback)
        self.audit.reconciliation(recon)
        recon_failures = [r for r in recon if r["Status"] == "MISMATCH"]

        # 8. wrap up: audit, archive, alert
        self.audit.files(self._in_flight, "PROCESSED")
        self._archive(cfg, self._in_flight, rejected=False)

        findings = ([self._describe_threshold(t) for t in threshold_warnings] +
                    [f"Reconciliation mismatch {r['Stage']} {r['CheckType']} {r['ColumnName']}: "
                     f"expected {r['ExpectedValue']}, found {r['ActualValue']}" for r in recon_failures])
        status = "WARNING" if findings else "SUCCESS"
        if findings:
            send_alert(cfg, self.run_id, "WARNING", "Threshold / reconciliation warning", findings)

        validation_warns = [r for r in validation_results if r["Severity"] == "WARN" and r["FailedRows"] > 0]
        message = (f"{raw_count} read, {typed_count} after cleansing, {valid_count} valid, {rejected_count} rejected, "
                   f"{published_count} published; {len(validation_warns)} warn-rules triggered")
        typed.unpersist()
        published.unpersist()
        return self._summary(status, raw_count, valid_count, rejected_count, published_count, message)

    # ------------------------------------------------------------------ helpers
    @staticmethod
    def _describe_threshold(t: dict) -> str:
        label = t["MetricName"] + (f"({t['ColumnName']})" if t["ColumnName"] else "")
        return (f"{label}: current {t['CurrentValue']:.2f} vs baseline {t['BaselineValue']:.2f} "
                f"= {t['DeviationPct']:.1f}% change (allowed {t['MaxDeviationPct']}%)")

    def _archive(self, cfg: SourceConfig, files: List[FileInfo], rejected: bool) -> None:
        if not cfg:
            return
        for f in files:
            try:
                self.dbutils.fs.mv(f.path, archive_path(cfg.client_code, cfg.source_name, f.name, rejected))
            except Exception as exc:                                # noqa: BLE001
                log.error("Could not archive %s: %s", f.path, exc)

    def _summary(self, status, rows_read=0, rows_valid=0, rows_rejected=0, rows_loaded=0, message="") -> dict:
        return {"status": status, "rows_read": rows_read, "rows_valid": rows_valid,
                "rows_rejected": rows_rejected, "rows_loaded": rows_loaded, "message": message}

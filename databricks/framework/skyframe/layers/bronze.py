"""BRONZE = raw data exactly as received (all strings) + lineage columns. Append-only Delta."""
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

from skyframe.config.models import SourceConfig
from skyframe.utils.paths import bronze_path


def write_bronze(df: DataFrame, cfg: SourceConfig, run_id: str) -> str:
    path = bronze_path(cfg.client_code, cfg.source_name)
    (df.withColumn("_run_id", F.lit(run_id))
       .withColumn("_ingested_at", F.current_timestamp())
       .withColumn("_ingest_date", F.current_date())
       .write.format("delta").mode("append").option("mergeSchema", "true")
       .partitionBy("_ingest_date").save(path))
    return path


def read_bronze_batch(spark: SparkSession, cfg: SourceConfig, run_id: str) -> DataFrame:
    """Re-read what we just wrote, so silver always starts from the stored bronze copy."""
    return (spark.read.format("delta").load(bronze_path(cfg.client_code, cfg.source_name))
            .filter(F.col("_run_id") == run_id).drop("_ingest_date"))

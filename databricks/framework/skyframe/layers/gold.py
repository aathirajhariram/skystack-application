"""GOLD = the client-facing shape that is delivered to the client's own database."""
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

from skyframe.config.models import SourceConfig
from skyframe.layers.silver import read_silver_current


def build_gold_frame(spark: SparkSession, cfg: SourceConfig, valid_batch_df: DataFrame, run_id: str) -> DataFrame:
    """APPEND    -> only this batch's valid rows
       OVERWRITE -> the full current snapshot from silver (current versions only for SCD2)"""
    source = read_silver_current(spark, cfg) if cfg.write_mode == "OVERWRITE" else valid_batch_df
    return (source.select(*[F.col(f"`{c}`") for c in cfg.target_columns])
                  .withColumn("_run_id", F.lit(run_id))
                  .withColumn("_loaded_at", F.current_timestamp()))

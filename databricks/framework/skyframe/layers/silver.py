"""SILVER = cleansed, typed, validated, history-managed (SCD). Rejected rows go to quarantine."""
from typing import List, Tuple

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

from skyframe.cleansing.cleaners import cleanse
from skyframe.cleansing.type_casting import apply_mapping
from skyframe.config.models import SourceConfig
from skyframe.scd.scd_handler import SCD2_COLS, apply_scd
from skyframe.utils.paths import quarantine_path, silver_path
from skyframe.validation.validation_engine import run_validations


def build_typed(bronze_df: DataFrame, cfg: SourceConfig) -> DataFrame:
    return apply_mapping(cleanse(bronze_df), cfg.columns,
                         decimal_comma=bool(cfg.file_options.get("decimal_comma", False)))


def validate(typed_df: DataFrame, cfg: SourceConfig) -> Tuple[DataFrame, DataFrame, List[dict]]:
    return run_validations(typed_df, cfg)


def write_quarantine(rejected_df: DataFrame, cfg: SourceConfig) -> None:
    (rejected_df.write.format("delta").mode("append").option("mergeSchema", "true")
     .save(quarantine_path(cfg.client_code, cfg.source_name)))


def write_silver(valid_df: DataFrame, spark: SparkSession, cfg: SourceConfig) -> None:
    apply_scd(spark, valid_df, silver_path(cfg.client_code, cfg.source_name),
              cfg.scd_type, cfg.business_keys, cfg.tracked_columns)


def read_silver_current(spark: SparkSession, cfg: SourceConfig) -> DataFrame:
    df = spark.read.format("delta").load(silver_path(cfg.client_code, cfg.source_name))
    if cfg.scd_type == 2:
        df = df.filter("_is_current = true")
    return df

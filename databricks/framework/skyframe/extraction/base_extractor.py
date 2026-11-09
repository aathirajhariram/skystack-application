"""Every extractor returns a DataFrame where ALL columns are strings (raw bronze data)
plus a `_source_file` column. Typing/cleansing happens later in silver."""
from abc import ABC, abstractmethod
from functools import reduce
from typing import List

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructField, StructType

from skyframe.config.models import ColumnMap


class BaseExtractor(ABC):
    def __init__(self, spark: SparkSession, options: dict):
        self.spark = spark
        self.options = options or {}

    @abstractmethod
    def extract(self, paths: List[str], columns: List[ColumnMap]) -> DataFrame:
        """Read the given files and return a raw all-string DataFrame."""

    # ---- helpers shared by subclasses -------------------------------------------------
    @staticmethod
    def union_all(frames: List[DataFrame]) -> DataFrame:
        return reduce(lambda a, b: a.unionByName(b, allowMissingColumns=True), frames)

    def from_records(self, records: List[dict], path: str) -> DataFrame:
        """Build an all-string DataFrame from a list of dicts (pandas/XML based readers)."""
        names = sorted({k for r in records for k in r})
        schema = StructType([StructField(n, StringType(), True) for n in names])
        rows = [tuple(None if r.get(n) is None else str(r.get(n)) for n in names) for r in records]
        return self.spark.createDataFrame(rows, schema).withColumn("_source_file", F.lit(path))

    @staticmethod
    def stringify(df: DataFrame) -> DataFrame:
        return df.select([F.col(f"`{c}`").cast("string").alias(c) for c in df.columns])

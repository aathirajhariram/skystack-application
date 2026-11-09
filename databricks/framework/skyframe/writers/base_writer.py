from abc import ABC, abstractmethod
from typing import List, Optional

from pyspark.sql import DataFrame, SparkSession

from skyframe.config.models import SourceConfig


class TargetWriter(ABC):
    def __init__(self, spark: SparkSession, cfg: SourceConfig):
        self.spark = spark
        self.cfg = cfg

    @abstractmethod
    def write(self, df: DataFrame, run_id: str) -> None:
        """Deliver the gold frame to the client's target."""

    def read_back(self, run_id: str, sum_columns: List[str]) -> Optional[dict]:
        """Return {"rows": n, "sums": {col: total}} for rows written by this run, or None if unsupported."""
        return None

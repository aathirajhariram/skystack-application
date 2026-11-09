from typing import List, Optional

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from skyframe.utils.paths import gold_path
from skyframe.writers.base_writer import TargetWriter


class DeltaWriter(TargetWriter):
    """Writes a Delta table in the gold container (for clients who read via Power BI / Synapse)."""

    @property
    def path(self) -> str:
        return gold_path(self.cfg.client_code, self.cfg.target_table)

    def write(self, df: DataFrame, run_id: str) -> None:
        writer = df.write.format("delta")
        if self.cfg.write_mode == "OVERWRITE":
            writer.mode("overwrite").option("overwriteSchema", "true").save(self.path)
        else:
            writer.mode("append").option("mergeSchema", "true").save(self.path)

    def read_back(self, run_id: str, sum_columns: List[str]) -> Optional[dict]:
        df = self.spark.read.format("delta").load(self.path).filter(F.col("_run_id") == run_id)
        aggs = [F.count(F.lit(1)).alias("n")] + [F.sum(F.col(f"`{c}`").cast("double")).alias(f"s_{i}")
                                                  for i, c in enumerate(sum_columns)]
        row = df.agg(*aggs).first()
        return {"rows": int(row["n"]), "sums": {c: float(row[f"s_{i}"] or 0.0) for i, c in enumerate(sum_columns)}}

from typing import List

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from skyframe.extraction.base_extractor import BaseExtractor


class CsvExtractor(BaseExtractor):
    """options: delimiter, header, encoding, quote, escape, multi_line"""

    def extract(self, paths: List[str], columns) -> DataFrame:
        o = self.options
        df = (self.spark.read
              .option("header", str(o.get("header", True)).lower())
              .option("sep", o.get("delimiter", ","))
              .option("encoding", o.get("encoding", "UTF-8"))
              .option("quote", o.get("quote", '"'))
              .option("escape", o.get("escape", '"'))
              .option("multiLine", str(o.get("multi_line", False)).lower())
              .option("inferSchema", "false")
              .option("mode", "PERMISSIVE")
              .csv(paths))
        return df.withColumn("_source_file", F.col("_metadata.file_path"))

from typing import List

from pyspark.sql import DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import StructType

from skyframe.extraction.base_extractor import BaseExtractor


class JsonExtractor(BaseExtractor):
    """options: multi_line (true = one JSON document / array per file, false = JSON lines)
    Nested objects are flattened to `parent_child` columns; arrays are kept as JSON strings."""

    def extract(self, paths: List[str], columns) -> DataFrame:
        df = (self.spark.read
              .option("multiLine", str(self.options.get("multi_line", True)).lower())
              .json(paths))
        df = df.withColumn("_source_file", F.col("_metadata.file_path"))
        return self.stringify(self._flatten(df))

    def _flatten(self, df: DataFrame) -> DataFrame:
        while any(isinstance(f.dataType, StructType) for f in df.schema.fields):
            cols = []
            for f in df.schema.fields:
                if isinstance(f.dataType, StructType):
                    cols += [F.col(f"`{f.name}`.`{c.name}`").alias(f"{f.name}_{c.name}") for c in f.dataType.fields]
                elif f.dataType.simpleString().startswith("array"):
                    cols.append(F.to_json(F.col(f"`{f.name}`")).alias(f.name))
                else:
                    cols.append(F.col(f"`{f.name}`"))
            df = df.select(*cols)
        return df

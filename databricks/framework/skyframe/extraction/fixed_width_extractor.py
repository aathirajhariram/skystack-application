from typing import List

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from skyframe.extraction.base_extractor import BaseExtractor


class FixedWidthExtractor(BaseExtractor):
    """Mainframe / legacy ERP fixed-width files. Positions come from cfg.ColumnMapping
    (FixedStart is 1-based, FixedLength in characters). options: skip_header_lines"""

    def extract(self, paths: List[str], columns) -> DataFrame:
        spec = [c for c in columns if c.fixed_start and c.fixed_length]
        if not spec:
            raise ValueError("FIXED_WIDTH needs FixedStart/FixedLength on every cfg.ColumnMapping row")
        skip = int(self.options.get("skip_header_lines", 0))
        df = self.spark.read.text(paths).withColumn("_source_file", F.col("_metadata.file_path"))
        if skip:
            w = Window.partitionBy("_source_file").orderBy(F.monotonically_increasing_id())
            df = df.withColumn("_n", F.row_number().over(w)).filter(F.col("_n") > skip)
        return df.select(*[F.trim(F.substring("value", c.fixed_start, c.fixed_length)).alias(c.source_column)
                           for c in spec], "_source_file")

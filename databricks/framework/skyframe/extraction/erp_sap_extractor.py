from typing import List

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from skyframe.extraction.base_extractor import BaseExtractor


class SapFlatExtractor(BaseExtractor):
    """SAP list / ALV downloads and similar ERP text reports:
        ----------------------------
        | Material | Plant | Qty   |
        ----------------------------
        | 1000234  | 1010  | 25.00 |
    options: delimiter (default "|"), skip_rows (title lines before the table, default 0)"""

    def extract(self, paths: List[str], columns) -> DataFrame:
        delim = self.options.get("delimiter", "|")
        skip = int(self.options.get("skip_rows", 0))
        frames = []
        for path in paths:
            lines = (self.spark.read.text(path)
                     .withColumn("_n", F.row_number().over(Window.orderBy(F.monotonically_increasing_id())))
                     .filter(F.col("_n") > skip)
                     .filter(F.trim("value") != "")
                     .filter(~F.col("value").rlike(r"^[\s\-=+*_]+$")))          # separator lines
            parts = lambda c: F.split(F.regexp_replace(F.trim(c), f"^\\{delim}|\\{delim}$", ""), f"\\{delim}")
            header_line = lines.orderBy("_n").first()["value"]
            header = [h.strip() for h in header_line.strip().strip(delim).split(delim)]
            body = lines.filter(F.col("value") != header_line).select(parts(F.col("value")).alias("p"))
            frames.append(body.select(*[F.trim(F.col("p")[i]).alias(h) for i, h in enumerate(header)])
                          .withColumn("_source_file", F.lit(path)))
        return self.union_all(frames)

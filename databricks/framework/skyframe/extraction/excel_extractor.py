from io import BytesIO
from typing import List

import pandas as pd
from pyspark.sql import DataFrame

from skyframe.extraction.base_extractor import BaseExtractor
from skyframe.utils.file_io import read_bytes


class ExcelExtractor(BaseExtractor):
    """options: sheet_name (default first sheet), header_row (0-based), skip_footer
    Needs `openpyxl` on the cluster (pip install openpyxl)."""

    def extract(self, paths: List[str], columns) -> DataFrame:
        frames = []
        for path in paths:
            pdf = pd.read_excel(
                BytesIO(read_bytes(self.spark, path)),
                sheet_name=self.options.get("sheet_name", 0),
                header=self.options.get("header_row", 0),
                skipfooter=self.options.get("skip_footer", 0),
                dtype=str,
            )
            pdf.columns = [str(c).strip() for c in pdf.columns]
            pdf = pdf.dropna(how="all")
            frames.append(self.from_records(pdf.where(pdf.notna(), None).to_dict("records"), path))
        return self.union_all(frames)

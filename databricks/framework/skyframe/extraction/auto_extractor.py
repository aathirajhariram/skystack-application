from typing import Dict, List

from pyspark.sql import DataFrame

from skyframe.extraction.base_extractor import BaseExtractor

EXT_TO_FORMAT = {".csv": "CSV", ".txt": "CSV", ".xlsx": "EXCEL", ".json": "JSON"}


class AutoExtractor(BaseExtractor):
    """Picks the reader per file extension, so a client can upload csv, xlsx or json to the same source."""

    def extract(self, paths: List[str], columns) -> DataFrame:
        from skyframe.extraction.extractor_factory import get_extractor   # lazy: avoids a circular import

        groups: Dict[str, List[str]] = {}
        for path in paths:
            ext = "." + path.rsplit(".", 1)[-1].lower() if "." in path.rsplit("/", 1)[-1] else ""
            fmt = EXT_TO_FORMAT.get(ext)
            if not fmt:
                raise ValueError(f"Unsupported file type '{ext}' (supported: {sorted(EXT_TO_FORMAT)})")
            groups.setdefault(fmt, []).append(path)
        frames = [get_extractor(fmt, self.spark, self.options).extract(group, columns)
                  for fmt, group in groups.items()]
        return self.union_all(frames)

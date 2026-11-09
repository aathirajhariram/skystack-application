import xml.etree.ElementTree as ET
from typing import List

from pyspark.sql import DataFrame

from skyframe.extraction.base_extractor import BaseExtractor
from skyframe.utils.file_io import read_bytes


class XmlExtractor(BaseExtractor):
    """Generic XML: every <record_tag> element becomes one row.
    Child elements become columns, nested ones are named parent_child, attributes are @name.
    options: record_tag (required)"""

    default_record_tag = None

    def extract(self, paths: List[str], columns) -> DataFrame:
        tag = self.options.get("record_tag", self.default_record_tag)
        if not tag:
            raise ValueError("XML source needs FileOptions {\"record_tag\": \"<element name>\"}")
        frames = []
        for path in paths:
            root = ET.fromstring(read_bytes(self.spark, path))
            records = [self._flatten(el) for el in root.iter() if self._local(el.tag) == tag]
            if records:
                frames.append(self.from_records(records, path))
        if not frames:
            raise ValueError(f"No <{tag}> elements found in {paths}")
        return self.union_all(frames)

    @staticmethod
    def _local(tag: str) -> str:
        return tag.rsplit("}", 1)[-1]

    def _flatten(self, element, prefix: str = "") -> dict:
        out = {f"{prefix}@{self._local(k)}": v for k, v in element.attrib.items()}
        for child in element:
            name = f"{prefix}{self._local(child.tag)}"
            if len(child):
                out.update(self._flatten(child, f"{name}_"))
            else:
                out[name] = (child.text or "").strip() or None
        return out

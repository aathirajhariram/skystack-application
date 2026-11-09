"""File discovery and byte-level reads on ADLS (used by non-Spark formats like Excel/XML)."""
import hashlib
from dataclasses import dataclass
from typing import List

from pyspark.sql import SparkSession


@dataclass
class FileInfo:
    path: str
    name: str
    size: int
    fingerprint: str


def list_files(spark: SparkSession, folder: str, pattern: str = "*") -> List[FileInfo]:
    try:
        rows = (spark.read.format("binaryFile").option("pathGlobFilter", pattern)
                .load(folder).select("path", "length", "modificationTime").collect())
    except Exception:                      # folder missing / empty -> nothing to do
        return []
    files = []
    for r in rows:
        raw = f"{r['path']}|{r['length']}|{r['modificationTime']}".encode()
        files.append(FileInfo(r["path"], r["path"].rsplit("/", 1)[-1], int(r["length"]),
                              hashlib.sha256(raw).hexdigest()))
    return sorted(files, key=lambda f: f.name)


def read_bytes(spark: SparkSession, path: str) -> bytes:
    return bytes(spark.read.format("binaryFile").load(path).select("content").first()[0])

"""Checks done BEFORE any data is processed: what files are there, are they usable, are they new?"""
from dataclasses import dataclass, field
from typing import List, Tuple

from pyspark.sql import DataFrame

from skyframe.config.models import SourceConfig
from skyframe.utils.file_io import FileInfo


class IngestionError(Exception):
    """Raised when a file/batch is structurally unusable (missing columns, too few rows ...)."""


@dataclass
class FileDecision:
    to_process: List[FileInfo] = field(default_factory=list)
    duplicates: List[FileInfo] = field(default_factory=list)
    empty: List[FileInfo] = field(default_factory=list)


def classify_files(files: List[FileInfo], known_fingerprints: set) -> FileDecision:
    decision = FileDecision()
    for f in files:
        if f.size == 0:
            decision.empty.append(f)
        elif f.fingerprint in known_fingerprints:
            decision.duplicates.append(f)
        else:
            decision.to_process.append(f)
    return decision


def check_expected_columns(raw_df: DataFrame, cfg: SourceConfig) -> None:
    """Every mapped source column must exist in the file header."""
    present = {c.strip().lower() for c in raw_df.columns}
    missing = [c.source_column for c in cfg.columns if c.source_column.strip().lower() not in present]
    if missing:
        raise IngestionError(f"Missing expected columns in file: {missing}")


def check_min_rows(row_count: int, cfg: SourceConfig) -> None:
    if row_count < cfg.min_row_count:
        raise IngestionError(f"File has {row_count} rows, minimum expected is {cfg.min_row_count}")

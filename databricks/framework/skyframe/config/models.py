"""Plain dataclasses describing one source's configuration."""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class TargetConn:
    target_type: str                 # AZURE_SQL | COSMOS | DELTA
    server: Optional[str]
    database: Optional[str]
    schema: str
    container: Optional[str]
    credential_secret: Optional[str]


@dataclass
class ColumnMap:
    source_column: str
    target_column: str
    data_type: str = "string"
    date_format: Optional[str] = None
    is_business_key: bool = False
    is_nullable: bool = True
    default_value: Optional[str] = None
    track_changes: bool = True
    column_order: int = 0
    fixed_start: Optional[int] = None
    fixed_length: Optional[int] = None


@dataclass
class ValidationRuleCfg:
    rule_id: int
    rule_type: str
    column: str
    params: dict
    severity: str


@dataclass
class ThresholdRuleCfg:
    metric: str
    column: str
    max_deviation_pct: float
    baseline_runs: int
    severity: str


@dataclass
class ReconRuleCfg:
    stage: str
    check_type: str
    column: str
    tolerance_pct: float


@dataclass
class SourceConfig:
    source_id: int
    client_code: str
    client_name: str
    source_name: str
    file_format: str
    file_pattern: str
    file_options: dict
    target: TargetConn
    target_table: str
    write_mode: str
    scd_type: int
    min_row_count: int
    columns: List[ColumnMap] = field(default_factory=list)
    validations: List[ValidationRuleCfg] = field(default_factory=list)
    thresholds: List[ThresholdRuleCfg] = field(default_factory=list)
    recon_rules: List[ReconRuleCfg] = field(default_factory=list)
    recipients: List[str] = field(default_factory=list)

    @property
    def business_keys(self) -> List[str]:
        return [c.target_column for c in self.columns if c.is_business_key]

    @property
    def target_columns(self) -> List[str]:
        return [c.target_column for c in sorted(self.columns, key=lambda c: c.column_order)]

    @property
    def tracked_columns(self) -> List[str]:
        return [c.target_column for c in self.columns
                if c.track_changes and not c.is_business_key]

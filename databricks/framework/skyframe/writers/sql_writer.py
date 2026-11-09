import uuid
from typing import List, Optional

from pyspark.sql import DataFrame

from skyframe.utils import jdbc
from skyframe.utils.secrets import get_json_secret
from skyframe.writers.base_writer import TargetWriter


class AzureSqlWriter(TargetWriter):
    """Writes into the client's own Azure SQL database. Credential secret = {"user": "...", "password": "..."}.
    Tip: pre-create target tables for production; Spark will create missing ones with default types."""

    def __init__(self, spark, cfg):
        super().__init__(spark, cfg)
        t = cfg.target
        secret = get_json_secret(t.credential_secret)
        self.url = jdbc.sql_url(t.server, t.database)
        self.user, self.password = secret["user"], secret["password"]
        self.table = f"{t.schema}.{cfg.target_table}"

    def write(self, df: DataFrame, run_id: str) -> None:
        mode = "overwrite" if self.cfg.write_mode == "OVERWRITE" else "append"
        jdbc.write_table(df, self.url, self.user, self.password, self.table, mode)

    def read_back(self, run_id: str, sum_columns: List[str]) -> Optional[dict]:
        rid = str(uuid.UUID(run_id))                          # validates -> safe to inline
        sums = "".join(f", SUM(CAST([{c}] AS FLOAT)) AS [s_{i}]" for i, c in enumerate(sum_columns))
        row = jdbc.read_query(self.spark, self.url, self.user, self.password,
                              f"SELECT COUNT(*) AS n{sums} FROM {self.table} WHERE _run_id = '{rid}'").first()
        return {"rows": int(row["n"]), "sums": {c: float(row[f"s_{i}"] or 0.0) for i, c in enumerate(sum_columns)}}

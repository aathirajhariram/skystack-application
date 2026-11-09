"""Each rule turns config into a Spark Column that is TRUE when a row FAILS the rule."""
from typing import Callable, Dict, List

from pyspark.sql import Column, Window
from pyspark.sql import functions as F


def _cols(spec: str) -> List[str]:
    return [c.strip() for c in spec.split(",") if c.strip()]


def not_null(column: str, params: dict) -> Column:
    return F.col(f"`{column}`").isNull()


def unique(column: str, params: dict) -> Column:
    cols = _cols(column)
    window = Window.partitionBy(*[F.col(f"`{c}`") for c in cols])
    all_present = F.lit(True)
    for c in cols:
        all_present = all_present & F.col(f"`{c}`").isNotNull()
    return all_present & (F.count(F.lit(1)).over(window) > 1)


def value_range(column: str, params: dict) -> Column:
    c = F.col(f"`{column}`")
    fail = F.lit(False)
    if params.get("min") is not None:
        fail = fail | (c < F.lit(params["min"]))
    if params.get("max") is not None:
        fail = fail | (c > F.lit(params["max"]))
    return c.isNotNull() & fail


def regex(column: str, params: dict) -> Column:
    c = F.col(f"`{column}`").cast("string")
    return c.isNotNull() & ~c.rlike(params["pattern"])


def allowed_values(column: str, params: dict) -> Column:
    c = F.col(f"`{column}`").cast("string")
    return c.isNotNull() & ~c.isin(*[str(v) for v in params["values"]])


RULES: Dict[str, Callable[[str, dict], Column]] = {
    "NOT_NULL": not_null,
    "UNIQUE": unique,
    "RANGE": value_range,
    "REGEX": regex,
    "ALLOWED_VALUES": allowed_values,
}

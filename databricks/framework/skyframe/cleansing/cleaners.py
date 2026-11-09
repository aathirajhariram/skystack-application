"""Generic, config-free cleaning applied to every source before typing."""
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

NULL_TOKENS = ["", "null", "none", "n/a", "na", "nan", "nil", "-", "--", "#n/a", "#null!"]
META_COLUMNS = ("_source_file", "_run_id", "_ingested_at")


def standardise_headers(df: DataFrame) -> DataFrame:
    """Trim header names (keeps original case so they match cfg.ColumnMapping.SourceColumn)."""
    for c in df.columns:
        if c != c.strip():
            df = df.withColumnRenamed(c, c.strip())
    return df


def clean_strings(df: DataFrame) -> DataFrame:
    """Trim, collapse whitespace, strip BOM / control characters, turn null-like tokens into NULL."""
    cols = []
    for field in df.schema.fields:
        if field.name in META_COLUMNS or field.dataType.simpleString() != "string":
            cols.append(F.col(f"`{field.name}`"))
            continue
        c = F.col(f"`{field.name}`")
        c = F.regexp_replace(c, "[\\u0000-\\u001F\\u007F\\uFEFF]", "")
        c = F.trim(F.regexp_replace(c, "\\s+", " "))
        c = F.when(F.lower(c).isin(NULL_TOKENS), F.lit(None)).otherwise(c)
        cols.append(c.alias(field.name))
    return df.select(*cols)


def drop_empty_rows(df: DataFrame) -> DataFrame:
    data_cols = [c for c in df.columns if c not in META_COLUMNS]
    return df.dropna(how="all", subset=data_cols)


def drop_exact_duplicates(df: DataFrame) -> DataFrame:
    data_cols = [c for c in df.columns if c not in META_COLUMNS]
    return df.dropDuplicates(data_cols)


def cleanse(df: DataFrame) -> DataFrame:
    return drop_exact_duplicates(drop_empty_rows(clean_strings(standardise_headers(df))))

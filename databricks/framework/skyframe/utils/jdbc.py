"""Thin JDBC helpers for Azure SQL (control DB and client target DBs)."""
from pyspark.sql import DataFrame, SparkSession


def sql_url(server: str, database: str) -> str:
    return (f"jdbc:sqlserver://{server}:1433;database={database};encrypt=true;"
            f"trustServerCertificate=false;hostNameInCertificate=*.database.windows.net;loginTimeout=30;")


def read_query(spark: SparkSession, url: str, user: str, password: str, query: str) -> DataFrame:
    return (spark.read.format("jdbc")
            .option("url", url).option("user", user).option("password", password)
            .option("query", query)
            .option("driver", "com.microsoft.sqlserver.jdbc.SQLServerDriver")
            .load())


def write_table(df: DataFrame, url: str, user: str, password: str, table: str, mode: str = "append") -> None:
    writer = (df.write.format("jdbc")
              .option("url", url).option("user", user).option("password", password)
              .option("dbtable", table).option("batchsize", 10000)
              .option("driver", "com.microsoft.sqlserver.jdbc.SQLServerDriver"))
    if mode == "overwrite":
        writer = writer.option("truncate", "true")     # keep table definition, just replace rows
    writer.mode(mode).save()

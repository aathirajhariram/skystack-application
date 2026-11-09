"""Reads secrets from the Key Vault-backed Databricks secret scope."""
import json

from skyframe.config.settings import settings


def get_dbutils(spark=None):
    from pyspark.sql import SparkSession
    spark = spark or SparkSession.builder.getOrCreate()
    try:
        from pyspark.dbutils import DBUtils
        return DBUtils(spark)
    except ImportError:                       # running inside a notebook
        import IPython
        return IPython.get_ipython().user_ns["dbutils"]


def get_secret(key: str) -> str:
    return get_dbutils().secrets.get(scope=settings.secret_scope, key=key)


def get_json_secret(key: str) -> dict:
    return json.loads(get_secret(key))

"""Access to the control database (config + audit)."""
from pyspark.sql import DataFrame, SparkSession

from skyframe.config.settings import settings
from skyframe.utils import jdbc
from skyframe.utils.secrets import get_secret


class ControlDb:
    def __init__(self, spark: SparkSession):
        self.spark = spark
        self.url = jdbc.sql_url(settings.control_db_server, settings.control_db_name)
        self.user = get_secret(settings.control_db_user_secret)
        self.password = get_secret(settings.control_db_password_secret)

    def query(self, sql: str) -> DataFrame:
        return jdbc.read_query(self.spark, self.url, self.user, self.password, sql)

    def append(self, df: DataFrame, table: str) -> None:
        jdbc.write_table(df, self.url, self.user, self.password, table, "append")

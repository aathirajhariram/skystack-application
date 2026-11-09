from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from skyframe.utils.secrets import get_json_secret
from skyframe.writers.base_writer import TargetWriter


class CosmosWriter(TargetWriter):
    """Azure Cosmos DB (NoSQL API) via the Cosmos Spark connector
    (install Maven library com.azure.cosmos.spark:azure-cosmos-spark_3-5_2-12 on the cluster).
    Credential secret = {"key": "<account key>"}. Rows are UPSERTED by `id` (business keys hashed),
    so OVERWRITE behaves like upsert for Cosmos."""

    def write(self, df: DataFrame, run_id: str) -> None:
        t = self.cfg.target
        key = get_json_secret(t.credential_secret)["key"]
        if "id" not in df.columns:
            keys = self.cfg.business_keys or df.columns
            df = df.withColumn("id", F.sha2(F.concat_ws("||", *[F.col(f"`{k}`").cast("string") for k in keys]), 256))
        (df.write.format("cosmos.oltp")
           .option("spark.cosmos.accountEndpoint", t.server)
           .option("spark.cosmos.accountKey", key)
           .option("spark.cosmos.database", t.database)
           .option("spark.cosmos.container", t.container or self.cfg.target_table)
           .option("spark.cosmos.write.strategy", "ItemOverwrite")
           .mode("append").save())

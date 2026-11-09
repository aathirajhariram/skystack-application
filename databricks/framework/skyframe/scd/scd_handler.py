"""Slowly changing dimensions on the silver Delta table.
  SCD 0 : append only (facts / transactions)
  SCD 1 : upsert, history is overwritten
  SCD 2 : keep history with effective_from / effective_to / is_current"""
from typing import List

from delta.tables import DeltaTable
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

SCD2_COLS = ["_mk", "_row_hash", "_effective_from", "_effective_to", "_is_current"]


def _merge_key(keys: List[str]):
    return F.sha2(F.concat_ws("||", *[F.col(f"`{k}`").cast("string") for k in keys]), 256)


def _row_hash(cols: List[str]):
    return F.sha2(F.concat_ws("||", *[F.coalesce(F.col(f"`{c}`").cast("string"), F.lit("<null>")) for c in cols]), 256)


def apply_scd(spark: SparkSession, df: DataFrame, path: str, scd_type: int,
              keys: List[str], tracked: List[str]) -> None:
    if scd_type == 2:
        _scd2(spark, df, path, keys, tracked)
    elif scd_type == 1:
        _scd1(spark, df, path, keys)
    else:
        df.write.format("delta").mode("append").option("mergeSchema", "true").save(path)


def _scd1(spark, df, path, keys):
    src = df.withColumn("_mk", _merge_key(keys))
    if not DeltaTable.isDeltaTable(spark, path):
        src.write.format("delta").save(path)
        return
    cond = "t._mk = s._mk"
    (DeltaTable.forPath(spark, path).alias("t").merge(src.alias("s"), cond)
     .whenMatchedUpdateAll().whenNotMatchedInsertAll().execute())


def _scd2(spark, df, path, keys, tracked):
    now = F.current_timestamp()
    src = (df.withColumn("_mk", _merge_key(keys))
             .withColumn("_row_hash", _row_hash(tracked or [c for c in df.columns if c not in keys and not c.startswith("_")]))
             .withColumn("_effective_from", now)
             .withColumn("_effective_to", F.lit(None).cast("timestamp"))
             .withColumn("_is_current", F.lit(True)))
    if not DeltaTable.isDeltaTable(spark, path):
        src.write.format("delta").save(path)
        return

    target = DeltaTable.forPath(spark, path)
    current = (target.toDF().filter("_is_current = true")
               .select(F.col("_mk").alias("_cur_mk"), F.col("_row_hash").alias("_cur_hash")))
    # new keys, or keys whose tracked columns changed
    changed = (src.join(current, src["_mk"] == current["_cur_mk"], "left")
                  .filter(F.col("_cur_hash").isNull() | (F.col("_cur_hash") != F.col("_row_hash")))
                  .drop("_cur_mk", "_cur_hash"))

    # Classic SCD2 trick: each changed row appears twice -> once to CLOSE the old version, once to INSERT the new
    to_close = changed.withColumn("_merge_key", F.col("_mk"))
    to_insert = changed.withColumn("_merge_key", F.lit(None).cast("string"))
    stage = to_close.unionByName(to_insert)

    insert_values = {c: f"s.`{c}`" for c in src.columns}
    (target.alias("t").merge(stage.alias("s"), "t._mk = s._merge_key AND t._is_current = true")
     .whenMatchedUpdate(set={"_is_current": "false", "_effective_to": "s._effective_from"})
     .whenNotMatchedInsert(values=insert_values)
     .execute())

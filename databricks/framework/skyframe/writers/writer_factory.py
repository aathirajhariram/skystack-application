from skyframe.writers.cosmos_writer import CosmosWriter
from skyframe.writers.delta_writer import DeltaWriter
from skyframe.writers.sql_writer import AzureSqlWriter

WRITERS = {"AZURE_SQL": AzureSqlWriter, "COSMOS": CosmosWriter, "DELTA": DeltaWriter}


def get_writer(spark, cfg):
    try:
        return WRITERS[cfg.target.target_type](spark, cfg)
    except KeyError:
        raise ValueError(f"Unsupported target type '{cfg.target.target_type}'. Supported: {sorted(WRITERS)}")

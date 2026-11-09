# Databricks notebook source
# MAGIC %md
# MAGIC ### SkyStack generic pipeline
# MAGIC Called by Azure Data Factory with `source_id` and `run_id`. Everything else comes from the control DB.
# MAGIC Cluster needs: `openpyxl` (Excel files), Cosmos Spark connector (only for Cosmos targets), Delta (built in).

# COMMAND ----------
import json
import os
import sys

dbutils.widgets.text("source_id", "")
dbutils.widgets.text("run_id", "")
dbutils.widgets.text("framework_path", "")        # optional override, e.g. /Workspace/Repos/<you>/skystack-platform/databricks/framework

source_id = int(dbutils.widgets.get("source_id"))
run_id = dbutils.widgets.get("run_id")
framework_path = dbutils.widgets.get("framework_path") or os.path.abspath(os.path.join(os.getcwd(), "..", "framework"))
if framework_path not in sys.path:
    sys.path.insert(0, framework_path)

# COMMAND ----------
from skyframe.pipeline.pipeline_runner import PipelineRunner

summary = PipelineRunner(spark, source_id, run_id).run()     # raises on failure -> ADF marks the activity failed
print(summary)

# COMMAND ----------
dbutils.notebook.exit(json.dumps(summary))                   # ADF reads this to close the run in audit.PipelineRun

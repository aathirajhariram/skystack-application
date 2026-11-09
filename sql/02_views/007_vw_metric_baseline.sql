-- Previous runs' metrics, newest first (RunRank = 1 is the most recent earlier run).
-- Failed runs are excluded so a bad load never becomes the "normal".
CREATE OR ALTER VIEW audit.vw_MetricBaseline AS
SELECT  m.SourceId, m.MetricName, m.ColumnName, m.MetricValue, m.RunId, m.CapturedAt,
        ROW_NUMBER() OVER (PARTITION BY m.SourceId, m.MetricName, m.ColumnName
                           ORDER BY m.CapturedAt DESC) AS RunRank
FROM    audit.MetricHistory m
JOIN    audit.PipelineRun   r ON r.RunId = m.RunId AND r.Status IN ('SUCCESS','WARNING');
GO

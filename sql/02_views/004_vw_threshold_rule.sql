CREATE OR ALTER VIEW cfg.vw_ThresholdRule AS
SELECT ThresholdId, SourceId, MetricName, ISNULL(ColumnName, '') AS ColumnName,
       MaxDeviationPct, BaselineRuns, Severity
FROM   cfg.ThresholdRule
WHERE  IsActive = 1;
GO

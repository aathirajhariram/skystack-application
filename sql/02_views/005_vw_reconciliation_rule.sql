CREATE OR ALTER VIEW cfg.vw_ReconciliationRule AS
SELECT ReconId, SourceId, Stage, CheckType, ISNULL(ColumnName, '') AS ColumnName, TolerancePct
FROM   cfg.ReconciliationRule
WHERE  IsActive = 1;
GO

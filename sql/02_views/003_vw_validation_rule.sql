CREATE OR ALTER VIEW cfg.vw_ValidationRule AS
SELECT RuleId, SourceId, RuleType, ColumnName, RuleParams, Severity
FROM   cfg.ValidationRule
WHERE  IsActive = 1;
GO

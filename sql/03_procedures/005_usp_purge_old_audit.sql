-- Housekeeping: keep metric/validation history for N days (default 1 year).
CREATE OR ALTER PROCEDURE audit.usp_PurgeOldAudit
    @RetentionDays INT = 365
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @cut DATETIME2 = DATEADD(DAY, -@RetentionDays, SYSUTCDATETIME());
    DELETE FROM audit.ValidationResult     WHERE CheckedAt  < @cut;
    DELETE FROM audit.ThresholdResult      WHERE CheckedAt  < @cut;
    DELETE FROM audit.ReconciliationResult WHERE CheckedAt  < @cut;
    DELETE FROM audit.MetricHistory        WHERE CapturedAt < @cut;
END
GO

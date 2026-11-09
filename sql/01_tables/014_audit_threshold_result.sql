CREATE TABLE audit.ThresholdResult (
    ResultId        BIGINT IDENTITY(1,1) PRIMARY KEY,
    RunId           UNIQUEIDENTIFIER NOT NULL,
    MetricName      VARCHAR(20)   NOT NULL,
    ColumnName      VARCHAR(128)  NOT NULL DEFAULT '',
    CurrentValue    DECIMAL(38,6) NULL,
    BaselineValue   DECIMAL(38,6) NULL,
    DeviationPct    DECIMAL(18,4) NULL,
    MaxDeviationPct DECIMAL(9,2)  NOT NULL,
    Status          VARCHAR(12)   NOT NULL,        -- OK | WARN | ERROR | NO_BASELINE
    CheckedAt       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

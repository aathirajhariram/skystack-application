-- Compares this run's metric with the average of previous runs.
CREATE TABLE cfg.ThresholdRule (
    ThresholdId     INT IDENTITY(1,1) PRIMARY KEY,
    SourceId        INT           NOT NULL REFERENCES cfg.Source(SourceId),
    MetricName      VARCHAR(20)   NOT NULL CHECK (MetricName IN ('ROW_COUNT','REJECT_PCT','NULL_PCT','SUM','AVG')),
    ColumnName      VARCHAR(128)  NULL,             -- required for NULL_PCT / SUM / AVG
    MaxDeviationPct DECIMAL(9,2)  NOT NULL,         -- allowed % change vs baseline
    BaselineRuns    INT           NOT NULL DEFAULT 5,
    Severity        VARCHAR(5)    NOT NULL DEFAULT 'WARN' CHECK (Severity IN ('WARN','ERROR')),
                    -- WARN = email developers | ERROR = email AND block the load
    IsActive        BIT           NOT NULL DEFAULT 1
);
GO

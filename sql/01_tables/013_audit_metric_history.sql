-- Every run stores its metrics; thresholds compare against this history.
CREATE TABLE audit.MetricHistory (
    MetricId    BIGINT IDENTITY(1,1) PRIMARY KEY,
    SourceId    INT              NOT NULL,
    RunId       UNIQUEIDENTIFIER NOT NULL,
    MetricName  VARCHAR(20)      NOT NULL,
    ColumnName  VARCHAR(128)     NOT NULL DEFAULT '',
    MetricValue DECIMAL(38,6)    NULL,
    CapturedAt  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_MetricHistory ON audit.MetricHistory (SourceId, MetricName, ColumnName, CapturedAt DESC);
GO

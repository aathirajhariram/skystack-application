CREATE TABLE audit.ReconciliationResult (
    ResultId      BIGINT IDENTITY(1,1) PRIMARY KEY,
    RunId         UNIQUEIDENTIFIER NOT NULL,
    Stage         VARCHAR(20)   NOT NULL,
    CheckType     VARCHAR(10)   NOT NULL,
    ColumnName    VARCHAR(128)  NOT NULL DEFAULT '',
    ExpectedValue DECIMAL(38,6) NULL,
    ActualValue   DECIMAL(38,6) NULL,
    DiffPct       DECIMAL(18,4) NULL,
    Status        VARCHAR(10)   NOT NULL,          -- MATCH | MISMATCH | SKIPPED
    CheckedAt     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE audit.ValidationResult (
    ResultId    BIGINT IDENTITY(1,1) PRIMARY KEY,
    RunId       UNIQUEIDENTIFIER NOT NULL,
    RuleName    VARCHAR(200)  NOT NULL,
    RuleType    VARCHAR(20)   NOT NULL,
    ColumnName  VARCHAR(256)  NULL,
    Severity    VARCHAR(5)    NOT NULL,
    FailedRows  BIGINT        NOT NULL,
    TotalRows   BIGINT        NOT NULL,
    CheckedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

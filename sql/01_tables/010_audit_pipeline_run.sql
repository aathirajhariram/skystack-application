CREATE TABLE audit.PipelineRun (
    RunId         UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    SourceId      INT              NOT NULL REFERENCES cfg.Source(SourceId),
    Status        VARCHAR(10)      NOT NULL CHECK (Status IN ('RUNNING','SUCCESS','WARNING','FAILED','NO_FILES')),
    TriggeredBy   VARCHAR(100)     NULL,           -- ADF pipeline run id
    StartedAt     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    EndedAt       DATETIME2        NULL,
    RowsRead      BIGINT           NULL,
    RowsValid     BIGINT           NULL,
    RowsRejected  BIGINT           NULL,
    RowsLoaded    BIGINT           NULL,
    Message       NVARCHAR(MAX)    NULL
);
GO

CREATE TABLE audit.FileIngestion (
    FileId          BIGINT IDENTITY(1,1) PRIMARY KEY,
    SourceId        INT              NOT NULL REFERENCES cfg.Source(SourceId),
    RunId           UNIQUEIDENTIFIER NULL,
    FileName        VARCHAR(260)     NOT NULL,
    FileFingerprint CHAR(64)         NOT NULL,     -- sha256(path|size|modified) -> duplicate detection
    FileSizeBytes   BIGINT           NULL,
    Status          VARCHAR(10)      NOT NULL CHECK (Status IN ('PROCESSED','REJECTED','DUPLICATE')),
    Reason          NVARCHAR(500)    NULL,
    ProcessedAt     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_FileIngestion_Fingerprint ON audit.FileIngestion (SourceId, FileFingerprint);
GO

-- Editing lock for table entry: one person at a time per client and data type. A lock expires by itself.
IF OBJECT_ID('portal.EntryLock', 'U') IS NULL
CREATE TABLE portal.EntryLock (
    ClientId    INT              NOT NULL REFERENCES cfg.Client(ClientId),
    SourceName  VARCHAR(100)     NOT NULL,
    UserId      UNIQUEIDENTIFIER NOT NULL,
    UserEmail   NVARCHAR(200)    NOT NULL,
    DisplayName NVARCHAR(200)    NOT NULL,
    LockedAt    DATETIME2        NOT NULL,
    ExpiresAt   DATETIME2        NOT NULL,
    CONSTRAINT PK_EntryLock PRIMARY KEY (ClientId, SourceName)
);
GO

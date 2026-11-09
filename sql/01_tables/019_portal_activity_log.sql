CREATE TABLE portal.ActivityLog (
    LogId    BIGINT IDENTITY(1,1) PRIMARY KEY,
    ClientId INT           NULL,
    UserId   UNIQUEIDENTIFIER NULL,
    Actor    NVARCHAR(200) NULL,                    -- e-mail of whoever did it (or ops user)
    Action   VARCHAR(40)   NOT NULL,                -- LOGIN, PASSWORD_CHANGED, USER_INVITED, ROLE_CHANGED, UPLOAD ...
    Detail   NVARCHAR(500) NULL,
    At       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ActivityLog_Client ON portal.ActivityLog (ClientId, At DESC);
GO

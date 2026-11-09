-- Per-employee dashboard visibility. A row HIDES that data source's dashboard (and uploads) from that user.
-- No rows = the user sees everything their role allows. Admins are never restricted.
CREATE TABLE portal.UserHiddenSource (
    UserId   UNIQUEIDENTIFIER NOT NULL REFERENCES portal.PortalUser(UserId),
    SourceId INT              NOT NULL REFERENCES cfg.Source(SourceId),
    CONSTRAINT PK_UserHiddenSource PRIMARY KEY (UserId, SourceId)
);
GO

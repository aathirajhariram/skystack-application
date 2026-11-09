-- Portal users. The PASSWORD HASH is NOT here: it lives in Key Vault as secret "pw-<UserId>".
CREATE TABLE portal.PortalUser (
    UserId                UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    ClientId              INT           NOT NULL REFERENCES cfg.Client(ClientId),
    Email                 NVARCHAR(200) NOT NULL,
    DisplayName           NVARCHAR(200) NOT NULL,
    Role                  VARCHAR(10)   NOT NULL CHECK (Role IN ('admin','uploader','viewer')),
                          -- admin: everything | uploader: dashboards + uploads | viewer: dashboards only
    IsEnabled             BIT           NOT NULL DEFAULT 1,
    MustChangePassword    BIT           NOT NULL DEFAULT 1,
    TempPasswordExpiresAt DATETIME2     NULL,
    FailedAttempts        INT           NOT NULL DEFAULT 0,
    LockedUntil           DATETIME2     NULL,
    LastLoginAt           DATETIME2     NULL,
    CreatedAt             DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedBy             NVARCHAR(200) NULL
);
CREATE UNIQUE INDEX UX_PortalUser_Email ON portal.PortalUser (Email);
CREATE INDEX IX_PortalUser_Client ON portal.PortalUser (ClientId);
GO

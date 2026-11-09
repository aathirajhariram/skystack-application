CREATE OR ALTER VIEW portal.vw_UserAccount AS
SELECT  u.UserId, u.ClientId, u.Email, u.DisplayName, u.Role, u.IsEnabled, u.MustChangePassword,
        u.TempPasswordExpiresAt, u.FailedAttempts, u.LockedUntil, u.LastLoginAt,
        c.ClientCode, c.ClientName, c.IsActive AS ClientActive
FROM    portal.PortalUser u
JOIN    cfg.Client c ON c.ClientId = u.ClientId;
GO

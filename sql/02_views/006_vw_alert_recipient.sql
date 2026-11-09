-- Recipients per source = global developers (ClientId NULL) + the client's own recipients.
CREATE OR ALTER VIEW cfg.vw_AlertRecipient AS
SELECT s.SourceId, r.Email, r.RecipientRole
FROM   cfg.Source s
JOIN   cfg.AlertRecipient r
       ON r.IsActive = 1 AND (r.ClientId IS NULL OR r.ClientId = s.ClientId);
GO

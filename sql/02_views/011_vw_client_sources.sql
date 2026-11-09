-- Upload dropdown + template download in the portal.
CREATE OR ALTER VIEW portal.vw_ClientSources AS
SELECT c.ClientCode, s.SourceId, s.SourceName, s.FileFormat, s.TargetTable
FROM   cfg.Source s
JOIN   cfg.Client c ON c.ClientId = s.ClientId
WHERE  s.IsActive = 1 AND c.IsActive = 1;
GO

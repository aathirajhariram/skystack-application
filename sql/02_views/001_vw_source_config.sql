-- Everything the framework needs to know about one source, in one row.
CREATE OR ALTER VIEW cfg.vw_SourceConfig AS
SELECT  s.SourceId, c.ClientId, c.ClientCode, c.ClientName, c.Industry,
        s.SourceName, s.FileFormat, s.FilePattern, s.FileOptions,
        s.TargetTable, s.WriteMode, s.ScdType, s.MinRowCount, s.ScheduleGroup,
        t.ConnectionId, t.TargetType, t.ServerName, t.DatabaseName, t.SchemaName,
        t.ContainerName, t.CredentialSecretName
FROM    cfg.Source s
JOIN    cfg.Client c            ON c.ClientId = s.ClientId AND c.IsActive = 1
JOIN    cfg.TargetConnection t  ON t.ConnectionId = s.TargetConnectionId AND t.IsActive = 1
WHERE   s.IsActive = 1;
GO

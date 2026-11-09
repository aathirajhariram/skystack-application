-- Tiles joined with where each client's data lives (portal supports AZURE_SQL targets).
CREATE OR ALTER VIEW cfg.vw_DashboardTile AS
SELECT  c.ClientCode, s.SourceId, s.SourceName, s.TargetTable,
        t.ServerName, t.DatabaseName, t.SchemaName,
        d.TileId, d.Title, d.TileType, d.Aggregation, d.MeasureColumn, d.GroupColumn, d.DateColumn,
        d.NumberFormat, d.DisplayOrder
FROM    cfg.DashboardTile d
JOIN    cfg.Source s           ON s.SourceId = d.SourceId AND s.IsActive = 1
JOIN    cfg.Client c           ON c.ClientId = s.ClientId AND c.IsActive = 1
JOIN    cfg.TargetConnection t ON t.ConnectionId = s.TargetConnectionId AND t.IsActive = 1
WHERE   d.IsActive = 1 AND t.TargetType = 'AZURE_SQL';
GO

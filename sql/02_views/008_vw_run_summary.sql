-- Feeds client dashboards / support screens: latest runs per client and source.
CREATE OR ALTER VIEW audit.vw_RunSummary AS
SELECT  c.ClientCode, s.SourceName, r.RunId, r.Status, r.StartedAt, r.EndedAt,
        DATEDIFF(SECOND, r.StartedAt, r.EndedAt) AS DurationSec,
        r.RowsRead, r.RowsValid, r.RowsRejected, r.RowsLoaded, r.Message
FROM    audit.PipelineRun r
JOIN    cfg.Source s ON s.SourceId = r.SourceId
JOIN    cfg.Client c ON c.ClientId = s.ClientId;
GO

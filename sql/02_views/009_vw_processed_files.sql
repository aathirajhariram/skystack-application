-- Fingerprints already handled -> duplicate-file detection.
CREATE OR ALTER VIEW audit.vw_ProcessedFiles AS
SELECT SourceId, FileFingerprint, FileName, Status, ProcessedAt
FROM   audit.FileIngestion
WHERE  Status IN ('PROCESSED','REJECTED');
GO

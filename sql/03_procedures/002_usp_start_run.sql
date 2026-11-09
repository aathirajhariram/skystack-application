-- Creates the run row and returns its id (ADF Lookup reads RunId and passes it to Databricks).
CREATE OR ALTER PROCEDURE audit.usp_StartRun
    @SourceId    INT,
    @TriggeredBy VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @RunId UNIQUEIDENTIFIER = NEWID();
    INSERT audit.PipelineRun (RunId, SourceId, Status, TriggeredBy)
    VALUES (@RunId, @SourceId, 'RUNNING', @TriggeredBy);
    SELECT CAST(@RunId AS VARCHAR(36)) AS RunId;
END
GO

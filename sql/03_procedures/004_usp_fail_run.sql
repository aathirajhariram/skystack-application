CREATE OR ALTER PROCEDURE audit.usp_FailRun
    @RunId   UNIQUEIDENTIFIER,
    @Message NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE audit.PipelineRun
    SET    Status = 'FAILED', EndedAt = SYSUTCDATETIME(), Message = LEFT(@Message, 4000)
    WHERE  RunId = @RunId;
END
GO

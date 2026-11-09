CREATE OR ALTER PROCEDURE audit.usp_EndRun
    @RunId        UNIQUEIDENTIFIER,
    @Status       VARCHAR(10),
    @RowsRead     BIGINT = NULL,
    @RowsValid    BIGINT = NULL,
    @RowsRejected BIGINT = NULL,
    @RowsLoaded   BIGINT = NULL,
    @Message      NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE audit.PipelineRun
    SET    Status = @Status, EndedAt = SYSUTCDATETIME(),
           RowsRead = @RowsRead, RowsValid = @RowsValid,
           RowsRejected = @RowsRejected, RowsLoaded = @RowsLoaded, Message = @Message
    WHERE  RunId = @RunId;
END
GO

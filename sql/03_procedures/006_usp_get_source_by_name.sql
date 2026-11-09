-- Used by the ADF "on upload" pipeline (folder path gives client + source).
CREATE OR ALTER PROCEDURE cfg.usp_GetSourceByName
    @ClientCode VARCHAR(30),
    @SourceName VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SourceId, ClientCode, SourceName
    FROM   cfg.vw_SourceConfig
    WHERE  ClientCode = @ClientCode AND SourceName = @SourceName;
END
GO

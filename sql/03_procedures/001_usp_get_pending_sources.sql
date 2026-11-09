-- Called by the ADF Lookup activity: which sources should run for this schedule?
CREATE OR ALTER PROCEDURE cfg.usp_GetPendingSources
    @ScheduleGroup VARCHAR(10),
    @ClientCode    VARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SourceId, ClientCode, SourceName
    FROM   cfg.vw_SourceConfig
    WHERE  ScheduleGroup = @ScheduleGroup
      AND  (@ClientCode IS NULL OR @ClientCode = '' OR ClientCode = @ClientCode)
    ORDER  BY ClientCode, SourceName;
END
GO

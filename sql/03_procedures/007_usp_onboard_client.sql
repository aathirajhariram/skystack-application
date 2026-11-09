-- "Subscribe a client": one call creates everything the framework and the portal need.
-- Called by the SkyStack ops service after the client's database exists.
CREATE OR ALTER PROCEDURE cfg.usp_OnboardClient
    @ClientCode    VARCHAR(30),
    @ClientName    NVARCHAR(200),
    @Industry      VARCHAR(50),
    @AdminEmail    NVARCHAR(200),
    @AdminName     NVARCHAR(200),
    @SqlServer     VARCHAR(200),
    @SqlDatabase   VARCHAR(100),
    @EtlSecretName VARCHAR(120),
    @CreatedBy     NVARCHAR(200) = NULL,
    @PlanCode      VARCHAR(20)   = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM cfg.SourceTemplate WHERE Industry = @Industry) THROW 50001, 'Unknown industry', 1;
    IF EXISTS (SELECT 1 FROM cfg.Client WHERE ClientCode = @ClientCode)          THROW 50002, 'Client code already exists', 1;
    IF EXISTS (SELECT 1 FROM portal.PortalUser WHERE Email = @AdminEmail)        THROW 50003, 'E-mail is already registered', 1;

    BEGIN TRAN;
    DECLARE @ClientId INT, @ConnId INT, @UserId UNIQUEIDENTIFIER = NEWID();

    INSERT cfg.Client (ClientCode, ClientName, Industry, PlanCode) VALUES (@ClientCode, @ClientName, @Industry, @PlanCode);
    SET @ClientId = SCOPE_IDENTITY();

    INSERT cfg.TargetConnection (ClientId, ConnectionName, TargetType, ServerName, DatabaseName, SchemaName, CredentialSecretName)
    VALUES (@ClientId, 'client_sql', 'AZURE_SQL', @SqlServer, @SqlDatabase, 'dbo', @EtlSecretName);
    SET @ConnId = SCOPE_IDENTITY();

    -- sources from the industry template (TemplateId -> new SourceId)
    DECLARE @map TABLE (TemplateId INT, SourceId INT);
    MERGE cfg.Source AS t
    USING (SELECT * FROM cfg.SourceTemplate WHERE Industry = @Industry) AS s ON 1 = 0
    WHEN NOT MATCHED THEN
        INSERT (ClientId, SourceName, FileFormat, FilePattern, TargetConnectionId, TargetTable, WriteMode, ScdType, MinRowCount, ScheduleGroup)
        VALUES (@ClientId, s.SourceName, s.FileFormat, '*', @ConnId, s.TargetTable, s.WriteMode, s.ScdType, 1, 'DAILY')
    OUTPUT s.TemplateId, inserted.SourceId INTO @map;

    INSERT cfg.ColumnMapping (SourceId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder)
    SELECT m.SourceId, c.SourceColumn, c.TargetColumn, c.DataType, c.DateFormat, c.IsBusinessKey, c.IsNullable, c.ColumnOrder
    FROM   cfg.ColumnTemplate c JOIN @map m ON m.TemplateId = c.TemplateId;

    INSERT cfg.DashboardTile (SourceId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder)
    SELECT m.SourceId, t.Title, t.TileType, t.Aggregation, t.MeasureColumn, t.GroupColumn, t.DateColumn, t.NumberFormat, t.DisplayOrder
    FROM   cfg.TileTemplate t JOIN @map m ON m.TemplateId = t.TemplateId;

    -- default safety net: warn developers if a load is 50% bigger/smaller than usual
    INSERT cfg.ThresholdRule (SourceId, MetricName, MaxDeviationPct, BaselineRuns, Severity)
    SELECT SourceId, 'ROW_COUNT', 50, 5, 'WARN' FROM @map;

    -- the first (admin) user; password is set by the ops service afterwards
    INSERT portal.PortalUser (UserId, ClientId, Email, DisplayName, Role, MustChangePassword, CreatedBy)
    VALUES (@UserId, @ClientId, @AdminEmail, @AdminName, 'admin', 1, @CreatedBy);

    INSERT portal.ActivityLog (ClientId, UserId, Actor, Action, Detail)
    VALUES (@ClientId, @UserId, @CreatedBy, 'CLIENT_SUBSCRIBED', CONCAT(@ClientCode, ' / ', @Industry));
    COMMIT;

    SELECT @ClientId AS ClientId, @UserId AS UserId;
END
GO

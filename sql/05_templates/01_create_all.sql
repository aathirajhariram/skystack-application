-- SkyStack control database: create everything. NO 'GO' lines, so it runs in the Azure portal Query editor in one go.
-- Run as skyadmin or as your Entra account. Safe to run after 00_DROP_EVERYTHING.sql. Then run 02_grants.sql as your Entra account.
SET NOCOUNT ON;

-- ===== 01_tables/001_schemas.sql =====
EXEC(N'-- Control database (Azure SQL). cfg = configuration, audit = run history.
IF SCHEMA_ID(''cfg'')   IS NULL EXEC(''CREATE SCHEMA cfg'');
IF SCHEMA_ID(''audit'') IS NULL EXEC(''CREATE SCHEMA audit'');
IF SCHEMA_ID(''portal'') IS NULL EXEC(''CREATE SCHEMA portal'');   -- portal users + activity log');

-- ===== 01_tables/002_cfg_client.sql =====
EXEC(N'CREATE TABLE cfg.Client (
    ClientId    INT IDENTITY(1,1) PRIMARY KEY,
    ClientCode  VARCHAR(30)   NOT NULL UNIQUE,      -- also the ADLS folder name and portal tenant id
    ClientName  NVARCHAR(200) NOT NULL,
    Industry    VARCHAR(50)   NOT NULL,             -- manufacturing, logistics, real_estate, ...
    PlanCode    VARCHAR(20)   NULL,                 -- basic | pro | elite (see cfg.[Plan])
    IsActive    BIT           NOT NULL DEFAULT 1,
    CreatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);');

-- ===== 01_tables/003_cfg_target_connection.sql =====
EXEC(N'-- Where a client''s data is delivered. Passwords/keys are NEVER stored here,
-- only the NAME of the Key Vault secret that holds them.
CREATE TABLE cfg.TargetConnection (
    ConnectionId         INT IDENTITY(1,1) PRIMARY KEY,
    ClientId             INT           NOT NULL REFERENCES cfg.Client(ClientId),
    ConnectionName       VARCHAR(60)   NOT NULL,
    TargetType           VARCHAR(20)   NOT NULL CHECK (TargetType IN (''AZURE_SQL'',''COSMOS'',''DELTA'')),
    ServerName           VARCHAR(200)  NULL,        -- SQL server FQDN or Cosmos endpoint
    DatabaseName         VARCHAR(100)  NULL,
    SchemaName           VARCHAR(50)   NOT NULL DEFAULT ''dbo'',
    ContainerName        VARCHAR(100)  NULL,        -- Cosmos container
    CredentialSecretName VARCHAR(120)  NULL,        -- SQL: {"user","password"} | Cosmos: {"key"}
    IsActive             BIT           NOT NULL DEFAULT 1,
    CONSTRAINT UQ_TargetConnection UNIQUE (ClientId, ConnectionName)
);');

-- ===== 01_tables/004_cfg_source.sql =====
EXEC(N'-- One row per file feed (e.g. "shipments" from client X). AUTO = pick the reader per file extension (csv/xlsx/json).
CREATE TABLE cfg.Source (
    SourceId           INT IDENTITY(1,1) PRIMARY KEY,
    ClientId           INT           NOT NULL REFERENCES cfg.Client(ClientId),
    SourceName         VARCHAR(50)   NOT NULL,      -- ADLS sub-folder: landing/<ClientCode>/<SourceName>/
    FileFormat         VARCHAR(20)   NOT NULL CHECK (FileFormat IN
                         (''AUTO'',''CSV'',''EXCEL'',''JSON'',''XML'',''FIXED_WIDTH'',''ERP_TALLY_XML'',''ERP_SAP_FLAT'')),
    FilePattern        VARCHAR(100)  NOT NULL DEFAULT ''*'',
    FileOptions        NVARCHAR(MAX) NULL CHECK (FileOptions IS NULL OR ISJSON(FileOptions) = 1),
                       -- e.g. {"delimiter":";","sheet_name":"Data","header_row":0,"record_tag":"VOUCHER"}
    TargetConnectionId INT           NOT NULL REFERENCES cfg.TargetConnection(ConnectionId),
    TargetTable        VARCHAR(128)  NOT NULL,
    WriteMode          VARCHAR(10)   NOT NULL DEFAULT ''APPEND'' CHECK (WriteMode IN (''APPEND'',''OVERWRITE'')),
                       -- APPEND: publish this batch | OVERWRITE: publish full current snapshot
    ScdType            TINYINT       NOT NULL DEFAULT 0 CHECK (ScdType IN (0,1,2)),
    MinRowCount        INT           NOT NULL DEFAULT 1,
    ScheduleGroup      VARCHAR(10)   NOT NULL DEFAULT ''DAILY'' CHECK (ScheduleGroup IN (''DAILY'',''WEEKLY'',''MONTHLY'',''ADHOC'')),
    IsActive           BIT           NOT NULL DEFAULT 1,
    CONSTRAINT UQ_Source UNIQUE (ClientId, SourceName)
);');

-- ===== 01_tables/005_cfg_column_mapping.sql =====
EXEC(N'CREATE TABLE cfg.ColumnMapping (
    MappingId      INT IDENTITY(1,1) PRIMARY KEY,
    SourceId       INT          NOT NULL REFERENCES cfg.Source(SourceId),
    SourceColumn   VARCHAR(128) NOT NULL,           -- header name in the file
    TargetColumn   VARCHAR(128) NOT NULL,
    DataType       VARCHAR(30)  NOT NULL DEFAULT ''string'',  -- string,int,bigint,double,decimal(18,2),date,timestamp,boolean
    DateFormat     VARCHAR(40)  NULL,               -- e.g. dd-MM-yyyy (for date/timestamp)
    IsBusinessKey  BIT          NOT NULL DEFAULT 0,
    IsNullable     BIT          NOT NULL DEFAULT 1,
    DefaultValue   VARCHAR(100) NULL,               -- used when value is null
    TrackChanges   BIT          NOT NULL DEFAULT 1, -- part of SCD2 change hash
    ColumnOrder    INT          NOT NULL DEFAULT 0,
    FixedStart     INT          NULL,               -- FIXED_WIDTH only (1-based)
    FixedLength    INT          NULL,               -- FIXED_WIDTH only
    CONSTRAINT UQ_ColumnMapping UNIQUE (SourceId, TargetColumn)
);');

-- ===== 01_tables/006_cfg_validation_rule.sql =====
EXEC(N'CREATE TABLE cfg.ValidationRule (
    RuleId      INT IDENTITY(1,1) PRIMARY KEY,
    SourceId    INT          NOT NULL REFERENCES cfg.Source(SourceId),
    RuleType    VARCHAR(20)  NOT NULL CHECK (RuleType IN (''NOT_NULL'',''UNIQUE'',''RANGE'',''REGEX'',''ALLOWED_VALUES'')),
    ColumnName  VARCHAR(256) NOT NULL,              -- TARGET column; UNIQUE accepts "colA,colB"
    RuleParams  NVARCHAR(MAX) NULL CHECK (RuleParams IS NULL OR ISJSON(RuleParams) = 1),
                -- RANGE {"min":0,"max":100} | REGEX {"pattern":"^[A-Z]{3}\\d+$"} | ALLOWED_VALUES {"values":["A","B"]}
    Severity    VARCHAR(5)   NOT NULL DEFAULT ''ERROR'' CHECK (Severity IN (''ERROR'',''WARN'')),
                -- ERROR = row goes to quarantine | WARN = row loads, issue is reported
    IsActive    BIT          NOT NULL DEFAULT 1
);');

-- ===== 01_tables/007_cfg_threshold_rule.sql =====
EXEC(N'-- Compares this run''s metric with the average of previous runs.
CREATE TABLE cfg.ThresholdRule (
    ThresholdId     INT IDENTITY(1,1) PRIMARY KEY,
    SourceId        INT           NOT NULL REFERENCES cfg.Source(SourceId),
    MetricName      VARCHAR(20)   NOT NULL CHECK (MetricName IN (''ROW_COUNT'',''REJECT_PCT'',''NULL_PCT'',''SUM'',''AVG'')),
    ColumnName      VARCHAR(128)  NULL,             -- required for NULL_PCT / SUM / AVG
    MaxDeviationPct DECIMAL(9,2)  NOT NULL,         -- allowed % change vs baseline
    BaselineRuns    INT           NOT NULL DEFAULT 5,
    Severity        VARCHAR(5)    NOT NULL DEFAULT ''WARN'' CHECK (Severity IN (''WARN'',''ERROR'')),
                    -- WARN = email developers | ERROR = email AND block the load
    IsActive        BIT           NOT NULL DEFAULT 1
);');

-- ===== 01_tables/008_cfg_reconciliation_rule.sql =====
EXEC(N'-- Row-count reconciliation is always on. Add rows here for SUM checks or custom tolerance.
CREATE TABLE cfg.ReconciliationRule (
    ReconId       INT IDENTITY(1,1) PRIMARY KEY,
    SourceId      INT           NOT NULL REFERENCES cfg.Source(SourceId),
    Stage         VARCHAR(20)   NOT NULL CHECK (Stage IN (''SOURCE_TO_SILVER'',''SILVER_TO_TARGET'')),
    CheckType     VARCHAR(10)   NOT NULL CHECK (CheckType IN (''ROW_COUNT'',''SUM'')),
    ColumnName    VARCHAR(128)  NULL,
    TolerancePct  DECIMAL(9,4)  NOT NULL DEFAULT 0,
    IsActive      BIT           NOT NULL DEFAULT 1
);');

-- ===== 01_tables/009_cfg_alert_recipient.sql =====
EXEC(N'-- ClientId NULL = global developer list (receives alerts for every client).
CREATE TABLE cfg.AlertRecipient (
    RecipientId   INT IDENTITY(1,1) PRIMARY KEY,
    ClientId      INT           NULL REFERENCES cfg.Client(ClientId),
    Email         VARCHAR(200)  NOT NULL,
    RecipientRole VARCHAR(10)   NOT NULL DEFAULT ''DEVELOPER'' CHECK (RecipientRole IN (''DEVELOPER'',''CLIENT'')),
    IsActive      BIT           NOT NULL DEFAULT 1
);');

-- ===== 01_tables/010_audit_pipeline_run.sql =====
EXEC(N'CREATE TABLE audit.PipelineRun (
    RunId         UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    SourceId      INT              NOT NULL REFERENCES cfg.Source(SourceId),
    Status        VARCHAR(10)      NOT NULL CHECK (Status IN (''RUNNING'',''SUCCESS'',''WARNING'',''FAILED'',''NO_FILES'')),
    TriggeredBy   VARCHAR(100)     NULL,           -- ADF pipeline run id
    StartedAt     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    EndedAt       DATETIME2        NULL,
    RowsRead      BIGINT           NULL,
    RowsValid     BIGINT           NULL,
    RowsRejected  BIGINT           NULL,
    RowsLoaded    BIGINT           NULL,
    Message       NVARCHAR(MAX)    NULL
);');

-- ===== 01_tables/011_audit_file_ingestion.sql =====
EXEC(N'CREATE TABLE audit.FileIngestion (
    FileId          BIGINT IDENTITY(1,1) PRIMARY KEY,
    SourceId        INT              NOT NULL REFERENCES cfg.Source(SourceId),
    RunId           UNIQUEIDENTIFIER NULL,
    FileName        VARCHAR(260)     NOT NULL,
    FileFingerprint CHAR(64)         NOT NULL,     -- sha256(path|size|modified) -> duplicate detection
    FileSizeBytes   BIGINT           NULL,
    Status          VARCHAR(10)      NOT NULL CHECK (Status IN (''PROCESSED'',''REJECTED'',''DUPLICATE'')),
    Reason          NVARCHAR(500)    NULL,
    ProcessedAt     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_FileIngestion_Fingerprint ON audit.FileIngestion (SourceId, FileFingerprint);');

-- ===== 01_tables/012_audit_validation_result.sql =====
EXEC(N'CREATE TABLE audit.ValidationResult (
    ResultId    BIGINT IDENTITY(1,1) PRIMARY KEY,
    RunId       UNIQUEIDENTIFIER NOT NULL,
    RuleName    VARCHAR(200)  NOT NULL,
    RuleType    VARCHAR(20)   NOT NULL,
    ColumnName  VARCHAR(256)  NULL,
    Severity    VARCHAR(5)    NOT NULL,
    FailedRows  BIGINT        NOT NULL,
    TotalRows   BIGINT        NOT NULL,
    CheckedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);');

-- ===== 01_tables/013_audit_metric_history.sql =====
EXEC(N'-- Every run stores its metrics; thresholds compare against this history.
CREATE TABLE audit.MetricHistory (
    MetricId    BIGINT IDENTITY(1,1) PRIMARY KEY,
    SourceId    INT              NOT NULL,
    RunId       UNIQUEIDENTIFIER NOT NULL,
    MetricName  VARCHAR(20)      NOT NULL,
    ColumnName  VARCHAR(128)     NOT NULL DEFAULT '''',
    MetricValue DECIMAL(38,6)    NULL,
    CapturedAt  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_MetricHistory ON audit.MetricHistory (SourceId, MetricName, ColumnName, CapturedAt DESC);');

-- ===== 01_tables/014_audit_threshold_result.sql =====
EXEC(N'CREATE TABLE audit.ThresholdResult (
    ResultId        BIGINT IDENTITY(1,1) PRIMARY KEY,
    RunId           UNIQUEIDENTIFIER NOT NULL,
    MetricName      VARCHAR(20)   NOT NULL,
    ColumnName      VARCHAR(128)  NOT NULL DEFAULT '''',
    CurrentValue    DECIMAL(38,6) NULL,
    BaselineValue   DECIMAL(38,6) NULL,
    DeviationPct    DECIMAL(18,4) NULL,
    MaxDeviationPct DECIMAL(9,2)  NOT NULL,
    Status          VARCHAR(12)   NOT NULL,        -- OK | WARN | ERROR | NO_BASELINE
    CheckedAt       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);');

-- ===== 01_tables/015_audit_reconciliation_result.sql =====
EXEC(N'CREATE TABLE audit.ReconciliationResult (
    ResultId      BIGINT IDENTITY(1,1) PRIMARY KEY,
    RunId         UNIQUEIDENTIFIER NOT NULL,
    Stage         VARCHAR(20)   NOT NULL,
    CheckType     VARCHAR(10)   NOT NULL,
    ColumnName    VARCHAR(128)  NOT NULL DEFAULT '''',
    ExpectedValue DECIMAL(38,6) NULL,
    ActualValue   DECIMAL(38,6) NULL,
    DiffPct       DECIMAL(18,4) NULL,
    Status        VARCHAR(10)   NOT NULL,          -- MATCH | MISMATCH | SKIPPED
    CheckedAt     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);');

-- ===== 01_tables/016_cfg_dashboard_tile.sql =====
EXEC(N'-- Declarative dashboard: the portal builds its queries from these rows (no SQL is stored here).
CREATE TABLE cfg.DashboardTile (
    TileId        INT IDENTITY(1,1) PRIMARY KEY,
    SourceId      INT           NOT NULL REFERENCES cfg.Source(SourceId),
    Title         NVARCHAR(120) NOT NULL,
    TileType      VARCHAR(5)    NOT NULL CHECK (TileType IN (''KPI'',''BAR'',''LINE'')),
    Aggregation   VARCHAR(5)    NOT NULL CHECK (Aggregation IN (''SUM'',''COUNT'',''AVG'',''MIN'',''MAX'')),
    MeasureColumn VARCHAR(128)  NULL,               -- target column; NULL with COUNT = COUNT(*)
    GroupColumn   VARCHAR(128)  NULL,               -- BAR: category column
    DateColumn    VARCHAR(128)  NULL,               -- LINE: month is derived from this column
    NumberFormat  VARCHAR(10)   NOT NULL DEFAULT ''number'' CHECK (NumberFormat IN (''number'',''decimal'',''percent'')),
    DisplayOrder  INT           NOT NULL DEFAULT 0,
    IsActive      BIT           NOT NULL DEFAULT 1
);');

-- ===== 01_tables/017_cfg_templates.sql =====
EXEC(N'-- Industry starter kits. Subscribing a client copies these rows into cfg.Source / ColumnMapping / DashboardTile.
CREATE TABLE cfg.SourceTemplate (
    TemplateId  INT IDENTITY(1,1) PRIMARY KEY,
    Industry    VARCHAR(50)  NOT NULL,
    SourceName  VARCHAR(50)  NOT NULL,
    FileFormat  VARCHAR(20)  NOT NULL DEFAULT ''AUTO'',
    WriteMode   VARCHAR(10)  NOT NULL DEFAULT ''OVERWRITE'',
    ScdType     TINYINT      NOT NULL DEFAULT 1,
    TargetTable VARCHAR(128) NOT NULL,
    CONSTRAINT UQ_SourceTemplate UNIQUE (Industry, SourceName)
);
CREATE TABLE cfg.ColumnTemplate (
    ColumnTemplateId INT IDENTITY(1,1) PRIMARY KEY,
    TemplateId    INT          NOT NULL REFERENCES cfg.SourceTemplate(TemplateId),
    SourceColumn  VARCHAR(128) NOT NULL,
    TargetColumn  VARCHAR(128) NOT NULL,
    DataType      VARCHAR(30)  NOT NULL DEFAULT ''string'',
    DateFormat    VARCHAR(40)  NULL,
    IsBusinessKey BIT          NOT NULL DEFAULT 0,
    IsNullable    BIT          NOT NULL DEFAULT 1,
    ColumnOrder   INT          NOT NULL DEFAULT 0
);
CREATE TABLE cfg.TileTemplate (
    TileTemplateId INT IDENTITY(1,1) PRIMARY KEY,
    TemplateId    INT           NOT NULL REFERENCES cfg.SourceTemplate(TemplateId),
    Title         NVARCHAR(120) NOT NULL,
    TileType      VARCHAR(5)    NOT NULL,
    Aggregation   VARCHAR(5)    NOT NULL,
    MeasureColumn VARCHAR(128)  NULL,
    GroupColumn   VARCHAR(128)  NULL,
    DateColumn    VARCHAR(128)  NULL,
    NumberFormat  VARCHAR(10)   NOT NULL DEFAULT ''number'',
    DisplayOrder  INT           NOT NULL DEFAULT 0
);');

-- ===== 01_tables/018_portal_user.sql =====
EXEC(N'-- Portal users. The PASSWORD HASH is NOT here: it lives in Key Vault as secret "pw-<UserId>".
CREATE TABLE portal.PortalUser (
    UserId                UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    ClientId              INT           NOT NULL REFERENCES cfg.Client(ClientId),
    Email                 NVARCHAR(200) NOT NULL,
    DisplayName           NVARCHAR(200) NOT NULL,
    Role                  VARCHAR(10)   NOT NULL CHECK (Role IN (''admin'',''uploader'',''viewer'')),
                          -- admin: everything | uploader: dashboards + uploads | viewer: dashboards only
    IsEnabled             BIT           NOT NULL DEFAULT 1,
    MustChangePassword    BIT           NOT NULL DEFAULT 1,
    TempPasswordExpiresAt DATETIME2     NULL,
    FailedAttempts        INT           NOT NULL DEFAULT 0,
    LockedUntil           DATETIME2     NULL,
    LastLoginAt           DATETIME2     NULL,
    CreatedAt             DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedBy             NVARCHAR(200) NULL
);
CREATE UNIQUE INDEX UX_PortalUser_Email ON portal.PortalUser (Email);
CREATE INDEX IX_PortalUser_Client ON portal.PortalUser (ClientId);');

-- ===== 01_tables/019_portal_activity_log.sql =====
EXEC(N'CREATE TABLE portal.ActivityLog (
    LogId    BIGINT IDENTITY(1,1) PRIMARY KEY,
    ClientId INT           NULL,
    UserId   UNIQUEIDENTIFIER NULL,
    Actor    NVARCHAR(200) NULL,                    -- e-mail of whoever did it (or ops user)
    Action   VARCHAR(40)   NOT NULL,                -- LOGIN, PASSWORD_CHANGED, USER_INVITED, ROLE_CHANGED, UPLOAD ...
    Detail   NVARCHAR(500) NULL,
    At       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ActivityLog_Client ON portal.ActivityLog (ClientId, At DESC);');

-- ===== 01_tables/020_cfg_plan.sql =====
EXEC(N'-- Subscription plans shown in the website popup. Edit prices/features with plain UPDATEs - no deployment needed.
CREATE TABLE cfg.[Plan] (
    PlanCode     VARCHAR(20)   NOT NULL PRIMARY KEY,
    Name         NVARCHAR(50)  NOT NULL,
    PriceMonthly DECIMAL(10,2) NOT NULL,
    Currency     CHAR(3)       NOT NULL DEFAULT ''EUR'',
    Tagline      NVARCHAR(200) NULL,
    Features     NVARCHAR(MAX) NOT NULL CHECK (ISJSON(Features) = 1),   -- JSON array of strings shown as bullets
    MaxUsers     INT           NOT NULL,                                -- enforced when admins invite employees
    IsPopular    BIT           NOT NULL DEFAULT 0,
    DisplayOrder INT           NOT NULL DEFAULT 0,
    IsActive     BIT           NOT NULL DEFAULT 1
);');

-- ===== 01_tables/021_portal_subscription_request.sql =====
EXEC(N'-- One row per "Subscribe" click. Lifecycle: PENDING_PAYMENT -> PAID -> ACTIVATING -> ACTIVATED
-- (ACTIVATION_FAILED is retried by SkyStack ops). Only the activation worker moves PAID onwards.
CREATE TABLE portal.SubscriptionRequest (
    RequestId    UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    Email        NVARCHAR(200) NOT NULL,
    ContactName  NVARCHAR(200) NOT NULL,
    CompanyName  NVARCHAR(200) NOT NULL,
    Industry     VARCHAR(50)   NOT NULL,
    PlanCode     VARCHAR(20)   NOT NULL REFERENCES cfg.[Plan](PlanCode),
    Status       VARCHAR(20)   NOT NULL DEFAULT ''PENDING_PAYMENT'' CHECK (Status IN
                   (''PENDING_PAYMENT'',''PAID'',''ACTIVATING'',''ACTIVATED'',''ACTIVATION_FAILED'',''CANCELLED'')),
    PaymentRef   VARCHAR(100)  NULL,                -- Stripe Checkout Session id
    ClientCode   VARCHAR(30)   NULL,                -- filled on activation
    LastError    NVARCHAR(500) NULL,
    CreatedAt    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    PaidAt       DATETIME2     NULL,
    ActivatedAt  DATETIME2     NULL
);
CREATE INDEX IX_SubscriptionRequest_Status ON portal.SubscriptionRequest (Status, CreatedAt);
CREATE INDEX IX_SubscriptionRequest_Email  ON portal.SubscriptionRequest (Email);');

-- ===== 01_tables/022_portal_user_hidden_source.sql =====
EXEC(N'-- Per-employee dashboard visibility. A row HIDES that data source''s dashboard (and uploads) from that user.
-- No rows = the user sees everything their role allows. Admins are never restricted.
CREATE TABLE portal.UserHiddenSource (
    UserId   UNIQUEIDENTIFIER NOT NULL REFERENCES portal.PortalUser(UserId),
    SourceId INT              NOT NULL REFERENCES cfg.Source(SourceId),
    CONSTRAINT PK_UserHiddenSource PRIMARY KEY (UserId, SourceId)
);');

-- ===== 02_views/001_vw_source_config.sql =====
EXEC(N'-- Everything the framework needs to know about one source, in one row.
CREATE OR ALTER VIEW cfg.vw_SourceConfig AS
SELECT  s.SourceId, c.ClientId, c.ClientCode, c.ClientName, c.Industry,
        s.SourceName, s.FileFormat, s.FilePattern, s.FileOptions,
        s.TargetTable, s.WriteMode, s.ScdType, s.MinRowCount, s.ScheduleGroup,
        t.ConnectionId, t.TargetType, t.ServerName, t.DatabaseName, t.SchemaName,
        t.ContainerName, t.CredentialSecretName
FROM    cfg.Source s
JOIN    cfg.Client c            ON c.ClientId = s.ClientId AND c.IsActive = 1
JOIN    cfg.TargetConnection t  ON t.ConnectionId = s.TargetConnectionId AND t.IsActive = 1
WHERE   s.IsActive = 1;');

-- ===== 02_views/002_vw_column_mapping.sql =====
EXEC(N'CREATE OR ALTER VIEW cfg.vw_ColumnMapping AS
SELECT SourceId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey,
       IsNullable, DefaultValue, TrackChanges, ColumnOrder, FixedStart, FixedLength
FROM   cfg.ColumnMapping;');

-- ===== 02_views/003_vw_validation_rule.sql =====
EXEC(N'CREATE OR ALTER VIEW cfg.vw_ValidationRule AS
SELECT RuleId, SourceId, RuleType, ColumnName, RuleParams, Severity
FROM   cfg.ValidationRule
WHERE  IsActive = 1;');

-- ===== 02_views/004_vw_threshold_rule.sql =====
EXEC(N'CREATE OR ALTER VIEW cfg.vw_ThresholdRule AS
SELECT ThresholdId, SourceId, MetricName, ISNULL(ColumnName, '''') AS ColumnName,
       MaxDeviationPct, BaselineRuns, Severity
FROM   cfg.ThresholdRule
WHERE  IsActive = 1;');

-- ===== 02_views/005_vw_reconciliation_rule.sql =====
EXEC(N'CREATE OR ALTER VIEW cfg.vw_ReconciliationRule AS
SELECT ReconId, SourceId, Stage, CheckType, ISNULL(ColumnName, '''') AS ColumnName, TolerancePct
FROM   cfg.ReconciliationRule
WHERE  IsActive = 1;');

-- ===== 02_views/006_vw_alert_recipient.sql =====
EXEC(N'-- Recipients per source = global developers (ClientId NULL) + the client''s own recipients.
CREATE OR ALTER VIEW cfg.vw_AlertRecipient AS
SELECT s.SourceId, r.Email, r.RecipientRole
FROM   cfg.Source s
JOIN   cfg.AlertRecipient r
       ON r.IsActive = 1 AND (r.ClientId IS NULL OR r.ClientId = s.ClientId);');

-- ===== 02_views/007_vw_metric_baseline.sql =====
EXEC(N'-- Previous runs'' metrics, newest first (RunRank = 1 is the most recent earlier run).
-- Failed runs are excluded so a bad load never becomes the "normal".
CREATE OR ALTER VIEW audit.vw_MetricBaseline AS
SELECT  m.SourceId, m.MetricName, m.ColumnName, m.MetricValue, m.RunId, m.CapturedAt,
        ROW_NUMBER() OVER (PARTITION BY m.SourceId, m.MetricName, m.ColumnName
                           ORDER BY m.CapturedAt DESC) AS RunRank
FROM    audit.MetricHistory m
JOIN    audit.PipelineRun   r ON r.RunId = m.RunId AND r.Status IN (''SUCCESS'',''WARNING'');');

-- ===== 02_views/008_vw_run_summary.sql =====
EXEC(N'-- Feeds client dashboards / support screens: latest runs per client and source.
CREATE OR ALTER VIEW audit.vw_RunSummary AS
SELECT  c.ClientCode, s.SourceName, r.RunId, r.Status, r.StartedAt, r.EndedAt,
        DATEDIFF(SECOND, r.StartedAt, r.EndedAt) AS DurationSec,
        r.RowsRead, r.RowsValid, r.RowsRejected, r.RowsLoaded, r.Message
FROM    audit.PipelineRun r
JOIN    cfg.Source s ON s.SourceId = r.SourceId
JOIN    cfg.Client c ON c.ClientId = s.ClientId;');

-- ===== 02_views/009_vw_processed_files.sql =====
EXEC(N'-- Fingerprints already handled -> duplicate-file detection.
CREATE OR ALTER VIEW audit.vw_ProcessedFiles AS
SELECT SourceId, FileFingerprint, FileName, Status, ProcessedAt
FROM   audit.FileIngestion
WHERE  Status IN (''PROCESSED'',''REJECTED'');');

-- ===== 02_views/010_vw_dashboard_tile.sql =====
EXEC(N'-- Tiles joined with where each client''s data lives (portal supports AZURE_SQL targets).
CREATE OR ALTER VIEW cfg.vw_DashboardTile AS
SELECT  c.ClientCode, s.SourceId, s.SourceName, s.TargetTable,
        t.ServerName, t.DatabaseName, t.SchemaName,
        d.TileId, d.Title, d.TileType, d.Aggregation, d.MeasureColumn, d.GroupColumn, d.DateColumn,
        d.NumberFormat, d.DisplayOrder
FROM    cfg.DashboardTile d
JOIN    cfg.Source s           ON s.SourceId = d.SourceId AND s.IsActive = 1
JOIN    cfg.Client c           ON c.ClientId = s.ClientId AND c.IsActive = 1
JOIN    cfg.TargetConnection t ON t.ConnectionId = s.TargetConnectionId AND t.IsActive = 1
WHERE   d.IsActive = 1 AND t.TargetType = ''AZURE_SQL'';');

-- ===== 02_views/011_vw_client_sources.sql =====
EXEC(N'-- Upload dropdown + template download in the portal.
CREATE OR ALTER VIEW portal.vw_ClientSources AS
SELECT c.ClientCode, s.SourceId, s.SourceName, s.FileFormat, s.TargetTable
FROM   cfg.Source s
JOIN   cfg.Client c ON c.ClientId = s.ClientId
WHERE  s.IsActive = 1 AND c.IsActive = 1;');

-- ===== 02_views/012_vw_user_account.sql =====
EXEC(N'CREATE OR ALTER VIEW portal.vw_UserAccount AS
SELECT  u.UserId, u.ClientId, u.Email, u.DisplayName, u.Role, u.IsEnabled, u.MustChangePassword,
        u.TempPasswordExpiresAt, u.FailedAttempts, u.LockedUntil, u.LastLoginAt,
        c.ClientCode, c.ClientName, c.IsActive AS ClientActive
FROM    portal.PortalUser u
JOIN    cfg.Client c ON c.ClientId = u.ClientId;');

-- ===== 02_views/013_vw_plan.sql =====
EXEC(N'CREATE OR ALTER VIEW portal.vw_Plan AS
SELECT PlanCode, Name, PriceMonthly, Currency, Tagline, Features, MaxUsers, IsPopular, DisplayOrder
FROM   cfg.[Plan] WHERE IsActive = 1;');

-- ===== 03_procedures/001_usp_get_pending_sources.sql =====
EXEC(N'-- Called by the ADF Lookup activity: which sources should run for this schedule?
CREATE OR ALTER PROCEDURE cfg.usp_GetPendingSources
    @ScheduleGroup VARCHAR(10),
    @ClientCode    VARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SourceId, ClientCode, SourceName
    FROM   cfg.vw_SourceConfig
    WHERE  ScheduleGroup = @ScheduleGroup
      AND  (@ClientCode IS NULL OR @ClientCode = '''' OR ClientCode = @ClientCode)
    ORDER  BY ClientCode, SourceName;
END');

-- ===== 03_procedures/002_usp_start_run.sql =====
EXEC(N'-- Creates the run row and returns its id (ADF Lookup reads RunId and passes it to Databricks).
CREATE OR ALTER PROCEDURE audit.usp_StartRun
    @SourceId    INT,
    @TriggeredBy VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @RunId UNIQUEIDENTIFIER = NEWID();
    INSERT audit.PipelineRun (RunId, SourceId, Status, TriggeredBy)
    VALUES (@RunId, @SourceId, ''RUNNING'', @TriggeredBy);
    SELECT CAST(@RunId AS VARCHAR(36)) AS RunId;
END');

-- ===== 03_procedures/003_usp_end_run.sql =====
EXEC(N'CREATE OR ALTER PROCEDURE audit.usp_EndRun
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
END');

-- ===== 03_procedures/004_usp_fail_run.sql =====
EXEC(N'CREATE OR ALTER PROCEDURE audit.usp_FailRun
    @RunId   UNIQUEIDENTIFIER,
    @Message NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE audit.PipelineRun
    SET    Status = ''FAILED'', EndedAt = SYSUTCDATETIME(), Message = LEFT(@Message, 4000)
    WHERE  RunId = @RunId;
END');

-- ===== 03_procedures/005_usp_purge_old_audit.sql =====
EXEC(N'-- Housekeeping: keep metric/validation history for N days (default 1 year).
CREATE OR ALTER PROCEDURE audit.usp_PurgeOldAudit
    @RetentionDays INT = 365
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @cut DATETIME2 = DATEADD(DAY, -@RetentionDays, SYSUTCDATETIME());
    DELETE FROM audit.ValidationResult     WHERE CheckedAt  < @cut;
    DELETE FROM audit.ThresholdResult      WHERE CheckedAt  < @cut;
    DELETE FROM audit.ReconciliationResult WHERE CheckedAt  < @cut;
    DELETE FROM audit.MetricHistory        WHERE CapturedAt < @cut;
END');

-- ===== 03_procedures/006_usp_get_source_by_name.sql =====
EXEC(N'-- Used by the ADF "on upload" pipeline (folder path gives client + source).
CREATE OR ALTER PROCEDURE cfg.usp_GetSourceByName
    @ClientCode VARCHAR(30),
    @SourceName VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SourceId, ClientCode, SourceName
    FROM   cfg.vw_SourceConfig
    WHERE  ClientCode = @ClientCode AND SourceName = @SourceName;
END');

-- ===== 03_procedures/007_usp_onboard_client.sql =====
EXEC(N'-- "Subscribe a client": one call creates everything the framework and the portal need.
-- Called by the SkyStack ops service after the client''s database exists.
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

    IF NOT EXISTS (SELECT 1 FROM cfg.SourceTemplate WHERE Industry = @Industry) THROW 50001, ''Unknown industry'', 1;
    IF EXISTS (SELECT 1 FROM cfg.Client WHERE ClientCode = @ClientCode)          THROW 50002, ''Client code already exists'', 1;
    IF EXISTS (SELECT 1 FROM portal.PortalUser WHERE Email = @AdminEmail)        THROW 50003, ''E-mail is already registered'', 1;

    BEGIN TRAN;
    DECLARE @ClientId INT, @ConnId INT, @UserId UNIQUEIDENTIFIER = NEWID();

    INSERT cfg.Client (ClientCode, ClientName, Industry, PlanCode) VALUES (@ClientCode, @ClientName, @Industry, @PlanCode);
    SET @ClientId = SCOPE_IDENTITY();

    INSERT cfg.TargetConnection (ClientId, ConnectionName, TargetType, ServerName, DatabaseName, SchemaName, CredentialSecretName)
    VALUES (@ClientId, ''client_sql'', ''AZURE_SQL'', @SqlServer, @SqlDatabase, ''dbo'', @EtlSecretName);
    SET @ConnId = SCOPE_IDENTITY();

    -- sources from the industry template (TemplateId -> new SourceId)
    DECLARE @map TABLE (TemplateId INT, SourceId INT);
    MERGE cfg.Source AS t
    USING (SELECT * FROM cfg.SourceTemplate WHERE Industry = @Industry) AS s ON 1 = 0
    WHEN NOT MATCHED THEN
        INSERT (ClientId, SourceName, FileFormat, FilePattern, TargetConnectionId, TargetTable, WriteMode, ScdType, MinRowCount, ScheduleGroup)
        VALUES (@ClientId, s.SourceName, s.FileFormat, ''*'', @ConnId, s.TargetTable, s.WriteMode, s.ScdType, 1, ''DAILY'')
    OUTPUT s.TemplateId, inserted.SourceId INTO @map;

    INSERT cfg.ColumnMapping (SourceId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder)
    SELECT m.SourceId, c.SourceColumn, c.TargetColumn, c.DataType, c.DateFormat, c.IsBusinessKey, c.IsNullable, c.ColumnOrder
    FROM   cfg.ColumnTemplate c JOIN @map m ON m.TemplateId = c.TemplateId;

    INSERT cfg.DashboardTile (SourceId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder)
    SELECT m.SourceId, t.Title, t.TileType, t.Aggregation, t.MeasureColumn, t.GroupColumn, t.DateColumn, t.NumberFormat, t.DisplayOrder
    FROM   cfg.TileTemplate t JOIN @map m ON m.TemplateId = t.TemplateId;

    -- default safety net: warn developers if a load is 50% bigger/smaller than usual
    INSERT cfg.ThresholdRule (SourceId, MetricName, MaxDeviationPct, BaselineRuns, Severity)
    SELECT SourceId, ''ROW_COUNT'', 50, 5, ''WARN'' FROM @map;

    -- the first (admin) user; password is set by the ops service afterwards
    INSERT portal.PortalUser (UserId, ClientId, Email, DisplayName, Role, MustChangePassword, CreatedBy)
    VALUES (@UserId, @ClientId, @AdminEmail, @AdminName, ''admin'', 1, @CreatedBy);

    INSERT portal.ActivityLog (ClientId, UserId, Actor, Action, Detail)
    VALUES (@ClientId, @UserId, @CreatedBy, ''CLIENT_SUBSCRIBED'', CONCAT(@ClientCode, '' / '', @Industry));
    COMMIT;

    SELECT @ClientId AS ClientId, @UserId AS UserId;
END');

-- ===== 03_procedures/008_usp_set_client_active.sql =====
EXEC(N'-- Enable / disable a whole client: portal sign-in AND scheduled processing stop immediately.
CREATE OR ALTER PROCEDURE cfg.usp_SetClientActive
    @ClientCode VARCHAR(30),
    @IsActive   BIT,
    @Actor      NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE cfg.Client SET IsActive = @IsActive WHERE ClientCode = @ClientCode;
    IF @@ROWCOUNT = 0 THROW 50004, ''Client not found'', 1;
    INSERT portal.ActivityLog (ClientId, Actor, Action, Detail)
    SELECT ClientId, @Actor, CASE WHEN @IsActive = 1 THEN ''CLIENT_ENABLED'' ELSE ''CLIENT_DISABLED'' END, @ClientCode
    FROM cfg.Client WHERE ClientCode = @ClientCode;
END');

-- ===== 05_templates/001_industry_templates.sql =====
EXEC(N'-- GENERATED starter kits per industry. Edit freely; new clients copy these at subscription time.

INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES (''logistics'', ''shipments'', ''AUTO'', ''OVERWRITE'', 1, ''shipments'');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, ''Shipment No'', ''shipment_no'', ''string'', NULL, 1, 0, 1),
  (@t, ''Ship Date'', ''ship_date'', ''date'', ''yyyy-MM-dd'', 0, 0, 2),
  (@t, ''Customer'', ''customer'', ''string'', NULL, 0, 1, 3),
  (@t, ''Origin'', ''origin'', ''string'', NULL, 0, 1, 4),
  (@t, ''Weight (kg)'', ''weight_kg'', ''decimal(12,2)'', NULL, 0, 1, 5),
  (@t, ''Freight Cost'', ''freight_cost'', ''decimal(14,2)'', NULL, 0, 1, 6),
  (@t, ''Status'', ''status'', ''string'', NULL, 0, 1, 7);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, ''Total shipments'', ''KPI'', ''COUNT'', NULL, NULL, NULL, ''number'', 1),
  (@t, ''Total freight cost'', ''KPI'', ''SUM'', ''freight_cost'', NULL, NULL, ''decimal'', 2),
  (@t, ''Freight cost by customer'', ''BAR'', ''SUM'', ''freight_cost'', ''customer'', NULL, ''decimal'', 3),
  (@t, ''Shipments per month'', ''LINE'', ''COUNT'', NULL, NULL, ''ship_date'', ''number'', 4),
  (@t, ''Shipments by status'', ''BAR'', ''COUNT'', NULL, ''status'', NULL, ''number'', 5);');
EXEC(N'INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES (''manufacturing'', ''production'', ''AUTO'', ''OVERWRITE'', 1, ''production'');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, ''Batch No'', ''batch_no'', ''string'', NULL, 1, 0, 1),
  (@t, ''Production Date'', ''production_date'', ''date'', ''yyyy-MM-dd'', 0, 0, 2),
  (@t, ''Product'', ''product'', ''string'', NULL, 0, 1, 3),
  (@t, ''Plant'', ''plant'', ''string'', NULL, 0, 1, 4),
  (@t, ''Units Produced'', ''units_produced'', ''int'', NULL, 0, 1, 5),
  (@t, ''Defect Units'', ''defect_units'', ''int'', NULL, 0, 1, 6);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, ''Units produced'', ''KPI'', ''SUM'', ''units_produced'', NULL, NULL, ''number'', 1),
  (@t, ''Defect units'', ''KPI'', ''SUM'', ''defect_units'', NULL, NULL, ''number'', 2),
  (@t, ''Units by product'', ''BAR'', ''SUM'', ''units_produced'', ''product'', NULL, ''number'', 3),
  (@t, ''Units per month'', ''LINE'', ''SUM'', ''units_produced'', NULL, ''production_date'', ''number'', 4),
  (@t, ''Units by plant'', ''BAR'', ''SUM'', ''units_produced'', ''plant'', NULL, ''number'', 5);');
EXEC(N'INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES (''real_estate'', ''leases'', ''AUTO'', ''OVERWRITE'', 1, ''leases'');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, ''Lease ID'', ''lease_id'', ''string'', NULL, 1, 0, 1),
  (@t, ''Property'', ''property_name'', ''string'', NULL, 0, 1, 2),
  (@t, ''Tenant'', ''tenant'', ''string'', NULL, 0, 1, 3),
  (@t, ''Start Date'', ''start_date'', ''date'', ''yyyy-MM-dd'', 0, 1, 4),
  (@t, ''Monthly Rent'', ''monthly_rent'', ''decimal(14,2)'', NULL, 0, 1, 5),
  (@t, ''Status'', ''status'', ''string'', NULL, 0, 1, 6);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, ''Total leases'', ''KPI'', ''COUNT'', NULL, NULL, NULL, ''number'', 1),
  (@t, ''Monthly rent roll'', ''KPI'', ''SUM'', ''monthly_rent'', NULL, NULL, ''decimal'', 2),
  (@t, ''Rent by property'', ''BAR'', ''SUM'', ''monthly_rent'', ''property_name'', NULL, ''decimal'', 3),
  (@t, ''New leases per month'', ''LINE'', ''COUNT'', NULL, NULL, ''start_date'', ''number'', 4),
  (@t, ''Leases by status'', ''BAR'', ''COUNT'', NULL, ''status'', NULL, ''number'', 5);');
EXEC(N'INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES (''construction'', ''projects'', ''AUTO'', ''OVERWRITE'', 1, ''projects'');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, ''Project ID'', ''project_id'', ''string'', NULL, 1, 0, 1),
  (@t, ''Project Name'', ''project_name'', ''string'', NULL, 0, 1, 2),
  (@t, ''Start Date'', ''start_date'', ''date'', ''yyyy-MM-dd'', 0, 1, 3),
  (@t, ''Budget'', ''budget'', ''decimal(16,2)'', NULL, 0, 1, 4),
  (@t, ''Actual Cost'', ''actual_cost'', ''decimal(16,2)'', NULL, 0, 1, 5),
  (@t, ''Status'', ''status'', ''string'', NULL, 0, 1, 6);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, ''Total budget'', ''KPI'', ''SUM'', ''budget'', NULL, NULL, ''decimal'', 1),
  (@t, ''Actual cost'', ''KPI'', ''SUM'', ''actual_cost'', NULL, NULL, ''decimal'', 2),
  (@t, ''Actual cost by project'', ''BAR'', ''SUM'', ''actual_cost'', ''project_name'', NULL, ''decimal'', 3),
  (@t, ''Projects started per month'', ''LINE'', ''COUNT'', NULL, NULL, ''start_date'', ''number'', 4),
  (@t, ''Projects by status'', ''BAR'', ''COUNT'', NULL, ''status'', NULL, ''number'', 5);');
EXEC(N'INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES (''marketing'', ''campaigns'', ''AUTO'', ''OVERWRITE'', 1, ''campaigns'');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, ''Campaign ID'', ''campaign_id'', ''string'', NULL, 1, 0, 1),
  (@t, ''Campaign'', ''campaign_name'', ''string'', NULL, 0, 1, 2),
  (@t, ''Channel'', ''channel'', ''string'', NULL, 0, 1, 3),
  (@t, ''Start Date'', ''start_date'', ''date'', ''yyyy-MM-dd'', 0, 1, 4),
  (@t, ''Spend'', ''spend'', ''decimal(14,2)'', NULL, 0, 1, 5),
  (@t, ''Conversions'', ''conversions'', ''int'', NULL, 0, 1, 6);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, ''Total spend'', ''KPI'', ''SUM'', ''spend'', NULL, NULL, ''decimal'', 1),
  (@t, ''Total conversions'', ''KPI'', ''SUM'', ''conversions'', NULL, NULL, ''number'', 2),
  (@t, ''Spend by channel'', ''BAR'', ''SUM'', ''spend'', ''channel'', NULL, ''decimal'', 3),
  (@t, ''Spend per month'', ''LINE'', ''SUM'', ''spend'', NULL, ''start_date'', ''decimal'', 4),
  (@t, ''Conversions by campaign'', ''BAR'', ''SUM'', ''conversions'', ''campaign_name'', NULL, ''number'', 5);');
EXEC(N'INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES (''legal'', ''matters'', ''AUTO'', ''OVERWRITE'', 1, ''matters'');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, ''Matter ID'', ''matter_id'', ''string'', NULL, 1, 0, 1),
  (@t, ''Client Name'', ''client_name'', ''string'', NULL, 0, 1, 2),
  (@t, ''Practice Area'', ''practice_area'', ''string'', NULL, 0, 1, 3),
  (@t, ''Opened Date'', ''opened_date'', ''date'', ''yyyy-MM-dd'', 0, 1, 4),
  (@t, ''Billed Amount'', ''billed_amount'', ''decimal(14,2)'', NULL, 0, 1, 5),
  (@t, ''Status'', ''status'', ''string'', NULL, 0, 1, 6);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, ''Total matters'', ''KPI'', ''COUNT'', NULL, NULL, NULL, ''number'', 1),
  (@t, ''Total billed'', ''KPI'', ''SUM'', ''billed_amount'', NULL, NULL, ''decimal'', 2),
  (@t, ''Billed by practice area'', ''BAR'', ''SUM'', ''billed_amount'', ''practice_area'', NULL, ''decimal'', 3),
  (@t, ''Matters opened per month'', ''LINE'', ''COUNT'', NULL, NULL, ''opened_date'', ''number'', 4),
  (@t, ''Matters by status'', ''BAR'', ''COUNT'', NULL, ''status'', NULL, ''number'', 5);');

EXEC(N'IF NOT EXISTS (SELECT 1 FROM cfg.SourceTemplate WHERE Industry = ''advertising'' AND SourceName = ''ad_statements'')
BEGIN
    INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
    VALUES (''advertising'', ''ad_statements'', ''AUTO'', ''OVERWRITE'', 1, ''ad_statements'');
    DECLARE @t INT = SCOPE_IDENTITY();

    -- SourceColumn = exact header in the Excel file; TargetColumn = column name in the client''s database.
    -- "Bill Settled" is empty in the sample file, so it is not mapped.
    INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
      (@t, ''Statement_Id'',          ''statement_id'',   ''string'',        NULL,         1, 0, 1),
      (@t, ''Client_Id'',             ''client_ref'',     ''string'',        NULL,         0, 1, 2),
      (@t, ''Client_Name'',           ''client_name'',    ''string'',        NULL,         0, 1, 3),
      (@t, ''Notice_Id'',             ''notice_id'',      ''string'',        NULL,         0, 1, 4),
      (@t, ''Notice'',                ''notice_type'',    ''string'',        NULL,         0, 1, 5),
      (@t, ''Party_Id'',              ''party_id'',       ''string'',        NULL,         0, 1, 6),
      (@t, ''Party_Name'',            ''party_name'',     ''string'',        NULL,         0, 1, 7),
      (@t, ''SNE_ID'',                ''sne_id'',         ''string'',        NULL,         0, 1, 8),
      (@t, ''SNE_No'',                ''sne_no'',         ''string'',        NULL,         0, 1, 9),
      (@t, ''Size'',                  ''ad_size'',        ''string'',        NULL,         0, 1, 10),
      (@t, ''Published_Date'',        ''published_date'', ''date'',          ''dd-MM-yyyy'', 0, 1, 11),
      (@t, ''Total_Amount_With_GST'', ''total_amount'',   ''decimal(14,2)'', NULL,         0, 1, 12),
      (@t, ''Transfer_Type'',         ''payment_mode'',   ''string'',        NULL,         0, 1, 13),
      (@t, ''Cheque_No'',             ''cheque_no'',      ''string'',        NULL,         0, 1, 14),
      (@t, ''Transfer_Date'',         ''payment_date'',   ''date'',          ''dd-MM-yyyy'', 0, 1, 15),
      (@t, ''Paper_Published'',       ''newspaper'',      ''string'',        NULL,         0, 1, 16);

    INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
      (@t, ''Total billed (incl. GST)'',  ''KPI'',  ''SUM'',   ''total_amount'', NULL,          NULL,             ''decimal'', 1),
      (@t, ''Statements'',                ''KPI'',  ''COUNT'', NULL,           NULL,          NULL,             ''number'',  2),
      (@t, ''Billed by newspaper'',       ''BAR'',  ''SUM'',   ''total_amount'', ''newspaper'',   NULL,             ''decimal'', 3),
      (@t, ''Billed by notice type'',     ''BAR'',  ''SUM'',   ''total_amount'', ''notice_type'', NULL,             ''decimal'', 4),
      (@t, ''Billed per month'',          ''LINE'', ''SUM'',   ''total_amount'', NULL,          ''published_date'', ''decimal'', 5);
END');

-- ===== 05_templates/002_plans.sql =====
EXEC(N'-- PLACEHOLDER prices and features - edit freely (UPDATE cfg.[Plan] ...). Shown live in the website popup.
INSERT cfg.[Plan] (PlanCode, Name, PriceMonthly, Currency, Tagline, Features, MaxUsers, IsPopular, DisplayOrder) VALUES
 (''basic'', N''Basic'', 99.00,  ''EUR'', N''For small teams getting started'',
  N''["1 data source","Up to 3 users","Monthly dashboard refresh","Email support"]'', 3, 0, 1),
 (''pro'',   N''Pro'',   249.00, ''EUR'', N''For growing companies'',
  N''["Up to 5 data sources","Up to 15 users","Daily dashboard refresh","Role-based access for employees","Priority support"]'', 15, 1, 2),
 (''elite'', N''Elite'', 499.00, ''EUR'', N''For data-driven organisations'',
  N''["Unlimited data sources","Up to 50 users","Refresh on every upload","Dedicated specialist and onboarding call","Custom dashboards"]'', 50, 0, 3);');

-- Example: onboarding a logistics client with a CSV "shipments" feed delivered to Azure SQL.
-- Onboarding another client/industry = new rows here, no code change.
DECLARE @ClientId INT, @ConnId INT, @SourceId INT;

INSERT cfg.Client (ClientCode, ClientName, Industry)
VALUES ('demo-logistics', N'Demo Logistics GmbH', 'logistics');
SET @ClientId = SCOPE_IDENTITY();

INSERT cfg.TargetConnection (ClientId, ConnectionName, TargetType, ServerName, DatabaseName, SchemaName, CredentialSecretName)
VALUES (@ClientId, 'client_sql', 'AZURE_SQL', 'myserver.database.windows.net', 'db_demo_logistics', 'dbo', 'target-demo-logistics-sql');
SET @ConnId = SCOPE_IDENTITY();

INSERT cfg.Source (ClientId, SourceName, FileFormat, FilePattern, FileOptions, TargetConnectionId,
                   TargetTable, WriteMode, ScdType, MinRowCount, ScheduleGroup)
VALUES (@ClientId, 'shipments', 'CSV', '*.csv', '{"delimiter":",","header":true,"encoding":"UTF-8"}',
        @ConnId, 'shipments', 'OVERWRITE', 2, 1, 'DAILY');
SET @SourceId = SCOPE_IDENTITY();

INSERT cfg.ColumnMapping (SourceId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
 (@SourceId, 'Shipment No',   'shipment_no',   'string',        NULL,         1, 0, 1),
 (@SourceId, 'Ship Date',     'ship_date',     'date',          'dd-MM-yyyy', 0, 0, 2),
 (@SourceId, 'Customer',      'customer',      'string',        NULL,         0, 1, 3),
 (@SourceId, 'Weight (kg)',   'weight_kg',     'decimal(12,2)', NULL,         0, 1, 4),
 (@SourceId, 'Freight Cost',  'freight_cost',  'decimal(14,2)', NULL,         0, 0, 5),
 (@SourceId, 'Status',        'status',        'string',        NULL,         0, 1, 6);

INSERT cfg.ValidationRule (SourceId, RuleType, ColumnName, RuleParams, Severity) VALUES
 (@SourceId, 'RANGE',          'freight_cost', '{"min":0,"max":1000000}',                    'ERROR'),
 (@SourceId, 'ALLOWED_VALUES', 'status',       '{"values":["BOOKED","IN_TRANSIT","DELIVERED"]}', 'WARN'),
 (@SourceId, 'REGEX',          'shipment_no',  '{"pattern":"^SH[0-9]{6}$"}',                 'WARN');

INSERT cfg.ThresholdRule (SourceId, MetricName, ColumnName, MaxDeviationPct, BaselineRuns, Severity) VALUES
 (@SourceId, 'ROW_COUNT',  NULL,           30, 5, 'WARN'),
 (@SourceId, 'REJECT_PCT', NULL,           50, 5, 'ERROR'),
 (@SourceId, 'SUM',        'freight_cost', 40, 5, 'WARN');

INSERT cfg.ReconciliationRule (SourceId, Stage, CheckType, ColumnName, TolerancePct) VALUES
 (@SourceId, 'SILVER_TO_TARGET', 'SUM', 'freight_cost', 0.01);

INSERT cfg.AlertRecipient (ClientId, Email, RecipientRole)
VALUES (NULL, 'dev-team@skystack.global', 'DEVELOPER');
GO

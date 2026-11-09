-- GENERATED starter kits per industry. Edit freely; new clients copy these at subscription time.

INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES ('logistics', 'shipments', 'AUTO', 'OVERWRITE', 1, 'shipments');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, 'Shipment No', 'shipment_no', 'string', NULL, 1, 0, 1),
  (@t, 'Ship Date', 'ship_date', 'date', 'yyyy-MM-dd', 0, 0, 2),
  (@t, 'Customer', 'customer', 'string', NULL, 0, 1, 3),
  (@t, 'Origin', 'origin', 'string', NULL, 0, 1, 4),
  (@t, 'Weight (kg)', 'weight_kg', 'decimal(12,2)', NULL, 0, 1, 5),
  (@t, 'Freight Cost', 'freight_cost', 'decimal(14,2)', NULL, 0, 1, 6),
  (@t, 'Status', 'status', 'string', NULL, 0, 1, 7);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, 'Total shipments', 'KPI', 'COUNT', NULL, NULL, NULL, 'number', 1),
  (@t, 'Total freight cost', 'KPI', 'SUM', 'freight_cost', NULL, NULL, 'decimal', 2),
  (@t, 'Freight cost by customer', 'BAR', 'SUM', 'freight_cost', 'customer', NULL, 'decimal', 3),
  (@t, 'Shipments per month', 'LINE', 'COUNT', NULL, NULL, 'ship_date', 'number', 4),
  (@t, 'Shipments by status', 'BAR', 'COUNT', NULL, 'status', NULL, 'number', 5);
GO

INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES ('manufacturing', 'production', 'AUTO', 'OVERWRITE', 1, 'production');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, 'Batch No', 'batch_no', 'string', NULL, 1, 0, 1),
  (@t, 'Production Date', 'production_date', 'date', 'yyyy-MM-dd', 0, 0, 2),
  (@t, 'Product', 'product', 'string', NULL, 0, 1, 3),
  (@t, 'Plant', 'plant', 'string', NULL, 0, 1, 4),
  (@t, 'Units Produced', 'units_produced', 'int', NULL, 0, 1, 5),
  (@t, 'Defect Units', 'defect_units', 'int', NULL, 0, 1, 6);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, 'Units produced', 'KPI', 'SUM', 'units_produced', NULL, NULL, 'number', 1),
  (@t, 'Defect units', 'KPI', 'SUM', 'defect_units', NULL, NULL, 'number', 2),
  (@t, 'Units by product', 'BAR', 'SUM', 'units_produced', 'product', NULL, 'number', 3),
  (@t, 'Units per month', 'LINE', 'SUM', 'units_produced', NULL, 'production_date', 'number', 4),
  (@t, 'Units by plant', 'BAR', 'SUM', 'units_produced', 'plant', NULL, 'number', 5);
GO

INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES ('real_estate', 'leases', 'AUTO', 'OVERWRITE', 1, 'leases');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, 'Lease ID', 'lease_id', 'string', NULL, 1, 0, 1),
  (@t, 'Property', 'property_name', 'string', NULL, 0, 1, 2),
  (@t, 'Tenant', 'tenant', 'string', NULL, 0, 1, 3),
  (@t, 'Start Date', 'start_date', 'date', 'yyyy-MM-dd', 0, 1, 4),
  (@t, 'Monthly Rent', 'monthly_rent', 'decimal(14,2)', NULL, 0, 1, 5),
  (@t, 'Status', 'status', 'string', NULL, 0, 1, 6);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, 'Total leases', 'KPI', 'COUNT', NULL, NULL, NULL, 'number', 1),
  (@t, 'Monthly rent roll', 'KPI', 'SUM', 'monthly_rent', NULL, NULL, 'decimal', 2),
  (@t, 'Rent by property', 'BAR', 'SUM', 'monthly_rent', 'property_name', NULL, 'decimal', 3),
  (@t, 'New leases per month', 'LINE', 'COUNT', NULL, NULL, 'start_date', 'number', 4),
  (@t, 'Leases by status', 'BAR', 'COUNT', NULL, 'status', NULL, 'number', 5);
GO

INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES ('construction', 'projects', 'AUTO', 'OVERWRITE', 1, 'projects');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, 'Project ID', 'project_id', 'string', NULL, 1, 0, 1),
  (@t, 'Project Name', 'project_name', 'string', NULL, 0, 1, 2),
  (@t, 'Start Date', 'start_date', 'date', 'yyyy-MM-dd', 0, 1, 3),
  (@t, 'Budget', 'budget', 'decimal(16,2)', NULL, 0, 1, 4),
  (@t, 'Actual Cost', 'actual_cost', 'decimal(16,2)', NULL, 0, 1, 5),
  (@t, 'Status', 'status', 'string', NULL, 0, 1, 6);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, 'Total budget', 'KPI', 'SUM', 'budget', NULL, NULL, 'decimal', 1),
  (@t, 'Actual cost', 'KPI', 'SUM', 'actual_cost', NULL, NULL, 'decimal', 2),
  (@t, 'Actual cost by project', 'BAR', 'SUM', 'actual_cost', 'project_name', NULL, 'decimal', 3),
  (@t, 'Projects started per month', 'LINE', 'COUNT', NULL, NULL, 'start_date', 'number', 4),
  (@t, 'Projects by status', 'BAR', 'COUNT', NULL, 'status', NULL, 'number', 5);
GO

INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES ('marketing', 'campaigns', 'AUTO', 'OVERWRITE', 1, 'campaigns');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, 'Campaign ID', 'campaign_id', 'string', NULL, 1, 0, 1),
  (@t, 'Campaign', 'campaign_name', 'string', NULL, 0, 1, 2),
  (@t, 'Channel', 'channel', 'string', NULL, 0, 1, 3),
  (@t, 'Start Date', 'start_date', 'date', 'yyyy-MM-dd', 0, 1, 4),
  (@t, 'Spend', 'spend', 'decimal(14,2)', NULL, 0, 1, 5),
  (@t, 'Conversions', 'conversions', 'int', NULL, 0, 1, 6);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, 'Total spend', 'KPI', 'SUM', 'spend', NULL, NULL, 'decimal', 1),
  (@t, 'Total conversions', 'KPI', 'SUM', 'conversions', NULL, NULL, 'number', 2),
  (@t, 'Spend by channel', 'BAR', 'SUM', 'spend', 'channel', NULL, 'decimal', 3),
  (@t, 'Spend per month', 'LINE', 'SUM', 'spend', NULL, 'start_date', 'decimal', 4),
  (@t, 'Conversions by campaign', 'BAR', 'SUM', 'conversions', 'campaign_name', NULL, 'number', 5);
GO

INSERT cfg.SourceTemplate (Industry, SourceName, FileFormat, WriteMode, ScdType, TargetTable)
VALUES ('legal', 'matters', 'AUTO', 'OVERWRITE', 1, 'matters');
DECLARE @t INT = SCOPE_IDENTITY();
INSERT cfg.ColumnTemplate (TemplateId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey, IsNullable, ColumnOrder) VALUES
  (@t, 'Matter ID', 'matter_id', 'string', NULL, 1, 0, 1),
  (@t, 'Client Name', 'client_name', 'string', NULL, 0, 1, 2),
  (@t, 'Practice Area', 'practice_area', 'string', NULL, 0, 1, 3),
  (@t, 'Opened Date', 'opened_date', 'date', 'yyyy-MM-dd', 0, 1, 4),
  (@t, 'Billed Amount', 'billed_amount', 'decimal(14,2)', NULL, 0, 1, 5),
  (@t, 'Status', 'status', 'string', NULL, 0, 1, 6);
INSERT cfg.TileTemplate (TemplateId, Title, TileType, Aggregation, MeasureColumn, GroupColumn, DateColumn, NumberFormat, DisplayOrder) VALUES
  (@t, 'Total matters', 'KPI', 'COUNT', NULL, NULL, NULL, 'number', 1),
  (@t, 'Total billed', 'KPI', 'SUM', 'billed_amount', NULL, NULL, 'decimal', 2),
  (@t, 'Billed by practice area', 'BAR', 'SUM', 'billed_amount', 'practice_area', NULL, 'decimal', 3),
  (@t, 'Matters opened per month', 'LINE', 'COUNT', NULL, NULL, 'opened_date', 'number', 4),
  (@t, 'Matters by status', 'BAR', 'COUNT', NULL, 'status', NULL, 'number', 5);
GO

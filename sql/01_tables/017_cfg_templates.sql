-- Industry starter kits. Subscribing a client copies these rows into cfg.Source / ColumnMapping / DashboardTile.
CREATE TABLE cfg.SourceTemplate (
    TemplateId  INT IDENTITY(1,1) PRIMARY KEY,
    Industry    VARCHAR(50)  NOT NULL,
    SourceName  VARCHAR(50)  NOT NULL,
    FileFormat  VARCHAR(20)  NOT NULL DEFAULT 'AUTO',
    WriteMode   VARCHAR(10)  NOT NULL DEFAULT 'OVERWRITE',
    ScdType     TINYINT      NOT NULL DEFAULT 1,
    TargetTable VARCHAR(128) NOT NULL,
    CONSTRAINT UQ_SourceTemplate UNIQUE (Industry, SourceName)
);
CREATE TABLE cfg.ColumnTemplate (
    ColumnTemplateId INT IDENTITY(1,1) PRIMARY KEY,
    TemplateId    INT          NOT NULL REFERENCES cfg.SourceTemplate(TemplateId),
    SourceColumn  VARCHAR(128) NOT NULL,
    TargetColumn  VARCHAR(128) NOT NULL,
    DataType      VARCHAR(30)  NOT NULL DEFAULT 'string',
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
    NumberFormat  VARCHAR(10)   NOT NULL DEFAULT 'number',
    DisplayOrder  INT           NOT NULL DEFAULT 0
);
GO

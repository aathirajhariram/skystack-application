CREATE TABLE cfg.ColumnMapping (
    MappingId      INT IDENTITY(1,1) PRIMARY KEY,
    SourceId       INT          NOT NULL REFERENCES cfg.Source(SourceId),
    SourceColumn   VARCHAR(128) NOT NULL,           -- header name in the file
    TargetColumn   VARCHAR(128) NOT NULL,
    DataType       VARCHAR(30)  NOT NULL DEFAULT 'string',  -- string,int,bigint,double,decimal(18,2),date,timestamp,boolean
    DateFormat     VARCHAR(40)  NULL,               -- e.g. dd-MM-yyyy (for date/timestamp)
    IsBusinessKey  BIT          NOT NULL DEFAULT 0,
    IsNullable     BIT          NOT NULL DEFAULT 1,
    DefaultValue   VARCHAR(100) NULL,               -- used when value is null
    TrackChanges   BIT          NOT NULL DEFAULT 1, -- part of SCD2 change hash
    ColumnOrder    INT          NOT NULL DEFAULT 0,
    FixedStart     INT          NULL,               -- FIXED_WIDTH only (1-based)
    FixedLength    INT          NULL,               -- FIXED_WIDTH only
    CONSTRAINT UQ_ColumnMapping UNIQUE (SourceId, TargetColumn)
);
GO

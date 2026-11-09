-- Declarative dashboard: the portal builds its queries from these rows (no SQL is stored here).
CREATE TABLE cfg.DashboardTile (
    TileId        INT IDENTITY(1,1) PRIMARY KEY,
    SourceId      INT           NOT NULL REFERENCES cfg.Source(SourceId),
    Title         NVARCHAR(120) NOT NULL,
    TileType      VARCHAR(5)    NOT NULL CHECK (TileType IN ('KPI','BAR','LINE')),
    Aggregation   VARCHAR(5)    NOT NULL CHECK (Aggregation IN ('SUM','COUNT','AVG','MIN','MAX')),
    MeasureColumn VARCHAR(128)  NULL,               -- target column; NULL with COUNT = COUNT(*)
    GroupColumn   VARCHAR(128)  NULL,               -- BAR: category column
    DateColumn    VARCHAR(128)  NULL,               -- LINE: month is derived from this column
    NumberFormat  VARCHAR(10)   NOT NULL DEFAULT 'number' CHECK (NumberFormat IN ('number','decimal','percent')),
    DisplayOrder  INT           NOT NULL DEFAULT 0,
    IsActive      BIT           NOT NULL DEFAULT 1
);
GO

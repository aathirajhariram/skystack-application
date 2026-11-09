CREATE OR ALTER VIEW cfg.vw_ColumnMapping AS
SELECT SourceId, SourceColumn, TargetColumn, DataType, DateFormat, IsBusinessKey,
       IsNullable, DefaultValue, TrackChanges, ColumnOrder, FixedStart, FixedLength
FROM   cfg.ColumnMapping;
GO

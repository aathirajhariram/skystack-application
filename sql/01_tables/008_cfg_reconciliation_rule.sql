-- Row-count reconciliation is always on. Add rows here for SUM checks or custom tolerance.
CREATE TABLE cfg.ReconciliationRule (
    ReconId       INT IDENTITY(1,1) PRIMARY KEY,
    SourceId      INT           NOT NULL REFERENCES cfg.Source(SourceId),
    Stage         VARCHAR(20)   NOT NULL CHECK (Stage IN ('SOURCE_TO_SILVER','SILVER_TO_TARGET')),
    CheckType     VARCHAR(10)   NOT NULL CHECK (CheckType IN ('ROW_COUNT','SUM')),
    ColumnName    VARCHAR(128)  NULL,
    TolerancePct  DECIMAL(9,4)  NOT NULL DEFAULT 0,
    IsActive      BIT           NOT NULL DEFAULT 1
);
GO

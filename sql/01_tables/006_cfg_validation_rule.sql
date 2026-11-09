CREATE TABLE cfg.ValidationRule (
    RuleId      INT IDENTITY(1,1) PRIMARY KEY,
    SourceId    INT          NOT NULL REFERENCES cfg.Source(SourceId),
    RuleType    VARCHAR(20)  NOT NULL CHECK (RuleType IN ('NOT_NULL','UNIQUE','RANGE','REGEX','ALLOWED_VALUES')),
    ColumnName  VARCHAR(256) NOT NULL,              -- TARGET column; UNIQUE accepts "colA,colB"
    RuleParams  NVARCHAR(MAX) NULL CHECK (RuleParams IS NULL OR ISJSON(RuleParams) = 1),
                -- RANGE {"min":0,"max":100} | REGEX {"pattern":"^[A-Z]{3}\\d+$"} | ALLOWED_VALUES {"values":["A","B"]}
    Severity    VARCHAR(5)   NOT NULL DEFAULT 'ERROR' CHECK (Severity IN ('ERROR','WARN')),
                -- ERROR = row goes to quarantine | WARN = row loads, issue is reported
    IsActive    BIT          NOT NULL DEFAULT 1
);
GO

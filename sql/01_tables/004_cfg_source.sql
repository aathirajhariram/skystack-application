-- One row per file feed (e.g. "shipments" from client X). AUTO = pick the reader per file extension (csv/xlsx/json).
CREATE TABLE cfg.Source (
    SourceId           INT IDENTITY(1,1) PRIMARY KEY,
    ClientId           INT           NOT NULL REFERENCES cfg.Client(ClientId),
    SourceName         VARCHAR(50)   NOT NULL,      -- ADLS sub-folder: landing/<ClientCode>/<SourceName>/
    FileFormat         VARCHAR(20)   NOT NULL CHECK (FileFormat IN
                         ('AUTO','CSV','EXCEL','JSON','XML','FIXED_WIDTH','ERP_TALLY_XML','ERP_SAP_FLAT')),
    FilePattern        VARCHAR(100)  NOT NULL DEFAULT '*',
    FileOptions        NVARCHAR(MAX) NULL CHECK (FileOptions IS NULL OR ISJSON(FileOptions) = 1),
                       -- e.g. {"delimiter":";","sheet_name":"Data","header_row":0,"record_tag":"VOUCHER"}
    TargetConnectionId INT           NOT NULL REFERENCES cfg.TargetConnection(ConnectionId),
    TargetTable        VARCHAR(128)  NOT NULL,
    WriteMode          VARCHAR(10)   NOT NULL DEFAULT 'APPEND' CHECK (WriteMode IN ('APPEND','OVERWRITE')),
                       -- APPEND: publish this batch | OVERWRITE: publish full current snapshot
    ScdType            TINYINT       NOT NULL DEFAULT 0 CHECK (ScdType IN (0,1,2)),
    MinRowCount        INT           NOT NULL DEFAULT 1,
    ScheduleGroup      VARCHAR(10)   NOT NULL DEFAULT 'DAILY' CHECK (ScheduleGroup IN ('DAILY','WEEKLY','MONTHLY','ADHOC')),
    IsActive           BIT           NOT NULL DEFAULT 1,
    CONSTRAINT UQ_Source UNIQUE (ClientId, SourceName)
);
GO

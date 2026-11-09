CREATE TABLE cfg.Client (
    ClientId    INT IDENTITY(1,1) PRIMARY KEY,
    ClientCode  VARCHAR(30)   NOT NULL UNIQUE,      -- also the ADLS folder name and portal tenant id
    ClientName  NVARCHAR(200) NOT NULL,
    Industry    VARCHAR(50)   NOT NULL,             -- manufacturing, logistics, real_estate, ...
    PlanCode    VARCHAR(20)   NULL,                 -- basic | pro | elite (see cfg.Plan)
    IsActive    BIT           NOT NULL DEFAULT 1,
    CreatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

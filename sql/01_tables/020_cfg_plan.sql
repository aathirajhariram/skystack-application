-- Subscription plans shown in the website popup. Edit prices/features with plain UPDATEs - no deployment needed.
CREATE TABLE cfg.Plan (
    PlanCode     VARCHAR(20)   NOT NULL PRIMARY KEY,
    Name         NVARCHAR(50)  NOT NULL,
    PriceMonthly DECIMAL(10,2) NOT NULL,
    Currency     CHAR(3)       NOT NULL DEFAULT 'EUR',
    Tagline      NVARCHAR(200) NULL,
    Features     NVARCHAR(MAX) NOT NULL CHECK (ISJSON(Features) = 1),   -- JSON array of strings shown as bullets
    MaxUsers     INT           NOT NULL,                                -- enforced when admins invite employees
    IsPopular    BIT           NOT NULL DEFAULT 0,
    DisplayOrder INT           NOT NULL DEFAULT 0,
    IsActive     BIT           NOT NULL DEFAULT 1
);
GO

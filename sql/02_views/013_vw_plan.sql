CREATE OR ALTER VIEW portal.vw_Plan AS
SELECT PlanCode, Name, PriceMonthly, Currency, Tagline, Features, MaxUsers, IsPopular, DisplayOrder
FROM   cfg.Plan WHERE IsActive = 1;
GO

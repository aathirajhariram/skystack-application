-- PLACEHOLDER prices and features - edit freely (UPDATE cfg.Plan ...). Shown live in the website popup.
INSERT cfg.Plan (PlanCode, Name, PriceMonthly, Currency, Tagline, Features, MaxUsers, IsPopular, DisplayOrder) VALUES
 ('basic', N'Basic', 99.00,  'EUR', N'For small teams getting started',
  N'["1 data source","Up to 3 users","Monthly dashboard refresh","Email support"]', 3, 0, 1),
 ('pro',   N'Pro',   249.00, 'EUR', N'For growing companies',
  N'["Up to 5 data sources","Up to 15 users","Daily dashboard refresh","Role-based access for employees","Priority support"]', 15, 1, 2),
 ('elite', N'Elite', 499.00, 'EUR', N'For data-driven organisations',
  N'["Unlimited data sources","Up to 50 users","Refresh on every upload","Dedicated specialist and onboarding call","Custom dashboards"]', 50, 0, 3);
GO

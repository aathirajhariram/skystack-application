-- Control database (Azure SQL). cfg = configuration, audit = run history.
IF SCHEMA_ID('cfg')   IS NULL EXEC('CREATE SCHEMA cfg');
IF SCHEMA_ID('audit') IS NULL EXEC('CREATE SCHEMA audit');
IF SCHEMA_ID('portal') IS NULL EXEC('CREATE SCHEMA portal');   -- portal users + activity log
GO

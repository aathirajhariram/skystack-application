-- Run once in the CONTROL database as Entra admin. Replace the names with your two managed identities.
-- Customer-facing API: reads config/audit, manages portal users. Cannot onboard clients.
CREATE USER [skystack-api] FROM EXTERNAL PROVIDER;
GRANT SELECT ON SCHEMA::cfg    TO [skystack-api];
GRANT SELECT ON SCHEMA::audit  TO [skystack-api];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::portal TO [skystack-api];   -- DELETE: visibility lists

-- Internal Ops service: may onboard / enable / disable clients and re-issue passwords.
CREATE USER [skystack-ops] FROM EXTERNAL PROVIDER;
GRANT SELECT ON SCHEMA::cfg    TO [skystack-ops];
GRANT SELECT ON SCHEMA::audit  TO [skystack-ops];
GRANT SELECT, INSERT, UPDATE ON SCHEMA::portal TO [skystack-ops];
GRANT EXECUTE ON cfg.usp_OnboardClient   TO [skystack-ops];
GRANT EXECUTE ON cfg.usp_SetClientActive TO [skystack-ops];
GO
-- Note: both users also need INSERT/UPDATE on the cfg tables that usp_OnboardClient writes; because the
-- procedure is owned by dbo, EXECUTE is enough (ownership chaining) - no direct table rights are required.

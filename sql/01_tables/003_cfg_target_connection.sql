-- Where a client's data is delivered. Passwords/keys are NEVER stored here,
-- only the NAME of the Key Vault secret that holds them.
CREATE TABLE cfg.TargetConnection (
    ConnectionId         INT IDENTITY(1,1) PRIMARY KEY,
    ClientId             INT           NOT NULL REFERENCES cfg.Client(ClientId),
    ConnectionName       VARCHAR(60)   NOT NULL,
    TargetType           VARCHAR(20)   NOT NULL CHECK (TargetType IN ('AZURE_SQL','COSMOS','DELTA')),
    ServerName           VARCHAR(200)  NULL,        -- SQL server FQDN or Cosmos endpoint
    DatabaseName         VARCHAR(100)  NULL,
    SchemaName           VARCHAR(50)   NOT NULL DEFAULT 'dbo',
    ContainerName        VARCHAR(100)  NULL,        -- Cosmos container
    CredentialSecretName VARCHAR(120)  NULL,        -- SQL: {"user","password"} | Cosmos: {"key"}
    IsActive             BIT           NOT NULL DEFAULT 1,
    CONSTRAINT UQ_TargetConnection UNIQUE (ClientId, ConnectionName)
);
GO

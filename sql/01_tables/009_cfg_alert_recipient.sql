-- ClientId NULL = global developer list (receives alerts for every client).
CREATE TABLE cfg.AlertRecipient (
    RecipientId   INT IDENTITY(1,1) PRIMARY KEY,
    ClientId      INT           NULL REFERENCES cfg.Client(ClientId),
    Email         VARCHAR(200)  NOT NULL,
    RecipientRole VARCHAR(10)   NOT NULL DEFAULT 'DEVELOPER' CHECK (RecipientRole IN ('DEVELOPER','CLIENT')),
    IsActive      BIT           NOT NULL DEFAULT 1
);
GO

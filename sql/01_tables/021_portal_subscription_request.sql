-- One row per "Subscribe" click. Lifecycle: PENDING_PAYMENT -> PAID -> ACTIVATING -> ACTIVATED
-- (ACTIVATION_FAILED is retried by SkyStack ops). Only the activation worker moves PAID onwards.
CREATE TABLE portal.SubscriptionRequest (
    RequestId    UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    Email        NVARCHAR(200) NOT NULL,
    ContactName  NVARCHAR(200) NOT NULL,
    CompanyName  NVARCHAR(200) NOT NULL,
    Industry     VARCHAR(50)   NOT NULL,
    PlanCode     VARCHAR(20)   NOT NULL REFERENCES cfg.Plan(PlanCode),
    Status       VARCHAR(20)   NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (Status IN
                   ('PENDING_PAYMENT','PAID','ACTIVATING','ACTIVATED','ACTIVATION_FAILED','CANCELLED')),
    PaymentRef   VARCHAR(100)  NULL,                -- Stripe Checkout Session id
    ClientCode   VARCHAR(30)   NULL,                -- filled on activation
    LastError    NVARCHAR(500) NULL,
    CreatedAt    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    PaidAt       DATETIME2     NULL,
    ActivatedAt  DATETIME2     NULL
);
CREATE INDEX IX_SubscriptionRequest_Status ON portal.SubscriptionRequest (Status, CreatedAt);
CREATE INDEX IX_SubscriptionRequest_Email  ON portal.SubscriptionRequest (Email);
GO

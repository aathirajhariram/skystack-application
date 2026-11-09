-- Enable / disable a whole client: portal sign-in AND scheduled processing stop immediately.
CREATE OR ALTER PROCEDURE cfg.usp_SetClientActive
    @ClientCode VARCHAR(30),
    @IsActive   BIT,
    @Actor      NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE cfg.Client SET IsActive = @IsActive WHERE ClientCode = @ClientCode;
    IF @@ROWCOUNT = 0 THROW 50004, 'Client not found', 1;
    INSERT portal.ActivityLog (ClientId, Actor, Action, Detail)
    SELECT ClientId, @Actor, CASE WHEN @IsActive = 1 THEN 'CLIENT_ENABLED' ELSE 'CLIENT_DISABLED' END, @ClientCode
    FROM cfg.Client WHERE ClientCode = @ClientCode;
END
GO

/* ------------------------------------------------------------------ */
/*  Mastermind — webhook integrations (Zapier / Slack / Discord / any) */
/*                                                                    */
/*  Why:                                                              */
/*    Lets staff plug Mastermind events into any external system that  */
/*    can accept an HTTP POST: Zapier, Make, Slack incoming webhooks,  */
/*    Discord webhooks, n8n, custom internal services. Closes the     */
/*    "integration" gap on the competitive matrix.                     */
/*                                                                    */
/*  Storage decisions:                                                 */
/*    - One row per registered webhook subscription. Each row says     */
/*      "POST a JSON payload to <url> whenever <event_code> fires."    */
/*    - link_created_by_user_profile_id audits who added it.           */
/*    - is_active toggles delivery without deleting the row.           */
/*    - webhook_secret is HMAC-SHA256-signed into the request header   */
/*      X-Mastermind-Signature so receivers can verify authenticity.  */
/*    - last_dispatch_at + last_dispatch_status_code give an at-a-     */
/*      glance health view in the admin UI.                            */
/*                                                                    */
/*  Run in SSMS while connected to the amolnama_news database.         */
/* ------------------------------------------------------------------ */

IF OBJECT_ID(N'[mastermind].[coll_webhook_subscription]', N'U') IS NULL
BEGIN
    CREATE TABLE [mastermind].[coll_webhook_subscription] (
        mastermind_coll_webhook_subscription_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        webhook_event_code                      NVARCHAR(60) NOT NULL,
        webhook_target_url                      NVARCHAR(1000) NOT NULL,
        webhook_secret                          NVARCHAR(200) NULL,
        webhook_label                           NVARCHAR(200) NULL,
        link_created_by_user_profile_id         BIGINT NULL,
        last_dispatch_at                        DATETIME2 NULL,
        last_dispatch_status_code               NVARCHAR(20) NULL,
        last_dispatch_response_code             INT NULL,
        last_dispatch_error_message             NVARCHAR(500) NULL,
        dispatch_success_count                  INT NOT NULL DEFAULT 0,
        dispatch_failure_count                  INT NOT NULL DEFAULT 0,
        is_active                               BIT NOT NULL DEFAULT 1,
        created_at                              DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at                              DATETIME2 NULL
    );

    CREATE INDEX IX_webhook_subscription_event_active
        ON [mastermind].[coll_webhook_subscription](webhook_event_code, is_active);

    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Registered webhook subscriptions. Mastermind POSTs a signed JSON payload to webhook_target_url whenever the named webhook_event_code fires. Delivery is fire-and-forget with retries; dispatch_success_count + dispatch_failure_count keep an at-a-glance health view in the admin UI.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_webhook_subscription';

    PRINT 'Created table: [mastermind].[coll_webhook_subscription]';
END
ELSE
BEGIN
    PRINT 'Table already exists: [mastermind].[coll_webhook_subscription]';
END
GO

/* Verification ---------------------------------------------------- */

SELECT TOP 5 sys.columns.name AS column_name, sys.types.name AS data_type, sys.columns.is_nullable
FROM   sys.columns
JOIN   sys.types ON sys.types.user_type_id = sys.columns.user_type_id
WHERE  sys.columns.object_id = OBJECT_ID(N'[mastermind].[coll_webhook_subscription]')
ORDER BY sys.columns.column_id;
GO

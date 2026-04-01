-- ================================================================
-- SYSTEM LOG — Simple activity/error log for all apps
-- Write-only, append-only. Query when you need to investigate.
-- ================================================================

USE [news_magazine];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE [name] = N'system')
BEGIN
    EXEC(N'CREATE SCHEMA [system]');
END;
GO

DROP TABLE IF EXISTS [system].[log_activity];
GO

CREATE TABLE [system].[log_activity]
(
    [system_log_activity_id]      BIGINT IDENTITY(1,1) NOT NULL,
    [app_name_code]                    NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [log_action_code]                 NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [log_severity_code]                  NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [link_user_profile_id]        BIGINT NULL,
    [link_entity_id]              BIGINT NULL,
    [entity_type_code]                 NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [log_message]                     NVARCHAR(2000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [log_detail_json]                 NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [client_ip_address]                  NVARCHAR(45) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [created_at]                  DATETIME2(0) NOT NULL,

    CONSTRAINT [PK_system_log_activity]
        PRIMARY KEY CLUSTERED ([system_log_activity_id] ASC)
);
GO

ALTER TABLE [system].[log_activity]
    ADD CONSTRAINT [DF_system_log_activity_log_severity_code]
    DEFAULT (N'info') FOR [log_severity_code];
GO

ALTER TABLE [system].[log_activity]
    ADD CONSTRAINT [DF_system_log_activity_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

CREATE NONCLUSTERED INDEX [IX_system_log_activity_app_name_code_log_action_code]
    ON [system].[log_activity] ([app_name_code] ASC, [log_action_code] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_system_log_activity_log_severity_code]
    ON [system].[log_activity] ([log_severity_code] ASC)
    WHERE [log_severity_code] IN (N'error', N'warning');
GO

CREATE NONCLUSTERED INDEX [IX_system_log_activity_created_at]
    ON [system].[log_activity] ([created_at] DESC);
GO

CREATE NONCLUSTERED INDEX [IX_system_log_activity_link_user_profile_id]
    ON [system].[log_activity] ([link_user_profile_id] ASC)
    WHERE [link_user_profile_id] IS NOT NULL;
GO

PRINT N'System log table created successfully.';
GO

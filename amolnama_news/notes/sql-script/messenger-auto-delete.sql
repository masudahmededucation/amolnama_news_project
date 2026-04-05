-- ============================================================
-- Messenger — Auto-Delete Timer + Clear Conversation
-- Run AFTER messenger-tables.sql
-- ============================================================

-- Add auto-delete settings to conversation
ALTER TABLE [messenger].[conversation]
ADD [auto_delete_after_seconds]             INT         NULL,
    [auto_delete_set_by_user_profile_id]    BIGINT      NULL,
    [auto_delete_set_at]                    DATETIME2   NULL;
GO

-- Add pre-calculated expiry timestamp to message
ALTER TABLE [messenger].[message]
ADD [auto_delete_expires_at]                DATETIME2   NULL;
GO

-- Index for background cleanup: find expired messages efficiently
CREATE NONCLUSTERED INDEX [IX_messenger_message_auto_delete_expires]
    ON [messenger].[message] ([auto_delete_expires_at])
    WHERE [auto_delete_expires_at] IS NOT NULL;
GO

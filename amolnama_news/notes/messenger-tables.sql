-- ============================================================
-- Messenger App — Database Tables (v2 — WhatsApp-informed design)
-- Schema: [messenger]
-- Supports: 1-on-1 chat, future group chat, read receipts,
--           reply-to, delete-for-me, media messages, reactions
-- ============================================================

-- Create schema if not exists
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'messenger')
    EXEC('CREATE SCHEMA messenger');
GO

-- ============================================================
-- Table 1: conversation
-- One row per chat thread. Works for both 1-on-1 and groups.
-- Denormalized last_message fields for fast conversation list.
-- ============================================================
CREATE TABLE [messenger].[conversation] (
    [messenger_conversation_id]         BIGINT          IDENTITY(1,1)   NOT NULL,
    [conversation_type_code]            VARCHAR(20)     NOT NULL        DEFAULT 'direct',   -- 'direct' or 'group'
    [conversation_title]                NVARCHAR(255)   NULL,                                -- NULL for direct, group name for group
    [last_message_text]                 NVARCHAR(500)   NULL,
    [last_message_at]                   DATETIME2       NULL,
    [last_message_sender_user_profile_id] BIGINT        NULL,
    [is_active]                         BIT             NOT NULL        DEFAULT 1,
    [created_at]                        DATETIME2       NOT NULL        DEFAULT GETDATE(),
    [link_created_by_user_profile_id]   BIGINT          NULL,

    CONSTRAINT [PK_messenger_conversation] PRIMARY KEY CLUSTERED ([messenger_conversation_id])
);
GO

-- ============================================================
-- Table 2: conversation_participant
-- Who is in which conversation. Tracks unread count, mute, pin.
-- For direct chat: exactly 2 participants.
-- ============================================================
CREATE TABLE [messenger].[conversation_participant] (
    [messenger_conversation_participant_id]  BIGINT      IDENTITY(1,1)   NOT NULL,
    [link_conversation_id]                   BIGINT      NOT NULL,
    [link_user_profile_id]                   BIGINT      NOT NULL,
    [participant_role_code]                   VARCHAR(20) NOT NULL        DEFAULT 'member',   -- 'member', 'admin', 'owner'
    [unread_count]                           INT         NOT NULL        DEFAULT 0,
    [last_read_message_id]                   BIGINT      NULL,
    [is_muted]                               BIT         NOT NULL        DEFAULT 0,
    [is_pinned]                              BIT         NOT NULL        DEFAULT 0,
    [is_active]                              BIT         NOT NULL        DEFAULT 1,
    [joined_at]                              DATETIME2   NOT NULL        DEFAULT GETDATE(),
    [left_at]                                DATETIME2   NULL,

    CONSTRAINT [PK_messenger_conversation_participant] PRIMARY KEY CLUSTERED ([messenger_conversation_participant_id]),
    CONSTRAINT [FK_messenger_participant_conversation] FOREIGN KEY ([link_conversation_id])
        REFERENCES [messenger].[conversation] ([messenger_conversation_id]),
    CONSTRAINT [UQ_messenger_participant_conversation_user] UNIQUE ([link_conversation_id], [link_user_profile_id])
);
GO

-- Index: find all conversations for a user (sorted by last message)
CREATE NONCLUSTERED INDEX [IX_messenger_participant_user]
    ON [messenger].[conversation_participant] ([link_user_profile_id], [is_active])
    INCLUDE ([link_conversation_id], [unread_count], [is_pinned], [is_muted]);
GO

-- ============================================================
-- Table 3: message
-- Individual messages. content_type_code supports future media.
-- reply_to for quoting. Soft delete for "delete for everyone".
-- ============================================================
CREATE TABLE [messenger].[message] (
    [messenger_message_id]              BIGINT          IDENTITY(1,1)   NOT NULL,
    [link_conversation_id]              BIGINT          NOT NULL,
    [link_sender_user_profile_id]       BIGINT          NOT NULL,
    [message_text]                      NVARCHAR(4000)  NOT NULL,
    [content_type_code]                 VARCHAR(20)     NOT NULL        DEFAULT 'text',     -- 'text', 'image', 'video', 'audio', 'document'
    [message_status_code]               VARCHAR(20)     NOT NULL        DEFAULT 'sent',     -- 'sent', 'delivered', 'read'
    [link_reply_to_message_id]          BIGINT          NULL,                                -- quoted/replied message
    [is_edited]                         BIT             NOT NULL        DEFAULT 0,
    [edited_at]                         DATETIME2       NULL,
    [is_deleted_for_everyone]           BIT             NOT NULL        DEFAULT 0,
    [deleted_for_everyone_at]           DATETIME2       NULL,
    [is_system_message]                 BIT             NOT NULL        DEFAULT 0,           -- "User joined", date separators
    [is_active]                         BIT             NOT NULL        DEFAULT 1,
    [created_at]                        DATETIME2       NOT NULL        DEFAULT GETDATE(),
    [delivered_at]                      DATETIME2       NULL,
    [read_at]                           DATETIME2       NULL,

    CONSTRAINT [PK_messenger_message] PRIMARY KEY CLUSTERED ([messenger_message_id]),
    CONSTRAINT [FK_messenger_message_conversation] FOREIGN KEY ([link_conversation_id])
        REFERENCES [messenger].[conversation] ([messenger_conversation_id]),
    CONSTRAINT [FK_messenger_message_reply_to] FOREIGN KEY ([link_reply_to_message_id])
        REFERENCES [messenger].[message] ([messenger_message_id])
);
GO

-- Index: fetch messages in conversation (newest first) — main query
CREATE NONCLUSTERED INDEX [IX_messenger_message_conversation_created]
    ON [messenger].[message] ([link_conversation_id], [created_at] DESC)
    INCLUDE ([link_sender_user_profile_id], [message_text], [content_type_code], [message_status_code], [is_active], [is_deleted_for_everyone]);

-- Index: poll for new messages since timestamp
CREATE NONCLUSTERED INDEX [IX_messenger_message_poll]
    ON [messenger].[message] ([link_conversation_id], [is_active], [created_at])
    INCLUDE ([link_sender_user_profile_id], [message_text], [message_status_code]);
GO

-- ============================================================
-- Table 4: message_deletion
-- "Delete for me" — per-user soft delete without affecting others.
-- ============================================================
CREATE TABLE [messenger].[message_deletion] (
    [messenger_message_deletion_id]     BIGINT          IDENTITY(1,1)   NOT NULL,
    [link_message_id]                   BIGINT          NOT NULL,
    [link_user_profile_id]              BIGINT          NOT NULL,
    [deleted_at]                        DATETIME2       NOT NULL        DEFAULT GETDATE(),

    CONSTRAINT [PK_messenger_message_deletion] PRIMARY KEY CLUSTERED ([messenger_message_deletion_id]),
    CONSTRAINT [FK_messenger_deletion_message] FOREIGN KEY ([link_message_id])
        REFERENCES [messenger].[message] ([messenger_message_id]),
    CONSTRAINT [UQ_messenger_deletion_message_user] UNIQUE ([link_message_id], [link_user_profile_id])
);
GO

-- ============================================================
-- Table 5: typing_indicator (ephemeral — rows expire after 5 seconds)
-- ============================================================
CREATE TABLE [messenger].[typing_indicator] (
    [messenger_typing_indicator_id]     BIGINT          IDENTITY(1,1)   NOT NULL,
    [link_conversation_id]              BIGINT          NOT NULL,
    [link_user_profile_id]              BIGINT          NOT NULL,
    [last_typed_at]                     DATETIME2       NOT NULL        DEFAULT GETDATE(),

    CONSTRAINT [PK_messenger_typing_indicator] PRIMARY KEY CLUSTERED ([messenger_typing_indicator_id]),
    CONSTRAINT [UQ_messenger_typing_conversation_user] UNIQUE ([link_conversation_id], [link_user_profile_id]),
    CONSTRAINT [FK_messenger_typing_conversation] FOREIGN KEY ([link_conversation_id])
        REFERENCES [messenger].[conversation] ([messenger_conversation_id])
);
GO

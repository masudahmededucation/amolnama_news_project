USE [news_magazine];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ================================================================
   SCHEMA: [debate]
   ================================================================ */

IF NOT EXISTS
(
    SELECT 1
    FROM sys.schemas
    WHERE [name] = N'debate'
)
BEGIN
    EXEC(N'CREATE SCHEMA [debate]');
END;
GO

/* ================================================================
   DROP OBJECTS: [debate]
   Drop in reverse dependency order.
   ================================================================ */

DROP TABLE IF EXISTS [blog_debate].[coll_post_edit_history];
GO
DROP TABLE IF EXISTS [blog_debate].[fact_post_moderation];
GO
DROP TABLE IF EXISTS [blog_debate].[coll_vote];
GO
DROP TABLE IF EXISTS [blog_debate].[coll_post];
GO
DROP TABLE IF EXISTS [blog_debate].[coll_topic_participant];
GO
DROP TABLE IF EXISTS [blog_debate].[coll_topic];
GO
DROP TABLE IF EXISTS [blog_debate].[ref_vote_target_type];
GO
DROP TABLE IF EXISTS [blog_debate].[ref_moderation_status];
GO
DROP TABLE IF EXISTS [blog_debate].[ref_post_kind];
GO
DROP TABLE IF EXISTS [blog_debate].[ref_topic_status];
GO
DROP TABLE IF EXISTS [blog_debate].[ref_team_side];
GO

/* ================================================================
   TABLE: [blog_debate].[ref_team_side]
   Blue (Pro / In Favor) vs Red (Against)
   ================================================================ */

CREATE TABLE [blog_debate].[ref_team_side]
(
    [debate_ref_team_side_id]          INT IDENTITY(1,1) NOT NULL,
    [team_side_code]                   NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [team_side_name_en]                NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [team_side_name_bn]                NVARCHAR(50) COLLATE Bengali_100_CI_AS NOT NULL,
    [team_side_color_hex]              NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                       INT NULL,
    [is_active]                        BIT NOT NULL,
    [created_at]                       DATETIME2(0) NOT NULL,
    [updated_at]                       DATETIME2(0) NULL,

    CONSTRAINT [PK_debate_ref_team_side]
        PRIMARY KEY CLUSTERED ([debate_ref_team_side_id] ASC)
);
GO

ALTER TABLE [blog_debate].[ref_team_side]
    ADD CONSTRAINT [DF_debate_ref_team_side_is_active]
    DEFAULT ((1)) FOR [is_active];
GO

ALTER TABLE [blog_debate].[ref_team_side]
    ADD CONSTRAINT [DF_debate_ref_team_side_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [blog_debate].[ref_team_side]
    ADD CONSTRAINT [UX_debate_ref_team_side_team_side_code]
    UNIQUE ([team_side_code]);
GO

SET IDENTITY_INSERT [blog_debate].[ref_team_side] ON;
INSERT INTO [blog_debate].[ref_team_side]
    ([debate_ref_team_side_id], [team_side_code], [team_side_name_en], [team_side_name_bn], [team_side_color_hex], [sort_order], [is_active])
VALUES
    (1, N'blue', N'Blue / Pro', N'নীল / পক্ষে', N'#2563eb', 1, 1),
    (2, N'red', N'Red / Against', N'লাল / বিপক্ষে', N'#dc2626', 2, 1);
SET IDENTITY_INSERT [blog_debate].[ref_team_side] OFF;
GO

/* ================================================================
   TABLE: [blog_debate].[ref_topic_status]
   Debate lifecycle: draft → scheduled → live → paused → closed → archived
   ================================================================ */

CREATE TABLE [blog_debate].[ref_topic_status]
(
    [debate_ref_topic_status_id]       INT IDENTITY(1,1) NOT NULL,
    [topic_status_code]                NVARCHAR(30) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [topic_status_name_en]             NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [topic_status_name_bn]             NVARCHAR(50) COLLATE Bengali_100_CI_AS NOT NULL,
    [sort_order]                       INT NULL,
    [is_active]                        BIT NOT NULL,
    [created_at]                       DATETIME2(0) NOT NULL,
    [updated_at]                       DATETIME2(0) NULL,

    CONSTRAINT [PK_debate_ref_topic_status]
        PRIMARY KEY CLUSTERED ([debate_ref_topic_status_id] ASC)
);
GO

ALTER TABLE [blog_debate].[ref_topic_status]
    ADD CONSTRAINT [DF_debate_ref_topic_status_is_active]
    DEFAULT ((1)) FOR [is_active];
GO

ALTER TABLE [blog_debate].[ref_topic_status]
    ADD CONSTRAINT [DF_debate_ref_topic_status_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [blog_debate].[ref_topic_status]
    ADD CONSTRAINT [UX_debate_ref_topic_status_topic_status_code]
    UNIQUE ([topic_status_code]);
GO

SET IDENTITY_INSERT [blog_debate].[ref_topic_status] ON;
INSERT INTO [blog_debate].[ref_topic_status]
    ([debate_ref_topic_status_id], [topic_status_code], [topic_status_name_en], [topic_status_name_bn], [sort_order], [is_active])
VALUES
    (1, N'draft',     N'Draft',     N'খসড়া',     1, 1),
    (2, N'scheduled', N'Scheduled', N'নির্ধারিত', 2, 1),
    (3, N'live',      N'Live',      N'চলমান',     3, 1),
    (4, N'paused',    N'Paused',    N'স্থগিত',    4, 1),
    (5, N'closed',    N'Closed',    N'সমাপ্ত',    5, 1),
    (6, N'archived',  N'Archived',  N'সংরক্ষিত',  6, 1);
SET IDENTITY_INSERT [blog_debate].[ref_topic_status] OFF;
GO

/* ================================================================
   TABLE: [blog_debate].[ref_post_kind]
   Argument (new top-level point) vs Rebuttal (reply = opposition)
   ================================================================ */

CREATE TABLE [blog_debate].[ref_post_kind]
(
    [debate_ref_post_kind_id]          INT IDENTITY(1,1) NOT NULL,
    [post_kind_code]                   NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [post_kind_name_en]                NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [post_kind_name_bn]                NVARCHAR(50) COLLATE Bengali_100_CI_AS NOT NULL,
    [sort_order]                       INT NULL,
    [is_active]                        BIT NOT NULL,
    [created_at]                       DATETIME2(0) NOT NULL,
    [updated_at]                       DATETIME2(0) NULL,

    CONSTRAINT [PK_debate_ref_post_kind]
        PRIMARY KEY CLUSTERED ([debate_ref_post_kind_id] ASC)
);
GO

ALTER TABLE [blog_debate].[ref_post_kind]
    ADD CONSTRAINT [DF_debate_ref_post_kind_is_active]
    DEFAULT ((1)) FOR [is_active];
GO

ALTER TABLE [blog_debate].[ref_post_kind]
    ADD CONSTRAINT [DF_debate_ref_post_kind_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [blog_debate].[ref_post_kind]
    ADD CONSTRAINT [UX_debate_ref_post_kind_post_kind_code]
    UNIQUE ([post_kind_code]);
GO

SET IDENTITY_INSERT [blog_debate].[ref_post_kind] ON;
INSERT INTO [blog_debate].[ref_post_kind]
    ([debate_ref_post_kind_id], [post_kind_code], [post_kind_name_en], [post_kind_name_bn], [sort_order], [is_active])
VALUES
    (1, N'argument', N'Argument', N'মূল যুক্তি', 1, 1),
    (2, N'rebuttal', N'Rebuttal', N'খণ্ডন',      2, 1);
SET IDENTITY_INSERT [blog_debate].[ref_post_kind] OFF;
GO

/* ================================================================
   TABLE: [blog_debate].[ref_moderation_status]
   Moderation pipeline for post quality control
   ================================================================ */

CREATE TABLE [blog_debate].[ref_moderation_status]
(
    [debate_ref_moderation_status_id]  INT IDENTITY(1,1) NOT NULL,
    [moderation_status_code]           NVARCHAR(30) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [moderation_status_name_en]        NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [moderation_status_name_bn]        NVARCHAR(50) COLLATE Bengali_100_CI_AS NOT NULL,
    [sort_order]                       INT NULL,
    [is_active]                        BIT NOT NULL,
    [created_at]                       DATETIME2(0) NOT NULL,
    [updated_at]                       DATETIME2(0) NULL,

    CONSTRAINT [PK_debate_ref_moderation_status]
        PRIMARY KEY CLUSTERED ([debate_ref_moderation_status_id] ASC)
);
GO

ALTER TABLE [blog_debate].[ref_moderation_status]
    ADD CONSTRAINT [DF_debate_ref_moderation_status_is_active]
    DEFAULT ((1)) FOR [is_active];
GO

ALTER TABLE [blog_debate].[ref_moderation_status]
    ADD CONSTRAINT [DF_debate_ref_moderation_status_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [blog_debate].[ref_moderation_status]
    ADD CONSTRAINT [UX_debate_ref_moderation_status_moderation_status_code]
    UNIQUE ([moderation_status_code]);
GO

SET IDENTITY_INSERT [blog_debate].[ref_moderation_status] ON;
INSERT INTO [blog_debate].[ref_moderation_status]
    ([debate_ref_moderation_status_id], [moderation_status_code], [moderation_status_name_en], [moderation_status_name_bn], [sort_order], [is_active])
VALUES
    (1, N'pending',  N'Pending',  N'পর্যালোচনাধীন', 1, 1),
    (2, N'approved', N'Approved', N'অনুমোদিত',       2, 1),
    (3, N'rejected', N'Rejected', N'প্রত্যাখ্যাত',   3, 1),
    (4, N'hidden',   N'Hidden',   N'গোপন',           4, 1),
    (5, N'flagged',  N'Flagged',  N'ফ্ল্যাগকৃত',     5, 1);
SET IDENTITY_INSERT [blog_debate].[ref_moderation_status] OFF;
GO

/* ================================================================
   TABLE: [blog_debate].[ref_vote_target_type]
   Vote can target a topic or a post
   ================================================================ */

CREATE TABLE [blog_debate].[ref_vote_target_type]
(
    [debate_ref_vote_target_type_id]   INT IDENTITY(1,1) NOT NULL,
    [vote_target_type_code]            NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [vote_target_type_name_en]         NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [vote_target_type_name_bn]         NVARCHAR(50) COLLATE Bengali_100_CI_AS NOT NULL,
    [sort_order]                       INT NULL,
    [is_active]                        BIT NOT NULL,
    [created_at]                       DATETIME2(0) NOT NULL,
    [updated_at]                       DATETIME2(0) NULL,

    CONSTRAINT [PK_debate_ref_vote_target_type]
        PRIMARY KEY CLUSTERED ([debate_ref_vote_target_type_id] ASC)
);
GO

ALTER TABLE [blog_debate].[ref_vote_target_type]
    ADD CONSTRAINT [DF_debate_ref_vote_target_type_is_active]
    DEFAULT ((1)) FOR [is_active];
GO

ALTER TABLE [blog_debate].[ref_vote_target_type]
    ADD CONSTRAINT [DF_debate_ref_vote_target_type_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [blog_debate].[ref_vote_target_type]
    ADD CONSTRAINT [UX_debate_ref_vote_target_type_vote_target_type_code]
    UNIQUE ([vote_target_type_code]);
GO

SET IDENTITY_INSERT [blog_debate].[ref_vote_target_type] ON;
INSERT INTO [blog_debate].[ref_vote_target_type]
    ([debate_ref_vote_target_type_id], [vote_target_type_code], [vote_target_type_name_en], [vote_target_type_name_bn], [sort_order], [is_active])
VALUES
    (1, N'topic', N'Topic', N'বিষয়',  1, 1),
    (2, N'post',  N'Post',  N'পোস্ট', 2, 1);
SET IDENTITY_INSERT [blog_debate].[ref_vote_target_type] OFF;
GO

/* ================================================================
   TABLE: [blog_debate].[coll_topic]
   The scheduled debate event — topic, rules, lifecycle, vote counts
   ================================================================ */

CREATE TABLE [blog_debate].[coll_topic]
(
    [debate_coll_topic_id]                     BIGINT IDENTITY(1,1) NOT NULL,
    [topic_guid]                               UNIQUEIDENTIFIER NOT NULL,
    [topic_title]                              NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [topic_description]                        NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [blue_side_label]                          NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [red_side_label]                           NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [link_topic_status_id]                     INT NOT NULL,
    [scheduled_start_at]                       DATETIME2(0) NOT NULL,
    [scheduled_end_at]                         DATETIME2(0) NULL,
    [actual_started_at]                        DATETIME2(0) NULL,
    [actual_closed_at]                         DATETIME2(0) NULL,
    [is_public]                                BIT NOT NULL,
    [allow_topic_upvote]                       BIT NOT NULL,
    [minimum_post_character_count]             INT NOT NULL,
    [maximum_post_character_count]             INT NULL,
    [minimum_sentence_count]                   INT NOT NULL,
    [allow_nested_replies]                     BIT NOT NULL,
    [maximum_reply_depth]                      INT NOT NULL,
    [is_ai_moderation_enabled]                 BIT NOT NULL,
    [minimum_logic_score]                      DECIMAL(5,4) NOT NULL,
    [topic_upvote_count]                       INT NOT NULL,
    [topic_downvote_count]                     INT NOT NULL,
    [topic_score]                              INT NOT NULL,
    [blue_participant_count]                   INT NOT NULL,
    [blue_post_count]                          INT NOT NULL,
    [blue_upvote_count]                        INT NOT NULL,
    [blue_sentence_count]                      INT NOT NULL,
    [blue_character_count]                     INT NOT NULL,
    [red_participant_count]                    INT NOT NULL,
    [red_post_count]                           INT NOT NULL,
    [red_upvote_count]                         INT NOT NULL,
    [red_sentence_count]                       INT NOT NULL,
    [red_character_count]                      INT NOT NULL,
    [total_post_count]                         INT NOT NULL,
    [link_created_by_user_profile_id]           BIGINT NOT NULL,
    [is_active]                                BIT NOT NULL,
    [created_at]                               DATETIME2(0) NOT NULL,
    [updated_at]                               DATETIME2(0) NULL,

    CONSTRAINT [PK_debate_coll_topic]
        PRIMARY KEY CLUSTERED ([debate_coll_topic_id] ASC)
);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_topic_guid]
    DEFAULT (NEWID()) FOR [topic_guid];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_is_public]
    DEFAULT ((1)) FOR [is_public];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_allow_topic_upvote]
    DEFAULT ((1)) FOR [allow_topic_upvote];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_minimum_post_character_count]
    DEFAULT ((20)) FOR [minimum_post_character_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_minimum_sentence_count]
    DEFAULT ((1)) FOR [minimum_sentence_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_allow_nested_replies]
    DEFAULT ((1)) FOR [allow_nested_replies];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_maximum_reply_depth]
    DEFAULT ((1)) FOR [maximum_reply_depth];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_is_ai_moderation_enabled]
    DEFAULT ((0)) FOR [is_ai_moderation_enabled];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_minimum_logic_score]
    DEFAULT ((0.3000)) FOR [minimum_logic_score];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_topic_upvote_count]
    DEFAULT ((0)) FOR [topic_upvote_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_topic_downvote_count]
    DEFAULT ((0)) FOR [topic_downvote_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_topic_score]
    DEFAULT ((0)) FOR [topic_score];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_blue_participant_count]
    DEFAULT ((0)) FOR [blue_participant_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_blue_post_count]
    DEFAULT ((0)) FOR [blue_post_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_blue_upvote_count]
    DEFAULT ((0)) FOR [blue_upvote_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_blue_sentence_count]
    DEFAULT ((0)) FOR [blue_sentence_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_blue_character_count]
    DEFAULT ((0)) FOR [blue_character_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_red_participant_count]
    DEFAULT ((0)) FOR [red_participant_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_red_post_count]
    DEFAULT ((0)) FOR [red_post_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_red_upvote_count]
    DEFAULT ((0)) FOR [red_upvote_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_red_sentence_count]
    DEFAULT ((0)) FOR [red_sentence_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_red_character_count]
    DEFAULT ((0)) FOR [red_character_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_total_post_count]
    DEFAULT ((0)) FOR [total_post_count];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_is_active]
    DEFAULT ((1)) FOR [is_active];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [DF_debate_coll_topic_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_minimum_post_character_count]
    CHECK ([minimum_post_character_count] >= 1);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_minimum_sentence_count]
    CHECK ([minimum_sentence_count] >= 1);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_maximum_reply_depth]
    CHECK ([maximum_reply_depth] >= 0);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_minimum_logic_score]
    CHECK ([minimum_logic_score] >= 0 AND [minimum_logic_score] <= 1);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_vote_counts]
    CHECK ([topic_upvote_count] >= 0 AND [topic_downvote_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_blue_post_count]
    CHECK ([blue_post_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_blue_upvote_count]
    CHECK ([blue_upvote_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_blue_sentence_count]
    CHECK ([blue_sentence_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_blue_character_count]
    CHECK ([blue_character_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_red_post_count]
    CHECK ([red_post_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_red_upvote_count]
    CHECK ([red_upvote_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_red_sentence_count]
    CHECK ([red_sentence_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [CK_debate_coll_topic_red_character_count]
    CHECK ([red_character_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [FK_debate_coll_topic_link_topic_status_id]
    FOREIGN KEY ([link_topic_status_id])
    REFERENCES [blog_debate].[ref_topic_status] ([debate_ref_topic_status_id]);
GO

ALTER TABLE [blog_debate].[coll_topic]
    ADD CONSTRAINT [FK_debate_coll_topic_link_created_by_user_profile_id]
    FOREIGN KEY ([link_created_by_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

CREATE NONCLUSTERED INDEX [IX_debate_coll_topic_scheduled_start_at]
    ON [blog_debate].[coll_topic] ([scheduled_start_at] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_debate_coll_topic_link_topic_status_id]
    ON [blog_debate].[coll_topic] ([link_topic_status_id], [is_active]);
GO

/* ================================================================
   TABLE: [blog_debate].[coll_topic_participant]
   One user joins one topic on exactly one side
   ================================================================ */

CREATE TABLE [blog_debate].[coll_topic_participant]
(
    [debate_coll_topic_participant_id]          BIGINT IDENTITY(1,1) NOT NULL,
    [link_topic_id]                             BIGINT NOT NULL,
    [link_user_profile_id]                      BIGINT NOT NULL,
    [link_team_side_id]                         INT NOT NULL,
    [joined_at]                                 DATETIME2(0) NOT NULL,
    [is_active]                                 BIT NOT NULL,
    [is_muted]                                  BIT NOT NULL,
    [is_banned]                                 BIT NOT NULL,
    [participant_reputation_snapshot]                       INT NOT NULL,
    [participant_argument_count]                            INT NOT NULL,
    [participant_rebuttal_count]                            INT NOT NULL,
    [participant_total_vote_score]                          INT NOT NULL,
    [created_at]                                DATETIME2(0) NOT NULL,
    [updated_at]                                DATETIME2(0) NULL,

    CONSTRAINT [PK_debate_coll_topic_participant]
        PRIMARY KEY CLUSTERED ([debate_coll_topic_participant_id] ASC)
);
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [DF_debate_coll_topic_participant_joined_at]
    DEFAULT (SYSDATETIME()) FOR [joined_at];
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [DF_debate_coll_topic_participant_is_active]
    DEFAULT ((1)) FOR [is_active];
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [DF_debate_coll_topic_participant_is_muted]
    DEFAULT ((0)) FOR [is_muted];
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [DF_debate_coll_topic_participant_is_banned]
    DEFAULT ((0)) FOR [is_banned];
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [DF_debate_coll_topic_participant_reputation_snapshot]
    DEFAULT ((0)) FOR [participant_reputation_snapshot];
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [DF_debate_coll_topic_participant_argument_count]
    DEFAULT ((0)) FOR [participant_argument_count];
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [DF_debate_coll_topic_participant_rebuttal_count]
    DEFAULT ((0)) FOR [participant_rebuttal_count];
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [DF_debate_coll_topic_participant_total_vote_score]
    DEFAULT ((0)) FOR [participant_total_vote_score];
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [DF_debate_coll_topic_participant_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [FK_debate_coll_topic_participant_link_topic_id]
    FOREIGN KEY ([link_topic_id])
    REFERENCES [blog_debate].[coll_topic] ([debate_coll_topic_id]);
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [FK_debate_coll_topic_participant_link_user_profile_id]
    FOREIGN KEY ([link_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

ALTER TABLE [blog_debate].[coll_topic_participant]
    ADD CONSTRAINT [FK_debate_coll_topic_participant_link_team_side_id]
    FOREIGN KEY ([link_team_side_id])
    REFERENCES [blog_debate].[ref_team_side] ([debate_ref_team_side_id]);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_debate_coll_topic_participant_topic_user]
    ON [blog_debate].[coll_topic_participant] ([link_topic_id], [link_user_profile_id]);
GO

CREATE NONCLUSTERED INDEX [IX_debate_coll_topic_participant_topic_side]
    ON [blog_debate].[coll_topic_participant] ([link_topic_id], [link_team_side_id], [is_active], [is_banned]);
GO

/* ================================================================
   TABLE: [blog_debate].[coll_post]
   Argument or rebuttal — the core content with routing columns
   ================================================================ */

CREATE TABLE [blog_debate].[coll_post]
(
    [debate_coll_post_id]                      BIGINT IDENTITY(1,1) NOT NULL,
    [post_guid]                                UNIQUEIDENTIFIER NOT NULL,
    [link_topic_id]                            BIGINT NOT NULL,
    [link_coll_topic_participant_id]                BIGINT NOT NULL,
    [link_author_user_profile_id]              BIGINT NOT NULL,
    [link_author_team_side_id]                 INT NOT NULL,
    [link_post_kind_id]                        INT NOT NULL,
    [link_thread_board_side_id]                INT NOT NULL,
    [link_parent_post_id]                      BIGINT NULL,
    [link_root_post_id]                        BIGINT NULL,
    [post_reply_depth]                              INT NOT NULL,
    [post_sibling_sort_order]                       INT NOT NULL,
    [post_content]                             NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [post_character_count]                          INT NOT NULL,
    [post_sentence_count]                           INT NOT NULL,
    [post_emoji_ratio]                              DECIMAL(5,4) NOT NULL,
    [post_repeated_character_ratio]                 DECIMAL(5,4) NOT NULL,
    [post_non_language_ratio]                       DECIMAL(5,4) NOT NULL,
    [post_logic_score]                              DECIMAL(5,4) NULL,
    [is_emoji_only]                            BIT NOT NULL,
    [is_auto_rejected]                         BIT NOT NULL,
    [is_pinned]                                BIT NOT NULL,
    [is_deleted]                               BIT NOT NULL,
    [is_edited]                                BIT NOT NULL,
    [post_impact_score]                        DECIMAL(10,4) NOT NULL,
    [post_argument_strength]                   DECIMAL(5,4) NOT NULL,
    [post_content_hash]                        NVARCHAR(64) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [is_champion]                              BIT NOT NULL,
    [is_suppressed]                            BIT NOT NULL,
    [upvote_count]                             INT NOT NULL,
    [downvote_count]                           INT NOT NULL,
    [score]                                    INT NOT NULL,
    [reply_count]                              INT NOT NULL,
    [posted_at]                                DATETIME2(0) NOT NULL,
    [edited_at]                                DATETIME2(0) NULL,
    [deleted_at]                               DATETIME2(0) NULL,
    [is_active]                                BIT NOT NULL,
    [created_at]                               DATETIME2(0) NOT NULL,
    [updated_at]                               DATETIME2(0) NULL,

    CONSTRAINT [PK_debate_coll_post]
        PRIMARY KEY CLUSTERED ([debate_coll_post_id] ASC)
);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_post_guid]
    DEFAULT (NEWID()) FOR [post_guid];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_reply_depth]
    DEFAULT ((0)) FOR [post_reply_depth];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_sibling_sort_order]
    DEFAULT ((0)) FOR [post_sibling_sort_order];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_emoji_ratio]
    DEFAULT ((0)) FOR [post_emoji_ratio];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_repeated_character_ratio]
    DEFAULT ((0)) FOR [post_repeated_character_ratio];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_non_language_ratio]
    DEFAULT ((0)) FOR [post_non_language_ratio];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_is_emoji_only]
    DEFAULT ((0)) FOR [is_emoji_only];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_is_auto_rejected]
    DEFAULT ((0)) FOR [is_auto_rejected];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_is_pinned]
    DEFAULT ((0)) FOR [is_pinned];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_is_deleted]
    DEFAULT ((0)) FOR [is_deleted];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_is_edited]
    DEFAULT ((0)) FOR [is_edited];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_upvote_count]
    DEFAULT ((0)) FOR [upvote_count];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_downvote_count]
    DEFAULT ((0)) FOR [downvote_count];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_score]
    DEFAULT ((0)) FOR [score];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_reply_count]
    DEFAULT ((0)) FOR [reply_count];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_posted_at]
    DEFAULT (SYSDATETIME()) FOR [posted_at];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_post_impact_score]
    DEFAULT ((0)) FOR [post_impact_score];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_post_argument_strength]
    DEFAULT ((1.0000)) FOR [post_argument_strength];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_is_champion]
    DEFAULT ((0)) FOR [is_champion];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_is_suppressed]
    DEFAULT ((0)) FOR [is_suppressed];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_is_active]
    DEFAULT ((1)) FOR [is_active];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [DF_debate_coll_post_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [CK_debate_coll_post_post_impact_score]
    CHECK ([post_impact_score] >= 0);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [CK_debate_coll_post_post_argument_strength]
    CHECK ([post_argument_strength] >= 0 AND [post_argument_strength] <= 1);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [CK_debate_coll_post_reply_depth]
    CHECK ([post_reply_depth] >= 0);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [CK_debate_coll_post_character_count]
    CHECK ([post_character_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [CK_debate_coll_post_sentence_count]
    CHECK ([post_sentence_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [CK_debate_coll_post_emoji_ratio]
    CHECK ([post_emoji_ratio] >= 0 AND [post_emoji_ratio] <= 1);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [CK_debate_coll_post_repeated_character_ratio]
    CHECK ([post_repeated_character_ratio] >= 0 AND [post_repeated_character_ratio] <= 1);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [CK_debate_coll_post_non_language_ratio]
    CHECK ([post_non_language_ratio] >= 0 AND [post_non_language_ratio] <= 1);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [CK_debate_coll_post_logic_score]
    CHECK ([post_logic_score] IS NULL OR ([post_logic_score] >= 0 AND [post_logic_score] <= 1));
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [CK_debate_coll_post_vote_counts]
    CHECK ([upvote_count] >= 0 AND [downvote_count] >= 0);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [FK_debate_coll_post_link_topic_id]
    FOREIGN KEY ([link_topic_id])
    REFERENCES [blog_debate].[coll_topic] ([debate_coll_topic_id]);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [FK_debate_coll_post_link_coll_topic_participant_id]
    FOREIGN KEY ([link_coll_topic_participant_id])
    REFERENCES [blog_debate].[coll_topic_participant] ([debate_coll_topic_participant_id]);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [FK_debate_coll_post_link_author_user_profile_id]
    FOREIGN KEY ([link_author_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [FK_debate_coll_post_link_author_team_side_id]
    FOREIGN KEY ([link_author_team_side_id])
    REFERENCES [blog_debate].[ref_team_side] ([debate_ref_team_side_id]);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [FK_debate_coll_post_link_post_kind_id]
    FOREIGN KEY ([link_post_kind_id])
    REFERENCES [blog_debate].[ref_post_kind] ([debate_ref_post_kind_id]);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [FK_debate_coll_post_link_thread_board_side_id]
    FOREIGN KEY ([link_thread_board_side_id])
    REFERENCES [blog_debate].[ref_team_side] ([debate_ref_team_side_id]);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [FK_debate_coll_post_link_parent_post_id]
    FOREIGN KEY ([link_parent_post_id])
    REFERENCES [blog_debate].[coll_post] ([debate_coll_post_id]);
GO

ALTER TABLE [blog_debate].[coll_post]
    ADD CONSTRAINT [FK_debate_coll_post_link_root_post_id]
    FOREIGN KEY ([link_root_post_id])
    REFERENCES [blog_debate].[coll_post] ([debate_coll_post_id]);
GO

/* Board rendering: get root arguments for one board side */
CREATE NONCLUSTERED INDEX [IX_debate_coll_post_topic_board_root]
    ON [blog_debate].[coll_post] ([link_topic_id], [link_thread_board_side_id], [link_parent_post_id], [score] DESC, [posted_at] ASC)
    INCLUDE ([is_deleted], [is_auto_rejected], [is_active]);
GO

/* Thread nesting: get replies for a root post */
CREATE NONCLUSTERED INDEX [IX_debate_coll_post_root_post]
    ON [blog_debate].[coll_post] ([link_root_post_id], [post_reply_depth] ASC, [posted_at] ASC);
GO

/* Parent lookup */
CREATE NONCLUSTERED INDEX [IX_debate_coll_post_parent]
    ON [blog_debate].[coll_post] ([link_parent_post_id], [posted_at] ASC);
GO

/* Author posts */
CREATE NONCLUSTERED INDEX [IX_debate_coll_post_author]
    ON [blog_debate].[coll_post] ([link_author_user_profile_id], [posted_at] DESC);
GO

/* ================================================================
   TABLE: [blog_debate].[fact_post_moderation]
   Separate audit trail — don't bury moderation inside the post row
   ================================================================ */

CREATE TABLE [blog_debate].[fact_post_moderation]
(
    [debate_fact_post_moderation_id]            BIGINT IDENTITY(1,1) NOT NULL,
    [link_post_id]                              BIGINT NOT NULL,
    [link_moderation_status_id]                 INT NOT NULL,
    [moderation_reason]                         NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [moderation_notes]                          NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [is_length_valid]                           BIT NOT NULL,
    [is_sentence_count_valid]                   BIT NOT NULL,
    [is_emoji_only_valid]                       BIT NOT NULL,
    [is_repeated_character_valid]               BIT NOT NULL,
    [is_non_language_valid]                     BIT NOT NULL,
    [is_logic_score_valid]                      BIT NOT NULL,
    [link_moderated_by_user_profile_id]         BIGINT NULL,
    [moderated_at]                              DATETIME2(0) NOT NULL,
    [is_active]                                 BIT NOT NULL,
    [created_at]                                DATETIME2(0) NOT NULL,

    CONSTRAINT [PK_debate_fact_post_moderation]
        PRIMARY KEY CLUSTERED ([debate_fact_post_moderation_id] ASC)
);
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [DF_debate_fact_post_moderation_is_length_valid]
    DEFAULT ((0)) FOR [is_length_valid];
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [DF_debate_fact_post_moderation_is_sentence_count_valid]
    DEFAULT ((0)) FOR [is_sentence_count_valid];
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [DF_debate_fact_post_moderation_is_emoji_only_valid]
    DEFAULT ((0)) FOR [is_emoji_only_valid];
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [DF_debate_fact_post_moderation_is_repeated_character_valid]
    DEFAULT ((0)) FOR [is_repeated_character_valid];
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [DF_debate_fact_post_moderation_is_non_language_valid]
    DEFAULT ((0)) FOR [is_non_language_valid];
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [DF_debate_fact_post_moderation_is_logic_score_valid]
    DEFAULT ((0)) FOR [is_logic_score_valid];
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [DF_debate_fact_post_moderation_moderated_at]
    DEFAULT (SYSDATETIME()) FOR [moderated_at];
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [DF_debate_fact_post_moderation_is_active]
    DEFAULT ((1)) FOR [is_active];
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [DF_debate_fact_post_moderation_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [FK_debate_fact_post_moderation_link_post_id]
    FOREIGN KEY ([link_post_id])
    REFERENCES [blog_debate].[coll_post] ([debate_coll_post_id]);
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [FK_debate_fact_post_moderation_link_moderation_status_id]
    FOREIGN KEY ([link_moderation_status_id])
    REFERENCES [blog_debate].[ref_moderation_status] ([debate_ref_moderation_status_id]);
GO

ALTER TABLE [blog_debate].[fact_post_moderation]
    ADD CONSTRAINT [FK_debate_fact_post_moderation_link_moderated_by_user_profile_id]
    FOREIGN KEY ([link_moderated_by_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

CREATE NONCLUSTERED INDEX [IX_debate_fact_post_moderation_post]
    ON [blog_debate].[fact_post_moderation] ([link_post_id], [moderated_at] DESC);
GO

/* ================================================================
   TABLE: [blog_debate].[coll_vote]
   One vote per user per target — supports topics and posts
   ================================================================ */

CREATE TABLE [blog_debate].[coll_vote]
(
    [debate_coll_vote_id]                      BIGINT IDENTITY(1,1) NOT NULL,
    [link_voter_user_profile_id]               BIGINT NOT NULL,
    [link_vote_target_type_id]                 INT NOT NULL,
    [target_row_id]                            BIGINT NOT NULL,
    [vote_value]                               SMALLINT NOT NULL,
    [voted_at]                                 DATETIME2(0) NOT NULL,
    [is_active]                                BIT NOT NULL,
    [created_at]                               DATETIME2(0) NOT NULL,
    [updated_at]                               DATETIME2(0) NULL,

    CONSTRAINT [PK_debate_coll_vote]
        PRIMARY KEY CLUSTERED ([debate_coll_vote_id] ASC)
);
GO

ALTER TABLE [blog_debate].[coll_vote]
    ADD CONSTRAINT [DF_debate_coll_vote_voted_at]
    DEFAULT (SYSDATETIME()) FOR [voted_at];
GO

ALTER TABLE [blog_debate].[coll_vote]
    ADD CONSTRAINT [DF_debate_coll_vote_is_active]
    DEFAULT ((1)) FOR [is_active];
GO

ALTER TABLE [blog_debate].[coll_vote]
    ADD CONSTRAINT [DF_debate_coll_vote_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [blog_debate].[coll_vote]
    ADD CONSTRAINT [CK_debate_coll_vote_vote_value]
    CHECK ([vote_value] IN (-1, 1));
GO

ALTER TABLE [blog_debate].[coll_vote]
    ADD CONSTRAINT [FK_debate_coll_vote_link_voter_user_profile_id]
    FOREIGN KEY ([link_voter_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

ALTER TABLE [blog_debate].[coll_vote]
    ADD CONSTRAINT [FK_debate_coll_vote_link_vote_target_type_id]
    FOREIGN KEY ([link_vote_target_type_id])
    REFERENCES [blog_debate].[ref_vote_target_type] ([debate_ref_vote_target_type_id]);
GO

/* One vote per user per target */
CREATE UNIQUE NONCLUSTERED INDEX [UX_debate_coll_vote_voter_target]
    ON [blog_debate].[coll_vote] ([link_voter_user_profile_id], [link_vote_target_type_id], [target_row_id]);
GO

/* Aggregate votes for a target */
CREATE NONCLUSTERED INDEX [IX_debate_coll_vote_target]
    ON [blog_debate].[coll_vote] ([link_vote_target_type_id], [target_row_id], [vote_value]);
GO

/* ================================================================
   TABLE: [blog_debate].[coll_post_edit_history]
   Audit trail for edits — keep previous content
   ================================================================ */

CREATE TABLE [blog_debate].[coll_post_edit_history]
(
    [debate_coll_post_edit_history_id]          BIGINT IDENTITY(1,1) NOT NULL,
    [link_post_id]                              BIGINT NOT NULL,
    [previous_post_content]                     NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [link_edited_by_user_profile_id]            BIGINT NOT NULL,
    [edited_at]                                 DATETIME2(0) NOT NULL,
    [is_active]                                 BIT NOT NULL,
    [created_at]                                DATETIME2(0) NOT NULL,

    CONSTRAINT [PK_debate_coll_post_edit_history]
        PRIMARY KEY CLUSTERED ([debate_coll_post_edit_history_id] ASC)
);
GO

ALTER TABLE [blog_debate].[coll_post_edit_history]
    ADD CONSTRAINT [DF_debate_coll_post_edit_history_edited_at]
    DEFAULT (SYSDATETIME()) FOR [edited_at];
GO

ALTER TABLE [blog_debate].[coll_post_edit_history]
    ADD CONSTRAINT [DF_debate_coll_post_edit_history_is_active]
    DEFAULT ((1)) FOR [is_active];
GO

ALTER TABLE [blog_debate].[coll_post_edit_history]
    ADD CONSTRAINT [DF_debate_coll_post_edit_history_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [blog_debate].[coll_post_edit_history]
    ADD CONSTRAINT [FK_debate_coll_post_edit_history_link_post_id]
    FOREIGN KEY ([link_post_id])
    REFERENCES [blog_debate].[coll_post] ([debate_coll_post_id]);
GO

ALTER TABLE [blog_debate].[coll_post_edit_history]
    ADD CONSTRAINT [FK_debate_coll_post_edit_history_link_edited_by_user_profile_id]
    FOREIGN KEY ([link_edited_by_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

CREATE NONCLUSTERED INDEX [IX_debate_coll_post_edit_history_post]
    ON [blog_debate].[coll_post_edit_history] ([link_post_id], [edited_at] DESC);
GO

/* ================================================================
   END OF DEBATE SCHEMA

   Tables: 11
     Reference: ref_team_side, ref_topic_status, ref_post_kind,
                ref_moderation_status, ref_vote_target_type
     Core:      coll_topic, coll_topic_participant, coll_post,
                fact_post_moderation, coll_vote, coll_post_edit_history
   ================================================================ */

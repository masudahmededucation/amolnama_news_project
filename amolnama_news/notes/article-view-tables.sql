USE [news_magazine];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* =========================================================
   TABLE 1: [newshub].[article_edit_history]
   ========================================================= */

DROP TABLE IF EXISTS [newshub].[article_edit_history];
CREATE TABLE [newshub].[article_edit_history]
(
    [article_edit_history_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_coll_news_entry_id]         BIGINT NOT NULL,
    [link_user_profile_id]            BIGINT NOT NULL,
    [article_edit_type_code]          NVARCHAR(50) NOT NULL,
    [article_edit_summary_bn]         NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,
    [article_edit_summary_en]         NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [field_changed_name]              NVARCHAR(200) NULL,
    [field_old_value]                 NVARCHAR(MAX) NULL,
    [field_new_value]                 NVARCHAR(MAX) NULL,
    [is_approved]                     BIT NOT NULL,
    [link_approved_by_user_profile_id] BIGINT NULL,
    [approved_at]                     DATETIME2(0) NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_newshub_article_edit_history] PRIMARY KEY CLUSTERED ([article_edit_history_id] ASC)
);
GO

-- Default Constraints Block (Separate from CREATE TABLE)
ALTER TABLE [newshub].[article_edit_history] 
    ADD CONSTRAINT [DF_newshub_article_edit_history_is_approved] DEFAULT ((0)) FOR [is_approved];
ALTER TABLE [newshub].[article_edit_history] 
    ADD CONSTRAINT [DF_newshub_article_edit_history_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO

-- Foreign Key Constraints
ALTER TABLE [newshub].[article_edit_history] 
    ADD CONSTRAINT [FK_newshub_article_edit_history_link_coll_news_entry_id] FOREIGN KEY ([link_coll_news_entry_id]) 
    REFERENCES [newshub].[coll_news_entry] ([coll_news_entry_id]);

ALTER TABLE [newshub].[article_edit_history] 
    ADD CONSTRAINT [FK_newshub_article_edit_history_link_user_profile_id] FOREIGN KEY ([link_user_profile_id]) 
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

CREATE NONCLUSTERED INDEX [IX_newshub_article_edit_history_link_coll_news_entry_id] 
    ON [newshub].[article_edit_history] ([link_coll_news_entry_id] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_newshub_article_edit_history_link_user_profile_id] 
    ON [newshub].[article_edit_history] ([link_user_profile_id] ASC);
GO


/* =========================================================
   TABLE 2: [newshub].[article_community_addition]
   ========================================================= */

DROP TABLE IF EXISTS [newshub].[article_community_addition];
CREATE TABLE [newshub].[article_community_addition]
(
    [article_community_addition_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_coll_news_entry_id]               BIGINT NOT NULL,
    [link_user_profile_id]                  BIGINT NOT NULL,
    [community_addition_type_code]          NVARCHAR(50) NOT NULL,
    [community_addition_title_bn]           NVARCHAR(200) COLLATE Bengali_100_CI_AS NULL,
    [community_addition_body_bn]            NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NULL,
    [community_addition_body_en]            NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [community_addition_source_url]         NVARCHAR(1000) NULL,
    [status_code]                           NVARCHAR(50) NOT NULL,
    [link_reviewed_by_user_profile_id]      BIGINT NULL,
    [reviewed_at]                           DATETIME2(0) NULL,
    [review_note]                           NVARCHAR(500) NULL,
    [created_at]                            DATETIME2(0) NOT NULL,
    [updated_at]                            DATETIME2(0) NULL,

    CONSTRAINT [PK_newshub_article_community_addition] PRIMARY KEY CLUSTERED ([article_community_addition_id] ASC)
);
GO

-- Default Constraints Block (Separate from CREATE TABLE)
ALTER TABLE [newshub].[article_community_addition] 
    ADD CONSTRAINT [DF_newshub_article_community_addition_status_code] DEFAULT (N'pending') FOR [status_code];
ALTER TABLE [newshub].[article_community_addition] 
    ADD CONSTRAINT [DF_newshub_article_community_addition_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO

-- Foreign Key Constraints
ALTER TABLE [newshub].[article_community_addition] 
    ADD CONSTRAINT [FK_newshub_article_community_addition_link_coll_news_entry_id] FOREIGN KEY ([link_coll_news_entry_id]) 
    REFERENCES [newshub].[coll_news_entry] ([coll_news_entry_id]);

ALTER TABLE [newshub].[article_community_addition] 
    ADD CONSTRAINT [FK_newshub_article_community_addition_link_user_profile_id] FOREIGN KEY ([link_user_profile_id]) 
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

CREATE NONCLUSTERED INDEX [IX_newshub_article_community_addition_link_coll_news_entry_id] 
    ON [newshub].[article_community_addition] ([link_coll_news_entry_id] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_newshub_article_community_addition_status_code] 
    ON [newshub].[article_community_addition] ([status_code] ASC);
GO


/* =========================================================
   TABLE 3: [account].[community_user_reputation]
   ========================================================= */

DROP TABLE IF EXISTS [account].[community_user_reputation];
CREATE TABLE [account].[community_user_reputation]
(
    [community_user_reputation_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_user_profile_id]                 BIGINT NOT NULL,
    [total_points_count]                   INT NOT NULL,
    [articles_submitted_count]             INT NOT NULL,
    [articles_approved_count]              INT NOT NULL,
    [edits_made_count]                     INT NOT NULL,
    [edits_approved_count]                 INT NOT NULL,
    [additions_submitted_count]            INT NOT NULL,
    [additions_approved_count]             INT NOT NULL,
    [current_privilege_level_count]        INT NOT NULL,
    [created_at]                           DATETIME2(0) NOT NULL,
    [updated_at]                           DATETIME2(0) NULL,

    CONSTRAINT [PK_account_community_user_reputation] PRIMARY KEY CLUSTERED ([community_user_reputation_id] ASC)
);
GO

-- Default Constraints Block (Separate from CREATE TABLE)
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [DF_account_community_user_reputation_total_points_count] DEFAULT ((0)) FOR [total_points_count];
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [DF_account_community_user_reputation_articles_submitted_count] DEFAULT ((0)) FOR [articles_submitted_count];
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [DF_account_community_user_reputation_articles_approved_count] DEFAULT ((0)) FOR [articles_approved_count];
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [DF_account_community_user_reputation_edits_made_count] DEFAULT ((0)) FOR [edits_made_count];
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [DF_account_community_user_reputation_edits_approved_count] DEFAULT ((0)) FOR [edits_approved_count];
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [DF_account_community_user_reputation_additions_submitted_count] DEFAULT ((0)) FOR [additions_submitted_count];
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [DF_account_community_user_reputation_additions_approved_count] DEFAULT ((0)) FOR [additions_approved_count];
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [DF_account_community_user_reputation_current_privilege_level_count] DEFAULT ((1)) FOR [current_privilege_level_count];
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [DF_account_community_user_reputation_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO

-- Check Constraints for non-negative counters
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [CK_account_community_user_reputation_total_points_count] CHECK ([total_points_count] >= 0);
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [CK_account_community_user_reputation_articles_submitted_count] CHECK ([articles_submitted_count] >= 0);
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [CK_account_community_user_reputation_articles_approved_count] CHECK ([articles_approved_count] >= 0);
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [CK_account_community_user_reputation_edits_made_count] CHECK ([edits_made_count] >= 0);
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [CK_account_community_user_reputation_edits_approved_count] CHECK ([edits_approved_count] >= 0);
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [CK_account_community_user_reputation_additions_submitted_count] CHECK ([additions_submitted_count] >= 0);
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [CK_account_community_user_reputation_additions_approved_count] CHECK ([additions_approved_count] >= 0);
GO

-- Foreign Key Constraints
ALTER TABLE [account].[community_user_reputation] 
    ADD CONSTRAINT [FK_account_community_user_reputation_link_user_profile_id] FOREIGN KEY ([link_user_profile_id]) 
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

CREATE NONCLUSTERED INDEX [IX_account_community_user_reputation_link_user_profile_id] 
    ON [account].[community_user_reputation] ([link_user_profile_id] ASC);
GO


/* =========================================================
   TABLE 4: [account].[ref_community_privilege_level]
   ========================================================= */

DROP TABLE IF EXISTS [account].[ref_community_privilege_level];
CREATE TABLE [account].[ref_community_privilege_level]
(
    [ref_community_privilege_level_id] INT NOT NULL,
    [privilege_level_code]                     NVARCHAR(50) NOT NULL,
    [name_bn]                                  NVARCHAR(100) COLLATE Bengali_100_CI_AS NOT NULL,
    [name_en]                                  NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [min_points_required_count]                INT NOT NULL,
    [is_can_edit_own_article]                  BIT NOT NULL,
    [is_can_suggest_edits]                     BIT NOT NULL,
    [is_can_edit_others_article]               BIT NOT NULL,
    [is_can_approve_additions]                 BIT NOT NULL,
    [is_can_approve_edits]                     BIT NOT NULL,
    [is_can_delete_article]                    BIT NOT NULL,
    [sort_order]                               INT NOT NULL,
    [is_active]                                BIT NOT NULL,
    [created_at]                               DATETIME2(0) NOT NULL,

    CONSTRAINT [PK_account_ref_community_privilege_level] PRIMARY KEY CLUSTERED ([ref_community_privilege_level_id] ASC)
);
GO

-- Default Constraints Block (Separate from CREATE TABLE)
ALTER TABLE [account].[ref_community_privilege_level] 
    ADD CONSTRAINT [DF_account_ref_community_privilege_level_min_points_required_count] DEFAULT ((0)) FOR [min_points_required_count];
ALTER TABLE [account].[ref_community_privilege_level] 
    ADD CONSTRAINT [DF_account_ref_community_privilege_level_is_can_edit_own_article] DEFAULT ((1)) FOR [is_can_edit_own_article];
ALTER TABLE [account].[ref_community_privilege_level] 
    ADD CONSTRAINT [DF_account_ref_community_privilege_level_is_can_suggest_edits] DEFAULT ((0)) FOR [is_can_suggest_edits];
ALTER TABLE [account].[ref_community_privilege_level] 
    ADD CONSTRAINT [DF_account_ref_community_privilege_level_is_can_edit_others_article] DEFAULT ((0)) FOR [is_can_edit_others_article];
ALTER TABLE [account].[ref_community_privilege_level] 
    ADD CONSTRAINT [DF_account_ref_community_privilege_level_is_can_approve_additions] DEFAULT ((0)) FOR [is_can_approve_additions];
ALTER TABLE [account].[ref_community_privilege_level] 
    ADD CONSTRAINT [DF_account_ref_community_privilege_level_is_can_approve_edits] DEFAULT ((0)) FOR [is_can_approve_edits];
ALTER TABLE [account].[ref_community_privilege_level] 
    ADD CONSTRAINT [DF_account_ref_community_privilege_level_is_can_delete_article] DEFAULT ((0)) FOR [is_can_delete_article];
ALTER TABLE [account].[ref_community_privilege_level] 
    ADD CONSTRAINT [DF_account_ref_community_privilege_level_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [account].[ref_community_privilege_level] 
    ADD CONSTRAINT [DF_account_ref_community_privilege_level_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
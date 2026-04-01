USE [news_magazine];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ================================================================
   SCHEMA: [art]
   ================================================================ */

IF NOT EXISTS
(
    SELECT 1
    FROM sys.schemas
    WHERE [name] = N'art'
)
BEGIN
    EXEC(N'CREATE SCHEMA [art]');
END;
GO

/* ================================================================
   DROP OBJECTS: [art]
   ================================================================ */

DROP TABLE IF EXISTS [art].[eng_artwork_comment];
GO
DROP TABLE IF EXISTS [art].[eng_artwork_bookmark];
GO
DROP TABLE IF EXISTS [art].[eng_artwork_like];
GO
DROP TABLE IF EXISTS [art].[coll_artwork_youtube_link];
GO
DROP TABLE IF EXISTS [art].[coll_artwork_step];
GO
DROP TABLE IF EXISTS [art].[coll_artwork_asset];
GO
DROP TABLE IF EXISTS [art].[coll_artwork];
GO
DROP TABLE IF EXISTS [art].[ref_art_difficulty];
GO
DROP TABLE IF EXISTS [art].[ref_art_medium];
GO
DROP TABLE IF EXISTS [art].[ref_art_category];
GO

/* ================================================================
   TABLE: [art].[ref_art_category]
   ================================================================ */

CREATE TABLE [art].[ref_art_category]
(
    [art_ref_art_category_id]         INT IDENTITY(1,1) NOT NULL,
    [art_category_code]               NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [art_category_name_bn]            NVARCHAR(200) COLLATE Bengali_100_CI_AS NOT NULL,
    [art_category_name_en]            NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [art_category_icon]               NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                      INT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_art_ref_art_category]
        PRIMARY KEY CLUSTERED ([art_ref_art_category_id] ASC)
);
GO

ALTER TABLE [art].[ref_art_category]
    ADD CONSTRAINT [DF_art_ref_art_category_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [art].[ref_art_category]
    ADD CONSTRAINT [DF_art_ref_art_category_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [art].[ref_art_category]
    ADD CONSTRAINT [CK_art_ref_art_category_sort_order_non_negative]
    CHECK ([sort_order] IS NULL OR [sort_order] >= 0);
GO

ALTER TABLE [art].[ref_art_category]
    ADD CONSTRAINT [UX_art_ref_art_category_art_category_code]
    UNIQUE ([art_category_code]);
GO

CREATE NONCLUSTERED INDEX [IX_art_ref_art_category_sort_order]
    ON [art].[ref_art_category] ([sort_order] ASC);
GO

/* ================================================================
   TABLE: [art].[ref_art_medium]
   ================================================================ */

CREATE TABLE [art].[ref_art_medium]
(
    [art_ref_art_medium_id]           INT IDENTITY(1,1) NOT NULL,
    [art_medium_code]                 NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [art_medium_name_bn]              NVARCHAR(200) COLLATE Bengali_100_CI_AS NOT NULL,
    [art_medium_name_en]              NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [sort_order]                      INT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_art_ref_art_medium]
        PRIMARY KEY CLUSTERED ([art_ref_art_medium_id] ASC)
);
GO

ALTER TABLE [art].[ref_art_medium]
    ADD CONSTRAINT [DF_art_ref_art_medium_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [art].[ref_art_medium]
    ADD CONSTRAINT [DF_art_ref_art_medium_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [art].[ref_art_medium]
    ADD CONSTRAINT [CK_art_ref_art_medium_sort_order_non_negative]
    CHECK ([sort_order] IS NULL OR [sort_order] >= 0);
GO

ALTER TABLE [art].[ref_art_medium]
    ADD CONSTRAINT [UX_art_ref_art_medium_art_medium_code]
    UNIQUE ([art_medium_code]);
GO

CREATE NONCLUSTERED INDEX [IX_art_ref_art_medium_sort_order]
    ON [art].[ref_art_medium] ([sort_order] ASC);
GO

/* ================================================================
   TABLE: [art].[ref_art_difficulty]
   ================================================================ */

CREATE TABLE [art].[ref_art_difficulty]
(
    [art_ref_art_difficulty_id]       INT IDENTITY(1,1) NOT NULL,
    [art_difficulty_code]             NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [art_difficulty_name_bn]          NVARCHAR(100) COLLATE Bengali_100_CI_AS NOT NULL,
    [art_difficulty_name_en]          NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [sort_order]                      INT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_art_ref_art_difficulty]
        PRIMARY KEY CLUSTERED ([art_ref_art_difficulty_id] ASC)
);
GO

ALTER TABLE [art].[ref_art_difficulty]
    ADD CONSTRAINT [DF_art_ref_art_difficulty_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [art].[ref_art_difficulty]
    ADD CONSTRAINT [DF_art_ref_art_difficulty_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [art].[ref_art_difficulty]
    ADD CONSTRAINT [CK_art_ref_art_difficulty_sort_order_non_negative]
    CHECK ([sort_order] IS NULL OR [sort_order] >= 0);
GO

ALTER TABLE [art].[ref_art_difficulty]
    ADD CONSTRAINT [UX_art_ref_art_difficulty_art_difficulty_code]
    UNIQUE ([art_difficulty_code]);
GO

CREATE NONCLUSTERED INDEX [IX_art_ref_art_difficulty_sort_order]
    ON [art].[ref_art_difficulty] ([sort_order] ASC);
GO

/* ================================================================
   TABLE: [art].[coll_artwork]
   ================================================================ */

CREATE TABLE [art].[coll_artwork]
(
    [art_coll_artwork_id]             BIGINT IDENTITY(1,1) NOT NULL,
    [artwork_guid]                    UNIQUEIDENTIFIER NOT NULL,
    [link_user_profile_id]            BIGINT NOT NULL,
    [link_art_category_id]            INT NOT NULL,
    [link_art_medium_id]              INT NULL,
    [link_art_difficulty_id]          INT NULL,
    [artwork_title_bn]                NVARCHAR(300) COLLATE Bengali_100_CI_AS NOT NULL,
    [artwork_title_en]                NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [artwork_slug]                    NVARCHAR(400) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [artwork_description_bn]          NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NULL,
    [artwork_description_en]          NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [artwork_backstory_bn]            NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NULL,
    [artwork_materials_bn]            NVARCHAR(1000) COLLATE Bengali_100_CI_AS NULL,
    [artwork_materials_en]            NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [artwork_dimensions_en]           NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [artwork_type_code]               NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [is_tutorial]                     BIT NOT NULL,
    [is_for_sale]                     BIT NOT NULL,
    [estimated_time_minutes]    INT NULL,
    [like_count]                      INT NOT NULL,
    [view_count]                      INT NOT NULL,
    [bookmark_count]                  INT NOT NULL,
    [comment_count]                   INT NOT NULL,
    [is_featured]                     BIT NOT NULL,
    [is_published]                    BIT NOT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_art_coll_artwork]
        PRIMARY KEY CLUSTERED ([art_coll_artwork_id] ASC)
);
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_artwork_guid]
    DEFAULT (NEWID()) FOR [artwork_guid];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_artwork_type_code]
    DEFAULT (N'artwork') FOR [artwork_type_code];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_is_tutorial]
    DEFAULT ((0)) FOR [is_tutorial];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_is_for_sale]
    DEFAULT ((0)) FOR [is_for_sale];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_like_count]
    DEFAULT ((0)) FOR [like_count];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_view_count]
    DEFAULT ((0)) FOR [view_count];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_bookmark_count]
    DEFAULT ((0)) FOR [bookmark_count];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_comment_count]
    DEFAULT ((0)) FOR [comment_count];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_is_featured]
    DEFAULT ((0)) FOR [is_featured];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_is_published]
    DEFAULT ((0)) FOR [is_published];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [DF_art_coll_artwork_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [CK_art_coll_artwork_estimated_time_minutes_non_negative]
    CHECK ([estimated_time_minutes] IS NULL OR [estimated_time_minutes] >= 0);
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [CK_art_coll_artwork_like_count_non_negative]
    CHECK ([like_count] >= 0);
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [CK_art_coll_artwork_view_count_non_negative]
    CHECK ([view_count] >= 0);
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [CK_art_coll_artwork_bookmark_count_non_negative]
    CHECK ([bookmark_count] >= 0);
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [CK_art_coll_artwork_comment_count_non_negative]
    CHECK ([comment_count] >= 0);
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [UX_art_coll_artwork_artwork_guid]
    UNIQUE ([artwork_guid]);
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [UX_art_coll_artwork_artwork_slug]
    UNIQUE ([artwork_slug]);
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [FK_art_coll_artwork_link_user_profile_id]
    FOREIGN KEY ([link_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [FK_art_coll_artwork_link_art_category_id]
    FOREIGN KEY ([link_art_category_id])
    REFERENCES [art].[ref_art_category] ([art_ref_art_category_id]);
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [FK_art_coll_artwork_link_art_medium_id]
    FOREIGN KEY ([link_art_medium_id])
    REFERENCES [art].[ref_art_medium] ([art_ref_art_medium_id]);
GO

ALTER TABLE [art].[coll_artwork]
    ADD CONSTRAINT [FK_art_coll_artwork_link_art_difficulty_id]
    FOREIGN KEY ([link_art_difficulty_id])
    REFERENCES [art].[ref_art_difficulty] ([art_ref_art_difficulty_id]);
GO

CREATE NONCLUSTERED INDEX [IX_art_coll_artwork_link_user_profile_id]
    ON [art].[coll_artwork] ([link_user_profile_id] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_art_coll_artwork_link_art_category_id]
    ON [art].[coll_artwork] ([link_art_category_id] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_art_coll_artwork_created_at]
    ON [art].[coll_artwork] ([created_at] DESC);
GO

/* ================================================================
   TABLE: [art].[coll_artwork_asset]
   ================================================================ */

CREATE TABLE [art].[coll_artwork_asset]
(
    [art_coll_artwork_asset_id]       BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]                 BIGINT NOT NULL,
    [link_asset_id]                   BIGINT NOT NULL,
    [asset_group_code]                NVARCHAR(30) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [is_cover]                        BIT NOT NULL,
    [caption_bn]                      NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,
    [sort_order]                      INT NOT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_art_coll_artwork_asset]
        PRIMARY KEY CLUSTERED ([art_coll_artwork_asset_id] ASC)
);
GO

ALTER TABLE [art].[coll_artwork_asset]
    ADD CONSTRAINT [DF_art_coll_artwork_asset_asset_group_code]
    DEFAULT (N'main') FOR [asset_group_code];
GO

ALTER TABLE [art].[coll_artwork_asset]
    ADD CONSTRAINT [DF_art_coll_artwork_asset_is_cover]
    DEFAULT ((0)) FOR [is_cover];
GO

ALTER TABLE [art].[coll_artwork_asset]
    ADD CONSTRAINT [DF_art_coll_artwork_asset_sort_order]
    DEFAULT ((0)) FOR [sort_order];
GO

ALTER TABLE [art].[coll_artwork_asset]
    ADD CONSTRAINT [DF_art_coll_artwork_asset_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [art].[coll_artwork_asset]
    ADD CONSTRAINT [DF_art_coll_artwork_asset_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [art].[coll_artwork_asset]
    ADD CONSTRAINT [CK_art_coll_artwork_asset_sort_order_non_negative]
    CHECK ([sort_order] >= 0);
GO

ALTER TABLE [art].[coll_artwork_asset]
    ADD CONSTRAINT [FK_art_coll_artwork_asset_link_artwork_id]
    FOREIGN KEY ([link_artwork_id])
    REFERENCES [art].[coll_artwork] ([art_coll_artwork_id]);
GO

CREATE NONCLUSTERED INDEX [IX_art_coll_artwork_asset_link_artwork_id]
    ON [art].[coll_artwork_asset] ([link_artwork_id] ASC);
GO

/* ================================================================
   TABLE: [art].[coll_artwork_step]
   ================================================================ */

CREATE TABLE [art].[coll_artwork_step]
(
    [art_coll_artwork_step_id]        BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]                 BIGINT NOT NULL,
    [step_number]                     INT NOT NULL,
    [step_instruction_bn]             NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NOT NULL,
    [step_instruction_en]             NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [link_asset_id]                   BIGINT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_art_coll_artwork_step]
        PRIMARY KEY CLUSTERED ([art_coll_artwork_step_id] ASC)
);
GO

ALTER TABLE [art].[coll_artwork_step]
    ADD CONSTRAINT [DF_art_coll_artwork_step_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [art].[coll_artwork_step]
    ADD CONSTRAINT [DF_art_coll_artwork_step_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [art].[coll_artwork_step]
    ADD CONSTRAINT [CK_art_coll_artwork_step_step_number_positive]
    CHECK ([step_number] > 0);
GO

ALTER TABLE [art].[coll_artwork_step]
    ADD CONSTRAINT [FK_art_coll_artwork_step_link_artwork_id]
    FOREIGN KEY ([link_artwork_id])
    REFERENCES [art].[coll_artwork] ([art_coll_artwork_id]);
GO

ALTER TABLE [art].[coll_artwork_step]
    ADD CONSTRAINT [UX_art_coll_artwork_step_link_artwork_id_step_number]
    UNIQUE ([link_artwork_id], [step_number]);
GO

CREATE NONCLUSTERED INDEX [IX_art_coll_artwork_step_link_artwork_id_step_number]
    ON [art].[coll_artwork_step] ([link_artwork_id] ASC, [step_number] ASC);
GO

/* ================================================================
   TABLE: [art].[coll_artwork_youtube_link]
   ================================================================ */

CREATE TABLE [art].[coll_artwork_youtube_link]
(
    [art_coll_artwork_youtube_link_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]                  BIGINT NOT NULL,
    [link_user_profile_id]             BIGINT NOT NULL,
    [youtube_url]                      NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [youtube_title_bn]                 NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,
    [is_active]                        BIT NOT NULL,
    [created_at]                       DATETIME2(0) NOT NULL,
    [updated_at]                       DATETIME2(0) NULL,

    CONSTRAINT [PK_art_coll_artwork_youtube_link]
        PRIMARY KEY CLUSTERED ([art_coll_artwork_youtube_link_id] ASC)
);
GO

ALTER TABLE [art].[coll_artwork_youtube_link]
    ADD CONSTRAINT [DF_art_coll_artwork_youtube_link_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [art].[coll_artwork_youtube_link]
    ADD CONSTRAINT [DF_art_coll_artwork_youtube_link_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [art].[coll_artwork_youtube_link]
    ADD CONSTRAINT [FK_art_coll_artwork_youtube_link_link_artwork_id]
    FOREIGN KEY ([link_artwork_id])
    REFERENCES [art].[coll_artwork] ([art_coll_artwork_id]);
GO

ALTER TABLE [art].[coll_artwork_youtube_link]
    ADD CONSTRAINT [FK_art_coll_artwork_youtube_link_link_user_profile_id]
    FOREIGN KEY ([link_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

CREATE NONCLUSTERED INDEX [IX_art_coll_artwork_youtube_link_link_artwork_id]
    ON [art].[coll_artwork_youtube_link] ([link_artwork_id] ASC);
GO

/* ================================================================
   TABLE: [art].[eng_artwork_like]
   ================================================================ */

CREATE TABLE [art].[eng_artwork_like]
(
    [art_eng_artwork_like_id]         BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]                 BIGINT NOT NULL,
    [link_user_profile_id]            BIGINT NOT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_art_eng_artwork_like]
        PRIMARY KEY CLUSTERED ([art_eng_artwork_like_id] ASC)
);
GO

ALTER TABLE [art].[eng_artwork_like]
    ADD CONSTRAINT [DF_art_eng_artwork_like_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [art].[eng_artwork_like]
    ADD CONSTRAINT [DF_art_eng_artwork_like_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [art].[eng_artwork_like]
    ADD CONSTRAINT [FK_art_eng_artwork_like_link_artwork_id]
    FOREIGN KEY ([link_artwork_id])
    REFERENCES [art].[coll_artwork] ([art_coll_artwork_id]);
GO

ALTER TABLE [art].[eng_artwork_like]
    ADD CONSTRAINT [FK_art_eng_artwork_like_link_user_profile_id]
    FOREIGN KEY ([link_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

ALTER TABLE [art].[eng_artwork_like]
    ADD CONSTRAINT [UX_art_eng_artwork_like_link_artwork_id_link_user_profile_id]
    UNIQUE ([link_artwork_id], [link_user_profile_id]);
GO

/* ================================================================
   TABLE: [art].[eng_artwork_bookmark]
   ================================================================ */

CREATE TABLE [art].[eng_artwork_bookmark]
(
    [art_eng_artwork_bookmark_id]     BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]                 BIGINT NOT NULL,
    [link_user_profile_id]            BIGINT NOT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_art_eng_artwork_bookmark]
        PRIMARY KEY CLUSTERED ([art_eng_artwork_bookmark_id] ASC)
);
GO

ALTER TABLE [art].[eng_artwork_bookmark]
    ADD CONSTRAINT [DF_art_eng_artwork_bookmark_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [art].[eng_artwork_bookmark]
    ADD CONSTRAINT [DF_art_eng_artwork_bookmark_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [art].[eng_artwork_bookmark]
    ADD CONSTRAINT [FK_art_eng_artwork_bookmark_link_artwork_id]
    FOREIGN KEY ([link_artwork_id])
    REFERENCES [art].[coll_artwork] ([art_coll_artwork_id]);
GO

ALTER TABLE [art].[eng_artwork_bookmark]
    ADD CONSTRAINT [FK_art_eng_artwork_bookmark_link_user_profile_id]
    FOREIGN KEY ([link_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

ALTER TABLE [art].[eng_artwork_bookmark]
    ADD CONSTRAINT [UX_art_eng_artwork_bookmark_link_artwork_id_link_user_profile_id]
    UNIQUE ([link_artwork_id], [link_user_profile_id]);
GO

/* ================================================================
   TABLE: [art].[eng_artwork_comment]
   ================================================================ */

CREATE TABLE [art].[eng_artwork_comment]
(
    [art_eng_artwork_comment_id]      BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]                 BIGINT NOT NULL,
    [link_user_profile_id]            BIGINT NOT NULL,
    [link_parent_comment_id]          BIGINT NULL,
    [comment_text_bn]                 NVARCHAR(1000) COLLATE Bengali_100_CI_AS NOT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_art_eng_artwork_comment]
        PRIMARY KEY CLUSTERED ([art_eng_artwork_comment_id] ASC)
);
GO

ALTER TABLE [art].[eng_artwork_comment]
    ADD CONSTRAINT [DF_art_eng_artwork_comment_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [art].[eng_artwork_comment]
    ADD CONSTRAINT [DF_art_eng_artwork_comment_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [art].[eng_artwork_comment]
    ADD CONSTRAINT [FK_art_eng_artwork_comment_link_artwork_id]
    FOREIGN KEY ([link_artwork_id])
    REFERENCES [art].[coll_artwork] ([art_coll_artwork_id]);
GO

ALTER TABLE [art].[eng_artwork_comment]
    ADD CONSTRAINT [FK_art_eng_artwork_comment_link_user_profile_id]
    FOREIGN KEY ([link_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

ALTER TABLE [art].[eng_artwork_comment]
    ADD CONSTRAINT [FK_art_eng_artwork_comment_link_parent_comment_id]
    FOREIGN KEY ([link_parent_comment_id])
    REFERENCES [art].[eng_artwork_comment] ([art_eng_artwork_comment_id]);
GO

CREATE NONCLUSTERED INDEX [IX_art_eng_artwork_comment_link_artwork_id]
    ON [art].[eng_artwork_comment] ([link_artwork_id] ASC);
GO

/* ================================================================
   SEED: [art].[ref_art_category]
   ================================================================ */

INSERT INTO [art].[ref_art_category]
(
    [art_category_code],
    [art_category_name_bn],
    [art_category_name_en],
    [art_category_icon],
    [sort_order],
    [is_active]
)
VALUES
(N'nakshi_kantha', N'নকশি কাঁথা', N'Nakshi Kantha', N'🧵', 1, 1),
(N'patachitra', N'পটচিত্র', N'Patachitra', N'🖼️', 2, 1),
(N'alpona', N'আলপনা', N'Alpona', N'✨', 3, 1),
(N'pottery', N'মৃৎশিল্প', N'Pottery & Clay Art', N'🏺', 4, 1),
(N'rickshaw_art', N'রিকশা আর্ট', N'Rickshaw Art', N'🚲', 5, 1),
(N'jamdani', N'জামদানি', N'Jamdani Weaving', N'🧶', 6, 1),
(N'bamboo_craft', N'বাঁশশিল্প', N'Bamboo Craft', N'🎋', 7, 1),
(N'jute_craft', N'পাটশিল্প', N'Jute Craft', N'🌾', 8, 1),
(N'woodcraft', N'কাঠশিল্প', N'Woodcraft', N'🪵', 9, 1),
(N'metalwork', N'ধাতুশিল্প', N'Metalwork', N'⚒️', 10, 1),
(N'handloom', N'তাঁতশিল্প', N'Handloom Weaving', N'🧣', 11, 1),
(N'conch_shell', N'শঙ্খশিল্প', N'Conch Shell Craft', N'🐚', 12, 1),
(N'mask_making', N'মুখোশশিল্প', N'Mask Making', N'🎭', 13, 1),
(N'painting', N'চিত্রকলা', N'Painting', N'🎨', 14, 1),
(N'drawing', N'অঙ্কন', N'Drawing & Sketching', N'✏️', 15, 1),
(N'calligraphy', N'ক্যালিগ্রাফি', N'Calligraphy', N'✒️', 16, 1),
(N'digital_art', N'ডিজিটাল আর্ট', N'Digital Art', N'💻', 17, 1),
(N'sculpture', N'ভাস্কর্য', N'Sculpture', N'🗿', 18, 1),
(N'jewelry', N'গহনাশিল্প', N'Jewelry Making', N'💎', 19, 1),
(N'paper_craft', N'কাগজশিল্প', N'Paper Craft', N'📄', 20, 1),
(N'upcycled_art', N'পুনর্ব্যবহার শিল্প', N'Upcycled Art', N'♻️', 21, 1);
GO

/* ================================================================
   SEED: [art].[ref_art_medium]
   ================================================================ */

INSERT INTO [art].[ref_art_medium]
(
    [art_medium_code],
    [art_medium_name_bn],
    [art_medium_name_en],
    [sort_order],
    [is_active]
)
VALUES
(N'acrylic', N'অ্যাক্রিলিক', N'Acrylic', 1, 1),
(N'watercolor', N'জলরং', N'Watercolor', 2, 1),
(N'oil_paint', N'তৈলচিত্র', N'Oil Paint', 3, 1),
(N'pencil', N'পেন্সিল', N'Pencil', 4, 1),
(N'charcoal', N'চারকোল', N'Charcoal', 5, 1),
(N'ink', N'কালি', N'Ink', 6, 1),
(N'clay', N'মাটি', N'Clay', 7, 1),
(N'jute', N'পাট', N'Jute', 8, 1),
(N'bamboo', N'বাঁশ', N'Bamboo', 9, 1),
(N'wood', N'কাঠ', N'Wood', 10, 1),
(N'metal', N'ধাতু', N'Metal', 11, 1),
(N'fabric', N'কাপড়', N'Fabric & Thread', 12, 1),
(N'paper', N'কাগজ', N'Paper', 13, 1),
(N'mixed_media', N'মিশ্র মাধ্যম', N'Mixed Media', 14, 1),
(N'digital', N'ডিজিটাল', N'Digital', 15, 1);
GO

/* ================================================================
   SEED: [art].[ref_art_difficulty]
   ================================================================ */

INSERT INTO [art].[ref_art_difficulty]
(
    [art_difficulty_code],
    [art_difficulty_name_bn],
    [art_difficulty_name_en],
    [sort_order],
    [is_active]
)
VALUES
(N'easy', N'সহজ', N'Easy', 1, 1),
(N'medium', N'মাঝারি', N'Medium', 2, 1),
(N'hard', N'কঠিন', N'Hard', 3, 1);
GO

/* ================================================================
   SCHEMA: [stories]
   ================================================================ */

IF NOT EXISTS
(
    SELECT 1
    FROM sys.schemas
    WHERE [name] = N'stories'
)
BEGIN
    EXEC(N'CREATE SCHEMA [stories]');
END;
GO

/* ================================================================
   DROP OBJECTS: [stories]
   ================================================================ */

DROP TABLE IF EXISTS [stories].[eng_story_comment];
GO
DROP TABLE IF EXISTS [stories].[eng_story_bookmark];
GO
DROP TABLE IF EXISTS [stories].[eng_story_like];
GO
DROP TABLE IF EXISTS [stories].[coll_story_page];
GO
DROP TABLE IF EXISTS [stories].[coll_story_asset];
GO
DROP TABLE IF EXISTS [stories].[coll_story];
GO
DROP TABLE IF EXISTS [stories].[ref_story_age_group];
GO
DROP TABLE IF EXISTS [stories].[ref_story_category];
GO

/* ================================================================
   TABLE: [stories].[ref_story_category]
   ================================================================ */

CREATE TABLE [stories].[ref_story_category]
(
    [stories_ref_story_category_id]   INT IDENTITY(1,1) NOT NULL,
    [story_category_code]             NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [story_category_name_bn]          NVARCHAR(200) COLLATE Bengali_100_CI_AS NOT NULL,
    [story_category_name_en]          NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [story_category_icon]             NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                      INT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_stories_ref_story_category]
        PRIMARY KEY CLUSTERED ([stories_ref_story_category_id] ASC)
);
GO

ALTER TABLE [stories].[ref_story_category]
    ADD CONSTRAINT [DF_stories_ref_story_category_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [stories].[ref_story_category]
    ADD CONSTRAINT [DF_stories_ref_story_category_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [stories].[ref_story_category]
    ADD CONSTRAINT [CK_stories_ref_story_category_sort_order_non_negative]
    CHECK ([sort_order] IS NULL OR [sort_order] >= 0);
GO

ALTER TABLE [stories].[ref_story_category]
    ADD CONSTRAINT [UX_stories_ref_story_category_story_category_code]
    UNIQUE ([story_category_code]);
GO

/* ================================================================
   TABLE: [stories].[ref_story_age_group]
   ================================================================ */

CREATE TABLE [stories].[ref_story_age_group]
(
    [stories_ref_story_age_group_id]  INT IDENTITY(1,1) NOT NULL,
    [age_group_code]                  NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [age_group_name_bn]               NVARCHAR(100) COLLATE Bengali_100_CI_AS NOT NULL,
    [age_group_name_en]               NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [age_min]                         INT NOT NULL,
    [age_max]                         INT NOT NULL,
    [sort_order]                      INT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_stories_ref_story_age_group]
        PRIMARY KEY CLUSTERED ([stories_ref_story_age_group_id] ASC)
);
GO

ALTER TABLE [stories].[ref_story_age_group]
    ADD CONSTRAINT [DF_stories_ref_story_age_group_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [stories].[ref_story_age_group]
    ADD CONSTRAINT [DF_stories_ref_story_age_group_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [stories].[ref_story_age_group]
    ADD CONSTRAINT [CK_stories_ref_story_age_group_age_min_non_negative]
    CHECK ([age_min] >= 0);
GO

ALTER TABLE [stories].[ref_story_age_group]
    ADD CONSTRAINT [CK_stories_ref_story_age_group_age_max_non_negative]
    CHECK ([age_max] >= 0);
GO

ALTER TABLE [stories].[ref_story_age_group]
    ADD CONSTRAINT [CK_stories_ref_story_age_group_age_max_not_less_than_age_min]
    CHECK ([age_max] >= [age_min]);
GO

ALTER TABLE [stories].[ref_story_age_group]
    ADD CONSTRAINT [CK_stories_ref_story_age_group_sort_order_non_negative]
    CHECK ([sort_order] IS NULL OR [sort_order] >= 0);
GO

ALTER TABLE [stories].[ref_story_age_group]
    ADD CONSTRAINT [UX_stories_ref_story_age_group_age_group_code]
    UNIQUE ([age_group_code]);
GO

/* ================================================================
   TABLE: [stories].[coll_story]
   ================================================================ */

CREATE TABLE [stories].[coll_story]
(
    [stories_coll_story_id]           BIGINT IDENTITY(1,1) NOT NULL,
    [story_guid]                      UNIQUEIDENTIFIER NOT NULL,
    [link_user_profile_id]            BIGINT NOT NULL,
    [link_story_category_id]          INT NOT NULL,
    [link_age_group_id]               INT NOT NULL,
    [story_title_bn]                  NVARCHAR(300) COLLATE Bengali_100_CI_AS NOT NULL,
    [story_title_en]                  NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [story_slug]                      NVARCHAR(400) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [story_summary_bn]                NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,
    [story_content_html_bn]           NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NOT NULL,
    [story_source_attribution_bn]     NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,
    [story_type_code]                 NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [reading_time_minutes]      INT NOT NULL,
    [is_serial]                       BIT NOT NULL,
    [serial_part_number]        INT NULL,
    [link_serial_parent_id]           BIGINT NULL,
    [like_count]                      INT NOT NULL,
    [view_count]                      INT NOT NULL,
    [bookmark_count]                  INT NOT NULL,
    [completion_count]                INT NOT NULL,
    [comment_count]                   INT NOT NULL,
    [is_featured]                     BIT NOT NULL,
    [is_daily_pick]                   BIT NOT NULL,
    [is_published]                    BIT NOT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_stories_coll_story]
        PRIMARY KEY CLUSTERED ([stories_coll_story_id] ASC)
);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_story_guid]
    DEFAULT (NEWID()) FOR [story_guid];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_story_type_code]
    DEFAULT (N'text') FOR [story_type_code];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_reading_time_minutes]
    DEFAULT ((5)) FOR [reading_time_minutes];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_is_serial]
    DEFAULT ((0)) FOR [is_serial];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_like_count]
    DEFAULT ((0)) FOR [like_count];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_view_count]
    DEFAULT ((0)) FOR [view_count];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_bookmark_count]
    DEFAULT ((0)) FOR [bookmark_count];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_completion_count]
    DEFAULT ((0)) FOR [completion_count];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_comment_count]
    DEFAULT ((0)) FOR [comment_count];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_is_featured]
    DEFAULT ((0)) FOR [is_featured];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_is_daily_pick]
    DEFAULT ((0)) FOR [is_daily_pick];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_is_published]
    DEFAULT ((0)) FOR [is_published];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [DF_stories_coll_story_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [CK_stories_coll_story_reading_time_minutes_non_negative]
    CHECK ([reading_time_minutes] >= 0);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [CK_stories_coll_story_serial_part_number_non_negative]
    CHECK ([serial_part_number] IS NULL OR [serial_part_number] >= 0);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [CK_stories_coll_story_like_count_non_negative]
    CHECK ([like_count] >= 0);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [CK_stories_coll_story_view_count_non_negative]
    CHECK ([view_count] >= 0);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [CK_stories_coll_story_bookmark_count_non_negative]
    CHECK ([bookmark_count] >= 0);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [CK_stories_coll_story_completion_count_non_negative]
    CHECK ([completion_count] >= 0);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [CK_stories_coll_story_comment_count_non_negative]
    CHECK ([comment_count] >= 0);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [UX_stories_coll_story_story_guid]
    UNIQUE ([story_guid]);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [UX_stories_coll_story_story_slug]
    UNIQUE ([story_slug]);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [FK_stories_coll_story_link_user_profile_id]
    FOREIGN KEY ([link_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [FK_stories_coll_story_link_story_category_id]
    FOREIGN KEY ([link_story_category_id])
    REFERENCES [stories].[ref_story_category] ([stories_ref_story_category_id]);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [FK_stories_coll_story_link_age_group_id]
    FOREIGN KEY ([link_age_group_id])
    REFERENCES [stories].[ref_story_age_group] ([stories_ref_story_age_group_id]);
GO

ALTER TABLE [stories].[coll_story]
    ADD CONSTRAINT [FK_stories_coll_story_link_serial_parent_id]
    FOREIGN KEY ([link_serial_parent_id])
    REFERENCES [stories].[coll_story] ([stories_coll_story_id]);
GO

CREATE NONCLUSTERED INDEX [IX_stories_coll_story_link_user_profile_id]
    ON [stories].[coll_story] ([link_user_profile_id] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_stories_coll_story_link_story_category_id]
    ON [stories].[coll_story] ([link_story_category_id] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_stories_coll_story_link_age_group_id]
    ON [stories].[coll_story] ([link_age_group_id] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_stories_coll_story_created_at]
    ON [stories].[coll_story] ([created_at] DESC);
GO

/* ================================================================
   TABLE: [stories].[coll_story_asset]
   ================================================================ */

CREATE TABLE [stories].[coll_story_asset]
(
    [stories_coll_story_asset_id]     BIGINT IDENTITY(1,1) NOT NULL,
    [link_story_id]                   BIGINT NOT NULL,
    [link_asset_id]                   BIGINT NOT NULL,
    [asset_group_code]                NVARCHAR(30) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [is_cover]                        BIT NOT NULL,
    [caption_bn]                      NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,
    [sort_order]                      INT NOT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_stories_coll_story_asset]
        PRIMARY KEY CLUSTERED ([stories_coll_story_asset_id] ASC)
);
GO

ALTER TABLE [stories].[coll_story_asset]
    ADD CONSTRAINT [DF_stories_coll_story_asset_asset_group_code]
    DEFAULT (N'illustration') FOR [asset_group_code];
GO

ALTER TABLE [stories].[coll_story_asset]
    ADD CONSTRAINT [DF_stories_coll_story_asset_is_cover]
    DEFAULT ((0)) FOR [is_cover];
GO

ALTER TABLE [stories].[coll_story_asset]
    ADD CONSTRAINT [DF_stories_coll_story_asset_sort_order]
    DEFAULT ((0)) FOR [sort_order];
GO

ALTER TABLE [stories].[coll_story_asset]
    ADD CONSTRAINT [DF_stories_coll_story_asset_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [stories].[coll_story_asset]
    ADD CONSTRAINT [DF_stories_coll_story_asset_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [stories].[coll_story_asset]
    ADD CONSTRAINT [CK_stories_coll_story_asset_sort_order_non_negative]
    CHECK ([sort_order] >= 0);
GO

ALTER TABLE [stories].[coll_story_asset]
    ADD CONSTRAINT [FK_stories_coll_story_asset_link_story_id]
    FOREIGN KEY ([link_story_id])
    REFERENCES [stories].[coll_story] ([stories_coll_story_id]);
GO

CREATE NONCLUSTERED INDEX [IX_stories_coll_story_asset_link_story_id]
    ON [stories].[coll_story_asset] ([link_story_id] ASC);
GO

/* ================================================================
   TABLE: [stories].[coll_story_page]
   ================================================================ */

CREATE TABLE [stories].[coll_story_page]
(
    [stories_coll_story_page_id]      BIGINT IDENTITY(1,1) NOT NULL,
    [link_story_id]                   BIGINT NOT NULL,
    [page_number]                     INT NOT NULL,
    [page_content_html_bn]            NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NOT NULL,
    [link_illustration_asset_id]      BIGINT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_stories_coll_story_page]
        PRIMARY KEY CLUSTERED ([stories_coll_story_page_id] ASC)
);
GO

ALTER TABLE [stories].[coll_story_page]
    ADD CONSTRAINT [DF_stories_coll_story_page_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [stories].[coll_story_page]
    ADD CONSTRAINT [DF_stories_coll_story_page_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [stories].[coll_story_page]
    ADD CONSTRAINT [CK_stories_coll_story_page_page_number_positive]
    CHECK ([page_number] > 0);
GO

ALTER TABLE [stories].[coll_story_page]
    ADD CONSTRAINT [FK_stories_coll_story_page_link_story_id]
    FOREIGN KEY ([link_story_id])
    REFERENCES [stories].[coll_story] ([stories_coll_story_id]);
GO

ALTER TABLE [stories].[coll_story_page]
    ADD CONSTRAINT [UX_stories_coll_story_page_link_story_id_page_number]
    UNIQUE ([link_story_id], [page_number]);
GO

CREATE NONCLUSTERED INDEX [IX_stories_coll_story_page_link_story_id_page_number]
    ON [stories].[coll_story_page] ([link_story_id] ASC, [page_number] ASC);
GO

/* ================================================================
   TABLE: [stories].[eng_story_like]
   ================================================================ */

CREATE TABLE [stories].[eng_story_like]
(
    [stories_eng_story_like_id]       BIGINT IDENTITY(1,1) NOT NULL,
    [link_story_id]                   BIGINT NOT NULL,
    [link_user_profile_id]            BIGINT NOT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_stories_eng_story_like]
        PRIMARY KEY CLUSTERED ([stories_eng_story_like_id] ASC)
);
GO

ALTER TABLE [stories].[eng_story_like]
    ADD CONSTRAINT [DF_stories_eng_story_like_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [stories].[eng_story_like]
    ADD CONSTRAINT [DF_stories_eng_story_like_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [stories].[eng_story_like]
    ADD CONSTRAINT [FK_stories_eng_story_like_link_story_id]
    FOREIGN KEY ([link_story_id])
    REFERENCES [stories].[coll_story] ([stories_coll_story_id]);
GO

ALTER TABLE [stories].[eng_story_like]
    ADD CONSTRAINT [FK_stories_eng_story_like_link_user_profile_id]
    FOREIGN KEY ([link_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

ALTER TABLE [stories].[eng_story_like]
    ADD CONSTRAINT [UX_stories_eng_story_like_link_story_id_link_user_profile_id]
    UNIQUE ([link_story_id], [link_user_profile_id]);
GO

/* ================================================================
   TABLE: [stories].[eng_story_bookmark]
   ================================================================ */

CREATE TABLE [stories].[eng_story_bookmark]
(
    [stories_eng_story_bookmark_id]   BIGINT IDENTITY(1,1) NOT NULL,
    [link_story_id]                   BIGINT NOT NULL,
    [link_user_profile_id]            BIGINT NOT NULL,
    [last_page_number]          INT NULL,
    [is_completed]                    BIT NOT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_stories_eng_story_bookmark]
        PRIMARY KEY CLUSTERED ([stories_eng_story_bookmark_id] ASC)
);
GO

ALTER TABLE [stories].[eng_story_bookmark]
    ADD CONSTRAINT [DF_stories_eng_story_bookmark_is_completed]
    DEFAULT ((0)) FOR [is_completed];
GO

ALTER TABLE [stories].[eng_story_bookmark]
    ADD CONSTRAINT [DF_stories_eng_story_bookmark_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [stories].[eng_story_bookmark]
    ADD CONSTRAINT [DF_stories_eng_story_bookmark_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [stories].[eng_story_bookmark]
    ADD CONSTRAINT [CK_stories_eng_story_bookmark_last_page_number_non_negative]
    CHECK ([last_page_number] IS NULL OR [last_page_number] >= 0);
GO

ALTER TABLE [stories].[eng_story_bookmark]
    ADD CONSTRAINT [FK_stories_eng_story_bookmark_link_story_id]
    FOREIGN KEY ([link_story_id])
    REFERENCES [stories].[coll_story] ([stories_coll_story_id]);
GO

ALTER TABLE [stories].[eng_story_bookmark]
    ADD CONSTRAINT [FK_stories_eng_story_bookmark_link_user_profile_id]
    FOREIGN KEY ([link_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

ALTER TABLE [stories].[eng_story_bookmark]
    ADD CONSTRAINT [UX_stories_eng_story_bookmark_link_story_id_link_user_profile_id]
    UNIQUE ([link_story_id], [link_user_profile_id]);
GO

/* ================================================================
   TABLE: [stories].[eng_story_comment]
   ================================================================ */

CREATE TABLE [stories].[eng_story_comment]
(
    [stories_eng_story_comment_id]    BIGINT IDENTITY(1,1) NOT NULL,
    [link_story_id]                   BIGINT NOT NULL,
    [link_user_profile_id]            BIGINT NOT NULL,
    [link_parent_comment_id]          BIGINT NULL,
    [comment_text_bn]                 NVARCHAR(1000) COLLATE Bengali_100_CI_AS NOT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_stories_eng_story_comment]
        PRIMARY KEY CLUSTERED ([stories_eng_story_comment_id] ASC)
);
GO

ALTER TABLE [stories].[eng_story_comment]
    ADD CONSTRAINT [DF_stories_eng_story_comment_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [stories].[eng_story_comment]
    ADD CONSTRAINT [DF_stories_eng_story_comment_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [stories].[eng_story_comment]
    ADD CONSTRAINT [FK_stories_eng_story_comment_link_story_id]
    FOREIGN KEY ([link_story_id])
    REFERENCES [stories].[coll_story] ([stories_coll_story_id]);
GO

ALTER TABLE [stories].[eng_story_comment]
    ADD CONSTRAINT [FK_stories_eng_story_comment_link_user_profile_id]
    FOREIGN KEY ([link_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

ALTER TABLE [stories].[eng_story_comment]
    ADD CONSTRAINT [FK_stories_eng_story_comment_link_parent_comment_id]
    FOREIGN KEY ([link_parent_comment_id])
    REFERENCES [stories].[eng_story_comment] ([stories_eng_story_comment_id]);
GO

CREATE NONCLUSTERED INDEX [IX_stories_eng_story_comment_link_story_id]
    ON [stories].[eng_story_comment] ([link_story_id] ASC);
GO

/* ================================================================
   SEED: [stories].[ref_story_category]
   ================================================================ */

INSERT INTO [stories].[ref_story_category]
(
    [story_category_code],
    [story_category_name_bn],
    [story_category_name_en],
    [story_category_icon],
    [sort_order],
    [is_active]
)
VALUES
(N'thakurmar_jhuli', N'ঠাকুরমার ঝুলি', N'Grandmother''s Bag', N'👵', 1, 1),
(N'rupkotha', N'রূপকথা', N'Fairy Tales', N'🧚', 2, 1),
(N'panchatantra', N'পঞ্চতন্ত্র', N'Panchatantra', N'🦁', 3, 1),
(N'jataka', N'জাতক কাহিনী', N'Jataka Tales', N'🪷', 4, 1),
(N'gopal_bhar', N'গোপাল ভাঁড়', N'Gopal Bhar', N'😄', 5, 1),
(N'tuntuni', N'টুনটুনির গল্প', N'Tuntuni Tales', N'🐦', 6, 1),
(N'bangla_folk', N'বাংলার লোককথা', N'Bengali Folk Tales', N'🏡', 7, 1),
(N'niti_kotha', N'নীতিকথা', N'Moral Stories', N'⭐', 8, 1),
(N'ghum_parani', N'ঘুমপাড়ানি গল্প', N'Bedtime Stories', N'🌙', 9, 1),
(N'hashir_golpo', N'হাসির গল্প', N'Funny Stories', N'😂', 10, 1),
(N'adventure', N'অ্যাডভেঞ্চার গল্প', N'Adventure', N'⚔️', 11, 1),
(N'animal_stories', N'পশুপাখির গল্প', N'Animal Stories', N'🐾', 12, 1),
(N'mystery', N'রহস্য গল্প', N'Mystery', N'🔍', 13, 1),
(N'bhuter_golpo', N'ভূতের গল্প', N'Ghost Stories', N'👻', 14, 1),
(N'chhora', N'ছড়া ও কবিতা', N'Rhymes & Verse', N'🎶', 15, 1),
(N'science_nature', N'বিজ্ঞান ও প্রকৃতি', N'Science & Nature', N'🔬', 16, 1),
(N'liberation_war', N'মুক্তিযুদ্ধের গল্প', N'Liberation War Stories', N'🇧🇩', 17, 1),
(N'festival', N'উৎসব ও ঐতিহ্য', N'Festivals & Traditions', N'🎉', 18, 1);
GO

/* ================================================================
   SEED: [stories].[ref_story_age_group]
   ================================================================ */

INSERT INTO [stories].[ref_story_age_group]
(
    [age_group_code],
    [age_group_name_bn],
    [age_group_name_en],
    [age_min],
    [age_max],
    [sort_order],
    [is_active]
)
VALUES
(N'3_5', N'ছোট্ট শিশু (৩-৫)', N'Toddlers (3-5)', 3, 5, 1, 1),
(N'6_8', N'প্রাথমিক (৬-৮)', N'Primary (6-8)', 6, 8, 2, 1),
(N'9_12', N'কিশোর (৯-১২)', N'Pre-teen (9-12)', 9, 12, 3, 1);
GO

PRINT N'Art and Stories schema created successfully.';
GO
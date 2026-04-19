/* ================================================================
   BOOKWRITER — v01 SCHEMA
   ----------------------------------------------------------------
   App:       bookwriter (কলম)
   Schema:    [bookwriter]
   Purpose:   Independent writing platform — books, chapters, plot
              corkboard, character/location bible, cover designer,
              beta-reader sharing, sprint timer, writing analytics,
              and public serial publishing.
   Approach:  Drop + create (destructive). Safe for v01 since this
              is a brand-new app with no production data. Future
              migrations will be ALTER-based, additive only.

   Naming convention (matches [blog_bangladesh], [blog_art], etc.):
       ref_*          static admin data (lookup)
       coll_*         main standalone entity the user creates
       <bare>         sub-entity / 1:N child of a main entity
       engagement_*   like / bookmark / comment / reaction / view
       map_*          junction (M:M) — none in v01
       eng_*          computed / engine-derived data

   Tables: 14 ref · 1 coll · 12 sub-entity · 4 engagement · 1 eng
           = 32 total
   ================================================================ */

USE [news_magazine];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO


/* ================================================================
   SECTION 1 — SCHEMA
   ================================================================ */

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE [name] = N'bookwriter')
BEGIN
    EXEC(N'CREATE SCHEMA [bookwriter]');
END;
GO


/* ================================================================
   SECTION 2 — DROP TABLES (reverse dependency order)
   ================================================================ */

DROP TABLE IF EXISTS [bookwriter].[eng_user_streak];
GO
DROP TABLE IF EXISTS [bookwriter].[engagement_serial_view];
GO
DROP TABLE IF EXISTS [bookwriter].[engagement_serial_comment];
GO
DROP TABLE IF EXISTS [bookwriter].[engagement_serial_reaction];
GO
DROP TABLE IF EXISTS [bookwriter].[engagement_serial_subscriber];
GO
DROP TABLE IF EXISTS [bookwriter].[serial_release];
GO
DROP TABLE IF EXISTS [bookwriter].[writing_session];
GO
DROP TABLE IF EXISTS [bookwriter].[sprint_session];
GO
DROP TABLE IF EXISTS [bookwriter].[beta_comment];
GO
DROP TABLE IF EXISTS [bookwriter].[beta_reader];
GO
DROP TABLE IF EXISTS [bookwriter].[beta_share_link];
GO
DROP TABLE IF EXISTS [bookwriter].[book_cover_design];
GO
DROP TABLE IF EXISTS [bookwriter].[margin_note];
GO
DROP TABLE IF EXISTS [bookwriter].[plot_card];
GO
DROP TABLE IF EXISTS [bookwriter].[bible_entry];
GO
DROP TABLE IF EXISTS [bookwriter].[chapter_snapshot];
GO
DROP TABLE IF EXISTS [bookwriter].[chapter];
GO
DROP TABLE IF EXISTS [bookwriter].[coll_book];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_view_device];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_view_referrer];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_act_structure];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_publish_cadence];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_serial_release_status];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_beta_permission];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_cover_font];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_cover_background];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_cover_palette];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_cover_template];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_bible_category];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_chapter_visibility];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_chapter_status];
GO
DROP TABLE IF EXISTS [bookwriter].[ref_book_status];
GO


/* ================================================================
   SECTION 3 — REFERENCE TABLES
   ================================================================ */

/* ---------- 1. ref_book_status -------------------------------- */
CREATE TABLE [bookwriter].[ref_book_status]
(
    [bookwriter_ref_book_status_id]   INT IDENTITY(1,1) NOT NULL,
    [book_status_code]                NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [book_status_name_en]             NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [book_status_name_bn]             NVARCHAR(80) COLLATE Bengali_100_CI_AS NOT NULL,
    [book_status_description]         NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                      INT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_book_status]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_book_status_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_book_status_code]
        UNIQUE ([book_status_code])
);
GO
ALTER TABLE [bookwriter].[ref_book_status] ADD CONSTRAINT [DF_bookwriter_ref_book_status_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_book_status] ADD CONSTRAINT [DF_bookwriter_ref_book_status_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 2. ref_chapter_status ----------------------------- */
CREATE TABLE [bookwriter].[ref_chapter_status]
(
    [bookwriter_ref_chapter_status_id]  INT IDENTITY(1,1) NOT NULL,
    [chapter_status_code]               NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [chapter_status_name_en]            NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [chapter_status_name_bn]            NVARCHAR(80) COLLATE Bengali_100_CI_AS NOT NULL,
    [chapter_status_dot_color_hex]      NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                        INT NULL,
    [is_active]                         BIT NOT NULL,
    [created_at]                        DATETIME2(0) NOT NULL,
    [updated_at]                        DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_chapter_status]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_chapter_status_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_chapter_status_code]
        UNIQUE ([chapter_status_code])
);
GO
ALTER TABLE [bookwriter].[ref_chapter_status] ADD CONSTRAINT [DF_bookwriter_ref_chapter_status_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_chapter_status] ADD CONSTRAINT [DF_bookwriter_ref_chapter_status_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 3. ref_chapter_visibility ------------------------- */
CREATE TABLE [bookwriter].[ref_chapter_visibility]
(
    [bookwriter_ref_chapter_visibility_id]  INT IDENTITY(1,1) NOT NULL,
    [chapter_visibility_code]               NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [chapter_visibility_name_en]            NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [chapter_visibility_name_bn]            NVARCHAR(80) COLLATE Bengali_100_CI_AS NOT NULL,
    [chapter_visibility_description]        NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                            INT NULL,
    [is_active]                             BIT NOT NULL,
    [created_at]                            DATETIME2(0) NOT NULL,
    [updated_at]                            DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_chapter_visibility]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_chapter_visibility_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_chapter_visibility_code]
        UNIQUE ([chapter_visibility_code])
);
GO
ALTER TABLE [bookwriter].[ref_chapter_visibility] ADD CONSTRAINT [DF_bookwriter_ref_chapter_visibility_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_chapter_visibility] ADD CONSTRAINT [DF_bookwriter_ref_chapter_visibility_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 4. ref_bible_category ----------------------------- */
CREATE TABLE [bookwriter].[ref_bible_category]
(
    [bookwriter_ref_bible_category_id]  INT IDENTITY(1,1) NOT NULL,
    [bible_category_code]               NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [bible_category_name_en]            NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [bible_category_name_bn]            NVARCHAR(80) COLLATE Bengali_100_CI_AS NOT NULL,
    [bible_category_icon]               NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                        INT NULL,
    [is_active]                         BIT NOT NULL,
    [created_at]                        DATETIME2(0) NOT NULL,
    [updated_at]                        DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_bible_category]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_bible_category_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_bible_category_code]
        UNIQUE ([bible_category_code])
);
GO
ALTER TABLE [bookwriter].[ref_bible_category] ADD CONSTRAINT [DF_bookwriter_ref_bible_category_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_bible_category] ADD CONSTRAINT [DF_bookwriter_ref_bible_category_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 5. ref_cover_template ----------------------------- */
CREATE TABLE [bookwriter].[ref_cover_template]
(
    [bookwriter_ref_cover_template_id]  INT IDENTITY(1,1) NOT NULL,
    [cover_template_code]               NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [cover_template_name_en]            NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [cover_template_name_bn]            NVARCHAR(80) COLLATE Bengali_100_CI_AS NULL,
    [cover_template_description]        NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                        INT NULL,
    [is_active]                         BIT NOT NULL,
    [created_at]                        DATETIME2(0) NOT NULL,
    [updated_at]                        DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_cover_template]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_cover_template_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_cover_template_code]
        UNIQUE ([cover_template_code])
);
GO
ALTER TABLE [bookwriter].[ref_cover_template] ADD CONSTRAINT [DF_bookwriter_ref_cover_template_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_cover_template] ADD CONSTRAINT [DF_bookwriter_ref_cover_template_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 6. ref_cover_palette ------------------------------ */
CREATE TABLE [bookwriter].[ref_cover_palette]
(
    [bookwriter_ref_cover_palette_id]   INT IDENTITY(1,1) NOT NULL,
    [cover_palette_code]                NVARCHAR(30) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [cover_palette_name_en]             NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [cover_palette_bg_hex]              NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [cover_palette_fg_hex]              NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [cover_palette_accent_hex]          NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [sort_order]                        INT NULL,
    [is_active]                         BIT NOT NULL,
    [created_at]                        DATETIME2(0) NOT NULL,
    [updated_at]                        DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_cover_palette]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_cover_palette_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_cover_palette_code]
        UNIQUE ([cover_palette_code])
);
GO
ALTER TABLE [bookwriter].[ref_cover_palette] ADD CONSTRAINT [DF_bookwriter_ref_cover_palette_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_cover_palette] ADD CONSTRAINT [DF_bookwriter_ref_cover_palette_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 7. ref_cover_background --------------------------- */
CREATE TABLE [bookwriter].[ref_cover_background]
(
    [bookwriter_ref_cover_background_id]  INT IDENTITY(1,1) NOT NULL,
    [cover_background_code]               NVARCHAR(30) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [cover_background_name_en]            NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [sort_order]                          INT NULL,
    [is_active]                           BIT NOT NULL,
    [created_at]                          DATETIME2(0) NOT NULL,
    [updated_at]                          DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_cover_background]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_cover_background_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_cover_background_code]
        UNIQUE ([cover_background_code])
);
GO
ALTER TABLE [bookwriter].[ref_cover_background] ADD CONSTRAINT [DF_bookwriter_ref_cover_background_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_cover_background] ADD CONSTRAINT [DF_bookwriter_ref_cover_background_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 8. ref_cover_font --------------------------------- */
CREATE TABLE [bookwriter].[ref_cover_font]
(
    [bookwriter_ref_cover_font_id]   INT IDENTITY(1,1) NOT NULL,
    [cover_font_code]                NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [cover_font_name_en]             NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [cover_font_family_css]          NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [cover_font_style_css]           NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [cover_font_weight_css]          NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                     INT NULL,
    [is_active]                      BIT NOT NULL,
    [created_at]                     DATETIME2(0) NOT NULL,
    [updated_at]                     DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_cover_font]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_cover_font_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_cover_font_code]
        UNIQUE ([cover_font_code])
);
GO
ALTER TABLE [bookwriter].[ref_cover_font] ADD CONSTRAINT [DF_bookwriter_ref_cover_font_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_cover_font] ADD CONSTRAINT [DF_bookwriter_ref_cover_font_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 9. ref_beta_permission ---------------------------- */
CREATE TABLE [bookwriter].[ref_beta_permission]
(
    [bookwriter_ref_beta_permission_id]   INT IDENTITY(1,1) NOT NULL,
    [beta_permission_code]                NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [beta_permission_name_en]             NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [beta_permission_name_bn]             NVARCHAR(80) COLLATE Bengali_100_CI_AS NULL,
    [beta_permission_description]         NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                          INT NULL,
    [is_active]                           BIT NOT NULL,
    [created_at]                          DATETIME2(0) NOT NULL,
    [updated_at]                          DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_beta_permission]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_beta_permission_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_beta_permission_code]
        UNIQUE ([beta_permission_code])
);
GO
ALTER TABLE [bookwriter].[ref_beta_permission] ADD CONSTRAINT [DF_bookwriter_ref_beta_permission_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_beta_permission] ADD CONSTRAINT [DF_bookwriter_ref_beta_permission_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 10. ref_serial_release_status --------------------- */
CREATE TABLE [bookwriter].[ref_serial_release_status]
(
    [bookwriter_ref_serial_release_status_id]  INT IDENTITY(1,1) NOT NULL,
    [serial_release_status_code]               NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [serial_release_status_name_en]            NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [serial_release_status_name_bn]            NVARCHAR(80) COLLATE Bengali_100_CI_AS NULL,
    [serial_release_status_chip_color_hex]     NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                               INT NULL,
    [is_active]                                BIT NOT NULL,
    [created_at]                               DATETIME2(0) NOT NULL,
    [updated_at]                               DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_serial_release_status]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_serial_release_status_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_serial_release_status_code]
        UNIQUE ([serial_release_status_code])
);
GO
ALTER TABLE [bookwriter].[ref_serial_release_status] ADD CONSTRAINT [DF_bookwriter_ref_serial_release_status_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_serial_release_status] ADD CONSTRAINT [DF_bookwriter_ref_serial_release_status_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 11. ref_publish_cadence --------------------------- */
CREATE TABLE [bookwriter].[ref_publish_cadence]
(
    [bookwriter_ref_publish_cadence_id]  INT IDENTITY(1,1) NOT NULL,
    [publish_cadence_code]               NVARCHAR(30) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [publish_cadence_name_en]            NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [publish_cadence_name_bn]            NVARCHAR(80) COLLATE Bengali_100_CI_AS NULL,
    [publish_cadence_interval_days]      INT NULL,
    [publish_cadence_weekday]            TINYINT NULL,
    [sort_order]                         INT NULL,
    [is_active]                          BIT NOT NULL,
    [created_at]                         DATETIME2(0) NOT NULL,
    [updated_at]                         DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_publish_cadence]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_publish_cadence_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_publish_cadence_code]
        UNIQUE ([publish_cadence_code])
);
GO
ALTER TABLE [bookwriter].[ref_publish_cadence] ADD CONSTRAINT [DF_bookwriter_ref_publish_cadence_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_publish_cadence] ADD CONSTRAINT [DF_bookwriter_ref_publish_cadence_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 12. ref_act_structure ----------------------------- */
CREATE TABLE [bookwriter].[ref_act_structure]
(
    [bookwriter_ref_act_structure_id]  INT IDENTITY(1,1) NOT NULL,
    [act_structure_code]               NVARCHAR(30) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [act_structure_name_en]            NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [act_structure_name_bn]            NVARCHAR(80) COLLATE Bengali_100_CI_AS NULL,
    [act_structure_subtitle]           NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                       INT NULL,
    [is_active]                        BIT NOT NULL,
    [created_at]                       DATETIME2(0) NOT NULL,
    [updated_at]                       DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_act_structure]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_act_structure_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_act_structure_code]
        UNIQUE ([act_structure_code])
);
GO
ALTER TABLE [bookwriter].[ref_act_structure] ADD CONSTRAINT [DF_bookwriter_ref_act_structure_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_act_structure] ADD CONSTRAINT [DF_bookwriter_ref_act_structure_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 13. ref_view_referrer ----------------------------- */
CREATE TABLE [bookwriter].[ref_view_referrer]
(
    [bookwriter_ref_view_referrer_id]  INT IDENTITY(1,1) NOT NULL,
    [view_referrer_code]               NVARCHAR(30) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [view_referrer_name_en]            NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [sort_order]                       INT NULL,
    [is_active]                        BIT NOT NULL,
    [created_at]                       DATETIME2(0) NOT NULL,
    [updated_at]                       DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_view_referrer]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_view_referrer_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_view_referrer_code]
        UNIQUE ([view_referrer_code])
);
GO
ALTER TABLE [bookwriter].[ref_view_referrer] ADD CONSTRAINT [DF_bookwriter_ref_view_referrer_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_view_referrer] ADD CONSTRAINT [DF_bookwriter_ref_view_referrer_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ---------- 14. ref_view_device ------------------------------- */
CREATE TABLE [bookwriter].[ref_view_device]
(
    [bookwriter_ref_view_device_id]  INT IDENTITY(1,1) NOT NULL,
    [view_device_code]               NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [view_device_name_en]            NVARCHAR(80) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [sort_order]                     INT NULL,
    [is_active]                      BIT NOT NULL,
    [created_at]                     DATETIME2(0) NOT NULL,
    [updated_at]                     DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_ref_view_device]
        PRIMARY KEY CLUSTERED ([bookwriter_ref_view_device_id] ASC),
    CONSTRAINT [UX_bookwriter_ref_view_device_code]
        UNIQUE ([view_device_code])
);
GO
ALTER TABLE [bookwriter].[ref_view_device] ADD CONSTRAINT [DF_bookwriter_ref_view_device_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[ref_view_device] ADD CONSTRAINT [DF_bookwriter_ref_view_device_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ================================================================
   SECTION 4 — MAIN ENTITY (coll_)
   ================================================================ */

/* ---------- 15. coll_book ------------------------------------- */
CREATE TABLE [bookwriter].[coll_book]
(
    [bookwriter_coll_book_id]            BIGINT IDENTITY(1,1) NOT NULL,
    [link_owner_user_profile_id]         BIGINT NOT NULL,
    [book_title_bn]                      NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,
    [book_title_en]                      NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [book_subtitle_bn]                   NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,
    [book_subtitle_en]                   NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [book_author_display_bn]             NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,
    [book_author_display_en]             NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [book_synopsis]                      NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [book_language_code]                 NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [book_word_count_target]             INT NULL,
    [book_daily_word_target]             INT NOT NULL,
    [book_status_code]                   NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [book_visibility_code]               NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [book_slug_en]                       NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [book_published_at]                  DATETIME2(0) NULL,
    [book_archived_at]                   DATETIME2(0) NULL,
    [book_cover_image_url]               NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [link_publish_cadence_id]            INT NULL,
    [book_word_count_cached]             INT NOT NULL,
    [book_chapter_count_cached]          INT NOT NULL,
    [is_active]                          BIT NOT NULL,
    [created_at]                         DATETIME2(0) NOT NULL,
    [updated_at]                         DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_coll_book]
        PRIMARY KEY CLUSTERED ([bookwriter_coll_book_id] ASC)
);
GO
ALTER TABLE [bookwriter].[coll_book] ADD CONSTRAINT [DF_bookwriter_coll_book_book_language_code] DEFAULT (N'bn') FOR [book_language_code];
ALTER TABLE [bookwriter].[coll_book] ADD CONSTRAINT [DF_bookwriter_coll_book_book_daily_word_target] DEFAULT ((500)) FOR [book_daily_word_target];
ALTER TABLE [bookwriter].[coll_book] ADD CONSTRAINT [DF_bookwriter_coll_book_book_status_code] DEFAULT (N'draft') FOR [book_status_code];
ALTER TABLE [bookwriter].[coll_book] ADD CONSTRAINT [DF_bookwriter_coll_book_book_visibility_code] DEFAULT (N'private') FOR [book_visibility_code];
ALTER TABLE [bookwriter].[coll_book] ADD CONSTRAINT [DF_bookwriter_coll_book_book_word_count_cached] DEFAULT ((0)) FOR [book_word_count_cached];
ALTER TABLE [bookwriter].[coll_book] ADD CONSTRAINT [DF_bookwriter_coll_book_book_chapter_count_cached] DEFAULT ((0)) FOR [book_chapter_count_cached];
ALTER TABLE [bookwriter].[coll_book] ADD CONSTRAINT [DF_bookwriter_coll_book_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[coll_book] ADD CONSTRAINT [DF_bookwriter_coll_book_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[coll_book]
    ADD CONSTRAINT [FK_bookwriter_coll_book_link_publish_cadence_id]
    FOREIGN KEY ([link_publish_cadence_id])
    REFERENCES [bookwriter].[ref_publish_cadence] ([bookwriter_ref_publish_cadence_id]);
GO
CREATE UNIQUE NONCLUSTERED INDEX [UX_bookwriter_coll_book_slug_en]
    ON [bookwriter].[coll_book] ([book_slug_en])
    WHERE [book_slug_en] IS NOT NULL;
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_coll_book_owner_status]
    ON [bookwriter].[coll_book] ([link_owner_user_profile_id], [book_status_code], [is_active]);
GO


/* ================================================================
   SECTION 5 — SUB-ENTITY TABLES (1:N children of coll_book / chapter)
   ================================================================ */

/* ---------- 16. chapter --------------------------------------- */
CREATE TABLE [bookwriter].[chapter]
(
    [bookwriter_chapter_id]              BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_coll_book_id]       BIGINT NOT NULL,
    [chapter_number]                     INT NOT NULL,
    [chapter_title_bn]                   NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,
    [chapter_title_en]                   NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [chapter_text_html]                  NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [chapter_text_plain]                 NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [chapter_word_count]                 INT NOT NULL,
    [chapter_status_code]                NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [chapter_visibility_code]            NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [sort_order]                         INT NOT NULL,
    [last_edited_at]                     DATETIME2(0) NULL,
    [is_active]                          BIT NOT NULL,
    [created_at]                         DATETIME2(0) NOT NULL,
    [updated_at]                         DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_chapter]
        PRIMARY KEY CLUSTERED ([bookwriter_chapter_id] ASC)
);
GO
ALTER TABLE [bookwriter].[chapter] ADD CONSTRAINT [DF_bookwriter_chapter_chapter_word_count] DEFAULT ((0)) FOR [chapter_word_count];
ALTER TABLE [bookwriter].[chapter] ADD CONSTRAINT [DF_bookwriter_chapter_chapter_status_code] DEFAULT (N'blank') FOR [chapter_status_code];
ALTER TABLE [bookwriter].[chapter] ADD CONSTRAINT [DF_bookwriter_chapter_chapter_visibility_code] DEFAULT (N'private') FOR [chapter_visibility_code];
ALTER TABLE [bookwriter].[chapter] ADD CONSTRAINT [DF_bookwriter_chapter_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[chapter] ADD CONSTRAINT [DF_bookwriter_chapter_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[chapter]
    ADD CONSTRAINT [FK_bookwriter_chapter_link_bookwriter_coll_book_id]
    FOREIGN KEY ([link_bookwriter_coll_book_id])
    REFERENCES [bookwriter].[coll_book] ([bookwriter_coll_book_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_chapter_book_sort]
    ON [bookwriter].[chapter] ([link_bookwriter_coll_book_id], [sort_order], [is_active]);
GO


/* ---------- 17. chapter_snapshot ------------------------------ */
CREATE TABLE [bookwriter].[chapter_snapshot]
(
    [bookwriter_chapter_snapshot_id]   BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_chapter_id]       BIGINT NOT NULL,
    [snapshot_kind_code]               NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [snapshot_label]                   NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [snapshot_text_html]               NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [snapshot_text_plain]              NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [snapshot_word_count]              INT NOT NULL,
    [snapshot_word_count_diff]         INT NULL,
    [link_created_by_user_profile_id]  BIGINT NULL,
    [is_active]                        BIT NOT NULL,
    [created_at]                       DATETIME2(0) NOT NULL,

    CONSTRAINT [PK_bookwriter_chapter_snapshot]
        PRIMARY KEY CLUSTERED ([bookwriter_chapter_snapshot_id] ASC)
);
GO
ALTER TABLE [bookwriter].[chapter_snapshot] ADD CONSTRAINT [DF_bookwriter_chapter_snapshot_snapshot_kind_code] DEFAULT (N'auto') FOR [snapshot_kind_code];
ALTER TABLE [bookwriter].[chapter_snapshot] ADD CONSTRAINT [DF_bookwriter_chapter_snapshot_snapshot_word_count] DEFAULT ((0)) FOR [snapshot_word_count];
ALTER TABLE [bookwriter].[chapter_snapshot] ADD CONSTRAINT [DF_bookwriter_chapter_snapshot_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[chapter_snapshot] ADD CONSTRAINT [DF_bookwriter_chapter_snapshot_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[chapter_snapshot]
    ADD CONSTRAINT [FK_bookwriter_chapter_snapshot_link_bookwriter_chapter_id]
    FOREIGN KEY ([link_bookwriter_chapter_id])
    REFERENCES [bookwriter].[chapter] ([bookwriter_chapter_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_chapter_snapshot_chapter_created]
    ON [bookwriter].[chapter_snapshot] ([link_bookwriter_chapter_id], [created_at] DESC);
GO


/* ---------- 18. bible_entry ----------------------------------- */
CREATE TABLE [bookwriter].[bible_entry]
(
    [bookwriter_bible_entry_id]         BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_coll_book_id]      BIGINT NOT NULL,
    [bible_category_code]               NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [entry_name]                        NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [entry_role]                        NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [entry_avatar_initial]              NVARCHAR(5) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [entry_avatar_color_hex]            NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [entry_avatar_color_hex_2]          NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [entry_image_url]                   NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [entry_biography]                   NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [entry_attributes_json]             NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [entry_notes]                       NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [entry_tags_csv]                    NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                        INT NOT NULL,
    [is_active]                         BIT NOT NULL,
    [created_at]                        DATETIME2(0) NOT NULL,
    [updated_at]                        DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_bible_entry]
        PRIMARY KEY CLUSTERED ([bookwriter_bible_entry_id] ASC)
);
GO
ALTER TABLE [bookwriter].[bible_entry] ADD CONSTRAINT [DF_bookwriter_bible_entry_sort_order] DEFAULT ((0)) FOR [sort_order];
ALTER TABLE [bookwriter].[bible_entry] ADD CONSTRAINT [DF_bookwriter_bible_entry_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[bible_entry] ADD CONSTRAINT [DF_bookwriter_bible_entry_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[bible_entry]
    ADD CONSTRAINT [FK_bookwriter_bible_entry_link_bookwriter_coll_book_id]
    FOREIGN KEY ([link_bookwriter_coll_book_id])
    REFERENCES [bookwriter].[coll_book] ([bookwriter_coll_book_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_bible_entry_book_category]
    ON [bookwriter].[bible_entry] ([link_bookwriter_coll_book_id], [bible_category_code], [sort_order], [is_active]);
GO


/* ---------- 19. plot_card ------------------------------------- */
CREATE TABLE [bookwriter].[plot_card]
(
    [bookwriter_plot_card_id]           BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_coll_book_id]      BIGINT NOT NULL,
    [link_bookwriter_chapter_id]        BIGINT NULL,
    [act_structure_code]                NVARCHAR(30) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [card_scene_number]                 INT NULL,
    [card_title]                        NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [card_body]                         NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [card_tag]                          NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                        INT NOT NULL,
    [is_active]                         BIT NOT NULL,
    [created_at]                        DATETIME2(0) NOT NULL,
    [updated_at]                        DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_plot_card]
        PRIMARY KEY CLUSTERED ([bookwriter_plot_card_id] ASC)
);
GO
ALTER TABLE [bookwriter].[plot_card] ADD CONSTRAINT [DF_bookwriter_plot_card_sort_order] DEFAULT ((0)) FOR [sort_order];
ALTER TABLE [bookwriter].[plot_card] ADD CONSTRAINT [DF_bookwriter_plot_card_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[plot_card] ADD CONSTRAINT [DF_bookwriter_plot_card_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[plot_card]
    ADD CONSTRAINT [FK_bookwriter_plot_card_link_bookwriter_coll_book_id]
    FOREIGN KEY ([link_bookwriter_coll_book_id])
    REFERENCES [bookwriter].[coll_book] ([bookwriter_coll_book_id]);
ALTER TABLE [bookwriter].[plot_card]
    ADD CONSTRAINT [FK_bookwriter_plot_card_link_bookwriter_chapter_id]
    FOREIGN KEY ([link_bookwriter_chapter_id])
    REFERENCES [bookwriter].[chapter] ([bookwriter_chapter_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_plot_card_book_act_sort]
    ON [bookwriter].[plot_card] ([link_bookwriter_coll_book_id], [act_structure_code], [sort_order], [is_active]);
GO


/* ---------- 20. margin_note ----------------------------------- */
CREATE TABLE [bookwriter].[margin_note]
(
    [bookwriter_margin_note_id]         BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_chapter_id]        BIGINT NOT NULL,
    [note_text]                         NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [is_resolved]                       BIT NOT NULL,
    [is_active]                         BIT NOT NULL,
    [created_at]                        DATETIME2(0) NOT NULL,
    [updated_at]                        DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_margin_note]
        PRIMARY KEY CLUSTERED ([bookwriter_margin_note_id] ASC)
);
GO
ALTER TABLE [bookwriter].[margin_note] ADD CONSTRAINT [DF_bookwriter_margin_note_is_resolved] DEFAULT ((0)) FOR [is_resolved];
ALTER TABLE [bookwriter].[margin_note] ADD CONSTRAINT [DF_bookwriter_margin_note_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[margin_note] ADD CONSTRAINT [DF_bookwriter_margin_note_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[margin_note]
    ADD CONSTRAINT [FK_bookwriter_margin_note_link_bookwriter_chapter_id]
    FOREIGN KEY ([link_bookwriter_chapter_id])
    REFERENCES [bookwriter].[chapter] ([bookwriter_chapter_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_margin_note_chapter]
    ON [bookwriter].[margin_note] ([link_bookwriter_chapter_id], [is_resolved], [is_active]);
GO


/* ---------- 21. book_cover_design (1:1 with coll_book) -------- */
CREATE TABLE [bookwriter].[book_cover_design]
(
    [bookwriter_book_cover_design_id]        BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_coll_book_id]           BIGINT NOT NULL,
    [link_cover_template_id]                 INT NULL,
    [link_cover_palette_id]                  INT NULL,
    [link_cover_background_id]               INT NULL,
    [link_cover_font_id]                     INT NULL,
    [cover_title_size_pt]                    INT NOT NULL,
    [cover_letter_spacing_unit]              INT NOT NULL,
    [cover_palette_bg_hex_override]          NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [cover_palette_fg_hex_override]          NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [cover_palette_accent_hex_override]      NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [cover_custom_image_url]                 NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [cover_rendered_preview_url]             NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [is_active]                              BIT NOT NULL,
    [created_at]                             DATETIME2(0) NOT NULL,
    [updated_at]                             DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_book_cover_design]
        PRIMARY KEY CLUSTERED ([bookwriter_book_cover_design_id] ASC),
    CONSTRAINT [UX_bookwriter_book_cover_design_book]
        UNIQUE ([link_bookwriter_coll_book_id])
);
GO
ALTER TABLE [bookwriter].[book_cover_design] ADD CONSTRAINT [DF_bookwriter_book_cover_design_cover_title_size_pt] DEFAULT ((42)) FOR [cover_title_size_pt];
ALTER TABLE [bookwriter].[book_cover_design] ADD CONSTRAINT [DF_bookwriter_book_cover_design_cover_letter_spacing_unit] DEFAULT ((0)) FOR [cover_letter_spacing_unit];
ALTER TABLE [bookwriter].[book_cover_design] ADD CONSTRAINT [DF_bookwriter_book_cover_design_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[book_cover_design] ADD CONSTRAINT [DF_bookwriter_book_cover_design_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[book_cover_design]
    ADD CONSTRAINT [FK_bookwriter_book_cover_design_link_bookwriter_coll_book_id]
    FOREIGN KEY ([link_bookwriter_coll_book_id])
    REFERENCES [bookwriter].[coll_book] ([bookwriter_coll_book_id]);
ALTER TABLE [bookwriter].[book_cover_design]
    ADD CONSTRAINT [FK_bookwriter_book_cover_design_link_cover_template_id]
    FOREIGN KEY ([link_cover_template_id])
    REFERENCES [bookwriter].[ref_cover_template] ([bookwriter_ref_cover_template_id]);
ALTER TABLE [bookwriter].[book_cover_design]
    ADD CONSTRAINT [FK_bookwriter_book_cover_design_link_cover_palette_id]
    FOREIGN KEY ([link_cover_palette_id])
    REFERENCES [bookwriter].[ref_cover_palette] ([bookwriter_ref_cover_palette_id]);
ALTER TABLE [bookwriter].[book_cover_design]
    ADD CONSTRAINT [FK_bookwriter_book_cover_design_link_cover_background_id]
    FOREIGN KEY ([link_cover_background_id])
    REFERENCES [bookwriter].[ref_cover_background] ([bookwriter_ref_cover_background_id]);
ALTER TABLE [bookwriter].[book_cover_design]
    ADD CONSTRAINT [FK_bookwriter_book_cover_design_link_cover_font_id]
    FOREIGN KEY ([link_cover_font_id])
    REFERENCES [bookwriter].[ref_cover_font] ([bookwriter_ref_cover_font_id]);
GO


/* ---------- 22. beta_share_link ------------------------------- */
CREATE TABLE [bookwriter].[beta_share_link]
(
    [bookwriter_beta_share_link_id]         BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_coll_book_id]          BIGINT NOT NULL,
    [share_link_token]                      NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [beta_permission_code]                  NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [share_expires_at]                      DATETIME2(0) NULL,
    [share_revoked_at]                      DATETIME2(0) NULL,
    [link_created_by_user_profile_id]       BIGINT NOT NULL,
    [is_active]                             BIT NOT NULL,
    [created_at]                            DATETIME2(0) NOT NULL,
    [updated_at]                            DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_beta_share_link]
        PRIMARY KEY CLUSTERED ([bookwriter_beta_share_link_id] ASC),
    CONSTRAINT [UX_bookwriter_beta_share_link_token]
        UNIQUE ([share_link_token])
);
GO
ALTER TABLE [bookwriter].[beta_share_link] ADD CONSTRAINT [DF_bookwriter_beta_share_link_beta_permission_code] DEFAULT (N'read') FOR [beta_permission_code];
ALTER TABLE [bookwriter].[beta_share_link] ADD CONSTRAINT [DF_bookwriter_beta_share_link_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[beta_share_link] ADD CONSTRAINT [DF_bookwriter_beta_share_link_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[beta_share_link]
    ADD CONSTRAINT [FK_bookwriter_beta_share_link_link_bookwriter_coll_book_id]
    FOREIGN KEY ([link_bookwriter_coll_book_id])
    REFERENCES [bookwriter].[coll_book] ([bookwriter_coll_book_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_beta_share_link_book]
    ON [bookwriter].[beta_share_link] ([link_bookwriter_coll_book_id], [is_active]);
GO


/* ---------- 23. beta_reader ----------------------------------- */
CREATE TABLE [bookwriter].[beta_reader]
(
    [bookwriter_beta_reader_id]                 BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_coll_book_id]              BIGINT NOT NULL,
    [link_bookwriter_beta_share_link_id]        BIGINT NULL,
    [reader_email]                              NVARCHAR(254) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [link_reader_user_profile_id]               BIGINT NULL,
    [reader_display_name]                       NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [reader_avatar_initial]                     NVARCHAR(5) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [reader_avatar_color_hex]                   NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [beta_permission_code]                      NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [invited_at]                                DATETIME2(0) NULL,
    [accepted_at]                               DATETIME2(0) NULL,
    [last_visited_at]                           DATETIME2(0) NULL,
    [is_active]                                 BIT NOT NULL,
    [created_at]                                DATETIME2(0) NOT NULL,
    [updated_at]                                DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_beta_reader]
        PRIMARY KEY CLUSTERED ([bookwriter_beta_reader_id] ASC)
);
GO
ALTER TABLE [bookwriter].[beta_reader] ADD CONSTRAINT [DF_bookwriter_beta_reader_beta_permission_code] DEFAULT (N'read') FOR [beta_permission_code];
ALTER TABLE [bookwriter].[beta_reader] ADD CONSTRAINT [DF_bookwriter_beta_reader_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[beta_reader] ADD CONSTRAINT [DF_bookwriter_beta_reader_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[beta_reader]
    ADD CONSTRAINT [FK_bookwriter_beta_reader_link_bookwriter_coll_book_id]
    FOREIGN KEY ([link_bookwriter_coll_book_id])
    REFERENCES [bookwriter].[coll_book] ([bookwriter_coll_book_id]);
ALTER TABLE [bookwriter].[beta_reader]
    ADD CONSTRAINT [FK_bookwriter_beta_reader_link_bookwriter_beta_share_link_id]
    FOREIGN KEY ([link_bookwriter_beta_share_link_id])
    REFERENCES [bookwriter].[beta_share_link] ([bookwriter_beta_share_link_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_beta_reader_book]
    ON [bookwriter].[beta_reader] ([link_bookwriter_coll_book_id], [is_active]);
CREATE NONCLUSTERED INDEX [IX_bookwriter_beta_reader_user]
    ON [bookwriter].[beta_reader] ([link_reader_user_profile_id], [is_active])
    WHERE [link_reader_user_profile_id] IS NOT NULL;
GO


/* ---------- 24. beta_comment ---------------------------------- */
CREATE TABLE [bookwriter].[beta_comment]
(
    [bookwriter_beta_comment_id]            BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_chapter_id]            BIGINT NOT NULL,
    [link_bookwriter_beta_reader_id]        BIGINT NOT NULL,
    [comment_anchor_offset]                 INT NULL,
    [comment_anchor_length]                 INT NULL,
    [comment_anchor_text]                   NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [comment_text]                          NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [comment_kind_code]                     NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [suggestion_replacement_text]           NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [suggestion_resolution_code]            NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [is_resolved]                           BIT NOT NULL,
    [is_active]                             BIT NOT NULL,
    [created_at]                            DATETIME2(0) NOT NULL,
    [updated_at]                            DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_beta_comment]
        PRIMARY KEY CLUSTERED ([bookwriter_beta_comment_id] ASC)
);
GO
ALTER TABLE [bookwriter].[beta_comment] ADD CONSTRAINT [DF_bookwriter_beta_comment_comment_kind_code] DEFAULT (N'comment') FOR [comment_kind_code];
ALTER TABLE [bookwriter].[beta_comment] ADD CONSTRAINT [DF_bookwriter_beta_comment_is_resolved] DEFAULT ((0)) FOR [is_resolved];
ALTER TABLE [bookwriter].[beta_comment] ADD CONSTRAINT [DF_bookwriter_beta_comment_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[beta_comment] ADD CONSTRAINT [DF_bookwriter_beta_comment_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[beta_comment]
    ADD CONSTRAINT [FK_bookwriter_beta_comment_link_bookwriter_chapter_id]
    FOREIGN KEY ([link_bookwriter_chapter_id])
    REFERENCES [bookwriter].[chapter] ([bookwriter_chapter_id]);
ALTER TABLE [bookwriter].[beta_comment]
    ADD CONSTRAINT [FK_bookwriter_beta_comment_link_bookwriter_beta_reader_id]
    FOREIGN KEY ([link_bookwriter_beta_reader_id])
    REFERENCES [bookwriter].[beta_reader] ([bookwriter_beta_reader_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_beta_comment_chapter]
    ON [bookwriter].[beta_comment] ([link_bookwriter_chapter_id], [is_resolved], [is_active]);
GO


/* ---------- 25. sprint_session -------------------------------- */
CREATE TABLE [bookwriter].[sprint_session]
(
    [bookwriter_sprint_session_id]        BIGINT IDENTITY(1,1) NOT NULL,
    [link_user_profile_id]                BIGINT NOT NULL,
    [link_bookwriter_coll_book_id]        BIGINT NULL,
    [link_bookwriter_chapter_id]          BIGINT NULL,
    [sprint_planned_minutes]              INT NOT NULL,
    [sprint_started_at]                   DATETIME2(0) NOT NULL,
    [sprint_ended_at]                     DATETIME2(0) NULL,
    [sprint_actual_seconds]               INT NULL,
    [sprint_completed]                    BIT NOT NULL,
    [sprint_words_added]                  INT NOT NULL,
    [is_active]                           BIT NOT NULL,
    [created_at]                          DATETIME2(0) NOT NULL,

    CONSTRAINT [PK_bookwriter_sprint_session]
        PRIMARY KEY CLUSTERED ([bookwriter_sprint_session_id] ASC)
);
GO
ALTER TABLE [bookwriter].[sprint_session] ADD CONSTRAINT [DF_bookwriter_sprint_session_sprint_completed] DEFAULT ((0)) FOR [sprint_completed];
ALTER TABLE [bookwriter].[sprint_session] ADD CONSTRAINT [DF_bookwriter_sprint_session_sprint_words_added] DEFAULT ((0)) FOR [sprint_words_added];
ALTER TABLE [bookwriter].[sprint_session] ADD CONSTRAINT [DF_bookwriter_sprint_session_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[sprint_session] ADD CONSTRAINT [DF_bookwriter_sprint_session_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[sprint_session]
    ADD CONSTRAINT [FK_bookwriter_sprint_session_link_bookwriter_coll_book_id]
    FOREIGN KEY ([link_bookwriter_coll_book_id])
    REFERENCES [bookwriter].[coll_book] ([bookwriter_coll_book_id]);
ALTER TABLE [bookwriter].[sprint_session]
    ADD CONSTRAINT [FK_bookwriter_sprint_session_link_bookwriter_chapter_id]
    FOREIGN KEY ([link_bookwriter_chapter_id])
    REFERENCES [bookwriter].[chapter] ([bookwriter_chapter_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_sprint_session_user_started]
    ON [bookwriter].[sprint_session] ([link_user_profile_id], [sprint_started_at] DESC);
GO


/* ---------- 26. writing_session ------------------------------- */
CREATE TABLE [bookwriter].[writing_session]
(
    [bookwriter_writing_session_id]       BIGINT IDENTITY(1,1) NOT NULL,
    [link_user_profile_id]                BIGINT NOT NULL,
    [link_bookwriter_coll_book_id]        BIGINT NULL,
    [session_date]                        DATE NOT NULL,
    [session_started_at]                  DATETIME2(0) NOT NULL,
    [session_ended_at]                    DATETIME2(0) NULL,
    [session_words_added]                 INT NOT NULL,
    [session_active_seconds]              INT NOT NULL,
    [is_active]                           BIT NOT NULL,
    [created_at]                          DATETIME2(0) NOT NULL,
    [updated_at]                          DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_writing_session]
        PRIMARY KEY CLUSTERED ([bookwriter_writing_session_id] ASC)
);
GO
ALTER TABLE [bookwriter].[writing_session] ADD CONSTRAINT [DF_bookwriter_writing_session_session_words_added] DEFAULT ((0)) FOR [session_words_added];
ALTER TABLE [bookwriter].[writing_session] ADD CONSTRAINT [DF_bookwriter_writing_session_session_active_seconds] DEFAULT ((0)) FOR [session_active_seconds];
ALTER TABLE [bookwriter].[writing_session] ADD CONSTRAINT [DF_bookwriter_writing_session_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[writing_session] ADD CONSTRAINT [DF_bookwriter_writing_session_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[writing_session]
    ADD CONSTRAINT [FK_bookwriter_writing_session_link_bookwriter_coll_book_id]
    FOREIGN KEY ([link_bookwriter_coll_book_id])
    REFERENCES [bookwriter].[coll_book] ([bookwriter_coll_book_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_writing_session_user_date]
    ON [bookwriter].[writing_session] ([link_user_profile_id], [session_date] DESC);
GO


/* ---------- 27. serial_release (1:1 with chapter) ------------- */
CREATE TABLE [bookwriter].[serial_release]
(
    [bookwriter_serial_release_id]         BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_chapter_id]           BIGINT NOT NULL,
    [link_bookwriter_coll_book_id]         BIGINT NOT NULL,
    [serial_release_status_code]           NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [scheduled_at]                         DATETIME2(0) NULL,
    [published_at]                         DATETIME2(0) NULL,
    [unpublished_at]                       DATETIME2(0) NULL,
    [public_chapter_slug]                  NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [chapter_excerpt]                      NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [read_count_cached]                    INT NOT NULL,
    [unique_reader_count_cached]           INT NOT NULL,
    [reaction_count_cached]                INT NOT NULL,
    [comment_count_cached]                 INT NOT NULL,
    [preview_view_count_cached]            INT NOT NULL,
    [is_active]                            BIT NOT NULL,
    [created_at]                           DATETIME2(0) NOT NULL,
    [updated_at]                           DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_serial_release]
        PRIMARY KEY CLUSTERED ([bookwriter_serial_release_id] ASC),
    CONSTRAINT [UX_bookwriter_serial_release_chapter]
        UNIQUE ([link_bookwriter_chapter_id])
);
GO
ALTER TABLE [bookwriter].[serial_release] ADD CONSTRAINT [DF_bookwriter_serial_release_serial_release_status_code] DEFAULT (N'draft') FOR [serial_release_status_code];
ALTER TABLE [bookwriter].[serial_release] ADD CONSTRAINT [DF_bookwriter_serial_release_read_count_cached] DEFAULT ((0)) FOR [read_count_cached];
ALTER TABLE [bookwriter].[serial_release] ADD CONSTRAINT [DF_bookwriter_serial_release_unique_reader_count_cached] DEFAULT ((0)) FOR [unique_reader_count_cached];
ALTER TABLE [bookwriter].[serial_release] ADD CONSTRAINT [DF_bookwriter_serial_release_reaction_count_cached] DEFAULT ((0)) FOR [reaction_count_cached];
ALTER TABLE [bookwriter].[serial_release] ADD CONSTRAINT [DF_bookwriter_serial_release_comment_count_cached] DEFAULT ((0)) FOR [comment_count_cached];
ALTER TABLE [bookwriter].[serial_release] ADD CONSTRAINT [DF_bookwriter_serial_release_preview_view_count_cached] DEFAULT ((0)) FOR [preview_view_count_cached];
ALTER TABLE [bookwriter].[serial_release] ADD CONSTRAINT [DF_bookwriter_serial_release_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[serial_release] ADD CONSTRAINT [DF_bookwriter_serial_release_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[serial_release]
    ADD CONSTRAINT [FK_bookwriter_serial_release_link_bookwriter_chapter_id]
    FOREIGN KEY ([link_bookwriter_chapter_id])
    REFERENCES [bookwriter].[chapter] ([bookwriter_chapter_id]);
ALTER TABLE [bookwriter].[serial_release]
    ADD CONSTRAINT [FK_bookwriter_serial_release_link_bookwriter_coll_book_id]
    FOREIGN KEY ([link_bookwriter_coll_book_id])
    REFERENCES [bookwriter].[coll_book] ([bookwriter_coll_book_id]);
GO
CREATE UNIQUE NONCLUSTERED INDEX [UX_bookwriter_serial_release_public_chapter_slug]
    ON [bookwriter].[serial_release] ([public_chapter_slug])
    WHERE [public_chapter_slug] IS NOT NULL;
CREATE NONCLUSTERED INDEX [IX_bookwriter_serial_release_book_status]
    ON [bookwriter].[serial_release] ([link_bookwriter_coll_book_id], [serial_release_status_code], [scheduled_at]);
GO


/* ================================================================
   SECTION 6 — ENGAGEMENT TABLES
   ================================================================ */

/* ---------- 28. engagement_serial_subscriber ------------------ */
CREATE TABLE [bookwriter].[engagement_serial_subscriber]
(
    [bookwriter_engagement_serial_subscriber_id]   BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_coll_book_id]                 BIGINT NOT NULL,
    [link_user_profile_id]                         BIGINT NOT NULL,
    [subscribed_at]                                DATETIME2(0) NOT NULL,
    [unsubscribed_at]                              DATETIME2(0) NULL,
    [email_notifications_enabled]                  BIT NOT NULL,
    [is_active]                                    BIT NOT NULL,
    [created_at]                                   DATETIME2(0) NOT NULL,
    [updated_at]                                   DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_engagement_serial_subscriber]
        PRIMARY KEY CLUSTERED ([bookwriter_engagement_serial_subscriber_id] ASC),
    CONSTRAINT [UX_bookwriter_engagement_serial_subscriber_book_user]
        UNIQUE ([link_bookwriter_coll_book_id], [link_user_profile_id])
);
GO
ALTER TABLE [bookwriter].[engagement_serial_subscriber] ADD CONSTRAINT [DF_bookwriter_engagement_serial_subscriber_email_notifications_enabled] DEFAULT ((1)) FOR [email_notifications_enabled];
ALTER TABLE [bookwriter].[engagement_serial_subscriber] ADD CONSTRAINT [DF_bookwriter_engagement_serial_subscriber_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[engagement_serial_subscriber] ADD CONSTRAINT [DF_bookwriter_engagement_serial_subscriber_subscribed_at] DEFAULT (SYSDATETIME()) FOR [subscribed_at];
ALTER TABLE [bookwriter].[engagement_serial_subscriber] ADD CONSTRAINT [DF_bookwriter_engagement_serial_subscriber_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[engagement_serial_subscriber]
    ADD CONSTRAINT [FK_bookwriter_engagement_serial_subscriber_link_bookwriter_coll_book_id]
    FOREIGN KEY ([link_bookwriter_coll_book_id])
    REFERENCES [bookwriter].[coll_book] ([bookwriter_coll_book_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_engagement_serial_subscriber_user]
    ON [bookwriter].[engagement_serial_subscriber] ([link_user_profile_id], [is_active]);
GO


/* ---------- 29. engagement_serial_reaction -------------------- */
CREATE TABLE [bookwriter].[engagement_serial_reaction]
(
    [bookwriter_engagement_serial_reaction_id]    BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_serial_release_id]           BIGINT NOT NULL,
    [link_user_profile_id]                        BIGINT NOT NULL,
    [reaction_kind_code]                          NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [is_active]                                   BIT NOT NULL,
    [created_at]                                  DATETIME2(0) NOT NULL,
    [updated_at]                                  DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_engagement_serial_reaction]
        PRIMARY KEY CLUSTERED ([bookwriter_engagement_serial_reaction_id] ASC),
    CONSTRAINT [UX_bookwriter_engagement_serial_reaction_release_user_kind]
        UNIQUE ([link_bookwriter_serial_release_id], [link_user_profile_id], [reaction_kind_code])
);
GO
ALTER TABLE [bookwriter].[engagement_serial_reaction] ADD CONSTRAINT [DF_bookwriter_engagement_serial_reaction_reaction_kind_code] DEFAULT (N'heart') FOR [reaction_kind_code];
ALTER TABLE [bookwriter].[engagement_serial_reaction] ADD CONSTRAINT [DF_bookwriter_engagement_serial_reaction_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[engagement_serial_reaction] ADD CONSTRAINT [DF_bookwriter_engagement_serial_reaction_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[engagement_serial_reaction]
    ADD CONSTRAINT [FK_bookwriter_engagement_serial_reaction_link_bookwriter_serial_release_id]
    FOREIGN KEY ([link_bookwriter_serial_release_id])
    REFERENCES [bookwriter].[serial_release] ([bookwriter_serial_release_id]);
GO


/* ---------- 30. engagement_serial_comment --------------------- */
CREATE TABLE [bookwriter].[engagement_serial_comment]
(
    [bookwriter_engagement_serial_comment_id]               BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_serial_release_id]                     BIGINT NOT NULL,
    [link_user_profile_id]                                  BIGINT NOT NULL,
    [parent_link_bookwriter_engagement_serial_comment_id]   BIGINT NULL,
    [comment_text]                                          NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [is_pinned]                                             BIT NOT NULL,
    [is_active]                                             BIT NOT NULL,
    [created_at]                                            DATETIME2(0) NOT NULL,
    [updated_at]                                            DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_engagement_serial_comment]
        PRIMARY KEY CLUSTERED ([bookwriter_engagement_serial_comment_id] ASC)
);
GO
ALTER TABLE [bookwriter].[engagement_serial_comment] ADD CONSTRAINT [DF_bookwriter_engagement_serial_comment_is_pinned] DEFAULT ((0)) FOR [is_pinned];
ALTER TABLE [bookwriter].[engagement_serial_comment] ADD CONSTRAINT [DF_bookwriter_engagement_serial_comment_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[engagement_serial_comment] ADD CONSTRAINT [DF_bookwriter_engagement_serial_comment_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[engagement_serial_comment]
    ADD CONSTRAINT [FK_bookwriter_engagement_serial_comment_link_bookwriter_serial_release_id]
    FOREIGN KEY ([link_bookwriter_serial_release_id])
    REFERENCES [bookwriter].[serial_release] ([bookwriter_serial_release_id]);
ALTER TABLE [bookwriter].[engagement_serial_comment]
    ADD CONSTRAINT [FK_bookwriter_engagement_serial_comment_parent]
    FOREIGN KEY ([parent_link_bookwriter_engagement_serial_comment_id])
    REFERENCES [bookwriter].[engagement_serial_comment] ([bookwriter_engagement_serial_comment_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_engagement_serial_comment_release_created]
    ON [bookwriter].[engagement_serial_comment] ([link_bookwriter_serial_release_id], [created_at] DESC, [is_active]);
GO


/* ---------- 31. engagement_serial_view (per-read tracking) ---- */
CREATE TABLE [bookwriter].[engagement_serial_view]
(
    [bookwriter_engagement_serial_view_id]    BIGINT IDENTITY(1,1) NOT NULL,
    [link_bookwriter_serial_release_id]       BIGINT NOT NULL,
    [link_user_profile_id]                    BIGINT NULL,
    [view_session_hash]                       NVARCHAR(64) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [view_seconds]                            INT NULL,
    [view_completion_pct]                     TINYINT NULL,
    [view_referrer_code]                      NVARCHAR(30) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [view_device_code]                        NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [created_at]                              DATETIME2(0) NOT NULL,

    CONSTRAINT [PK_bookwriter_engagement_serial_view]
        PRIMARY KEY CLUSTERED ([bookwriter_engagement_serial_view_id] ASC)
);
GO
ALTER TABLE [bookwriter].[engagement_serial_view] ADD CONSTRAINT [DF_bookwriter_engagement_serial_view_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO
ALTER TABLE [bookwriter].[engagement_serial_view]
    ADD CONSTRAINT [FK_bookwriter_engagement_serial_view_link_bookwriter_serial_release_id]
    FOREIGN KEY ([link_bookwriter_serial_release_id])
    REFERENCES [bookwriter].[serial_release] ([bookwriter_serial_release_id]);
GO
CREATE NONCLUSTERED INDEX [IX_bookwriter_engagement_serial_view_release_created]
    ON [bookwriter].[engagement_serial_view] ([link_bookwriter_serial_release_id], [created_at] DESC);
CREATE NONCLUSTERED INDEX [IX_bookwriter_engagement_serial_view_user]
    ON [bookwriter].[engagement_serial_view] ([link_user_profile_id], [created_at] DESC)
    WHERE [link_user_profile_id] IS NOT NULL;
CREATE NONCLUSTERED INDEX [IX_bookwriter_engagement_serial_view_session_hash]
    ON [bookwriter].[engagement_serial_view] ([view_session_hash])
    WHERE [view_session_hash] IS NOT NULL;
GO


/* ================================================================
   SECTION 7 — ENGINE TABLE
   ================================================================ */

/* ---------- 32. eng_user_streak ------------------------------- */
CREATE TABLE [bookwriter].[eng_user_streak]
(
    [bookwriter_eng_user_streak_id]   BIGINT IDENTITY(1,1) NOT NULL,
    [link_user_profile_id]            BIGINT NOT NULL,
    [streak_date]                     DATE NOT NULL,
    [streak_words_written]            INT NOT NULL,
    [streak_minutes_active]           INT NOT NULL,
    [streak_session_count]            INT NOT NULL,
    [streak_goal_met]                 BIT NOT NULL,
    [is_active]                       BIT NOT NULL,
    [created_at]                      DATETIME2(0) NOT NULL,
    [updated_at]                      DATETIME2(0) NULL,

    CONSTRAINT [PK_bookwriter_eng_user_streak]
        PRIMARY KEY CLUSTERED ([bookwriter_eng_user_streak_id] ASC),
    CONSTRAINT [UX_bookwriter_eng_user_streak_user_date]
        UNIQUE ([link_user_profile_id], [streak_date])
);
GO
ALTER TABLE [bookwriter].[eng_user_streak] ADD CONSTRAINT [DF_bookwriter_eng_user_streak_streak_words_written] DEFAULT ((0)) FOR [streak_words_written];
ALTER TABLE [bookwriter].[eng_user_streak] ADD CONSTRAINT [DF_bookwriter_eng_user_streak_streak_minutes_active] DEFAULT ((0)) FOR [streak_minutes_active];
ALTER TABLE [bookwriter].[eng_user_streak] ADD CONSTRAINT [DF_bookwriter_eng_user_streak_streak_session_count] DEFAULT ((0)) FOR [streak_session_count];
ALTER TABLE [bookwriter].[eng_user_streak] ADD CONSTRAINT [DF_bookwriter_eng_user_streak_streak_goal_met] DEFAULT ((0)) FOR [streak_goal_met];
ALTER TABLE [bookwriter].[eng_user_streak] ADD CONSTRAINT [DF_bookwriter_eng_user_streak_is_active] DEFAULT ((1)) FOR [is_active];
ALTER TABLE [bookwriter].[eng_user_streak] ADD CONSTRAINT [DF_bookwriter_eng_user_streak_created_at] DEFAULT (SYSDATETIME()) FOR [created_at];
GO


/* ================================================================
   SECTION 8 — SEED DATA (reference tables)
   ================================================================ */

-- 1. Book status
INSERT INTO [bookwriter].[ref_book_status]
    ([book_status_code], [book_status_name_en], [book_status_name_bn], [book_status_description], [sort_order])
VALUES
    (N'draft',      N'Draft',       N'খসড়া',          N'Private to the author. The default state for new books.', 1),
    (N'in_review',  N'In review',   N'পর্যালোচনাধীন', N'Submitted for staff review before publishing.',           2),
    (N'published',  N'Published',   N'প্রকাশিত',       N'Visible per book visibility rules.',                       3),
    (N'archived',   N'Archived',    N'আর্কাইভড',       N'Hidden but recoverable.',                                  4);
GO

-- 2. Chapter status
INSERT INTO [bookwriter].[ref_chapter_status]
    ([chapter_status_code], [chapter_status_name_en], [chapter_status_name_bn], [chapter_status_dot_color_hex], [sort_order])
VALUES
    (N'blank',     N'Blank',     N'ফাঁকা',     N'#8b2a1f', 1),
    (N'outline',   N'Outline',   N'রূপরেখা',   N'#8b2a1f', 2),
    (N'draft',     N'Draft',     N'খসড়া',     N'#c8945a', 3),
    (N'done',      N'Done',      N'সম্পন্ন',   N'#5a6b3f', 4);
GO

-- 3. Chapter visibility
INSERT INTO [bookwriter].[ref_chapter_visibility]
    ([chapter_visibility_code], [chapter_visibility_name_en], [chapter_visibility_name_bn], [chapter_visibility_description], [sort_order])
VALUES
    (N'private',  N'Private',          N'ব্যক্তিগত', N'Only the author can see this chapter.',                  1),
    (N'beta',     N'Beta readers',     N'বিটা পাঠক',  N'Visible to invited beta readers per their permission.', 2),
    (N'public',   N'Public',           N'সর্বজনীন',    N'Live on the public gallery.',                            3);
GO

-- 4. Bible category
INSERT INTO [bookwriter].[ref_bible_category]
    ([bible_category_code], [bible_category_name_en], [bible_category_name_bn], [bible_category_icon], [sort_order])
VALUES
    (N'characters', N'Characters',           N'চরিত্র',       N'👤', 1),
    (N'locations',  N'Locations',            N'স্থান',         N'📍', 2),
    (N'objects',    N'Objects & Artifacts',  N'বস্তু',         N'🗝',  3),
    (N'research',   N'Research',             N'গবেষণা',       N'📚', 4),
    (N'lore',       N'Lore & Timeline',      N'ঐতিহ্য',        N'⏳', 5);
GO

-- 5. Cover templates (the 6 from the Inkwell design)
INSERT INTO [bookwriter].[ref_cover_template]
    ([cover_template_code], [cover_template_name_en], [cover_template_description], [sort_order])
VALUES
    (N'classical', N'Classical',  N'Centered title with framed border and ornament.',                1),
    (N'modern',    N'Modern',     N'Bold left-aligned title at the bottom, accent bar at the top.',  2),
    (N'photo',     N'Landscape',  N'Photographic background with overlay gradient and italic title.',3),
    (N'minimal',   N'Minimal',    N'Top-aligned plain title with circle accent and bottom author.',  4),
    (N'vintage',   N'Vintage',    N'Centered italic-bold title inside a double border.',             5),
    (N'type',      N'Typographic',N'Display-only initial monogram.',                                  6);
GO

-- 6. Cover palettes (the 6 from the Inkwell design)
INSERT INTO [bookwriter].[ref_cover_palette]
    ([cover_palette_code], [cover_palette_name_en], [cover_palette_bg_hex], [cover_palette_fg_hex], [cover_palette_accent_hex], [sort_order])
VALUES
    (N'paper_ink_red',   N'Paper · Ink · Red',  N'#f4ede0', N'#1a1612', N'#8b2a1f', 1),
    (N'ink_paper_coral', N'Ink · Paper · Coral',N'#1a1612', N'#f4ede0', N'#c46a5d', 2),
    (N'moss_cream_gold', N'Moss · Cream · Gold',N'#2d3b2d', N'#e8dcc0', N'#c8945a', 3),
    (N'terracotta',      N'Terracotta',         N'#c47a4f', N'#f7e8d0', N'#3d1f15', 4),
    (N'midnight_amber',  N'Midnight · Amber',   N'#1c2530', N'#d4c4a0', N'#a03030', 5),
    (N'cream_brick_moss',N'Cream · Brick · Moss',N'#e8dcc0',N'#3d1f15', N'#5a6b3f', 6);
GO

-- 7. Cover backgrounds (the 8 from the Inkwell design)
INSERT INTO [bookwriter].[ref_cover_background]
    ([cover_background_code], [cover_background_name_en], [sort_order])
VALUES
    (N'solid',   N'Solid',          1),
    (N'grad-1',  N'Warm gradient',  2),
    (N'grad-2',  N'Moss gradient',  3),
    (N'grad-3',  N'Ink gradient',   4),
    (N'noise',   N'Textured',       5),
    (N'dots',    N'Dotted',         6),
    (N'stripes', N'Stripes',        7),
    (N'upload',  N'Upload image',   8);
GO

-- 8. Cover fonts (the 4 from the Inkwell design)
INSERT INTO [bookwriter].[ref_cover_font]
    ([cover_font_code], [cover_font_name_en], [cover_font_family_css], [cover_font_style_css], [cover_font_weight_css], [sort_order])
VALUES
    (N'serif',  N'Serif',   N'"Fraunces", serif',     N'normal', N'400', 1),
    (N'italic', N'Italic',  N'"Fraunces", serif',     N'italic', N'400', 2),
    (N'body',   N'Classic', N'"EB Garamond", serif',  N'normal', N'500', 3),
    (N'mono',   N'Mono',    N'"JetBrains Mono", monospace', N'normal', N'500', 4);
GO

-- 9. Beta permissions
INSERT INTO [bookwriter].[ref_beta_permission]
    ([beta_permission_code], [beta_permission_name_en], [beta_permission_name_bn], [beta_permission_description], [sort_order])
VALUES
    (N'read',     N'Read only',                N'শুধু পড়া',     N'They can read every published chapter. No feedback, no notes.',                              1),
    (N'comment',  N'Read & leave margin notes',N'মন্তব্য',        N'They can highlight passages and leave comments. They cannot edit the manuscript.',          2),
    (N'suggest',  N'Read & suggest edits',     N'সম্পাদনা প্রস্তাব',N'Suggestions come to the author as tracked changes that can be accepted or rejected.',     3);
GO

-- 10. Serial release status
INSERT INTO [bookwriter].[ref_serial_release_status]
    ([serial_release_status_code], [serial_release_status_name_en], [serial_release_status_name_bn], [serial_release_status_chip_color_hex], [sort_order])
VALUES
    (N'draft',        N'Draft',        N'খসড়া',     N'#b3a692', 1),
    (N'scheduled',    N'Scheduled',    N'নির্ধারিত', N'#c8945a', 2),
    (N'live',         N'Live',         N'প্রকাশিত',  N'#5a6b3f', 3),
    (N'unpublished',  N'Unpublished',  N'অপ্রকাশিত', N'#8b2a1f', 4);
GO

-- 11. Publish cadence
INSERT INTO [bookwriter].[ref_publish_cadence]
    ([publish_cadence_code], [publish_cadence_name_en], [publish_cadence_interval_days], [publish_cadence_weekday], [sort_order])
VALUES
    (N'daily',       N'Daily',           1,  NULL, 1),
    (N'weekly_mon',  N'Weekly · Monday', 7,  1,    2),
    (N'weekly_tue',  N'Weekly · Tuesday',7,  2,    3),
    (N'weekly_wed',  N'Weekly · Wednesday',7,3,    4),
    (N'weekly_thu',  N'Weekly · Thursday',7, 4,    5),
    (N'weekly_fri',  N'Weekly · Friday', 7,  5,    6),
    (N'weekly_sat',  N'Weekly · Saturday',7, 6,    7),
    (N'weekly_sun',  N'Weekly · Sunday', 7,  7,    8),
    (N'biweekly',    N'Biweekly',        14, NULL, 9),
    (N'monthly',     N'Monthly',         30, NULL, 10),
    (N'manual',      N'Manual',          NULL,NULL,11);
GO

-- 12. Act structure (3-act default; authors can extend)
INSERT INTO [bookwriter].[ref_act_structure]
    ([act_structure_code], [act_structure_name_en], [act_structure_name_bn], [act_structure_subtitle], [sort_order])
VALUES
    (N'act_1_setup',          N'Act I',  N'প্রথম অঙ্ক', N'Setup',         1),
    (N'act_2_confrontation',  N'Act II', N'দ্বিতীয় অঙ্ক', N'Confrontation', 2),
    (N'act_3_resolution',     N'Act III',N'তৃতীয় অঙ্ক', N'Resolution',    3),
    (N'unplaced',             N'Unplaced',N'অশ্রেণিত',  N'Cards not yet pinned to an act.', 4);
GO

-- 13. View referrer kinds
INSERT INTO [bookwriter].[ref_view_referrer]
    ([view_referrer_code], [view_referrer_name_en], [sort_order])
VALUES
    (N'direct',   N'Direct',         1),
    (N'search',   N'Search engine',  2),
    (N'social',   N'Social media',   3),
    (N'email',    N'Email',          4),
    (N'rss',      N'RSS feed',       5),
    (N'internal', N'Inkwell · internal', 6),
    (N'unknown',  N'Unknown',        7);
GO

-- 14. View device kinds
INSERT INTO [bookwriter].[ref_view_device]
    ([view_device_code], [view_device_name_en], [sort_order])
VALUES
    (N'mobile',  N'Mobile',  1),
    (N'tablet',  N'Tablet',  2),
    (N'desktop', N'Desktop', 3),
    (N'unknown', N'Unknown', 4);
GO


/* ================================================================
   SECTION 9 — TABLE DESCRIPTIONS (extended properties)
   ================================================================ */

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Lifecycle states for a book. Values: draft, in_review, published, archived. Display values via the name_en/name_bn columns.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_book_status';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Per-chapter lifecycle. Values: blank, outline, draft, done. Each value carries a dot color used in the chapter sidebar (.ch-dot.draft / .ch-dot.done / .ch-dot.new).',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_chapter_status';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Per-chapter visibility scope: private (author only), beta (invited readers), public (live on the gallery).',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_chapter_visibility';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The 5 categories shown in the Bible left rail: characters, locations, objects, research, lore.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_bible_category';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The 6 cover layout templates from the Cover Studio: classical, modern, photo, minimal, vintage, type. Each template owns its own CSS layout in page-inkwell.css.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_cover_template';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The 6 preset color palettes shown as 3-strip swatches in the Cover Studio. Each row stores bg / fg / accent as hex strings so the front-end can apply them without joining.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_cover_palette';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The 8 background styles in the Cover Studio: solid, grad-1, grad-2, grad-3, noise, dots, stripes, upload. The "upload" code triggers a file picker and stores the resulting URL on book_cover_design.cover_custom_image_url.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_cover_background';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The 4 cover title fonts: serif, italic (Fraunces italic), body (EB Garamond), mono (JetBrains Mono).',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_cover_font';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Beta-reader permission scopes shown as radio cards in the share modal: read, comment, suggest.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_beta_permission';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Per-chapter publish lifecycle in the public Gallery: draft, scheduled, live, unpublished. Each carries a chip color used in the gallery serial list.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_serial_release_status';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'How often the next chapter drops in the public Gallery: daily, weekly_<weekday>, biweekly, monthly, manual. The interval_days + weekday columns drive the auto-scheduler.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_publish_cadence';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Story acts used to group plot cards in the corkboard left rail. Default is the 3-act structure plus an "unplaced" bucket.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_act_structure';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Where a public read came from. Used to drive analytics charts.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_view_referrer';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Device class behind a public read. Derived server-side from the user agent at view time.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'ref_view_device';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'A book authored on the platform. Owned by exactly one user (link_owner_user_profile_id). Holds title/subtitle/author display in both Bengali and English, lifecycle status, total/daily word goals, public slug, cover image URL, and cached aggregates (word + chapter counts) for fast list rendering. This is the single main entity in the bookwriter schema; everything else hangs off this row.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'coll_book';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'A chapter inside a book — sub-entity of coll_book. Stores both rich (chapter_text_html) and plain (chapter_text_plain) text — plain is used for word counting, search, and beta-comment anchoring. sort_order drives the sidebar order; chapter_number is the displayed Roman/Arabic number.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'chapter';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Version-history entries for a chapter. snapshot_kind_code is "auto" (debounced auto-save) or "manual" (writer named the version, e.g., "Before rewrite of ornament passage"). snapshot_word_count_diff stores the delta against the previous snapshot for the +412 / -74 chips in the Snapshots panel.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'chapter_snapshot';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Generic Book-Bible entry — one row per character / location / object / research item / lore note. Discriminated by bible_category_code. Free-form attributes (Wants, Needs, Fatal Flaw, Age, Height, etc.) live in entry_attributes_json so writers can extend the attr-grid without schema changes.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'bible_entry';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Index card on the corkboard / Plot view. Optional link to a chapter once the scene gets drafted. card_tag is a free-form label (e.g., "Act I · Setup", "unplaced") shown beneath the card body.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'plot_card';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Writer''s self-notes on a chapter — the "Margin Notes" desk card. Distinct from beta_comment (which comes from beta readers).',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'margin_note';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'1:1 with coll_book — the saved state of the Cover Studio (template, palette, background, font, title size, letter spacing, optional palette overrides, optional uploaded image). cover_rendered_preview_url caches the most recent rendered PNG.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'book_cover_design';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'A shareable link the writer issued to send the manuscript to beta readers. share_link_token is a high-entropy random string that becomes the public slug for the share. Permission is enforced server-side on every reader request.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'beta_share_link';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'A specific person granted beta access. May be either an existing platform user (link_reader_user_profile_id) or an external email invite. Permission is per-reader and overrides any link-level permission.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'beta_reader';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'A comment or suggestion left by a beta reader, anchored to a span of chapter_text_plain via comment_anchor_offset / length. comment_kind_code is "comment" or "suggestion"; suggestion_replacement_text holds tracked-change content when the reader proposes new wording.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'beta_comment';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'One row per Pomodoro / writing sprint. sprint_planned_minutes is the chosen 10/25/45/60. sprint_completed = 1 only if the timer ran out without being cancelled. sprint_words_added is computed by diffing the chapter''s word count between start and end.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'sprint_session';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'One row per writing session per book per day. Aggregates words added and active editor seconds. Used to power the "words today / minutes at the desk" desk card and the daily streak engine.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'writing_session';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'1:1 with chapter (UNIQUE) — the public-publishing state of a chapter. read/reaction/comment counts are cached aggregates updated by background tasks; the source of truth lives in engagement_serial_view / engagement_serial_reaction / engagement_serial_comment.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'serial_release';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'A user who follows a public book and gets notified on new chapter drops. UNIQUE (book, user). is_active = 0 represents an unsubscribe (we keep the row for analytics).',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'engagement_serial_subscriber';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'A reader reaction (heart by default) on a public chapter release. UNIQUE (release, user, kind) so toggling on/off updates is_active rather than spawning duplicates.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'engagement_serial_reaction';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'A public reader''s comment on a chapter. parent_link_*_comment_id allows threaded replies. is_pinned lets the author elevate a featured comment.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'engagement_serial_comment';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Per-read tracking on a public chapter release. Stores the bare minimum: who (user_profile_id OR a hashed anonymous session), how engaged (seconds + completion %), and where they came from (referrer + device). Aggregations roll up into serial_release.*_cached counters via batch jobs. Will grow large — partition by created_at if a chapter goes viral.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'engagement_serial_view';
GO
EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Daily writing streak — one row per user per active day. Drives the 7-day streak strip on the desk and the "X days of showing up" copy. UNIQUE (user, streak_date) so a single day is idempotent.',
    @level0type = N'SCHEMA', @level0name = N'bookwriter',
    @level1type = N'TABLE',  @level1name = N'eng_user_streak';
GO


/* ================================================================
   END — bookwriter v01 schema
   ================================================================ */

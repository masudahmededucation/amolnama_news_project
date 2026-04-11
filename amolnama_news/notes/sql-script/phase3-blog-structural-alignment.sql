-- ============================================================================
-- Phase 3 — Blog Structural Alignment (Option X: additive, safe)
--
-- Brings 5 blog collection tables into structural alignment with the
-- reference gold standard (stories/coll_story). Stories already has
-- everything; this script adds the missing fields on the other 5.
--
-- Option X means: additive only. No column renames, no data rewrites,
-- no API contract changes. Every new column is either:
--   - NULLable (strings)
--   - NOT NULL with a sensible DEFAULT (counters, flags)
--   - A PERSISTED computed column (is_published mirrors *_status fields)
--
-- Ran: 2026-04-11
-- Result: SUCCESS (applied via SSMS before this file was archived).
--
-- WHY computed is_published for poem/destination/media but not art/stories:
--   Stories + art store is_published as a real boolean column already.
--   Poem/destination/media use string status codes (poem_status_code,
--   destination_status, media_status). Adding a parallel is_published
--   boolean would create two sources of truth that could drift. A
--   PERSISTED computed column stays in sync automatically — SQL Server
--   recomputes on UPDATE, no triggers needed. Shared Python code reads
--   row.is_published (via @property on the Django model) and doesn't
--   care which mechanism supplies the value.
--
-- WHY no is_published on debate:
--   A debate lifecycle has more states than published/unpublished
--   (scheduled, active, closed, archived, winner_decided). The existing
--   link_blog_debate_ref_topic_status_id FK models this correctly.
--   Forcing is_published onto debate would lose information.
--
-- WHY debate gets only the 4 counters:
--   Cross-content features (bookmarks, likes, views, comments) need
--   uniform fields. Debate-specific vote counts (topic_upvote_count,
--   blue_*, red_*) stay separate because they have different semantics.
-- ============================================================================

SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    -- ========================================================================
    -- Part A — blog_art.coll_artwork: add summary_bn/en
    -- (Already had is_published, is_active, is_featured, all counters.)
    -- ========================================================================
    IF COL_LENGTH('[blog_art].[coll_artwork]', 'artwork_summary_bn') IS NULL
        ALTER TABLE [blog_art].[coll_artwork] ADD artwork_summary_bn NVARCHAR(500) NULL;
    IF COL_LENGTH('[blog_art].[coll_artwork]', 'artwork_summary_en') IS NULL
        ALTER TABLE [blog_art].[coll_artwork] ADD artwork_summary_en NVARCHAR(500) NULL;

    -- ========================================================================
    -- Part B — blog_poem.coll_poem_entry: 6 plain columns + computed is_published
    -- ========================================================================
    IF COL_LENGTH('[blog_poem].[coll_poem_entry]', 'is_active') IS NULL
        ALTER TABLE [blog_poem].[coll_poem_entry] ADD is_active BIT NOT NULL CONSTRAINT DF_poem_is_active DEFAULT 1;
    IF COL_LENGTH('[blog_poem].[coll_poem_entry]', 'is_featured') IS NULL
        ALTER TABLE [blog_poem].[coll_poem_entry] ADD is_featured BIT NOT NULL CONSTRAINT DF_poem_is_featured DEFAULT 0;
    IF COL_LENGTH('[blog_poem].[coll_poem_entry]', 'bookmark_count') IS NULL
        ALTER TABLE [blog_poem].[coll_poem_entry] ADD bookmark_count INT NOT NULL CONSTRAINT DF_poem_bookmark_count DEFAULT 0;
    IF COL_LENGTH('[blog_poem].[coll_poem_entry]', 'comment_count') IS NULL
        ALTER TABLE [blog_poem].[coll_poem_entry] ADD comment_count INT NOT NULL CONSTRAINT DF_poem_comment_count DEFAULT 0;
    IF COL_LENGTH('[blog_poem].[coll_poem_entry]', 'poem_summary_bn') IS NULL
        ALTER TABLE [blog_poem].[coll_poem_entry] ADD poem_summary_bn NVARCHAR(500) NULL;
    IF COL_LENGTH('[blog_poem].[coll_poem_entry]', 'poem_summary_en') IS NULL
        ALTER TABLE [blog_poem].[coll_poem_entry] ADD poem_summary_en NVARCHAR(500) NULL;
    IF COL_LENGTH('[blog_poem].[coll_poem_entry]', 'is_published') IS NULL
        ALTER TABLE [blog_poem].[coll_poem_entry]
            ADD is_published AS (CASE WHEN poem_status_code = N'published' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END) PERSISTED;

    -- ========================================================================
    -- Part C — blog_bangladesh.coll_destination: 2 plain columns + computed is_published
    -- ========================================================================
    IF COL_LENGTH('[blog_bangladesh].[coll_destination]', 'is_active') IS NULL
        ALTER TABLE [blog_bangladesh].[coll_destination] ADD is_active BIT NOT NULL CONSTRAINT DF_destination_is_active DEFAULT 1;
    IF COL_LENGTH('[blog_bangladesh].[coll_destination]', 'comment_count') IS NULL
        ALTER TABLE [blog_bangladesh].[coll_destination] ADD comment_count INT NOT NULL CONSTRAINT DF_destination_comment_count DEFAULT 0;
    IF COL_LENGTH('[blog_bangladesh].[coll_destination]', 'is_published') IS NULL
        ALTER TABLE [blog_bangladesh].[coll_destination]
            ADD is_published AS (CASE WHEN destination_status = N'published' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END) PERSISTED;

    -- ========================================================================
    -- Part D — blog_bangladesh.coll_media_entry: 4 plain columns + slug + computed is_published
    -- ========================================================================
    IF COL_LENGTH('[blog_bangladesh].[coll_media_entry]', 'is_active') IS NULL
        ALTER TABLE [blog_bangladesh].[coll_media_entry] ADD is_active BIT NOT NULL CONSTRAINT DF_media_is_active DEFAULT 1;
    IF COL_LENGTH('[blog_bangladesh].[coll_media_entry]', 'is_featured') IS NULL
        ALTER TABLE [blog_bangladesh].[coll_media_entry] ADD is_featured BIT NOT NULL CONSTRAINT DF_media_is_featured DEFAULT 0;
    IF COL_LENGTH('[blog_bangladesh].[coll_media_entry]', 'bookmark_count') IS NULL
        ALTER TABLE [blog_bangladesh].[coll_media_entry] ADD bookmark_count INT NOT NULL CONSTRAINT DF_media_bookmark_count DEFAULT 0;
    IF COL_LENGTH('[blog_bangladesh].[coll_media_entry]', 'media_slug') IS NULL
        ALTER TABLE [blog_bangladesh].[coll_media_entry] ADD media_slug NVARCHAR(400) NULL;
    IF COL_LENGTH('[blog_bangladesh].[coll_media_entry]', 'is_published') IS NULL
        ALTER TABLE [blog_bangladesh].[coll_media_entry]
            ADD is_published AS (CASE WHEN media_status = N'published' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END) PERSISTED;

    -- ========================================================================
    -- Part E — blog_debate.coll_topic: 4 universal counters only
    -- (No is_published / is_featured / slug / summary — these don't fit debate.)
    -- ========================================================================
    IF COL_LENGTH('[blog_debate].[coll_topic]', 'bookmark_count') IS NULL
        ALTER TABLE [blog_debate].[coll_topic] ADD bookmark_count INT NOT NULL CONSTRAINT DF_topic_bookmark_count DEFAULT 0;
    IF COL_LENGTH('[blog_debate].[coll_topic]', 'like_count') IS NULL
        ALTER TABLE [blog_debate].[coll_topic] ADD like_count INT NOT NULL CONSTRAINT DF_topic_like_count DEFAULT 0;
    IF COL_LENGTH('[blog_debate].[coll_topic]', 'view_count') IS NULL
        ALTER TABLE [blog_debate].[coll_topic] ADD view_count INT NOT NULL CONSTRAINT DF_topic_view_count DEFAULT 0;
    IF COL_LENGTH('[blog_debate].[coll_topic]', 'comment_count') IS NULL
        ALTER TABLE [blog_debate].[coll_topic] ADD comment_count INT NOT NULL CONSTRAINT DF_topic_comment_count DEFAULT 0;

    COMMIT TRANSACTION;
    PRINT 'phase 3 blog structural alignment: SUCCESS';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT 'phase 3 blog structural alignment: FAILED — ' + @msg;
    THROW;
END CATCH;

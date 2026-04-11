-- ============================================================================
-- Unified subcategory cleanup — drop vestigial per-app category FK columns +
-- rename the one live column that was being used in place.
--
-- Context: Plan B migration moved all 4 blog apps (art, stories, poem,
-- bangladesh) onto the unified [content].[ref_content_subcategory] table.
-- Per-app category columns became dead weight (no code reads/writes them)
-- except for stories' age_group column which was repurposed in place and
-- just needed renaming to match its new semantic meaning.
--
-- Ran: 2026-04-11
-- Result: SUCCESS
-- ============================================================================

SET XACT_ABORT ON;  -- force rollback on any runtime error (some errors
                    -- don't auto-rollback in SQL Server without this)
BEGIN TRY
    BEGIN TRANSACTION;

    -- ------------------------------------------------------------------------
    -- Step 1: drop 4 dead columns
    -- No FK constraints exist on these columns (verified via sys.foreign_keys).
    -- Order: DROP INDEX first, then ALTER TABLE DROP COLUMN.
    -- Guards: IF EXISTS / COL_LENGTH so script is idempotent (safe to re-run).
    -- ------------------------------------------------------------------------

    -- art
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_art_coll_artwork_link_art_category_id')
        DROP INDEX IX_art_coll_artwork_link_art_category_id ON [blog_art].[coll_artwork];
    IF COL_LENGTH('[blog_art].[coll_artwork]', 'link_blog_art_ref_art_category_id') IS NOT NULL
        ALTER TABLE [blog_art].[coll_artwork] DROP COLUMN link_blog_art_ref_art_category_id;

    -- stories (category — dead; age_group lives on, see Step 2)
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_stories_coll_story_link_story_category_id')
        DROP INDEX IX_stories_coll_story_link_story_category_id ON [blog_stories].[coll_story];
    IF COL_LENGTH('[blog_stories].[coll_story]', 'link_blog_stories_ref_story_category_id') IS NOT NULL
        ALTER TABLE [blog_stories].[coll_story] DROP COLUMN link_blog_stories_ref_story_category_id;

    -- poem
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_poem_coll_poem_entry_link_poem_ref_poem_category_id')
        DROP INDEX IX_poem_coll_poem_entry_link_poem_ref_poem_category_id ON [blog_poem].[coll_poem_entry];
    IF COL_LENGTH('[blog_poem].[coll_poem_entry]', 'link_blog_poem_ref_poem_category_id') IS NOT NULL
        ALTER TABLE [blog_poem].[coll_poem_entry] DROP COLUMN link_blog_poem_ref_poem_category_id;

    -- bangladesh
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bangladesh_coll_destination_category')
        DROP INDEX IX_bangladesh_coll_destination_category ON [blog_bangladesh].[coll_destination];
    IF COL_LENGTH('[blog_bangladesh].[coll_destination]', 'link_blog_bangladesh_ref_destination_category_id') IS NOT NULL
        ALTER TABLE [blog_bangladesh].[coll_destination] DROP COLUMN link_blog_bangladesh_ref_destination_category_id;

    -- ------------------------------------------------------------------------
    -- Step 2: rename stories' live age_group column + its index.
    -- The column already stores unified ref_content_subcategory IDs
    -- (verified — all values match group_code='blog_stories_age_group').
    -- Rename the column to match the unified naming pattern, so Django
    -- model fields can be named consistently with the existing
    -- link_content_ref_content_subcategory_id field on the same table.
    -- ------------------------------------------------------------------------
    IF COL_LENGTH('[blog_stories].[coll_story]', 'link_blog_stories_ref_story_age_group_id') IS NOT NULL
       AND COL_LENGTH('[blog_stories].[coll_story]', 'link_content_ref_content_subcategory_age_group_id') IS NULL
    BEGIN
        EXEC sp_rename
            '[blog_stories].[coll_story].[link_blog_stories_ref_story_age_group_id]',
            'link_content_ref_content_subcategory_age_group_id',
            'COLUMN';
    END

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_stories_coll_story_link_age_group_id')
        EXEC sp_rename
            '[blog_stories].[coll_story].IX_stories_coll_story_link_age_group_id',
            'IX_stories_coll_story_link_age_group_subcategory_id',
            'INDEX';

    COMMIT TRANSACTION;
    PRINT 'unified subcategory cleanup: SUCCESS';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT 'unified subcategory cleanup: FAILED — ' + @msg;
    THROW;
END CATCH;

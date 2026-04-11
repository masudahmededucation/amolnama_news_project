-- ============================================================================
-- Bangladesh Phase 2 — season migration + media category seed
--
-- Brings bangladesh app onto the unified [content].[ref_content_subcategory]
-- table for BOTH categories (Beauty Hub media) and seasons (Travel Hub + Beauty
-- Hub). After this script runs, [blog_bangladesh].[ref_season] is gone and
-- every category/season ID used by coll_destination and coll_media_entry
-- points at the unified table.
--
-- Research findings baked into this script:
--   1. [content].[ref_content_subcategory] has TWO computed columns that
--      MUST NOT be named in INSERT (link_subcategory_id, link_subcategory_code).
--      SSMS error "column cannot be modified because it is computed" was the
--      earlier draft trying to supply these — this script omits them and lets
--      the computed column expressions populate them automatically.
--   2. content_ref_content_subcategory_id is IDENTITY — do not name it.
--   3. is_active (DEFAULT 1) and created_at (DEFAULT sysdatetime()) are set
--      by column defaults — omitted from INSERT for cleanliness.
--   4. link_content_ref_content_category_id is the parent category FK:
--      7 = 'media'       (for blog_bangladesh_media_category seed)
--      6 = 'destination' (for blog_bangladesh_season seed — seasons describe
--                         when to visit destinations)
--   5. FKs exist on the season columns:
--      FK_bangladesh_coll_destination_best_season
--      FK_bangladesh_coll_media_entry_season
--      Must be dropped before the column rename so the FK name doesn't
--      accidentally dangle on a renamed column.
--   6. coll_destination has 1 row with a season set — backfilled via JOIN on
--      season_code (deterministic, independent of ID ordering).
--   7. coll_media_entry is empty — no backfill needed there.
--   8. subcategory_metadata_json is where we park season_months, so the
--      NVARCHAR string "April - May" etc. is preserved without adding
--      season-specific columns to the generic subcategory table.
--
-- Transaction model:
--   SET XACT_ABORT ON   — any runtime error triggers rollback (SQL Server
--                         otherwise leaves some errors un-rolled-back).
--   BEGIN TRAN / TRY / CATCH — all 6 parts land together or none do.
--   IF-EXISTS / COL_LENGTH guards — safe to re-run after a partial success.
-- ============================================================================

SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    -- ========================================================================
    -- Part A — seed blog_bangladesh_media_category (10 categories)
    -- Only inserts categories that don't already exist (by subcategory_code).
    -- ========================================================================
    INSERT INTO [content].[ref_content_subcategory]
        (link_content_ref_content_category_id, group_code, subcategory_code,
         subcategory_name_en, subcategory_name_bn, subcategory_icon, sort_order)
    SELECT * FROM (VALUES
        (7, 'blog_bangladesh_media_category', 'landscape',        N'Landscape',              N'প্রকৃতি দৃশ্য',       N'🌄',  1),
        (7, 'blog_bangladesh_media_category', 'rivers_waterways', N'Rivers & Waterways',     N'নদী ও জলাধার',        N'🏞️', 2),
        (7, 'blog_bangladesh_media_category', 'hills_mountains',  N'Hills & Mountains',      N'পাহাড় ও পর্বত',       N'⛰️', 3),
        (7, 'blog_bangladesh_media_category', 'architecture',     N'Architecture & Heritage', N'স্থাপত্য ও ঐতিহ্য',   N'🏛️', 4),
        (7, 'blog_bangladesh_media_category', 'people_culture',   N'People & Culture',       N'মানুষ ও সংস্কৃতি',    N'👥',  5),
        (7, 'blog_bangladesh_media_category', 'festival',         N'Festival',               N'উৎসব',                N'🎉',  6),
        (7, 'blog_bangladesh_media_category', 'food',             N'Food & Cuisine',         N'খাবার ও রন্ধন',      N'🍲',  7),
        (7, 'blog_bangladesh_media_category', 'wildlife',         N'Wildlife',               N'বন্যপ্রাণী',         N'🐅',  8),
        (7, 'blog_bangladesh_media_category', 'urban_city',       N'Urban & City',           N'নগর ও শহর',          N'🏙️', 9),
        (7, 'blog_bangladesh_media_category', 'rural_village',    N'Rural & Village',        N'গ্রাম্য জীবন',       N'🌾', 10)
    ) AS seed(link_content_ref_content_category_id, group_code, subcategory_code, subcategory_name_en, subcategory_name_bn, subcategory_icon, sort_order)
    WHERE NOT EXISTS (
        SELECT 1 FROM [content].[ref_content_subcategory] existing
        WHERE existing.group_code = seed.group_code
          AND existing.subcategory_code = seed.subcategory_code
    );

    -- ========================================================================
    -- Part B — seed blog_bangladesh_season (6 ritu)
    -- Months kept in subcategory_metadata_json so data is not lost.
    -- ========================================================================
    INSERT INTO [content].[ref_content_subcategory]
        (link_content_ref_content_category_id, group_code, subcategory_code,
         subcategory_name_en, subcategory_name_bn, subcategory_icon, sort_order,
         subcategory_metadata_json)
    SELECT * FROM (VALUES
        (6, 'blog_bangladesh_season', 'grishmo',  N'Summer',      N'গ্রীষ্ম',  N'☀️', 1, N'{"months":"April - May"}'),
        (6, 'blog_bangladesh_season', 'borsha',   N'Monsoon',     N'বর্ষা',    N'🌧️', 2, N'{"months":"June - July"}'),
        (6, 'blog_bangladesh_season', 'shorot',   N'Autumn',      N'শরৎ',      N'🍃', 3, N'{"months":"August - September"}'),
        (6, 'blog_bangladesh_season', 'hemonto',  N'Late Autumn', N'হেমন্ত',   N'🌾', 4, N'{"months":"October - November"}'),
        (6, 'blog_bangladesh_season', 'sheet',    N'Winter',      N'শীত',      N'❄️', 5, N'{"months":"December - January"}'),
        (6, 'blog_bangladesh_season', 'boshonto', N'Spring',      N'বসন্ত',    N'🌸', 6, N'{"months":"February - March"}')
    ) AS seed(link_content_ref_content_category_id, group_code, subcategory_code, subcategory_name_en, subcategory_name_bn, subcategory_icon, sort_order, subcategory_metadata_json)
    WHERE NOT EXISTS (
        SELECT 1 FROM [content].[ref_content_subcategory] existing
        WHERE existing.group_code = seed.group_code
          AND existing.subcategory_code = seed.subcategory_code
    );

    -- ========================================================================
    -- Part C — drop the 2 FK constraints on the old season columns.
    -- Must happen BEFORE the column rename, otherwise SQL Server keeps the
    -- constraint attached to a column whose name no longer matches.
    -- ========================================================================
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_bangladesh_coll_destination_best_season')
        ALTER TABLE [blog_bangladesh].[coll_destination]
            DROP CONSTRAINT FK_bangladesh_coll_destination_best_season;

    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_bangladesh_coll_media_entry_season')
        ALTER TABLE [blog_bangladesh].[coll_media_entry]
            DROP CONSTRAINT FK_bangladesh_coll_media_entry_season;

    -- ========================================================================
    -- Part D — backfill coll_destination season FK (old per-app id -> new
    -- unified subcategory id). Match by season_code so it's independent of
    -- any ID ordering assumptions. Skip rows where the season was NULL.
    -- coll_media_entry has 0 rows so there is nothing to backfill there.
    -- ========================================================================
    IF OBJECT_ID('[blog_bangladesh].[ref_season]', 'U') IS NOT NULL
    BEGIN
        UPDATE dest
        SET dest.link_blog_bangladesh_ref_season_id = new_sub.content_ref_content_subcategory_id
        FROM [blog_bangladesh].[coll_destination] dest
        JOIN [blog_bangladesh].[ref_season] old
            ON old.blog_bangladesh_ref_season_id = dest.link_blog_bangladesh_ref_season_id
        JOIN [content].[ref_content_subcategory] new_sub
            ON new_sub.group_code = 'blog_bangladesh_season'
           AND new_sub.subcategory_code = old.season_code
        WHERE dest.link_blog_bangladesh_ref_season_id IS NOT NULL;
    END

    -- ========================================================================
    -- Part E — rename the season columns to unified naming.
    -- New name mirrors the pattern already in use on coll_story:
    --   link_content_ref_content_subcategory_<role>_id
    -- The <role> suffix disambiguates the second subcategory FK on the table.
    -- ========================================================================
    IF COL_LENGTH('[blog_bangladesh].[coll_destination]', 'link_blog_bangladesh_ref_season_id') IS NOT NULL
       AND COL_LENGTH('[blog_bangladesh].[coll_destination]', 'link_content_ref_content_subcategory_season_id') IS NULL
    BEGIN
        EXEC sp_rename
            '[blog_bangladesh].[coll_destination].[link_blog_bangladesh_ref_season_id]',
            'link_content_ref_content_subcategory_season_id',
            'COLUMN';
    END

    IF COL_LENGTH('[blog_bangladesh].[coll_media_entry]', 'link_blog_bangladesh_ref_season_id') IS NOT NULL
       AND COL_LENGTH('[blog_bangladesh].[coll_media_entry]', 'link_content_ref_content_subcategory_season_id') IS NULL
    BEGIN
        EXEC sp_rename
            '[blog_bangladesh].[coll_media_entry].[link_blog_bangladesh_ref_season_id]',
            'link_content_ref_content_subcategory_season_id',
            'COLUMN';
    END

    -- ========================================================================
    -- Part F — drop the old per-app ref_season table.
    -- After Part D backfilled, it has no remaining consumers.
    -- ========================================================================
    IF OBJECT_ID('[blog_bangladesh].[ref_season]', 'U') IS NOT NULL
        DROP TABLE [blog_bangladesh].[ref_season];

    COMMIT TRANSACTION;
    PRINT 'bangladesh season + media category migration: SUCCESS';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT 'bangladesh season + media category migration: FAILED — ' + @msg;
    THROW;
END CATCH;

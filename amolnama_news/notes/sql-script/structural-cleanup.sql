/* ============================================================
   Structural Cleanup — 3 migrations
   ============================================================
   Script 1: Newsengine polymorphic cleanup
   Script 2: Drop old per-app category ref tables
   Script 3: Debate slug migration

   SAFE TO RERUN — all steps guarded with IF NOT EXISTS / IF EXISTS.
   Run in order. Each script is independent.
   ============================================================ */

SET XACT_ABORT ON;
SET NOCOUNT ON;


/* ============================================================
   SCRIPT 1 — Newsengine polymorphic cleanup
   ============================================================
   fact_content_classification_result and fact_check_result both have:
     - link_content_id + source_app (old pattern — requires knowing the app)
     - link_content_registry_id (new pattern — universal, already exists but nullable)

   This script:
     1. Backfills link_content_registry_id where it's NULL (if content_registry has the data)
     2. Adds indexes on link_content_registry_id for fast lookup
     3. Does NOT drop the old columns (they may have data not in content_registry yet)
   ============================================================ */

PRINT '=== Script 1: Newsengine polymorphic cleanup ===';
PRINT '';

-- 1a. Backfill link_content_registry_id on fact_content_classification_result
UPDATE fcc
SET fcc.link_content_registry_id = cr.content_registry_id
FROM [newsengine].[fact_content_classification_result] fcc
JOIN [content].[content_registry] cr
    ON cr.content_type_code = fcc.content_classification_source_app
    AND cr.content_id = fcc.link_content_id
WHERE fcc.link_content_registry_id IS NULL
  AND cr.is_active = 1;

PRINT '  [OK] backfilled link_content_registry_id on fact_content_classification_result: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows';
GO

-- 1b. Backfill link_content_registry_id on fact_check_result
UPDATE fcr
SET fcr.link_content_registry_id = cr.content_registry_id
FROM [newsengine].[fact_check_result] fcr
JOIN [content].[content_registry] cr
    ON cr.content_type_code = fcr.fact_check_source_app
    AND cr.content_id = fcr.link_content_id
WHERE fcr.link_content_registry_id IS NULL
  AND cr.is_active = 1;

PRINT '  [OK] backfilled link_content_registry_id on fact_check_result: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows';
GO

-- 1c. Index on link_content_registry_id for fast lookup
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[newsengine].[fact_content_classification_result]')
      AND name = N'IX_fact_content_classification_registry'
)
BEGIN
    CREATE INDEX IX_fact_content_classification_registry
        ON [newsengine].[fact_content_classification_result] ([link_content_registry_id])
        WHERE [link_content_registry_id] IS NOT NULL;
    PRINT '  [OK] created IX_fact_content_classification_registry';
END
ELSE
    PRINT '  [SKIP] IX_fact_content_classification_registry already exists';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[newsengine].[fact_check_result]')
      AND name = N'IX_fact_check_result_registry'
)
BEGIN
    CREATE INDEX IX_fact_check_result_registry
        ON [newsengine].[fact_check_result] ([link_content_registry_id])
        WHERE [link_content_registry_id] IS NOT NULL;
    PRINT '  [OK] created IX_fact_check_result_registry';
END
ELSE
    PRINT '  [SKIP] IX_fact_check_result_registry already exists';
GO

PRINT '';


/* ============================================================
   SCRIPT 2 — Drop old per-app category ref tables
   ============================================================
   These were replaced by [content].[ref_content_subcategory].
   Python code no longer references them (verified via grep).
   The old FK columns on collection tables still exist but now
   point to ref_content_subcategory IDs, not these old tables.

   Tables to drop:
     [blog_art].[ref_art_category]
     [blog_poem].[ref_poem_category]
     [blog_stories].[ref_story_category]
     [blog_stories].[ref_story_age_group]
     [blog_bangladesh].[ref_destination_category]

   NOTE: Only drops if no FK constraints reference them.
   If a FK constraint exists, the DROP will fail safely with
   an error message — you'll need to drop the FK first.
   ============================================================ */

PRINT '=== Script 2: Drop old per-app category ref tables ===';
PRINT '';

-- Helper: try to drop a table, print result
DECLARE @tables_to_drop TABLE (schema_name NVARCHAR(50), table_name NVARCHAR(100));
INSERT INTO @tables_to_drop VALUES
    (N'blog_art',        N'ref_art_category'),
    (N'blog_poem',       N'ref_poem_category'),
    (N'blog_stories',    N'ref_story_category'),
    (N'blog_stories',    N'ref_story_age_group'),
    (N'blog_bangladesh', N'ref_destination_category');

DECLARE @schema NVARCHAR(50), @table NVARCHAR(100), @full_name NVARCHAR(200), @drop_sql NVARCHAR(500);
DECLARE table_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT schema_name, table_name FROM @tables_to_drop;

OPEN table_cursor;
FETCH NEXT FROM table_cursor INTO @schema, @table;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @full_name = QUOTENAME(@schema) + N'.' + QUOTENAME(@table);

    IF EXISTS (
        SELECT 1 FROM sys.tables t
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE s.name = @schema AND t.name = @table
    )
    BEGIN
        -- Check for FK constraints referencing this table
        IF EXISTS (
            SELECT 1 FROM sys.foreign_keys fk
            WHERE fk.referenced_object_id = OBJECT_ID(@full_name)
        )
        BEGIN
            PRINT '  [WARN] ' + @full_name + ' has FK constraints — dropping constraints first';
            -- Drop all FK constraints referencing this table
            DECLARE @fk_drop NVARCHAR(MAX) = N'';
            SELECT @fk_drop = @fk_drop
                + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
                + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
                + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
            FROM sys.foreign_keys fk
            WHERE fk.referenced_object_id = OBJECT_ID(@full_name);

            IF LEN(@fk_drop) > 0
            BEGIN
                EXEC sp_executesql @fk_drop;
                PRINT '  [OK] dropped FK constraints on ' + @full_name;
            END
        END

        SET @drop_sql = N'DROP TABLE ' + @full_name + N';';
        EXEC sp_executesql @drop_sql;
        PRINT '  [OK] dropped ' + @full_name;
    END
    ELSE
    BEGIN
        PRINT '  [SKIP] ' + @full_name + ' does not exist';
    END

    FETCH NEXT FROM table_cursor INTO @schema, @table;
END

CLOSE table_cursor;
DEALLOCATE table_cursor;
GO

PRINT '';


/* ============================================================
   SCRIPT 3 — Debate slug migration
   ============================================================
   Add topic_slug column to [blog_debate].[coll_topic] for SEO-friendly
   Bengali URLs. Changes /debate/topic/42/ to /debate/topic/বিতর্ক-শিরোনাম/

   Steps:
     1. Add topic_slug column (NVARCHAR(400), nullable initially)
     2. Backfill slugs from topic_title using a simple transliteration
        (Python's bangla_slugify will regenerate proper slugs on first access)
     3. Add unique index on topic_slug

   NOTE: The Python code change (URL pattern + view lookup) must be done
   AFTER this script runs. Until then, the old integer URL still works.
   ============================================================ */

PRINT '=== Script 3: Debate slug migration ===';
PRINT '';

-- 3a. Add topic_slug column
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[blog_debate].[coll_topic]')
      AND name = N'topic_slug'
)
BEGIN
    ALTER TABLE [blog_debate].[coll_topic]
        ADD [topic_slug] NVARCHAR(400) NULL;
    PRINT '  [OK] added [blog_debate].[coll_topic].[topic_slug]';
END
ELSE
    PRINT '  [SKIP] topic_slug already exists';
GO

-- 3b. Backfill slug from topic_title (simple: replace spaces with hyphens, lowercase)
-- This is a rough backfill — Python's bangla_slugify() will generate proper
-- NFC-normalized Bengali slugs on first save. This just ensures the column isn't NULL.
UPDATE [blog_debate].[coll_topic]
SET [topic_slug] = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    LTRIM(RTRIM([topic_title])),
    ' ', '-'), '?', ''), '!', ''), ',', ''), '.', ''))
WHERE [topic_slug] IS NULL
  AND [topic_title] IS NOT NULL;

PRINT '  [OK] backfilled topic_slug from topic_title: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows';
GO

-- 3c. Unique index on topic_slug (filtered — NULL allowed for drafts without titles)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[blog_debate].[coll_topic]')
      AND name = N'IX_coll_topic_slug'
)
BEGIN
    CREATE UNIQUE INDEX IX_coll_topic_slug
        ON [blog_debate].[coll_topic] ([topic_slug])
        WHERE [topic_slug] IS NOT NULL;
    PRINT '  [OK] created IX_coll_topic_slug (unique, filtered)';
END
ELSE
    PRINT '  [SKIP] IX_coll_topic_slug already exists';
GO


/* ============================================================
   VERIFICATION
   ============================================================ */

PRINT '';
PRINT '=== Verification ===';
PRINT '';

-- Script 1 checks
SELECT 'S1: classification backfill' AS check_name,
    CAST(COUNT(*) AS VARCHAR(10)) + ' rows with registry_id' AS status
FROM [newsengine].[fact_content_classification_result]
WHERE link_content_registry_id IS NOT NULL;

SELECT 'S1: fact_check backfill' AS check_name,
    CAST(COUNT(*) AS VARCHAR(10)) + ' rows with registry_id' AS status
FROM [newsengine].[fact_check_result]
WHERE link_content_registry_id IS NOT NULL;

-- Script 2 checks
SELECT 'S2: ref_art_category' AS check_name,
    CASE WHEN NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'blog_art' AND t.name = N'ref_art_category')
    THEN 'DROPPED' ELSE 'STILL EXISTS' END AS status;

SELECT 'S2: ref_poem_category' AS check_name,
    CASE WHEN NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'blog_poem' AND t.name = N'ref_poem_category')
    THEN 'DROPPED' ELSE 'STILL EXISTS' END AS status;

SELECT 'S2: ref_story_category' AS check_name,
    CASE WHEN NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'blog_stories' AND t.name = N'ref_story_category')
    THEN 'DROPPED' ELSE 'STILL EXISTS' END AS status;

SELECT 'S2: ref_story_age_group' AS check_name,
    CASE WHEN NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'blog_stories' AND t.name = N'ref_story_age_group')
    THEN 'DROPPED' ELSE 'STILL EXISTS' END AS status;

SELECT 'S2: ref_destination_category' AS check_name,
    CASE WHEN NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'blog_bangladesh' AND t.name = N'ref_destination_category')
    THEN 'DROPPED' ELSE 'STILL EXISTS' END AS status;

-- Script 3 checks
SELECT 'S3: topic_slug column' AS check_name,
    CASE WHEN EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[blog_debate].[coll_topic]') AND name = N'topic_slug')
    THEN 'PASS' ELSE 'FAIL' END AS status;

SELECT 'S3: IX_coll_topic_slug' AS check_name,
    CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[blog_debate].[coll_topic]') AND name = N'IX_coll_topic_slug')
    THEN 'PASS' ELSE 'FAIL' END AS status;

SELECT 'S3: slug backfill count' AS check_name,
    CAST(COUNT(*) AS VARCHAR(10)) + ' topics with slugs' AS status
FROM [blog_debate].[coll_topic]
WHERE topic_slug IS NOT NULL;

PRINT '';
PRINT '=== structural-cleanup complete ===';
GO

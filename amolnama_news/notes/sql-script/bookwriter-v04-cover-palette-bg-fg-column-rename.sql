/* ============================================================
   bookwriter v04 — Cover-palette `bg` / `fg` column rename
   ============================================================
   Purpose: rename 4 columns to remove the `bg` / `fg`
   abbreviations in the cover-palette context (the only column-
   naming convention violation in the bookwriter schema vs the
   project precedent — see CLAUDE.md Gate 7 + the precedent
   examples in blog_art / blog_bangladesh / blog_biography
   where no abbreviations appear in column names).

   Scope (4 columns across 2 tables — NO table renames, NO PK
   renames, NO FK renames; only column-name cosmetic fixes):

   Table                                    Old column                                   New column
   ------------------------------------------------------------------------------------------------
   [bookwriter].[ref_cover_palette]         cover_palette_bg_hex                         cover_palette_background_color_hex
   [bookwriter].[ref_cover_palette]         cover_palette_fg_hex                         cover_palette_foreground_color_hex
   [bookwriter].[book_cover_design]         cover_palette_bg_hex_override                cover_palette_background_color_hex_override
   [bookwriter].[book_cover_design]         cover_palette_fg_hex_override                cover_palette_foreground_color_hex_override

   `cover_palette_accent_hex` / `cover_palette_accent_hex_override`
   are NOT renamed — `accent` is already a full word.

   Note: sp_rename for COLUMN preserves the column's data,
   data type, NOT NULL constraint, default constraint, FK
   constraints (none here), indexes (none on these columns),
   and any extended properties (MS_Description). No data is
   touched; only the column name in sys.columns changes.

   Coordination — paired Python edits MUST ship in the SAME
   deploy window as this DB rename (the Django ORM models map
   field name -> db_column; old field names will 404 against
   the renamed columns):

     1. amolnama_news/site_apps/bookwriter/models.py
        * RefCoverPalette: rename fields
            cover_palette_bg_hex -> cover_palette_background_color_hex
            cover_palette_fg_hex -> cover_palette_foreground_color_hex
        * BookCoverDesign: rename fields
            cover_palette_bg_hex_override -> cover_palette_background_color_hex_override
            cover_palette_fg_hex_override -> cover_palette_foreground_color_hex_override
     2. amolnama_news/site_apps/bookwriter/views_api_book.py
        * Cover-design save endpoint: rename payload keys
            'cover_palette_bg_hex_override' -> 'cover_palette_background_color_hex_override'
            'cover_palette_fg_hex_override' -> 'cover_palette_foreground_color_hex_override'
     3. amolnama_news/site_apps/bookwriter/static/bookwriter/assets/js/modules/bookwriter-cover-designer.js
        * Payload object keys (the JS that POSTs the save):
            'cover_palette_bg_hex_override' -> 'cover_palette_background_color_hex_override'
            'cover_palette_fg_hex_override' -> 'cover_palette_foreground_color_hex_override'
     4. amolnama_news/site_apps/bookwriter/field_mapping/db-mapping-cover-design.txt
        * Update any references to the old column names.

   Rollback: each rename is reversible — see ROLLBACK block at
   bottom (commented out; uncomment if needed).
   ============================================================ */

USE [your_database_name_here];  -- replace with actual DB name
GO

BEGIN TRANSACTION bookwriter_v04_palette_rename;

/* ---------- ref_cover_palette (2 column renames) ---------- */
EXEC sp_rename
    '[bookwriter].[ref_cover_palette].cover_palette_bg_hex',
    'cover_palette_background_color_hex',
    'COLUMN';

EXEC sp_rename
    '[bookwriter].[ref_cover_palette].cover_palette_fg_hex',
    'cover_palette_foreground_color_hex',
    'COLUMN';

/* ---------- book_cover_design (2 column renames) ---------- */
EXEC sp_rename
    '[bookwriter].[book_cover_design].cover_palette_bg_hex_override',
    'cover_palette_background_color_hex_override',
    'COLUMN';

EXEC sp_rename
    '[bookwriter].[book_cover_design].cover_palette_fg_hex_override',
    'cover_palette_foreground_color_hex_override',
    'COLUMN';

/* ---------- VERIFICATION ---------- */
/* Both queries below should match exactly the expected results
   before COMMIT. If anything looks wrong, ROLLBACK. */

/* Query 1 — confirm all 4 NEW column names exist. Expect 4 rows. */
SELECT
    SCHEMA_NAME(t.schema_id) AS schema_name,
    t.name                   AS table_name,
    c.name                   AS column_name
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
WHERE SCHEMA_NAME(t.schema_id) = 'bookwriter'
  AND t.name IN ('ref_cover_palette', 'book_cover_design')
  AND c.name IN (
      'cover_palette_background_color_hex',
      'cover_palette_foreground_color_hex',
      'cover_palette_background_color_hex_override',
      'cover_palette_foreground_color_hex_override'
  )
ORDER BY t.name, c.name;

/* Query 2 — confirm NONE of the OLD names still exist. Expect 0 rows. */
SELECT
    SCHEMA_NAME(t.schema_id) AS schema_name,
    t.name                   AS table_name,
    c.name                   AS column_name
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
WHERE SCHEMA_NAME(t.schema_id) = 'bookwriter'
  AND t.name IN ('ref_cover_palette', 'book_cover_design')
  AND c.name IN (
      'cover_palette_bg_hex',
      'cover_palette_fg_hex',
      'cover_palette_bg_hex_override',
      'cover_palette_fg_hex_override'
  );

/* If both verification queries return expected results: */
COMMIT TRANSACTION bookwriter_v04_palette_rename;
/* If anything looks wrong: */
-- ROLLBACK TRANSACTION bookwriter_v04_palette_rename;
GO


/* ============================================================
   ROLLBACK BLOCK (run only if you need to revert post-commit)
   ============================================================ */
/*
BEGIN TRANSACTION bookwriter_v04_rollback;

EXEC sp_rename
    '[bookwriter].[ref_cover_palette].cover_palette_background_color_hex',
    'cover_palette_bg_hex',
    'COLUMN';

EXEC sp_rename
    '[bookwriter].[ref_cover_palette].cover_palette_foreground_color_hex',
    'cover_palette_fg_hex',
    'COLUMN';

EXEC sp_rename
    '[bookwriter].[book_cover_design].cover_palette_background_color_hex_override',
    'cover_palette_bg_hex_override',
    'COLUMN';

EXEC sp_rename
    '[bookwriter].[book_cover_design].cover_palette_foreground_color_hex_override',
    'cover_palette_fg_hex_override',
    'COLUMN';

COMMIT TRANSACTION bookwriter_v04_rollback;
GO
*/

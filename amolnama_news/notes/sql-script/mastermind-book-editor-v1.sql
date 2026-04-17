/* ------------------------------------------------------------------ */
/*  Mastermind — Book Editor v1                                        */
/*                                                                    */
/*  Adds 5 columns to coll_book to support 3 features that share the  */
/*  same data model:                                                  */
/*    1. Read/edit imported (OCR'd) books                              */
/*    2. Paste-as-book ingest (skip OCR pipeline)                      */
/*    3. User-authored books (write a book on the platform)            */
/*                                                                    */
/*  No new tables. CollBook + CollBookChapter + CollBookChunk already */
/*  cover all three storage needs — chapter TEXT lives in coll_book_  */
/*  chunk (one row per ~500-word paragraph; persisted, not discarded).*/
/*                                                                    */
/*  No DB change for the question reject-recovery flow either —       */
/*  question_status_code is NVARCHAR(20) and accepts any string;      */
/*  the new 'needs_edit' state is purely a Python/UI convention.      */
/*                                                                    */
/*  Idempotent: each ALTER guarded by sys.columns existence check.    */
/*  Run via SSMS while connected to the amolnama_news database.       */
/* ------------------------------------------------------------------ */

/* 1. link_created_by_user_profile_id ------------------------------- */
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[mastermind].[coll_book]')
      AND name = 'link_created_by_user_profile_id'
)
BEGIN
    ALTER TABLE [mastermind].[coll_book]
        ADD link_created_by_user_profile_id BIGINT NULL;

    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Owner user_profile_id. Set when the book is uploaded by a quiz creator OR authored on the platform. NULL for legacy books that pre-date this column.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_book',
        @level2type = N'COLUMN', @level2name = N'link_created_by_user_profile_id';

    PRINT '[OK] Added column coll_book.link_created_by_user_profile_id';
END
ELSE
    PRINT '[SKIP] Column coll_book.link_created_by_user_profile_id already exists';
GO


/* 2. book_origin_code --------------------------------------------- */
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[mastermind].[coll_book]')
      AND name = 'book_origin_code'
)
BEGIN
    ALTER TABLE [mastermind].[coll_book]
        ADD book_origin_code NVARCHAR(20) NOT NULL CONSTRAINT DF_coll_book_origin_code DEFAULT 'imported_pdf';

    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'How the book entered the system. Values: imported_pdf (default — uploaded as a PDF and OCR-extracted), pasted_text (skipped OCR; user pasted plain text into the editor), user_authored (written from scratch on the platform).',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_book',
        @level2type = N'COLUMN', @level2name = N'book_origin_code';

    PRINT '[OK] Added column coll_book.book_origin_code';
END
ELSE
    PRINT '[SKIP] Column coll_book.book_origin_code already exists';
GO


/* 3. book_status_code --------------------------------------------- */
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[mastermind].[coll_book]')
      AND name = 'book_status_code'
)
BEGIN
    ALTER TABLE [mastermind].[coll_book]
        ADD book_status_code NVARCHAR(20) NOT NULL CONSTRAINT DF_coll_book_status_code DEFAULT 'draft';

    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Publishing lifecycle. Values: draft (private to the author + staff), review (submitted for staff review), published (visible to anyone at /mastermind/book/<id>/), archived (hidden but recoverable).',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_book',
        @level2type = N'COLUMN', @level2name = N'book_status_code';

    PRINT '[OK] Added column coll_book.book_status_code';
END
ELSE
    PRINT '[SKIP] Column coll_book.book_status_code already exists';
GO


/* 4. book_published_at -------------------------------------------- */
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[mastermind].[coll_book]')
      AND name = 'book_published_at'
)
BEGIN
    ALTER TABLE [mastermind].[coll_book]
        ADD book_published_at DATETIME2 NULL;

    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Timestamp of first transition to status=published. NULL for unpublished books.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_book',
        @level2type = N'COLUMN', @level2name = N'book_published_at';

    PRINT '[OK] Added column coll_book.book_published_at';
END
ELSE
    PRINT '[SKIP] Column coll_book.book_published_at already exists';
GO


/* 5. book_slug ----------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[mastermind].[coll_book]')
      AND name = 'book_slug'
)
BEGIN
    ALTER TABLE [mastermind].[coll_book]
        ADD book_slug NVARCHAR(300) NULL;

    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'URL-safe English slug for the public reader. Generated from book_title_bn via core/utils.py:english_slug_from_text() at publish time. NULL until the book is published.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_book',
        @level2type = N'COLUMN', @level2name = N'book_slug';

    PRINT '[OK] Added column coll_book.book_slug';
END
ELSE
    PRINT '[SKIP] Column coll_book.book_slug already exists';
GO


/* 6. Unique index on book_slug (filtered: only when not null) ----- */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_coll_book_slug'
      AND object_id = OBJECT_ID(N'[mastermind].[coll_book]')
)
BEGIN
    CREATE UNIQUE INDEX UQ_coll_book_slug
        ON [mastermind].[coll_book](book_slug)
        WHERE book_slug IS NOT NULL;
    PRINT '[OK] Created index UQ_coll_book_slug';
END
ELSE
    PRINT '[SKIP] Index UQ_coll_book_slug already exists';
GO


/* 7. Owner+status lookup index ------------------------------------ */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_coll_book_owner_status'
      AND object_id = OBJECT_ID(N'[mastermind].[coll_book]')
)
BEGIN
    CREATE INDEX IX_coll_book_owner_status
        ON [mastermind].[coll_book](link_created_by_user_profile_id, book_status_code, is_active);
    PRINT '[OK] Created index IX_coll_book_owner_status';
END
ELSE
    PRINT '[SKIP] Index IX_coll_book_owner_status already exists';
GO


PRINT '------------------------------------------------------------------';
PRINT '  Mastermind book-editor v1 SQL: complete.';
PRINT '  Question reject-recovery requires NO SQL change — ''needs_edit''';
PRINT '  is just a new value of the existing question_status_code column.';
PRINT '------------------------------------------------------------------';

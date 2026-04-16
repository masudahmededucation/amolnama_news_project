/*
  Fix: 3 columns couldn't rename because indexes depend on them.
  Drop indexes → rename columns → recreate indexes + FKs.
*/

-- ================================================================
-- 1. DROP blocking indexes
-- ================================================================

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_chunk_chapter' AND object_id = OBJECT_ID('[mastermind].[coll_book_chunk]'))
    DROP INDEX IX_chunk_chapter ON [mastermind].[coll_book_chunk];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_question_book' AND object_id = OBJECT_ID('[mastermind].[coll_question]'))
    DROP INDEX IX_question_book ON [mastermind].[coll_question];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_exam_book' AND object_id = OBJECT_ID('[mastermind].[coll_exam]'))
    DROP INDEX IX_exam_book ON [mastermind].[coll_exam];
GO


-- ================================================================
-- 2. RENAME the 3 stuck columns
-- ================================================================

-- coll_book_chunk: link_mastermind_ref_book_chapter_id → link_mastermind_coll_book_chapter_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[mastermind].[coll_book_chunk]') AND name = 'link_mastermind_ref_book_chapter_id')
    EXEC sp_rename '[mastermind].[coll_book_chunk].[link_mastermind_ref_book_chapter_id]', 'link_mastermind_coll_book_chapter_id', 'COLUMN';
GO

-- coll_question: link_mastermind_ref_book_id → link_mastermind_coll_book_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[mastermind].[coll_question]') AND name = 'link_mastermind_ref_book_id')
    EXEC sp_rename '[mastermind].[coll_question].[link_mastermind_ref_book_id]', 'link_mastermind_coll_book_id', 'COLUMN';
GO

-- coll_exam: link_mastermind_ref_book_id → link_mastermind_coll_book_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[mastermind].[coll_exam]') AND name = 'link_mastermind_ref_book_id')
    EXEC sp_rename '[mastermind].[coll_exam].[link_mastermind_ref_book_id]', 'link_mastermind_coll_book_id', 'COLUMN';
GO


-- ================================================================
-- 3. RECREATE indexes with new column names
-- ================================================================

CREATE INDEX IX_chunk_chapter
    ON [mastermind].[coll_book_chunk](link_mastermind_coll_book_chapter_id);
GO

CREATE INDEX IX_question_book
    ON [mastermind].[coll_question](link_mastermind_coll_book_id, link_mastermind_coll_book_chapter_id)
    WHERE link_mastermind_coll_book_id IS NOT NULL;
GO

CREATE INDEX IX_exam_book
    ON [mastermind].[coll_exam](link_mastermind_coll_book_id);
GO


-- ================================================================
-- 4. RECREATE the 2 FKs that failed in the first script
-- ================================================================

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_question_book')
    ALTER TABLE [mastermind].[coll_question]
        ADD CONSTRAINT FK_question_book
        FOREIGN KEY (link_mastermind_coll_book_id)
        REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_exam_book')
    ALTER TABLE [mastermind].[coll_exam]
        ADD CONSTRAINT FK_exam_book
        FOREIGN KEY (link_mastermind_coll_book_id)
        REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO


-- ================================================================
-- 5. VERIFY — no ref_book columns should remain
-- ================================================================

SELECT
    OBJECT_NAME(c.object_id) AS table_name,
    c.name AS column_name
FROM sys.columns c
WHERE c.name LIKE '%ref_book%'
  AND OBJECT_SCHEMA_NAME(c.object_id) = 'mastermind'
ORDER BY table_name, column_name;
-- Expected: 0 rows

/*
  Mastermind — Rename ref_book → coll_book, ref_book_chapter → coll_book_chapter.
  Books are growing collection data, not static reference tables.

  Run in order. Drop FKs first, rename tables + columns, recreate FKs.
*/

-- ================================================================
-- 1. DROP all FK constraints that reference ref_book / ref_book_chapter
-- ================================================================

-- ref_book_chapter → ref_book
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_book_chapter_book')
    ALTER TABLE [mastermind].[ref_book_chapter] DROP CONSTRAINT FK_book_chapter_book;
GO

-- coll_book_chunk → ref_book
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('[mastermind].[coll_book_chunk]') AND name LIKE '%book%')
    ALTER TABLE [mastermind].[coll_book_chunk] DROP CONSTRAINT FK_chunk_book;
GO

-- coll_question → ref_book
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_question_book')
    ALTER TABLE [mastermind].[coll_question] DROP CONSTRAINT FK_question_book;
GO

-- coll_question → ref_book_chapter
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_question_chapter')
    ALTER TABLE [mastermind].[coll_question] DROP CONSTRAINT FK_question_chapter;
GO

-- map_question_source → ref_book
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qs_book')
    ALTER TABLE [mastermind].[map_question_source] DROP CONSTRAINT FK_qs_book;
GO

-- map_question_source → ref_book_chapter
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qs_chapter')
    ALTER TABLE [mastermind].[map_question_source] DROP CONSTRAINT FK_qs_chapter;
GO

-- coll_exam → ref_book
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_exam_book')
    ALTER TABLE [mastermind].[coll_exam] DROP CONSTRAINT FK_exam_book;
GO

-- coll_transparency_ledger → ref_book
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tl_book')
    ALTER TABLE [mastermind].[coll_transparency_ledger] DROP CONSTRAINT FK_tl_book;
GO


-- ================================================================
-- 2. RENAME PK columns
-- ================================================================

-- ref_book PK: mastermind_ref_book_id → mastermind_coll_book_id
EXEC sp_rename '[mastermind].[ref_book].[mastermind_ref_book_id]', 'mastermind_coll_book_id', 'COLUMN';
GO

-- ref_book_chapter PK: mastermind_ref_book_chapter_id → mastermind_coll_book_chapter_id
EXEC sp_rename '[mastermind].[ref_book_chapter].[mastermind_ref_book_chapter_id]', 'mastermind_coll_book_chapter_id', 'COLUMN';
GO


-- ================================================================
-- 3. RENAME FK columns across all referencing tables
-- ================================================================

-- ref_book_chapter.link_mastermind_ref_book_id → link_mastermind_coll_book_id
EXEC sp_rename '[mastermind].[ref_book_chapter].[link_mastermind_ref_book_id]', 'link_mastermind_coll_book_id', 'COLUMN';
GO

-- coll_book_chunk
EXEC sp_rename '[mastermind].[coll_book_chunk].[link_mastermind_ref_book_id]', 'link_mastermind_coll_book_id', 'COLUMN';
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[mastermind].[coll_book_chunk]') AND name = 'link_mastermind_ref_book_chapter_id')
    EXEC sp_rename '[mastermind].[coll_book_chunk].[link_mastermind_ref_book_chapter_id]', 'link_mastermind_coll_book_chapter_id', 'COLUMN';
GO

-- coll_question
EXEC sp_rename '[mastermind].[coll_question].[link_mastermind_ref_book_id]', 'link_mastermind_coll_book_id', 'COLUMN';
GO
EXEC sp_rename '[mastermind].[coll_question].[link_mastermind_ref_book_chapter_id]', 'link_mastermind_coll_book_chapter_id', 'COLUMN';
GO

-- coll_exam
EXEC sp_rename '[mastermind].[coll_exam].[link_mastermind_ref_book_id]', 'link_mastermind_coll_book_id', 'COLUMN';
GO

-- coll_generation_job
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[mastermind].[coll_generation_job]') AND name = 'link_mastermind_ref_book_id')
    EXEC sp_rename '[mastermind].[coll_generation_job].[link_mastermind_ref_book_id]', 'link_mastermind_coll_book_id', 'COLUMN';
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[mastermind].[coll_generation_job]') AND name = 'link_mastermind_ref_book_chapter_id')
    EXEC sp_rename '[mastermind].[coll_generation_job].[link_mastermind_ref_book_chapter_id]', 'link_mastermind_coll_book_chapter_id', 'COLUMN';
GO

-- map_question_source
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[mastermind].[map_question_source]') AND name = 'link_mastermind_ref_book_id')
    EXEC sp_rename '[mastermind].[map_question_source].[link_mastermind_ref_book_id]', 'link_mastermind_coll_book_id', 'COLUMN';
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[mastermind].[map_question_source]') AND name = 'link_mastermind_ref_book_chapter_id')
    EXEC sp_rename '[mastermind].[map_question_source].[link_mastermind_ref_book_chapter_id]', 'link_mastermind_coll_book_chapter_id', 'COLUMN';
GO

-- coll_transparency_ledger
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[mastermind].[coll_transparency_ledger]') AND name = 'link_mastermind_ref_book_id')
    EXEC sp_rename '[mastermind].[coll_transparency_ledger].[link_mastermind_ref_book_id]', 'link_mastermind_coll_book_id', 'COLUMN';
GO


-- ================================================================
-- 4. RENAME TABLES
-- ================================================================

EXEC sp_rename '[mastermind].[ref_book]', 'coll_book';
GO
EXEC sp_rename '[mastermind].[ref_book_chapter]', 'coll_book_chapter';
GO


-- ================================================================
-- 5. RECREATE FK constraints with new names
-- ================================================================

ALTER TABLE [mastermind].[coll_book_chapter]
    ADD CONSTRAINT FK_book_chapter_book
    FOREIGN KEY (link_mastermind_coll_book_id)
    REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO

ALTER TABLE [mastermind].[coll_question]
    ADD CONSTRAINT FK_question_book
    FOREIGN KEY (link_mastermind_coll_book_id)
    REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO

ALTER TABLE [mastermind].[coll_question]
    ADD CONSTRAINT FK_question_chapter
    FOREIGN KEY (link_mastermind_coll_book_chapter_id)
    REFERENCES [mastermind].[coll_book_chapter](mastermind_coll_book_chapter_id);
GO

ALTER TABLE [mastermind].[coll_exam]
    ADD CONSTRAINT FK_exam_book
    FOREIGN KEY (link_mastermind_coll_book_id)
    REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO

ALTER TABLE [mastermind].[coll_transparency_ledger]
    ADD CONSTRAINT FK_tl_book
    FOREIGN KEY (link_mastermind_coll_book_id)
    REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO

ALTER TABLE [mastermind].[map_question_source]
    ADD CONSTRAINT FK_qs_book
    FOREIGN KEY (link_mastermind_coll_book_id)
    REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO

ALTER TABLE [mastermind].[map_question_source]
    ADD CONSTRAINT FK_qs_chapter
    FOREIGN KEY (link_mastermind_coll_book_chapter_id)
    REFERENCES [mastermind].[coll_book_chapter](mastermind_coll_book_chapter_id);
GO


-- ================================================================
-- 6. VERIFY
-- ================================================================

SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('mastermind') ORDER BY name;

SELECT
    fk.name AS constraint_name,
    OBJECT_NAME(fk.parent_object_id) AS table_name,
    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
    OBJECT_NAME(fk.referenced_object_id) AS referenced_table
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
WHERE fk.schema_id = SCHEMA_ID('mastermind')
  AND (OBJECT_NAME(fk.referenced_object_id) IN ('coll_book', 'coll_book_chapter'))
ORDER BY table_name;

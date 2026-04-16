/*
  Mastermind — Rename ref_topic → coll_quiz_topic.
  Topics grow regularly (not static) + name was vague ("topic of what?").

  Order: drop FKs → drop indexes → rename columns → rename table → recreate indexes → recreate FKs.
*/

-- ================================================================
-- 1. DROP FK constraints
-- ================================================================

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_question_topic')
    ALTER TABLE [mastermind].[coll_question] DROP CONSTRAINT FK_question_topic;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_gj_topic')
    ALTER TABLE [mastermind].[coll_generation_job] DROP CONSTRAINT FK_gj_topic;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_exam_topic')
    ALTER TABLE [mastermind].[coll_exam] DROP CONSTRAINT FK_exam_topic;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_utm_topic')
    ALTER TABLE [mastermind].[eng_user_topic_mastery] DROP CONSTRAINT FK_utm_topic;
GO


-- ================================================================
-- 2. DROP indexes that reference the column
-- ================================================================

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_question_topic_status' AND object_id = OBJECT_ID('[mastermind].[coll_question]'))
    DROP INDEX IX_question_topic_status ON [mastermind].[coll_question];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_exam_topic' AND object_id = OBJECT_ID('[mastermind].[coll_exam]'))
    DROP INDEX IX_exam_topic ON [mastermind].[coll_exam];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_user_topic' AND object_id = OBJECT_ID('[mastermind].[eng_user_topic_mastery]'))
    ALTER TABLE [mastermind].[eng_user_topic_mastery] DROP CONSTRAINT UQ_user_topic;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_mastery_topic' AND object_id = OBJECT_ID('[mastermind].[eng_user_topic_mastery]'))
    DROP INDEX IX_user_mastery_topic ON [mastermind].[eng_user_topic_mastery];
GO


-- ================================================================
-- 3. RENAME PK column on ref_topic
-- ================================================================

EXEC sp_rename '[mastermind].[ref_topic].[mastermind_ref_topic_id]', 'mastermind_coll_quiz_topic_id', 'COLUMN';
GO


-- ================================================================
-- 4. RENAME FK columns across all referencing tables
-- ================================================================

EXEC sp_rename '[mastermind].[coll_question].[link_mastermind_ref_topic_id]', 'link_mastermind_coll_quiz_topic_id', 'COLUMN';
GO

EXEC sp_rename '[mastermind].[coll_generation_job].[link_mastermind_ref_topic_id]', 'link_mastermind_coll_quiz_topic_id', 'COLUMN';
GO

EXEC sp_rename '[mastermind].[coll_exam].[link_mastermind_ref_topic_id]', 'link_mastermind_coll_quiz_topic_id', 'COLUMN';
GO

EXEC sp_rename '[mastermind].[eng_user_topic_mastery].[link_mastermind_ref_topic_id]', 'link_mastermind_coll_quiz_topic_id', 'COLUMN';
GO


-- ================================================================
-- 5. RENAME TABLE
-- ================================================================

EXEC sp_rename '[mastermind].[ref_topic]', 'coll_quiz_topic';
GO


-- ================================================================
-- 6. RECREATE indexes with new column names
-- ================================================================

CREATE INDEX IX_question_topic_status
    ON [mastermind].[coll_question](link_mastermind_coll_quiz_topic_id, question_status_code, is_active);
GO

CREATE INDEX IX_exam_topic
    ON [mastermind].[coll_exam](link_mastermind_coll_quiz_topic_id);
GO

CREATE UNIQUE INDEX UQ_user_topic
    ON [mastermind].[eng_user_topic_mastery](link_user_profile_id, link_mastermind_coll_quiz_topic_id);
GO

CREATE INDEX IX_user_mastery_topic
    ON [mastermind].[eng_user_topic_mastery](link_mastermind_coll_quiz_topic_id);
GO


-- ================================================================
-- 7. RECREATE FK constraints
-- ================================================================

ALTER TABLE [mastermind].[coll_question]
    ADD CONSTRAINT FK_question_quiz_topic
    FOREIGN KEY (link_mastermind_coll_quiz_topic_id)
    REFERENCES [mastermind].[coll_quiz_topic](mastermind_coll_quiz_topic_id);
GO

ALTER TABLE [mastermind].[coll_generation_job]
    ADD CONSTRAINT FK_gj_quiz_topic
    FOREIGN KEY (link_mastermind_coll_quiz_topic_id)
    REFERENCES [mastermind].[coll_quiz_topic](mastermind_coll_quiz_topic_id);
GO

ALTER TABLE [mastermind].[coll_exam]
    ADD CONSTRAINT FK_exam_quiz_topic
    FOREIGN KEY (link_mastermind_coll_quiz_topic_id)
    REFERENCES [mastermind].[coll_quiz_topic](mastermind_coll_quiz_topic_id);
GO

ALTER TABLE [mastermind].[eng_user_topic_mastery]
    ADD CONSTRAINT FK_utm_quiz_topic
    FOREIGN KEY (link_mastermind_coll_quiz_topic_id)
    REFERENCES [mastermind].[coll_quiz_topic](mastermind_coll_quiz_topic_id);
GO


-- ================================================================
-- 8. VERIFY — no ref_topic columns should remain
-- ================================================================

SELECT OBJECT_NAME(c.object_id) AS table_name, c.name AS column_name
FROM sys.columns c
WHERE c.name LIKE '%ref_topic%'
  AND OBJECT_SCHEMA_NAME(c.object_id) = 'mastermind'
ORDER BY table_name;
-- Expected: 0 rows

SELECT name FROM sys.tables
WHERE schema_id = SCHEMA_ID('mastermind') AND name LIKE '%topic%';
-- Expected: coll_quiz_topic only

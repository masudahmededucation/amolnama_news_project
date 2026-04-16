/*
  Mastermind — Mega rename: make ALL table names descriptive.
  16 table renames + all PK/FK columns + all indexes.

  Run in order. Includes ref_topic rename (already has separate script — skip that one).

  Strategy: Drop ALL FKs → Drop ALL indexes → Rename everything → Recreate.
*/

-- ================================================================
-- PHASE 1: DROP ALL FK CONSTRAINTS
-- ================================================================

-- coll_book_chapter
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_book_chapter_book') ALTER TABLE [mastermind].[coll_book_chapter] DROP CONSTRAINT FK_book_chapter_book;
GO

-- coll_book_chunk
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_chunk_chapter') ALTER TABLE [mastermind].[coll_book_chunk] DROP CONSTRAINT FK_chunk_chapter;
GO

-- coll_exam (→ coll_quiz)
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_exam_book') ALTER TABLE [mastermind].[coll_exam] DROP CONSTRAINT FK_exam_book;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_exam_reward_badge') ALTER TABLE [mastermind].[coll_exam] DROP CONSTRAINT FK_exam_reward_badge;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_exam_topic') ALTER TABLE [mastermind].[coll_exam] DROP CONSTRAINT FK_exam_topic;
GO

-- coll_exam_session
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_session_exam') ALTER TABLE [mastermind].[coll_exam_session] DROP CONSTRAINT FK_session_exam;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_session_user') ALTER TABLE [mastermind].[coll_exam_session] DROP CONSTRAINT FK_session_user;
GO

-- coll_exam_session_question
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_sq_question') ALTER TABLE [mastermind].[coll_exam_session_question] DROP CONSTRAINT FK_sq_question;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_sq_session') ALTER TABLE [mastermind].[coll_exam_session_question] DROP CONSTRAINT FK_sq_session;
GO

-- coll_generation_job
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_gj_book') ALTER TABLE [mastermind].[coll_generation_job] DROP CONSTRAINT FK_gj_book;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_gj_chapter') ALTER TABLE [mastermind].[coll_generation_job] DROP CONSTRAINT FK_gj_chapter;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_gj_topic') ALTER TABLE [mastermind].[coll_generation_job] DROP CONSTRAINT FK_gj_topic;
GO

-- coll_question
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_question_book') ALTER TABLE [mastermind].[coll_question] DROP CONSTRAINT FK_question_book;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_question_chapter') ALTER TABLE [mastermind].[coll_question] DROP CONSTRAINT FK_question_chapter;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_question_difficulty') ALTER TABLE [mastermind].[coll_question] DROP CONSTRAINT FK_question_difficulty;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_question_topic') ALTER TABLE [mastermind].[coll_question] DROP CONSTRAINT FK_question_topic;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_question_type') ALTER TABLE [mastermind].[coll_question] DROP CONSTRAINT FK_question_type;
GO

-- coll_question_option
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_option_question') ALTER TABLE [mastermind].[coll_question_option] DROP CONSTRAINT FK_option_question;
GO

-- coll_question_report
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qr_question') ALTER TABLE [mastermind].[coll_question_report] DROP CONSTRAINT FK_qr_question;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qr_user') ALTER TABLE [mastermind].[coll_question_report] DROP CONSTRAINT FK_qr_user;
GO

-- coll_streak_freeze
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_sf_user') ALTER TABLE [mastermind].[coll_streak_freeze] DROP CONSTRAINT FK_sf_user;
GO

-- coll_transparency_ledger
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tl_book') ALTER TABLE [mastermind].[coll_transparency_ledger] DROP CONSTRAINT FK_tl_book;
GO

-- coll_user_badge
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ub_badge') ALTER TABLE [mastermind].[coll_user_badge] DROP CONSTRAINT FK_ub_badge;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ub_user') ALTER TABLE [mastermind].[coll_user_badge] DROP CONSTRAINT FK_ub_user;
GO

-- coll_user_card
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_uc_question') ALTER TABLE [mastermind].[coll_user_card] DROP CONSTRAINT FK_uc_question;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_uc_user') ALTER TABLE [mastermind].[coll_user_card] DROP CONSTRAINT FK_uc_user;
GO

-- coll_user_streak
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_us_user') ALTER TABLE [mastermind].[coll_user_streak] DROP CONSTRAINT FK_us_user;
GO

-- eng_question_option_analytics
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qoa_option') ALTER TABLE [mastermind].[eng_question_option_analytics] DROP CONSTRAINT FK_qoa_option;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qoa_question') ALTER TABLE [mastermind].[eng_question_option_analytics] DROP CONSTRAINT FK_qoa_question;
GO

-- eng_user_topic_mastery
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_utm_topic') ALTER TABLE [mastermind].[eng_user_topic_mastery] DROP CONSTRAINT FK_utm_topic;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_utm_user') ALTER TABLE [mastermind].[eng_user_topic_mastery] DROP CONSTRAINT FK_utm_user;
GO

-- map_exam_question_pool
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_eqp_exam') ALTER TABLE [mastermind].[map_exam_question_pool] DROP CONSTRAINT FK_eqp_exam;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_eqp_question') ALTER TABLE [mastermind].[map_exam_question_pool] DROP CONSTRAINT FK_eqp_question;
GO

-- map_question_source
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qs_book') ALTER TABLE [mastermind].[map_question_source] DROP CONSTRAINT FK_qs_book;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qs_chapter') ALTER TABLE [mastermind].[map_question_source] DROP CONSTRAINT FK_qs_chapter;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qs_question') ALTER TABLE [mastermind].[map_question_source] DROP CONSTRAINT FK_qs_question;
GO

-- map_question_tag
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qt_question') ALTER TABLE [mastermind].[map_question_tag] DROP CONSTRAINT FK_qt_question;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qt_tag') ALTER TABLE [mastermind].[map_question_tag] DROP CONSTRAINT FK_qt_tag;
GO


-- ================================================================
-- PHASE 2: DROP ALL NON-PK INDEXES (that reference columns being renamed)
-- ================================================================

-- Indexes on ref_topic columns
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_question_topic_status') DROP INDEX IX_question_topic_status ON [mastermind].[coll_question];
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_exam_topic') DROP INDEX IX_exam_topic ON [mastermind].[coll_exam];
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_mastery_topic') DROP INDEX IX_user_mastery_topic ON [mastermind].[eng_user_topic_mastery];
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_user_topic' AND object_id = OBJECT_ID('[mastermind].[eng_user_topic_mastery]'))
    ALTER TABLE [mastermind].[eng_user_topic_mastery] DROP CONSTRAINT UQ_user_topic;
GO

-- Indexes on ref_badge columns
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_user_badge' AND object_id = OBJECT_ID('[mastermind].[coll_user_badge]'))
    ALTER TABLE [mastermind].[coll_user_badge] DROP CONSTRAINT UQ_user_badge;
GO

-- Indexes on ref_question_tag columns
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_question_tag_reverse') DROP INDEX IX_question_tag_reverse ON [mastermind].[map_question_tag];
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_question_tag' AND object_id = OBJECT_ID('[mastermind].[map_question_tag]'))
    ALTER TABLE [mastermind].[map_question_tag] DROP CONSTRAINT UQ_question_tag;
GO

-- Indexes on ref_difficulty_level columns
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_question_difficulty') DROP INDEX IX_question_difficulty ON [mastermind].[coll_question];
GO

-- Indexes on ref_question_type columns (none found that reference the FK column directly)

-- Indexes on coll_exam columns
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_session_exam') DROP INDEX IX_session_exam ON [mastermind].[coll_exam_session];
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_session_score') DROP INDEX IX_session_score ON [mastermind].[coll_exam_session];
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_session_user_exam') DROP INDEX IX_session_user_exam ON [mastermind].[coll_exam_session];
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_session_question_session') DROP INDEX IX_session_question_session ON [mastermind].[coll_exam_session_question];
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_session_question' AND object_id = OBJECT_ID('[mastermind].[coll_exam_session_question]'))
    ALTER TABLE [mastermind].[coll_exam_session_question] DROP CONSTRAINT UQ_session_question;
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_exam_pool_question') DROP INDEX IX_exam_pool_question ON [mastermind].[map_exam_question_pool];
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_exam_question' AND object_id = OBJECT_ID('[mastermind].[map_exam_question_pool]'))
    ALTER TABLE [mastermind].[map_exam_question_pool] DROP CONSTRAINT UQ_exam_question;
GO

-- Indexes on coll_transparency_ledger columns
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ledger_book') DROP INDEX IX_ledger_book ON [mastermind].[coll_transparency_ledger];
GO


-- ================================================================
-- PHASE 3: RENAME PK COLUMNS
-- ================================================================

-- ref_topic → coll_quiz_topic
EXEC sp_rename '[mastermind].[ref_topic].[mastermind_ref_topic_id]', 'mastermind_coll_quiz_topic_id', 'COLUMN';
GO

-- ref_badge → ref_quiz_badge
EXEC sp_rename '[mastermind].[ref_badge].[mastermind_ref_badge_id]', 'mastermind_ref_quiz_badge_id', 'COLUMN';
GO

-- ref_question_tag → ref_quiz_question_tag
EXEC sp_rename '[mastermind].[ref_question_tag].[mastermind_ref_question_tag_id]', 'mastermind_ref_quiz_question_tag_id', 'COLUMN';
GO

-- ref_difficulty_level → ref_quiz_difficulty_level
EXEC sp_rename '[mastermind].[ref_difficulty_level].[mastermind_ref_difficulty_level_id]', 'mastermind_ref_quiz_difficulty_level_id', 'COLUMN';
GO

-- ref_question_type → ref_quiz_question_type
EXEC sp_rename '[mastermind].[ref_question_type].[mastermind_ref_question_type_id]', 'mastermind_ref_quiz_question_type_id', 'COLUMN';
GO

-- coll_exam → coll_quiz
EXEC sp_rename '[mastermind].[coll_exam].[mastermind_coll_exam_id]', 'mastermind_coll_quiz_id', 'COLUMN';
GO

-- coll_exam_session → coll_quiz_session
EXEC sp_rename '[mastermind].[coll_exam_session].[mastermind_coll_exam_session_id]', 'mastermind_coll_quiz_session_id', 'COLUMN';
GO

-- coll_exam_session_question → coll_quiz_session_question
EXEC sp_rename '[mastermind].[coll_exam_session_question].[mastermind_coll_exam_session_question_id]', 'mastermind_coll_quiz_session_question_id', 'COLUMN';
GO

-- coll_transparency_ledger → coll_quiz_source_registry
EXEC sp_rename '[mastermind].[coll_transparency_ledger].[mastermind_coll_transparency_ledger_id]', 'mastermind_coll_quiz_source_registry_id', 'COLUMN';
GO

-- coll_user_badge → coll_user_quiz_badge
EXEC sp_rename '[mastermind].[coll_user_badge].[mastermind_coll_user_badge_id]', 'mastermind_coll_user_quiz_badge_id', 'COLUMN';
GO

-- map_exam_question_pool → map_quiz_question_pool
EXEC sp_rename '[mastermind].[map_exam_question_pool].[mastermind_map_exam_question_pool_id]', 'mastermind_map_quiz_question_pool_id', 'COLUMN';
GO

-- map_question_source → map_quiz_question_source
EXEC sp_rename '[mastermind].[map_question_source].[mastermind_map_question_source_id]', 'mastermind_map_quiz_question_source_id', 'COLUMN';
GO

-- map_question_tag → map_quiz_question_tag
EXEC sp_rename '[mastermind].[map_question_tag].[mastermind_map_question_tag_id]', 'mastermind_map_quiz_question_tag_id', 'COLUMN';
GO

-- eng_embedding → eng_quiz_semantic_embedding
EXEC sp_rename '[mastermind].[eng_embedding].[mastermind_eng_embedding_id]', 'mastermind_eng_quiz_semantic_embedding_id', 'COLUMN';
GO

-- eng_question_option_analytics → eng_quiz_question_option_analytics
EXEC sp_rename '[mastermind].[eng_question_option_analytics].[mastermind_eng_question_option_analytics_id]', 'mastermind_eng_quiz_question_option_analytics_id', 'COLUMN';
GO

-- eng_user_topic_mastery → eng_user_quiz_topic_mastery
EXEC sp_rename '[mastermind].[eng_user_topic_mastery].[mastermind_eng_user_topic_mastery_id]', 'mastermind_eng_user_quiz_topic_mastery_id', 'COLUMN';
GO


-- ================================================================
-- PHASE 4: RENAME FK COLUMNS
-- ================================================================

-- link_mastermind_ref_topic_id → link_mastermind_coll_quiz_topic_id (4 tables)
EXEC sp_rename '[mastermind].[coll_question].[link_mastermind_ref_topic_id]', 'link_mastermind_coll_quiz_topic_id', 'COLUMN';
GO
EXEC sp_rename '[mastermind].[coll_exam].[link_mastermind_ref_topic_id]', 'link_mastermind_coll_quiz_topic_id', 'COLUMN';
GO
EXEC sp_rename '[mastermind].[coll_generation_job].[link_mastermind_ref_topic_id]', 'link_mastermind_coll_quiz_topic_id', 'COLUMN';
GO
EXEC sp_rename '[mastermind].[eng_user_topic_mastery].[link_mastermind_ref_topic_id]', 'link_mastermind_coll_quiz_topic_id', 'COLUMN';
GO

-- link_mastermind_ref_badge_id → link_mastermind_ref_quiz_badge_id (1 table)
EXEC sp_rename '[mastermind].[coll_user_badge].[link_mastermind_ref_badge_id]', 'link_mastermind_ref_quiz_badge_id', 'COLUMN';
GO

-- link_reward_badge_id → stays as-is (short name, in coll_exam which becomes coll_quiz)

-- link_mastermind_ref_question_tag_id → link_mastermind_ref_quiz_question_tag_id (1 table)
EXEC sp_rename '[mastermind].[map_question_tag].[link_mastermind_ref_question_tag_id]', 'link_mastermind_ref_quiz_question_tag_id', 'COLUMN';
GO

-- link_mastermind_ref_difficulty_level_id → link_mastermind_ref_quiz_difficulty_level_id (1 table)
EXEC sp_rename '[mastermind].[coll_question].[link_mastermind_ref_difficulty_level_id]', 'link_mastermind_ref_quiz_difficulty_level_id', 'COLUMN';
GO

-- link_mastermind_ref_question_type_id → link_mastermind_ref_quiz_question_type_id (1 table)
EXEC sp_rename '[mastermind].[coll_question].[link_mastermind_ref_question_type_id]', 'link_mastermind_ref_quiz_question_type_id', 'COLUMN';
GO

-- link_mastermind_coll_exam_id → link_mastermind_coll_quiz_id (3 tables)
EXEC sp_rename '[mastermind].[coll_exam_session].[link_mastermind_coll_exam_id]', 'link_mastermind_coll_quiz_id', 'COLUMN';
GO
EXEC sp_rename '[mastermind].[map_exam_question_pool].[link_mastermind_coll_exam_id]', 'link_mastermind_coll_quiz_id', 'COLUMN';
GO

-- link_mastermind_coll_exam_session_id → link_mastermind_coll_quiz_session_id (1 table)
EXEC sp_rename '[mastermind].[coll_exam_session_question].[link_mastermind_coll_exam_session_id]', 'link_mastermind_coll_quiz_session_id', 'COLUMN';
GO


-- ================================================================
-- PHASE 5: RENAME TABLES
-- ================================================================

EXEC sp_rename '[mastermind].[ref_topic]', 'coll_quiz_topic';
GO
EXEC sp_rename '[mastermind].[ref_badge]', 'ref_quiz_badge';
GO
EXEC sp_rename '[mastermind].[ref_question_tag]', 'ref_quiz_question_tag';
GO
EXEC sp_rename '[mastermind].[ref_difficulty_level]', 'ref_quiz_difficulty_level';
GO
EXEC sp_rename '[mastermind].[ref_question_type]', 'ref_quiz_question_type';
GO
EXEC sp_rename '[mastermind].[coll_exam]', 'coll_quiz';
GO
EXEC sp_rename '[mastermind].[coll_exam_session]', 'coll_quiz_session';
GO
EXEC sp_rename '[mastermind].[coll_exam_session_question]', 'coll_quiz_session_question';
GO
EXEC sp_rename '[mastermind].[coll_transparency_ledger]', 'coll_quiz_source_registry';
GO
EXEC sp_rename '[mastermind].[coll_user_badge]', 'coll_user_quiz_badge';
GO
EXEC sp_rename '[mastermind].[map_exam_question_pool]', 'map_quiz_question_pool';
GO
EXEC sp_rename '[mastermind].[map_question_source]', 'map_quiz_question_source';
GO
EXEC sp_rename '[mastermind].[map_question_tag]', 'map_quiz_question_tag';
GO
EXEC sp_rename '[mastermind].[eng_embedding]', 'eng_quiz_semantic_embedding';
GO
EXEC sp_rename '[mastermind].[eng_question_option_analytics]', 'eng_quiz_question_option_analytics';
GO
EXEC sp_rename '[mastermind].[eng_user_topic_mastery]', 'eng_user_quiz_topic_mastery';
GO


-- ================================================================
-- PHASE 6: RECREATE INDEXES (using new column names)
-- ================================================================

-- coll_question indexes
CREATE INDEX IX_question_quiz_topic_status ON [mastermind].[coll_question](link_mastermind_coll_quiz_topic_id, question_status_code, is_active);
GO
CREATE INDEX IX_question_quiz_difficulty ON [mastermind].[coll_question](link_mastermind_ref_quiz_difficulty_level_id, is_active);
GO

-- coll_quiz (was coll_exam) indexes
CREATE INDEX IX_quiz_topic ON [mastermind].[coll_quiz](link_mastermind_coll_quiz_topic_id, exam_status_code, is_active);
GO

-- coll_quiz_session indexes
CREATE INDEX IX_quiz_session_quiz ON [mastermind].[coll_quiz_session](link_mastermind_coll_quiz_id, session_status_code);
GO
CREATE INDEX IX_quiz_session_score ON [mastermind].[coll_quiz_session](link_mastermind_coll_quiz_id, session_score_percentage);
GO
CREATE INDEX IX_quiz_session_user_quiz ON [mastermind].[coll_quiz_session](link_user_profile_id, link_mastermind_coll_quiz_id, session_attempt_number);
GO

-- coll_quiz_session_question indexes
CREATE INDEX IX_quiz_session_question_session ON [mastermind].[coll_quiz_session_question](link_mastermind_coll_quiz_session_id, question_display_order);
GO
ALTER TABLE [mastermind].[coll_quiz_session_question]
    ADD CONSTRAINT UQ_quiz_session_question UNIQUE (link_mastermind_coll_quiz_session_id, link_mastermind_coll_question_id);
GO

-- coll_user_quiz_badge indexes
ALTER TABLE [mastermind].[coll_user_quiz_badge]
    ADD CONSTRAINT UQ_user_quiz_badge UNIQUE (link_user_profile_id, link_mastermind_ref_quiz_badge_id);
GO

-- eng_user_quiz_topic_mastery indexes
ALTER TABLE [mastermind].[eng_user_quiz_topic_mastery]
    ADD CONSTRAINT UQ_user_quiz_topic UNIQUE (link_user_profile_id, link_mastermind_coll_quiz_topic_id);
GO
CREATE INDEX IX_user_quiz_mastery_topic ON [mastermind].[eng_user_quiz_topic_mastery](link_mastermind_coll_quiz_topic_id, accuracy_percentage);
GO

-- map_quiz_question_pool indexes
CREATE INDEX IX_quiz_pool_question ON [mastermind].[map_quiz_question_pool](link_mastermind_coll_question_id);
GO
ALTER TABLE [mastermind].[map_quiz_question_pool]
    ADD CONSTRAINT UQ_quiz_question_pool UNIQUE (link_mastermind_coll_quiz_id, link_mastermind_coll_question_id);
GO

-- map_quiz_question_tag indexes
CREATE INDEX IX_quiz_question_tag_reverse ON [mastermind].[map_quiz_question_tag](link_mastermind_ref_quiz_question_tag_id);
GO
ALTER TABLE [mastermind].[map_quiz_question_tag]
    ADD CONSTRAINT UQ_quiz_question_tag UNIQUE (link_mastermind_coll_question_id, link_mastermind_ref_quiz_question_tag_id);
GO

-- coll_quiz_source_registry indexes
CREATE INDEX IX_quiz_source_registry_book ON [mastermind].[coll_quiz_source_registry](link_mastermind_coll_book_id, is_active);
GO


-- ================================================================
-- PHASE 7: RECREATE FK CONSTRAINTS
-- ================================================================

-- coll_book_chapter → coll_book
ALTER TABLE [mastermind].[coll_book_chapter] ADD CONSTRAINT FK_book_chapter_book
    FOREIGN KEY (link_mastermind_coll_book_id) REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO

-- coll_book_chunk → coll_book_chapter
ALTER TABLE [mastermind].[coll_book_chunk] ADD CONSTRAINT FK_chunk_chapter
    FOREIGN KEY (link_mastermind_coll_book_chapter_id) REFERENCES [mastermind].[coll_book_chapter](mastermind_coll_book_chapter_id);
GO

-- coll_quiz → coll_book, coll_quiz_topic, ref_quiz_badge
ALTER TABLE [mastermind].[coll_quiz] ADD CONSTRAINT FK_quiz_book
    FOREIGN KEY (link_mastermind_coll_book_id) REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO
ALTER TABLE [mastermind].[coll_quiz] ADD CONSTRAINT FK_quiz_topic
    FOREIGN KEY (link_mastermind_coll_quiz_topic_id) REFERENCES [mastermind].[coll_quiz_topic](mastermind_coll_quiz_topic_id);
GO
ALTER TABLE [mastermind].[coll_quiz] ADD CONSTRAINT FK_quiz_reward_badge
    FOREIGN KEY (link_reward_badge_id) REFERENCES [mastermind].[ref_quiz_badge](mastermind_ref_quiz_badge_id);
GO

-- coll_quiz_session → coll_quiz, user_profile
ALTER TABLE [mastermind].[coll_quiz_session] ADD CONSTRAINT FK_quiz_session_quiz
    FOREIGN KEY (link_mastermind_coll_quiz_id) REFERENCES [mastermind].[coll_quiz](mastermind_coll_quiz_id);
GO
ALTER TABLE [mastermind].[coll_quiz_session] ADD CONSTRAINT FK_quiz_session_user
    FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id);
GO

-- coll_quiz_session_question → coll_quiz_session, coll_question
ALTER TABLE [mastermind].[coll_quiz_session_question] ADD CONSTRAINT FK_quiz_sq_session
    FOREIGN KEY (link_mastermind_coll_quiz_session_id) REFERENCES [mastermind].[coll_quiz_session](mastermind_coll_quiz_session_id);
GO
ALTER TABLE [mastermind].[coll_quiz_session_question] ADD CONSTRAINT FK_quiz_sq_question
    FOREIGN KEY (link_mastermind_coll_question_id) REFERENCES [mastermind].[coll_question](mastermind_coll_question_id);
GO

-- coll_generation_job → coll_book, coll_book_chapter, coll_quiz_topic
ALTER TABLE [mastermind].[coll_generation_job] ADD CONSTRAINT FK_gj_book
    FOREIGN KEY (link_mastermind_coll_book_id) REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO
ALTER TABLE [mastermind].[coll_generation_job] ADD CONSTRAINT FK_gj_chapter
    FOREIGN KEY (link_mastermind_coll_book_chapter_id) REFERENCES [mastermind].[coll_book_chapter](mastermind_coll_book_chapter_id);
GO
ALTER TABLE [mastermind].[coll_generation_job] ADD CONSTRAINT FK_gj_quiz_topic
    FOREIGN KEY (link_mastermind_coll_quiz_topic_id) REFERENCES [mastermind].[coll_quiz_topic](mastermind_coll_quiz_topic_id);
GO

-- coll_question → coll_book, coll_book_chapter, coll_quiz_topic, ref_quiz_difficulty_level, ref_quiz_question_type
ALTER TABLE [mastermind].[coll_question] ADD CONSTRAINT FK_question_book
    FOREIGN KEY (link_mastermind_coll_book_id) REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO
ALTER TABLE [mastermind].[coll_question] ADD CONSTRAINT FK_question_chapter
    FOREIGN KEY (link_mastermind_coll_book_chapter_id) REFERENCES [mastermind].[coll_book_chapter](mastermind_coll_book_chapter_id);
GO
ALTER TABLE [mastermind].[coll_question] ADD CONSTRAINT FK_question_quiz_topic
    FOREIGN KEY (link_mastermind_coll_quiz_topic_id) REFERENCES [mastermind].[coll_quiz_topic](mastermind_coll_quiz_topic_id);
GO
ALTER TABLE [mastermind].[coll_question] ADD CONSTRAINT FK_question_quiz_difficulty
    FOREIGN KEY (link_mastermind_ref_quiz_difficulty_level_id) REFERENCES [mastermind].[ref_quiz_difficulty_level](mastermind_ref_quiz_difficulty_level_id);
GO
ALTER TABLE [mastermind].[coll_question] ADD CONSTRAINT FK_question_quiz_type
    FOREIGN KEY (link_mastermind_ref_quiz_question_type_id) REFERENCES [mastermind].[ref_quiz_question_type](mastermind_ref_quiz_question_type_id);
GO

-- coll_question_option → coll_question
ALTER TABLE [mastermind].[coll_question_option] ADD CONSTRAINT FK_option_question
    FOREIGN KEY (link_mastermind_coll_question_id) REFERENCES [mastermind].[coll_question](mastermind_coll_question_id);
GO

-- coll_question_report → coll_question, user_profile
ALTER TABLE [mastermind].[coll_question_report] ADD CONSTRAINT FK_qr_question
    FOREIGN KEY (link_mastermind_coll_question_id) REFERENCES [mastermind].[coll_question](mastermind_coll_question_id);
GO
ALTER TABLE [mastermind].[coll_question_report] ADD CONSTRAINT FK_qr_user
    FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id);
GO

-- coll_streak_freeze → user_profile
ALTER TABLE [mastermind].[coll_streak_freeze] ADD CONSTRAINT FK_sf_user
    FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id);
GO

-- coll_quiz_source_registry → coll_book
ALTER TABLE [mastermind].[coll_quiz_source_registry] ADD CONSTRAINT FK_quiz_source_registry_book
    FOREIGN KEY (link_mastermind_coll_book_id) REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO

-- coll_user_quiz_badge → ref_quiz_badge, user_profile
ALTER TABLE [mastermind].[coll_user_quiz_badge] ADD CONSTRAINT FK_user_quiz_badge_badge
    FOREIGN KEY (link_mastermind_ref_quiz_badge_id) REFERENCES [mastermind].[ref_quiz_badge](mastermind_ref_quiz_badge_id);
GO
ALTER TABLE [mastermind].[coll_user_quiz_badge] ADD CONSTRAINT FK_user_quiz_badge_user
    FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id);
GO

-- coll_user_card → coll_question, user_profile
ALTER TABLE [mastermind].[coll_user_card] ADD CONSTRAINT FK_uc_question
    FOREIGN KEY (link_mastermind_coll_question_id) REFERENCES [mastermind].[coll_question](mastermind_coll_question_id);
GO
ALTER TABLE [mastermind].[coll_user_card] ADD CONSTRAINT FK_uc_user
    FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id);
GO

-- coll_user_streak → user_profile
ALTER TABLE [mastermind].[coll_user_streak] ADD CONSTRAINT FK_us_user
    FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id);
GO

-- eng_quiz_question_option_analytics → coll_question, coll_question_option
ALTER TABLE [mastermind].[eng_quiz_question_option_analytics] ADD CONSTRAINT FK_qoa_question
    FOREIGN KEY (link_mastermind_coll_question_id) REFERENCES [mastermind].[coll_question](mastermind_coll_question_id);
GO
ALTER TABLE [mastermind].[eng_quiz_question_option_analytics] ADD CONSTRAINT FK_qoa_option
    FOREIGN KEY (link_mastermind_coll_question_option_id) REFERENCES [mastermind].[coll_question_option](mastermind_coll_question_option_id);
GO

-- eng_user_quiz_topic_mastery → coll_quiz_topic, user_profile
ALTER TABLE [mastermind].[eng_user_quiz_topic_mastery] ADD CONSTRAINT FK_utm_quiz_topic
    FOREIGN KEY (link_mastermind_coll_quiz_topic_id) REFERENCES [mastermind].[coll_quiz_topic](mastermind_coll_quiz_topic_id);
GO
ALTER TABLE [mastermind].[eng_user_quiz_topic_mastery] ADD CONSTRAINT FK_utm_user
    FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id);
GO

-- map_quiz_question_pool → coll_quiz, coll_question
ALTER TABLE [mastermind].[map_quiz_question_pool] ADD CONSTRAINT FK_quiz_pool_quiz
    FOREIGN KEY (link_mastermind_coll_quiz_id) REFERENCES [mastermind].[coll_quiz](mastermind_coll_quiz_id);
GO
ALTER TABLE [mastermind].[map_quiz_question_pool] ADD CONSTRAINT FK_quiz_pool_question
    FOREIGN KEY (link_mastermind_coll_question_id) REFERENCES [mastermind].[coll_question](mastermind_coll_question_id);
GO

-- map_quiz_question_source → coll_question, coll_book, coll_book_chapter
ALTER TABLE [mastermind].[map_quiz_question_source] ADD CONSTRAINT FK_quiz_qs_question
    FOREIGN KEY (link_mastermind_coll_question_id) REFERENCES [mastermind].[coll_question](mastermind_coll_question_id);
GO
ALTER TABLE [mastermind].[map_quiz_question_source] ADD CONSTRAINT FK_quiz_qs_book
    FOREIGN KEY (link_mastermind_coll_book_id) REFERENCES [mastermind].[coll_book](mastermind_coll_book_id);
GO
ALTER TABLE [mastermind].[map_quiz_question_source] ADD CONSTRAINT FK_quiz_qs_chapter
    FOREIGN KEY (link_mastermind_coll_book_chapter_id) REFERENCES [mastermind].[coll_book_chapter](mastermind_coll_book_chapter_id);
GO

-- map_quiz_question_tag → coll_question, ref_quiz_question_tag
ALTER TABLE [mastermind].[map_quiz_question_tag] ADD CONSTRAINT FK_quiz_qt_question
    FOREIGN KEY (link_mastermind_coll_question_id) REFERENCES [mastermind].[coll_question](mastermind_coll_question_id);
GO
ALTER TABLE [mastermind].[map_quiz_question_tag] ADD CONSTRAINT FK_quiz_qt_tag
    FOREIGN KEY (link_mastermind_ref_quiz_question_tag_id) REFERENCES [mastermind].[ref_quiz_question_tag](mastermind_ref_quiz_question_tag_id);
GO


-- ================================================================
-- PHASE 8: VERIFY
-- ================================================================

-- All tables should now have descriptive names
SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('mastermind') ORDER BY name;

-- No old names should remain in columns
SELECT OBJECT_NAME(c.object_id) AS table_name, c.name AS column_name
FROM sys.columns c
WHERE OBJECT_SCHEMA_NAME(c.object_id) = 'mastermind'
  AND (c.name LIKE '%ref_topic_id%'
    OR c.name LIKE '%ref_badge_id%'
    OR c.name LIKE '%ref_question_tag_id%'
    OR c.name LIKE '%ref_difficulty_level_id%'
    OR c.name LIKE '%ref_question_type_id%'
    OR c.name LIKE '%coll_exam_id%'
    OR c.name LIKE '%coll_exam_session%'
    OR c.name LIKE '%transparency_ledger%'
    OR c.name LIKE '%eng_embedding_id%'
    OR c.name LIKE '%eng_question_option_analytics_id%'
    OR c.name LIKE '%eng_user_topic_mastery_id%'
    OR c.name LIKE '%map_exam_question_pool%'
    OR c.name LIKE '%map_question_source_id%'
    OR c.name LIKE '%map_question_tag_id%')
ORDER BY table_name, column_name;
-- Expected: 0 rows

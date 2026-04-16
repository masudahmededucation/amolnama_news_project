/*
  Mastermind — Quiz Builder V1 schema changes.
  Run once, in order. Idempotent where possible.
*/

-- ---------------------------------------------------------
-- 1. New question type: essay (paragraph / open-ended).
--    Not auto-gradable; reviewer grades manually in V2.
-- ---------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM [mastermind].[ref_question_type]
    WHERE question_type_code = 'essay'
)
INSERT INTO [mastermind].[ref_question_type]
    (question_type_code, question_type_name_bn, question_type_name_en,
     is_auto_gradable, sort_order, is_active)
VALUES
    ('essay', N'বিস্তারিত উত্তর', 'Essay (Paragraph)', 0, 6, 1);
GO


-- ---------------------------------------------------------
-- 2. Reward columns on coll_exam.
--    Each ALTER is wrapped in EXISTS so rerun is safe.
-- ---------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[mastermind].[coll_exam]')
      AND name = 'exam_rewards_enabled'
)
ALTER TABLE [mastermind].[coll_exam]
    ADD exam_rewards_enabled BIT NOT NULL DEFAULT 0;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[mastermind].[coll_exam]')
      AND name = 'exam_reward_criteria_code'
)
ALTER TABLE [mastermind].[coll_exam]
    ADD exam_reward_criteria_code NVARCHAR(20) NULL;  -- 'top_n', 'threshold', 'speed'
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[mastermind].[coll_exam]')
      AND name = 'exam_reward_threshold_percent'
)
ALTER TABLE [mastermind].[coll_exam]
    ADD exam_reward_threshold_percent DECIMAL(5,2) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[mastermind].[coll_exam]')
      AND name = 'exam_reward_top_n'
)
ALTER TABLE [mastermind].[coll_exam]
    ADD exam_reward_top_n INT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[mastermind].[coll_exam]')
      AND name = 'link_reward_badge_id'
)
ALTER TABLE [mastermind].[coll_exam]
    ADD link_reward_badge_id INT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[mastermind].[coll_exam]')
      AND name = 'exam_reward_description'
)
ALTER TABLE [mastermind].[coll_exam]
    ADD exam_reward_description NVARCHAR(500) NULL;
GO

-- FK to ref_badge (only if table + column exist)
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'[mastermind].[coll_exam]')
      AND name = 'FK_exam_reward_badge'
)
ALTER TABLE [mastermind].[coll_exam]
    ADD CONSTRAINT FK_exam_reward_badge
    FOREIGN KEY (link_reward_badge_id)
    REFERENCES [mastermind].[ref_badge](mastermind_ref_badge_id);
GO


-- ---------------------------------------------------------
-- 3. Verify: list the new columns + the new question type row.
-- ---------------------------------------------------------
SELECT question_type_code, question_type_name_bn, question_type_name_en, is_auto_gradable
FROM [mastermind].[ref_question_type]
ORDER BY sort_order;

SELECT name AS new_column, system_type_name = TYPE_NAME(system_type_id)
FROM sys.columns
WHERE object_id = OBJECT_ID(N'[mastermind].[coll_exam]')
  AND name IN (
      'exam_rewards_enabled', 'exam_reward_criteria_code',
      'exam_reward_threshold_percent', 'exam_reward_top_n',
      'link_reward_badge_id', 'exam_reward_description'
  )
ORDER BY name;

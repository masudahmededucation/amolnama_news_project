/*
  Mastermind — Add scheduling columns to coll_quiz.
  Auto-publish at a future datetime, auto-close after a deadline.
*/

-- 1. Add columns
ALTER TABLE [mastermind].[coll_quiz]
    ADD exam_scheduled_publish_at DATETIME2 NULL,
        exam_scheduled_close_at   DATETIME2 NULL;
GO

-- 2. Update dictionary
EXEC sp_updateextendedproperty 'MS_Description',
  'Quiz definitions — title, rules, scoring, rewards, scheduling. Staff create; users take. Grows with content.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_quiz';
GO

-- 3. Verify
SELECT c.name, t.name AS type_name
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('[mastermind].[coll_quiz]')
  AND c.name LIKE '%scheduled%';

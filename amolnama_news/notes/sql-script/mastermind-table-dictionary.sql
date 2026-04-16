/*
  Mastermind — Table dictionary via SQL Server extended properties.
  Stores a description on every table. Queryable, visible in SSMS,
  survives backups/restores.

  View all: SELECT * FROM fn_listextendedproperty('MS_Description', 'SCHEMA', 'mastermind', 'TABLE', default, NULL, NULL);
*/

-- ================================================================
-- Collection tables (growing data)
-- ================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Source books/PDFs ingested for quiz question generation. Staff uploads, AI pipeline processes. Grows per ingestion.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_book';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Chapters within source books. Used to map questions back to specific sections for source citation.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_book_chapter';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'OCR text chunks extracted from book pages (~300 words each). Fed to AI for question generation. One book = many chunks.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_book_chunk';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Quiz/exam definitions — title, rules, scoring, rewards, shuffle settings. The main quiz entity. Staff creates via Quiz Panel.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_quiz';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'One user''s attempt at taking a quiz. Tracks score, time, pass/fail, attempt number. Created when user starts a quiz.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_quiz_session';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Per-question response within a quiz session. Stores selected option, correctness, time spent, bookmarked status.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_quiz_session_question';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Quiz subject areas — bd_constitution, bcs_exam, uk_driving_theory, etc. Admin adds new topics as platform expands.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_quiz_topic';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Universal question bank — AI-generated and manual. Each question has type, difficulty, topic, source citation, NLI scores.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_question';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Answer options per question (ক/খ/গ/ঘ for MCQ, সত্য/মিথ্যা for true/false, answer text for fill-blank).',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_question_option';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'User-submitted reports on problematic questions (wrong answer, unclear text, duplicate). Staff reviews via Quiz Panel.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_question_report';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'AI question-generation run records. Tracks book, topic, model, chunks processed, questions created/rejected, duration.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_generation_job';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Background task tracking for long-running operations (PDF ingestion, bulk generation). Stores progress and result.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_background_job';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Public registry of books used for question generation. Proves questions are sourced from real books (anti-bias transparency).',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_quiz_source_registry';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Quiz badges earned by users. Links user to badge with earned timestamp. Unique constraint prevents duplicate awards.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_user_quiz_badge';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Spaced-repetition flashcards per user. Tracks ease factor, interval, repetition count for Anki SM-2 algorithm.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_user_card';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Daily activity streak records. One row per user per active day. Used to calculate consecutive-day streaks.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_user_streak';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Streak freeze tokens. Prevents streak break on missed days. Earned through quiz performance or granted by admin.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_streak_freeze';
GO


-- ================================================================
-- Reference tables (static/admin-only, rarely changes)
-- ================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Quiz achievement badge definitions (first_quiz, perfect_score, streak_7, etc.). Admin creates. Users earn them.',
  'SCHEMA', 'mastermind', 'TABLE', 'ref_quiz_badge';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Question difficulty levels — easy, medium, hard, expert. Fixed 4 rows. Never changes.',
  'SCHEMA', 'mastermind', 'TABLE', 'ref_quiz_difficulty_level';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Question type definitions — mcq_single, mcq_multi, true_false, fill_blank, essay. Fixed rows.',
  'SCHEMA', 'mastermind', 'TABLE', 'ref_quiz_question_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Cross-cutting tags for organizing questions (e.g. article-7, fundamental-rights). Staff assigns via Quiz Panel.',
  'SCHEMA', 'mastermind', 'TABLE', 'ref_quiz_question_tag';
GO


-- ================================================================
-- Engine tables (computed/derived data)
-- ================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Semantic vector embeddings for questions and chunks. Used for deduplication and similarity search. Stored as varbinary(max).',
  'SCHEMA', 'mastermind', 'TABLE', 'eng_quiz_semantic_embedding';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Per-option analytics — how many times each option was selected and how often correctly. Updated after each quiz session.',
  'SCHEMA', 'mastermind', 'TABLE', 'eng_quiz_question_option_analytics';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Per-user proficiency per quiz topic. Tracks questions attempted, correct, accuracy %, mastery level (familiar/proficient/mastered).',
  'SCHEMA', 'mastermind', 'TABLE', 'eng_user_quiz_topic_mastery';
GO


-- ================================================================
-- Junction/mapping tables (many-to-many relationships)
-- ================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Maps which questions belong to which quiz''s question pool. A question can appear in multiple quizzes.',
  'SCHEMA', 'mastermind', 'TABLE', 'map_quiz_question_pool';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Maps questions to their source book/chapter/page citations. A question can cite multiple sources.',
  'SCHEMA', 'mastermind', 'TABLE', 'map_quiz_question_source';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Maps questions to tags for cross-cutting categorization. Many-to-many between questions and tags.',
  'SCHEMA', 'mastermind', 'TABLE', 'map_quiz_question_tag';
GO


-- ================================================================
-- VERIFY — list all descriptions
-- ================================================================

SELECT t.name AS table_name, ep.value AS description
FROM sys.tables t
LEFT JOIN sys.extended_properties ep
  ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
WHERE t.schema_id = SCHEMA_ID('mastermind')
ORDER BY t.name;

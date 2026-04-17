/* ------------------------------------------------------------------ */
/*  Mastermind — add 'ordering' + 'essay' question types               */
/*                                                                    */
/*  Why:                                                              */
/*    Mastermind already supports mcq_single, mcq_multi, true_false,  */
/*    fill_blank, short_answer, matching. Closing the gap with        */
/*    Moodle/Canvas requires:                                         */
/*      - 'ordering' — student arranges items into the correct order */
/*      - 'essay'    — long-answer with manual grading                 */
/*                                                                    */
/*  Storage decisions:                                                 */
/*    - 'ordering' reuses [coll_question_option] — sort_order is the   */
/*      canonical correct sequence. No new table needed.               */
/*    - 'essay' is auto-gradable=0; uses short_answer_text on the      */
/*      session question row, like short_answer.                       */
/*    - To capture the student's response for matching + ordering, we  */
/*      add two NVARCHAR(MAX) JSON columns to coll_quiz_session_       */
/*      question. Cleanest path that keeps the engine generic.         */
/*                                                                    */
/*  Run in SSMS while connected to the amolnama_news database.         */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  1. Seed new question types                                        */
/* ------------------------------------------------------------------ */

IF NOT EXISTS (
    SELECT 1 FROM [mastermind].[ref_quiz_question_type] WHERE question_type_code = 'ordering'
)
BEGIN
    INSERT INTO [mastermind].[ref_quiz_question_type]
        (question_type_code, question_type_name_bn, question_type_name_en, is_auto_gradable, sort_order, is_active)
    VALUES
        ('ordering', N'ক্রম সাজানো', 'Ordering / Sequence', 1, 7, 1);
    PRINT 'Inserted question type: ordering';
END
ELSE
BEGIN
    PRINT 'Question type already exists: ordering';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM [mastermind].[ref_quiz_question_type] WHERE question_type_code = 'essay'
)
BEGIN
    INSERT INTO [mastermind].[ref_quiz_question_type]
        (question_type_code, question_type_name_bn, question_type_name_en, is_auto_gradable, sort_order, is_active)
    VALUES
        ('essay', N'রচনা / দীর্ঘ উত্তর', 'Essay / Long Answer', 0, 8, 1);
    PRINT 'Inserted question type: essay';
END
ELSE
BEGIN
    PRINT 'Question type already exists: essay';
END
GO

/* ------------------------------------------------------------------ */
/*  2. Add response-capture JSON columns to coll_quiz_session_question */
/*     - matching_pairs_json: student's pair selections                */
/*     - ordering_option_ids_json: student's ordering of options       */
/*  Both NVARCHAR(MAX) NULL because not every question type uses them. */
/* ------------------------------------------------------------------ */

IF NOT EXISTS (
    SELECT 1
    FROM   sys.columns
    WHERE  object_id = OBJECT_ID(N'[mastermind].[coll_quiz_session_question]')
    AND    name      = N'matching_pairs_json'
)
BEGIN
    ALTER TABLE [mastermind].[coll_quiz_session_question]
        ADD matching_pairs_json NVARCHAR(MAX) NULL;
    PRINT 'Added column: matching_pairs_json';
END
ELSE
BEGIN
    PRINT 'Column already exists: matching_pairs_json';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM   sys.columns
    WHERE  object_id = OBJECT_ID(N'[mastermind].[coll_quiz_session_question]')
    AND    name      = N'ordering_option_ids_json'
)
BEGIN
    ALTER TABLE [mastermind].[coll_quiz_session_question]
        ADD ordering_option_ids_json NVARCHAR(MAX) NULL;
    PRINT 'Added column: ordering_option_ids_json';
END
ELSE
BEGIN
    PRINT 'Column already exists: ordering_option_ids_json';
END
GO

/* ------------------------------------------------------------------ */
/*  3. MS_Description for the new columns                              */
/* ------------------------------------------------------------------ */

IF NOT EXISTS (
    SELECT 1 FROM sys.extended_properties
    WHERE  major_id = OBJECT_ID(N'[mastermind].[coll_quiz_session_question]')
    AND    minor_id = COLUMNPROPERTY(OBJECT_ID(N'[mastermind].[coll_quiz_session_question]'), N'matching_pairs_json', 'ColumnId')
    AND    name     = N'MS_Description'
)
BEGIN
    EXEC sp_addextendedproperty
        @name      = N'MS_Description',
        @value     = N'JSON array of {stem_pair_id, response_pair_id} objects representing the student''s matching answer. NULL if not a matching question.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_quiz_session_question',
        @level2type = N'COLUMN', @level2name = N'matching_pairs_json';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.extended_properties
    WHERE  major_id = OBJECT_ID(N'[mastermind].[coll_quiz_session_question]')
    AND    minor_id = COLUMNPROPERTY(OBJECT_ID(N'[mastermind].[coll_quiz_session_question]'), N'ordering_option_ids_json', 'ColumnId')
    AND    name     = N'MS_Description'
)
BEGIN
    EXEC sp_addextendedproperty
        @name      = N'MS_Description',
        @value     = N'JSON array of option IDs in the order the student arranged them. Compared against coll_question_option.sort_order to grade. NULL if not an ordering question.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_quiz_session_question',
        @level2type = N'COLUMN', @level2name = N'ordering_option_ids_json';
END
GO

/* ------------------------------------------------------------------ */
/*  4. Verification                                                    */
/* ------------------------------------------------------------------ */

SELECT question_type_code, question_type_name_en, is_auto_gradable, sort_order, is_active
FROM   [mastermind].[ref_quiz_question_type]
WHERE  question_type_code IN ('ordering', 'essay', 'matching')
ORDER BY sort_order;
GO

SELECT sys.columns.name AS column_name, sys.types.name AS data_type, sys.columns.max_length, sys.columns.is_nullable
FROM   sys.columns
JOIN   sys.types ON sys.types.user_type_id = sys.columns.user_type_id
WHERE  sys.columns.object_id = OBJECT_ID(N'[mastermind].[coll_quiz_session_question]')
AND    sys.columns.name IN ('matching_pairs_json', 'ordering_option_ids_json');
GO

/* ------------------------------------------------------------------ */
/*  Mastermind — fixup for question types + session columns            */
/*                                                                    */
/*  Context: a previous run of mastermind-question-types-ordering-     */
/*  essay.sql applied partially. The DB verify showed:                 */
/*    - 'essay' already present (pre-existing, id=6, sort_order=6)     */
/*    - 'matching' MISSING from ref_quiz_question_type                 */
/*    - 'ordering' MISSING from ref_quiz_question_type                 */
/*    - matching_pairs_json column MISSING on coll_quiz_session_        */
/*      question                                                       */
/*    - ordering_option_ids_json column MISSING                        */
/*                                                                    */
/*  This fixup is fully idempotent — safe to re-run.                   */
/* ------------------------------------------------------------------ */

/* 1. Seed 'matching' type -------------------------------------- */

IF NOT EXISTS (
    SELECT 1 FROM [mastermind].[ref_quiz_question_type] WHERE question_type_code = 'matching'
)
BEGIN
    INSERT INTO [mastermind].[ref_quiz_question_type]
        (question_type_code, question_type_name_bn, question_type_name_en, is_auto_gradable, sort_order, is_active)
    VALUES
        ('matching', N'মিলকরণ', 'Matching', 1, 7, 1);
    PRINT 'Inserted question type: matching';
END
ELSE PRINT 'Already present: matching';
GO

/* 2. Seed 'ordering' type -------------------------------------- */

IF NOT EXISTS (
    SELECT 1 FROM [mastermind].[ref_quiz_question_type] WHERE question_type_code = 'ordering'
)
BEGIN
    INSERT INTO [mastermind].[ref_quiz_question_type]
        (question_type_code, question_type_name_bn, question_type_name_en, is_auto_gradable, sort_order, is_active)
    VALUES
        ('ordering', N'ক্রম সাজানো', 'Ordering / Sequence', 1, 8, 1);
    PRINT 'Inserted question type: ordering';
END
ELSE PRINT 'Already present: ordering';
GO

/* 3. matching_pairs_json column on coll_quiz_session_question --- */

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
ELSE PRINT 'Already present: matching_pairs_json';
GO

/* 4. ordering_option_ids_json column --------------------------- */

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
ELSE PRINT 'Already present: ordering_option_ids_json';
GO

/* Verification -------------------------------------------------- */

SELECT question_type_code, question_type_name_en, is_auto_gradable, sort_order
FROM   [mastermind].[ref_quiz_question_type]
WHERE  question_type_code IN ('matching', 'ordering', 'essay')
ORDER BY sort_order;
GO

SELECT sys.columns.name AS column_name, sys.types.name AS data_type
FROM   sys.columns
JOIN   sys.types ON sys.types.user_type_id = sys.columns.user_type_id
WHERE  sys.columns.object_id = OBJECT_ID(N'[mastermind].[coll_quiz_session_question]')
AND    sys.columns.name IN ('matching_pairs_json', 'ordering_option_ids_json');
GO

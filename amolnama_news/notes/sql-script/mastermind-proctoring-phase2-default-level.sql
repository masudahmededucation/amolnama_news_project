/* ------------------------------------------------------------------ */
/*  Mastermind Proctoring — Phase 2 prep                              */
/*  Change exam_proctoring_level DB DEFAULT from 0 to 1               */
/*                                                                    */
/*  Why:                                                              */
/*    Phase 2 introduces opt-in webcam AI (level 2). To keep that     */
/*    truly opt-in, every new quiz now starts at level 1 (lockdown    */
/*    only) instead of level 0 (no proctoring). This is the system    */
/*    default — staff must explicitly downgrade to 0 or upgrade to 2. */
/*                                                                    */
/*  Scope:                                                            */
/*    - Replaces the DEFAULT constraint on exam_proctoring_level.     */
/*    - Does NOT backfill existing rows. Quizzes already in the DB    */
/*      keep whatever level they were created with.                   */
/* ------------------------------------------------------------------ */

/* Run this in SSMS while connected to the amolnama_news database
   (whatever you named it on your server). No USE statement here so the
   script works regardless of the local database name. */

DECLARE @constraint_name NVARCHAR(200);

SELECT @constraint_name = default_constraints.name
FROM   sys.default_constraints
JOIN   sys.columns
       ON  sys.columns.default_object_id = sys.default_constraints.object_id
WHERE  sys.default_constraints.parent_object_id = OBJECT_ID(N'[mastermind].[coll_quiz]')
AND    sys.columns.name = N'exam_proctoring_level';

IF @constraint_name IS NOT NULL
BEGIN
    DECLARE @drop_sql NVARCHAR(400) =
        N'ALTER TABLE [mastermind].[coll_quiz] DROP CONSTRAINT [' + @constraint_name + N']';
    EXEC sp_executesql @drop_sql;
    PRINT 'Dropped existing default constraint: ' + @constraint_name;
END
ELSE
BEGIN
    PRINT 'No existing default constraint found on exam_proctoring_level (already removed?).';
END
GO

ALTER TABLE [mastermind].[coll_quiz]
    ADD CONSTRAINT [DF_coll_quiz_exam_proctoring_level]
    DEFAULT 1 FOR exam_proctoring_level;
GO

PRINT 'New default constraint installed: exam_proctoring_level DEFAULT 1';
GO

/* ------------------------------------------------------------------ */
/*  Verification                                                       */
/* ------------------------------------------------------------------ */

SELECT
    sys.default_constraints.name      AS constraint_name,
    sys.columns.name                  AS column_name,
    sys.default_constraints.definition
FROM   sys.default_constraints
JOIN   sys.columns
       ON  sys.columns.default_object_id = sys.default_constraints.object_id
WHERE  sys.default_constraints.parent_object_id = OBJECT_ID(N'[mastermind].[coll_quiz]')
AND    sys.columns.name = N'exam_proctoring_level';
GO

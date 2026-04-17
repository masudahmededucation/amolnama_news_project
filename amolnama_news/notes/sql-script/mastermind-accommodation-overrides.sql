/* ------------------------------------------------------------------ */
/*  Mastermind — accommodation overrides for individual quiz sessions  */
/*                                                                    */
/*  Why:                                                              */
/*    Accessibility / fairness — staff can grant a specific student    */
/*    extra time on a specific quiz session (longer time limit, OR     */
/*    no time limit at all). Standard feature in Moodle / Canvas /     */
/*    ExamSoft. Required by many exam regulations for students with    */
/*    documented learning differences.                                 */
/*                                                                    */
/*  Storage decisions:                                                 */
/*    - Per-session, not per-user. Each quiz attempt can have its own  */
/*      override (one student might get extra time on one quiz only).  */
/*    - session_extra_time_minutes: minutes ON TOP OF the quiz's       */
/*      configured exam_time_limit_minutes. NULL = no override.        */
/*    - session_no_time_limit: BIT — overrides exam_time_limit_minutes */
/*      entirely if true. Trumps session_extra_time_minutes.            */
/*    - session_accommodation_notes: short text from the granting      */
/*      staff member (e.g. "documented dyslexia — 50% extra time").    */
/*    - link_accommodation_granted_by_user_profile_id: who approved.   */
/*                                                                    */
/*  Run in SSMS while connected to the amolnama_news database.         */
/* ------------------------------------------------------------------ */

DECLARE @column_already_exists INT;

/* session_extra_time_minutes -------------------------------------- */
SELECT @column_already_exists = COUNT(*)
FROM   sys.columns
WHERE  object_id = OBJECT_ID(N'[mastermind].[coll_quiz_session]')
AND    name      = N'session_extra_time_minutes';
IF @column_already_exists = 0
BEGIN
    ALTER TABLE [mastermind].[coll_quiz_session]
        ADD session_extra_time_minutes INT NULL;
    PRINT 'Added column: session_extra_time_minutes';
END
ELSE PRINT 'Column already exists: session_extra_time_minutes';
GO

/* session_no_time_limit ------------------------------------------ */
DECLARE @column_already_exists INT;
SELECT @column_already_exists = COUNT(*)
FROM   sys.columns
WHERE  object_id = OBJECT_ID(N'[mastermind].[coll_quiz_session]')
AND    name      = N'session_no_time_limit';
IF @column_already_exists = 0
BEGIN
    ALTER TABLE [mastermind].[coll_quiz_session]
        ADD session_no_time_limit BIT NOT NULL DEFAULT 0;
    PRINT 'Added column: session_no_time_limit';
END
ELSE PRINT 'Column already exists: session_no_time_limit';
GO

/* session_accommodation_notes ------------------------------------ */
DECLARE @column_already_exists INT;
SELECT @column_already_exists = COUNT(*)
FROM   sys.columns
WHERE  object_id = OBJECT_ID(N'[mastermind].[coll_quiz_session]')
AND    name      = N'session_accommodation_notes';
IF @column_already_exists = 0
BEGIN
    ALTER TABLE [mastermind].[coll_quiz_session]
        ADD session_accommodation_notes NVARCHAR(500) NULL;
    PRINT 'Added column: session_accommodation_notes';
END
ELSE PRINT 'Column already exists: session_accommodation_notes';
GO

/* link_accommodation_granted_by_user_profile_id ------------------- */
DECLARE @column_already_exists INT;
SELECT @column_already_exists = COUNT(*)
FROM   sys.columns
WHERE  object_id = OBJECT_ID(N'[mastermind].[coll_quiz_session]')
AND    name      = N'link_accommodation_granted_by_user_profile_id';
IF @column_already_exists = 0
BEGIN
    ALTER TABLE [mastermind].[coll_quiz_session]
        ADD link_accommodation_granted_by_user_profile_id BIGINT NULL;
    PRINT 'Added column: link_accommodation_granted_by_user_profile_id';
END
ELSE PRINT 'Column already exists: link_accommodation_granted_by_user_profile_id';
GO

/* MS_Description for the new columns ----------------------------- */

IF NOT EXISTS (
    SELECT 1 FROM sys.extended_properties
    WHERE  major_id = OBJECT_ID(N'[mastermind].[coll_quiz_session]')
    AND    minor_id = COLUMNPROPERTY(OBJECT_ID(N'[mastermind].[coll_quiz_session]'), N'session_extra_time_minutes', 'ColumnId')
    AND    name     = N'MS_Description'
)
EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Accommodation: extra minutes added on top of the quiz''s exam_time_limit_minutes for this specific session. NULL = no override.',
    @level0type = N'SCHEMA', @level0name = N'mastermind',
    @level1type = N'TABLE',  @level1name = N'coll_quiz_session',
    @level2type = N'COLUMN', @level2name = N'session_extra_time_minutes';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.extended_properties
    WHERE  major_id = OBJECT_ID(N'[mastermind].[coll_quiz_session]')
    AND    minor_id = COLUMNPROPERTY(OBJECT_ID(N'[mastermind].[coll_quiz_session]'), N'session_no_time_limit', 'ColumnId')
    AND    name     = N'MS_Description'
)
EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Accommodation: when 1, the engine ignores exam_time_limit_minutes entirely for this session. Trumps session_extra_time_minutes.',
    @level0type = N'SCHEMA', @level0name = N'mastermind',
    @level1type = N'TABLE',  @level1name = N'coll_quiz_session',
    @level2type = N'COLUMN', @level2name = N'session_no_time_limit';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.extended_properties
    WHERE  major_id = OBJECT_ID(N'[mastermind].[coll_quiz_session]')
    AND    minor_id = COLUMNPROPERTY(OBJECT_ID(N'[mastermind].[coll_quiz_session]'), N'session_accommodation_notes', 'ColumnId')
    AND    name     = N'MS_Description'
)
EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Accommodation: short rationale from the staff member who granted the override (audit trail).',
    @level0type = N'SCHEMA', @level0name = N'mastermind',
    @level1type = N'TABLE',  @level1name = N'coll_quiz_session',
    @level2type = N'COLUMN', @level2name = N'session_accommodation_notes';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.extended_properties
    WHERE  major_id = OBJECT_ID(N'[mastermind].[coll_quiz_session]')
    AND    minor_id = COLUMNPROPERTY(OBJECT_ID(N'[mastermind].[coll_quiz_session]'), N'link_accommodation_granted_by_user_profile_id', 'ColumnId')
    AND    name     = N'MS_Description'
)
EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Accommodation: user_profile_id of the staff member who granted the override.',
    @level0type = N'SCHEMA', @level0name = N'mastermind',
    @level1type = N'TABLE',  @level1name = N'coll_quiz_session',
    @level2type = N'COLUMN', @level2name = N'link_accommodation_granted_by_user_profile_id';
GO

/* Verification ---------------------------------------------------- */

SELECT sys.columns.name AS column_name, sys.types.name AS data_type, sys.columns.is_nullable
FROM   sys.columns
JOIN   sys.types ON sys.types.user_type_id = sys.columns.user_type_id
WHERE  sys.columns.object_id = OBJECT_ID(N'[mastermind].[coll_quiz_session]')
AND    sys.columns.name IN (
    'session_extra_time_minutes',
    'session_no_time_limit',
    'session_accommodation_notes',
    'link_accommodation_granted_by_user_profile_id'
);
GO

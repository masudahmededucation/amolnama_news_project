/* ------------------------------------------------------------------ */
/*  Mastermind — quiz pass certificates                                */
/*                                                                    */
/*  Why:                                                              */
/*    Closes the "custom certificates" gap on the competitive matrix. */
/*    When a student passes a quiz that has been opted-in for         */
/*    certification, the engine auto-issues a certificate row with a  */
/*    unique unforgeable serial. The student gets a public URL like   */
/*    /mastermind/certificate/<serial>/ that anyone can verify.       */
/*                                                                    */
/*  Storage decisions:                                                */
/*    - exam_certificate_template_html on coll_quiz (NVARCHAR(MAX))   */
/*      — per-quiz template; NULL = no certificate for this quiz.     */
/*    - coll_certificate                                              */
/*      one row per issued certificate. Serial is a 32-char random    */
/*      string (URL-safe); UNIQUE constraint enforces no duplicates.  */
/*    - is_active toggles revocation without deleting the audit row.  */
/*                                                                    */
/*  Run in SSMS while connected to the amolnama_news database.         */
/* ------------------------------------------------------------------ */

/* exam_certificate_template_html on coll_quiz -------------------- */

DECLARE @column_already_exists INT;
SELECT @column_already_exists = COUNT(*)
FROM   sys.columns
WHERE  object_id = OBJECT_ID(N'[mastermind].[coll_quiz]')
AND    name      = N'exam_certificate_template_html';
IF @column_already_exists = 0
BEGIN
    ALTER TABLE [mastermind].[coll_quiz]
        ADD exam_certificate_template_html NVARCHAR(MAX) NULL;
    PRINT 'Added column: exam_certificate_template_html';
END
ELSE PRINT 'Column already exists: exam_certificate_template_html';
GO

/* coll_certificate table ----------------------------------------- */

IF OBJECT_ID(N'[mastermind].[coll_certificate]', N'U') IS NULL
BEGIN
    CREATE TABLE [mastermind].[coll_certificate] (
        mastermind_coll_certificate_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
        certificate_serial                NVARCHAR(40) NOT NULL UNIQUE,
        link_mastermind_coll_quiz_id      BIGINT NOT NULL,
        link_mastermind_coll_quiz_session_id BIGINT NOT NULL,
        link_user_profile_id              BIGINT NOT NULL,
        certificate_recipient_name        NVARCHAR(200) NULL,
        certificate_score_percentage      DECIMAL(5,2) NULL,
        certificate_issued_at             DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        certificate_revoked_at            DATETIME2 NULL,
        link_revoked_by_user_profile_id   BIGINT NULL,
        certificate_revocation_reason     NVARCHAR(500) NULL,
        is_active                         BIT NOT NULL DEFAULT 1,
        created_at                        DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_certificate_quiz
            FOREIGN KEY (link_mastermind_coll_quiz_id)
            REFERENCES [mastermind].[coll_quiz](mastermind_coll_quiz_id),
        CONSTRAINT FK_certificate_session
            FOREIGN KEY (link_mastermind_coll_quiz_session_id)
            REFERENCES [mastermind].[coll_quiz_session](mastermind_coll_quiz_session_id),
        CONSTRAINT UQ_certificate_session
            UNIQUE (link_mastermind_coll_quiz_session_id)
    );

    CREATE INDEX IX_certificate_user_active
        ON [mastermind].[coll_certificate](link_user_profile_id, is_active);

    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Issued quiz pass certificates. Auto-created when a session passes a quiz that has exam_certificate_template_html set. certificate_serial is the unforgeable URL-safe public id; verify at /mastermind/certificate/<serial>/.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_certificate';

    PRINT 'Created table: [mastermind].[coll_certificate]';
END
ELSE PRINT 'Table already exists: [mastermind].[coll_certificate]';
GO

/* Verification --------------------------------------------------- */

SELECT TOP 5 sys.columns.name AS column_name, sys.types.name AS data_type, sys.columns.is_nullable
FROM   sys.columns
JOIN   sys.types ON sys.types.user_type_id = sys.columns.user_type_id
WHERE  sys.columns.object_id = OBJECT_ID(N'[mastermind].[coll_certificate]')
ORDER BY sys.columns.column_id;
GO

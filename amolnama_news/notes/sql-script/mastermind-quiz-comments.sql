/* ------------------------------------------------------------------ */
/*  Mastermind — per-quiz discussion thread                            */
/*                                                                    */
/*  Why:                                                              */
/*    Closes the "per-quiz comments / discussion" gap on the          */
/*    competitive matrix. Lets students discuss specific quizzes,     */
/*    ask clarifying questions, and lets staff post errata or         */
/*    explanations after the fact. Engagement boost.                   */
/*                                                                    */
/*  Storage decisions:                                                */
/*    - One row per comment OR reply (link_parent_comment_id).         */
/*    - Soft-delete via is_active so the thread audit trail stays.    */
/*    - link_pinned_at + link_pinned_by_user_profile_id for staff to  */
/*      pin important corrections to the top.                          */
/*    - HTML in comment_text_html is sanitised by the API layer        */
/*      (core.utils.sanitize_user_html). Storage is whatever the       */
/*      sanitiser returns — never trust raw client input.              */
/*                                                                    */
/*  Run in SSMS while connected to the amolnama_news database.         */
/* ------------------------------------------------------------------ */

IF OBJECT_ID(N'[mastermind].[coll_quiz_comment]', N'U') IS NULL
BEGIN
    CREATE TABLE [mastermind].[coll_quiz_comment] (
        mastermind_coll_quiz_comment_id      BIGINT IDENTITY(1,1) PRIMARY KEY,
        link_mastermind_coll_quiz_id         BIGINT NOT NULL,
        link_user_profile_id                 BIGINT NOT NULL,
        link_parent_comment_id               BIGINT NULL,
        comment_text_html                    NVARCHAR(MAX) NOT NULL,
        is_pinned                            BIT NOT NULL DEFAULT 0,
        link_pinned_by_user_profile_id       BIGINT NULL,
        pinned_at                            DATETIME2 NULL,
        is_active                            BIT NOT NULL DEFAULT 1,
        deleted_at                           DATETIME2 NULL,
        link_deleted_by_user_profile_id      BIGINT NULL,
        created_at                           DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at                           DATETIME2 NULL,

        CONSTRAINT FK_quiz_comment_quiz
            FOREIGN KEY (link_mastermind_coll_quiz_id)
            REFERENCES [mastermind].[coll_quiz](mastermind_coll_quiz_id),
        CONSTRAINT FK_quiz_comment_parent
            FOREIGN KEY (link_parent_comment_id)
            REFERENCES [mastermind].[coll_quiz_comment](mastermind_coll_quiz_comment_id)
    );

    CREATE INDEX IX_quiz_comment_quiz_active
        ON [mastermind].[coll_quiz_comment](link_mastermind_coll_quiz_id, is_active, is_pinned, created_at DESC);

    CREATE INDEX IX_quiz_comment_user
        ON [mastermind].[coll_quiz_comment](link_user_profile_id, is_active);

    EXEC sp_addextendedproperty
        @name  = N'MS_Description',
        @value = N'Discussion thread per quiz. One row per comment or reply (link_parent_comment_id). Sanitised HTML body. Staff can pin (is_pinned) errata to the top. Soft-delete via is_active.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_quiz_comment';

    PRINT 'Created table: [mastermind].[coll_quiz_comment]';
END
ELSE PRINT 'Table already exists: [mastermind].[coll_quiz_comment]';
GO

/* coll_quiz_comment_reaction (likes / acks) ----------------------- */

IF OBJECT_ID(N'[mastermind].[coll_quiz_comment_reaction]', N'U') IS NULL
BEGIN
    CREATE TABLE [mastermind].[coll_quiz_comment_reaction] (
        mastermind_coll_quiz_comment_reaction_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        link_mastermind_coll_quiz_comment_id     BIGINT NOT NULL,
        link_user_profile_id                     BIGINT NOT NULL,
        reaction_type_code                       NVARCHAR(20) NOT NULL DEFAULT 'like',
        is_active                                BIT NOT NULL DEFAULT 1,
        created_at                               DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_qcr_comment
            FOREIGN KEY (link_mastermind_coll_quiz_comment_id)
            REFERENCES [mastermind].[coll_quiz_comment](mastermind_coll_quiz_comment_id),
        CONSTRAINT UQ_qcr_user_comment
            UNIQUE (link_mastermind_coll_quiz_comment_id, link_user_profile_id, reaction_type_code)
    );

    CREATE INDEX IX_qcr_comment_active
        ON [mastermind].[coll_quiz_comment_reaction](link_mastermind_coll_quiz_comment_id, is_active);

    EXEC sp_addextendedproperty
        @name  = N'MS_Description',
        @value = N'Likes / reactions on quiz comments. One row per (comment, user, reaction_type). Unique constraint prevents double-likes.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_quiz_comment_reaction';

    PRINT 'Created table: [mastermind].[coll_quiz_comment_reaction]';
END
ELSE PRINT 'Table already exists: [mastermind].[coll_quiz_comment_reaction]';
GO

/* Verification ---------------------------------------------------- */

SELECT name FROM sys.tables
WHERE schema_id = SCHEMA_ID('mastermind')
AND name IN ('coll_quiz_comment', 'coll_quiz_comment_reaction');
GO

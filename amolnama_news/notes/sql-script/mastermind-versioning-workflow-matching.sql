/*
  Mastermind — Question versioning, multi-admin workflow, matching question type.
  4 new tables in [mastermind] schema.
  Run AFTER all previous mastermind scripts.
*/

-- ================================================================
-- 1. QUESTION VERSIONING — immutable version snapshots
-- ================================================================

CREATE TABLE [mastermind].[coll_question_version] (
    mastermind_coll_question_version_id      BIGINT IDENTITY(1,1) PRIMARY KEY,
    link_mastermind_coll_question_id         BIGINT NOT NULL,
    version_number                           INT NOT NULL DEFAULT 1,
    question_text_bn                         NVARCHAR(MAX) NOT NULL,
    question_text_en                         NVARCHAR(MAX) NULL,
    question_explanation_bn                  NVARCHAR(MAX) NULL,
    question_explanation_en                  NVARCHAR(MAX) NULL,
    question_metadata_json                   NVARCHAR(MAX) NULL,
    link_modified_by_user_profile_id         BIGINT NULL,
    change_summary                           NVARCHAR(500) NULL,
    is_current                               BIT NOT NULL DEFAULT 1,
    created_at                               DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_question_version_question
        FOREIGN KEY (link_mastermind_coll_question_id)
        REFERENCES [mastermind].[coll_question](mastermind_coll_question_id),
    CONSTRAINT UQ_question_version_number
        UNIQUE (link_mastermind_coll_question_id, version_number)
);
GO

CREATE INDEX IX_question_version_current
    ON [mastermind].[coll_question_version](link_mastermind_coll_question_id, is_current)
    WHERE is_current = 1;
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Immutable version snapshots of questions. Each edit creates a new version. Quiz sessions link to a specific version so answered questions never change retroactively. Staff edits generate new versions automatically.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_question_version';
GO


-- ================================================================
-- 2. MULTI-ADMIN WORKFLOW — role assignments per quiz
-- ================================================================

CREATE TABLE [mastermind].[map_quiz_role_assignment] (
    mastermind_map_quiz_role_assignment_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    link_mastermind_coll_quiz_id             BIGINT NOT NULL,
    link_user_profile_id                     BIGINT NOT NULL,
    role_code                                NVARCHAR(20) NOT NULL,
    is_active                                BIT NOT NULL DEFAULT 1,
    created_at                               DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_quiz_role_quiz
        FOREIGN KEY (link_mastermind_coll_quiz_id)
        REFERENCES [mastermind].[coll_quiz](mastermind_coll_quiz_id),
    CONSTRAINT FK_quiz_role_user
        FOREIGN KEY (link_user_profile_id)
        REFERENCES [account].[user_profile](user_profile_id),
    CONSTRAINT UQ_quiz_role_user
        UNIQUE (link_mastermind_coll_quiz_id, link_user_profile_id, role_code)
);
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Per-quiz role assignments for multi-admin workflow. Roles: creator (drafts), reviewer (approves/rejects), publisher (makes live). A user can hold different roles on different quizzes.',
  'SCHEMA', 'mastermind', 'TABLE', 'map_quiz_role_assignment';
GO


-- ================================================================
-- 3. WORKFLOW AUDIT LOG — state transition history
-- ================================================================

CREATE TABLE [mastermind].[coll_quiz_workflow_log] (
    mastermind_coll_quiz_workflow_log_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    link_mastermind_coll_quiz_id             BIGINT NOT NULL,
    from_status_code                         NVARCHAR(20) NULL,
    to_status_code                           NVARCHAR(20) NOT NULL,
    link_user_profile_id                     BIGINT NOT NULL,
    role_code                                NVARCHAR(20) NOT NULL,
    workflow_comment                         NVARCHAR(500) NULL,
    created_at                               DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_workflow_log_quiz
        FOREIGN KEY (link_mastermind_coll_quiz_id)
        REFERENCES [mastermind].[coll_quiz](mastermind_coll_quiz_id),
    CONSTRAINT FK_workflow_log_user
        FOREIGN KEY (link_user_profile_id)
        REFERENCES [account].[user_profile](user_profile_id)
);
GO

CREATE INDEX IX_workflow_log_quiz
    ON [mastermind].[coll_quiz_workflow_log](link_mastermind_coll_quiz_id, created_at);
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Audit trail of quiz status transitions. Records who changed what, when, under which role, and optional comment. Immutable — rows are never updated or deleted.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_quiz_workflow_log';
GO


-- ================================================================
-- 4. MATCHING QUESTION TYPE — stem-response pairs
-- ================================================================

CREATE TABLE [mastermind].[coll_question_match_pair] (
    mastermind_coll_question_match_pair_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    link_mastermind_coll_question_id         BIGINT NOT NULL,
    stem_text_bn                             NVARCHAR(500) NULL,
    stem_text_en                             NVARCHAR(500) NULL,
    response_text_bn                         NVARCHAR(500) NOT NULL,
    response_text_en                         NVARCHAR(500) NULL,
    sort_order                               INT NOT NULL DEFAULT 0,
    is_active                                BIT NOT NULL DEFAULT 1,
    created_at                               DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_match_pair_question
        FOREIGN KEY (link_mastermind_coll_question_id)
        REFERENCES [mastermind].[coll_question](mastermind_coll_question_id)
);
GO

CREATE INDEX IX_match_pair_question
    ON [mastermind].[coll_question_match_pair](link_mastermind_coll_question_id, is_active);
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Stem-response pairs for matching questions. Each row = one stem (left) + its correct response (right). Rows where stem_text is NULL are distractors (extra wrong responses). Students see shuffled responses and match each stem.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_question_match_pair';
GO


-- ================================================================
-- 5. ADD matching TYPE to ref_quiz_question_type
-- ================================================================

INSERT INTO [mastermind].[ref_quiz_question_type]
    (question_type_code, question_type_name_bn, question_type_name_en, is_auto_gradable, sort_order)
VALUES
    ('matching', N'মিলকরণ', 'Matching', 1, 6);
GO


-- ================================================================
-- VERIFY
-- ================================================================

SELECT name FROM sys.tables
WHERE schema_id = SCHEMA_ID('mastermind')
  AND name IN ('coll_question_version', 'map_quiz_role_assignment',
               'coll_quiz_workflow_log', 'coll_question_match_pair')
ORDER BY name;

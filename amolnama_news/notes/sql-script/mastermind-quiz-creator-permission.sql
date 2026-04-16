/*
  Mastermind — Quiz creator permission table.
  Non-staff users who are granted quiz creation access by staff.
  They can only manage quizzes they created.
  Permission has optional expiry date.
*/

CREATE TABLE [mastermind].[coll_quiz_creator_permission] (
    mastermind_coll_quiz_creator_permission_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    link_user_profile_id                         BIGINT NOT NULL,
    link_granted_by_user_profile_id              BIGINT NOT NULL,
    permission_status_code                       NVARCHAR(20) NOT NULL DEFAULT 'active',
    granted_at                                   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    expires_at                                   DATETIME2 NULL,
    revoked_at                                   DATETIME2 NULL,
    permission_notes                             NVARCHAR(500) NULL,
    is_active                                    BIT NOT NULL DEFAULT 1,
    created_at                                   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at                                   DATETIME2 NULL,

    CONSTRAINT FK_quiz_creator_user
        FOREIGN KEY (link_user_profile_id)
        REFERENCES [account].[user_profile](user_profile_id),
    CONSTRAINT FK_quiz_creator_granted_by
        FOREIGN KEY (link_granted_by_user_profile_id)
        REFERENCES [account].[user_profile](user_profile_id),
    CONSTRAINT UQ_quiz_creator_user
        UNIQUE (link_user_profile_id)
);
GO

CREATE INDEX IX_quiz_creator_active
    ON [mastermind].[coll_quiz_creator_permission](permission_status_code, is_active)
    WHERE is_active = 1;
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Quiz creator permissions for non-staff users. Staff grants access with optional expiry date. Creators can only manage their own quizzes. One row per user (UNIQUE constraint). Status: active, expired, revoked.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_quiz_creator_permission';
GO

-- Verify
SELECT name FROM sys.tables
WHERE schema_id = SCHEMA_ID('mastermind')
  AND name = 'coll_quiz_creator_permission';

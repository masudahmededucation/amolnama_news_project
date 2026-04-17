/* ------------------------------------------------------------------ */
/*  Mastermind — synchronous multi-player lobby                       */
/*                                                                    */
/*  Why:                                                              */
/*    Adds Kahoot/Quizizz-style live group quizzes. A host creates a  */
/*    lobby (gets a 6-char join code), players join via /play/<code>/,*/
/*    and everyone answers the same question simultaneously. Scoring  */
/*    can include speed bonus + consecutive-correct streak bonus.     */
/*                                                                    */
/*  Tables:                                                           */
/*    coll_quiz_lobby         — one row per game room                  */
/*    coll_quiz_lobby_player  — one row per joined player              */
/*    coll_quiz_lobby_event   — append-only event log (start/answer/   */
/*                              advance/end) for replay + analytics    */
/*                                                                    */
/*  Plus: 2 columns on coll_quiz for opt-in lobby scoring tweaks.      */
/*                                                                    */
/*  Run in SSMS while connected to the amolnama_news database.         */
/* ------------------------------------------------------------------ */

/* 1. Lobby ---------------------------------------------------------- */

IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[mastermind].[coll_quiz_lobby]') AND type = 'U'
)
BEGIN
    CREATE TABLE [mastermind].[coll_quiz_lobby] (
        mastermind_coll_quiz_lobby_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
        link_mastermind_coll_quiz_id           BIGINT NOT NULL,
        link_host_user_profile_id              BIGINT NOT NULL,
        lobby_join_code                        NVARCHAR(8) NOT NULL,
        lobby_status_code                      NVARCHAR(20) NOT NULL DEFAULT 'waiting',
            -- waiting | playing | completed | abandoned
        lobby_mode_code                        NVARCHAR(20) NOT NULL DEFAULT 'host_advances',
            -- host_advances | timed_per_question
        lobby_max_players                      INT NOT NULL DEFAULT 50,
        lobby_question_seconds                 INT NULL,
            -- when lobby_mode_code = 'timed_per_question', server auto-advances
            -- after this many seconds per question (NULL → falls back to quiz default)
        lobby_current_question_index           INT NOT NULL DEFAULT 0,
        lobby_question_started_at              DATETIME2 NULL,
        lobby_started_at                       DATETIME2 NULL,
        lobby_completed_at                     DATETIME2 NULL,
        lobby_question_snapshot_json           NVARCHAR(MAX) NULL,
            -- JSON snapshot of selected question IDs + per-question option order so
            -- everyone in the lobby sees the SAME randomised set; written at lobby_started.
        is_active                              BIT NOT NULL DEFAULT 1,
        created_at                             DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at                             DATETIME2 NULL,
        CONSTRAINT FK_lobby_quiz FOREIGN KEY (link_mastermind_coll_quiz_id)
            REFERENCES [mastermind].[coll_quiz](mastermind_coll_quiz_id),
        CONSTRAINT UQ_coll_quiz_lobby_join_code UNIQUE (lobby_join_code)
    );

    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'One row per multiplayer game room. Host creates it, players join via lobby_join_code, status flows waiting→playing→completed. lobby_question_snapshot_json freezes the question/option order at start so all players see the same set.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_quiz_lobby';

    CREATE INDEX IX_coll_quiz_lobby_quiz_status
        ON [mastermind].[coll_quiz_lobby](link_mastermind_coll_quiz_id, lobby_status_code, is_active);

    PRINT '[OK] Created [mastermind].[coll_quiz_lobby]';
END
ELSE
    PRINT '[SKIP] [mastermind].[coll_quiz_lobby] already exists';
GO


/* 2. Lobby player --------------------------------------------------- */

IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[mastermind].[coll_quiz_lobby_player]') AND type = 'U'
)
BEGIN
    CREATE TABLE [mastermind].[coll_quiz_lobby_player] (
        mastermind_coll_quiz_lobby_player_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
        link_mastermind_coll_quiz_lobby_id     BIGINT NOT NULL,
        link_user_profile_id                   BIGINT NOT NULL,
        player_join_order                      INT NOT NULL,
        player_is_ready                        BIT NOT NULL DEFAULT 0,
        player_current_score                   DECIMAL(10,2) NOT NULL DEFAULT 0,
        player_correct_count                   INT NOT NULL DEFAULT 0,
        player_streak_count                    INT NOT NULL DEFAULT 0,
        player_has_left                        BIT NOT NULL DEFAULT 0,
        player_left_at                         DATETIME2 NULL,
        is_active                              BIT NOT NULL DEFAULT 1,
        created_at                             DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at                             DATETIME2 NULL,
        CONSTRAINT FK_coll_quiz_lobby_player_lobby
            FOREIGN KEY (link_mastermind_coll_quiz_lobby_id)
            REFERENCES [mastermind].[coll_quiz_lobby](mastermind_coll_quiz_lobby_id),
        CONSTRAINT UQ_coll_quiz_lobby_player
            UNIQUE (link_mastermind_coll_quiz_lobby_id, link_user_profile_id)
    );

    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'One row per joined player in a lobby. Tracks ready state, running score, streak, and whether they left. Unique on (lobby, user) so a user can only join a lobby once. Soft-delete via is_active.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_quiz_lobby_player';

    CREATE INDEX IX_coll_quiz_lobby_player_lobby_active
        ON [mastermind].[coll_quiz_lobby_player](link_mastermind_coll_quiz_lobby_id, is_active);

    PRINT '[OK] Created [mastermind].[coll_quiz_lobby_player]';
END
ELSE
    PRINT '[SKIP] [mastermind].[coll_quiz_lobby_player] already exists';
GO


/* 3. Lobby event log ------------------------------------------------ */

IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[mastermind].[coll_quiz_lobby_event]') AND type = 'U'
)
BEGIN
    CREATE TABLE [mastermind].[coll_quiz_lobby_event] (
        mastermind_coll_quiz_lobby_event_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
        link_mastermind_coll_quiz_lobby_id     BIGINT NOT NULL,
        link_user_profile_id                   BIGINT NULL,
        event_type_code                        NVARCHAR(40) NOT NULL,
            -- player_joined | player_left | player_ready | lobby_started |
            -- question_advance | answer_submitted | lobby_completed
        event_payload_json                     NVARCHAR(MAX) NULL,
        created_at                             DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_coll_quiz_lobby_event_lobby
            FOREIGN KEY (link_mastermind_coll_quiz_lobby_id)
            REFERENCES [mastermind].[coll_quiz_lobby](mastermind_coll_quiz_lobby_id)
    );

    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Append-only audit log for one lobby. Used for replay, analytics, and worker-restart resume. event_payload_json is the parsed JSON body of the originating WebSocket message.',
        @level0type = N'SCHEMA', @level0name = N'mastermind',
        @level1type = N'TABLE',  @level1name = N'coll_quiz_lobby_event';

    CREATE INDEX IX_coll_quiz_lobby_event_lobby_created
        ON [mastermind].[coll_quiz_lobby_event](link_mastermind_coll_quiz_lobby_id, created_at);

    PRINT '[OK] Created [mastermind].[coll_quiz_lobby_event]';
END
ELSE
    PRINT '[SKIP] [mastermind].[coll_quiz_lobby_event] already exists';
GO


/* 4. Quiz-level lobby scoring opt-ins ------------------------------- */

IF NOT EXISTS (
    SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[mastermind].[coll_quiz]') AND name = 'exam_lobby_speed_bonus_enabled'
)
BEGIN
    ALTER TABLE [mastermind].[coll_quiz]
        ADD exam_lobby_speed_bonus_enabled BIT NOT NULL DEFAULT 0;
    PRINT '[OK] Added column coll_quiz.exam_lobby_speed_bonus_enabled';
END
ELSE
    PRINT '[SKIP] coll_quiz.exam_lobby_speed_bonus_enabled already exists';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[mastermind].[coll_quiz]') AND name = 'exam_lobby_streak_bonus_enabled'
)
BEGIN
    ALTER TABLE [mastermind].[coll_quiz]
        ADD exam_lobby_streak_bonus_enabled BIT NOT NULL DEFAULT 0;
    PRINT '[OK] Added column coll_quiz.exam_lobby_streak_bonus_enabled';
END
ELSE
    PRINT '[SKIP] coll_quiz.exam_lobby_streak_bonus_enabled already exists';
GO

PRINT '------------------------------------------------------------------';
PRINT '  Mastermind multi-player lobby SQL: complete.';
PRINT '------------------------------------------------------------------';

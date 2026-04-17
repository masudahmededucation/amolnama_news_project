/*
  Mastermind — Proctoring schema (Phase 1: Lockdown + AI-ready).
  Adds:
    1. coll_quiz_proctoring_log     — one row per violation event
    2. exam_proctoring_level        — per-quiz tiered config (0/1/2)
    3. exam_proctoring_max_score    — per-quiz threshold override (NULL = global default)
    4. session_proctoring_score     — cached running score per session
    5. session_proctoring_status_code — clean / warned / flagged

  Design decisions (per discussion with masudahmed.education on 2026-04-17):
    - ZERO IMAGES — no video, no snapshots, no biometric data ever stored
    - Only discrete behavioral events with type, severity, timestamps
    - "Privacy-First" branding: Mastermind never captures, transmits, or stores
      any image data from the student's webcam. Phase 2 AI runs locally in
      browser; only text events (e.g., no_face, phone_detected) cross the network.
    - Avoids GDPR/biometric data regulation triggers. Keeps DB lean and backups fast.
    - Both violation_client_reported_at (browser) + created_at (server) stored to detect clock tampering
    - Severity-based scoring with global default + per-quiz override
*/

-- ================================================================
-- 1. PROCTORING LOG TABLE
-- ================================================================

CREATE TABLE [mastermind].[coll_quiz_proctoring_log] (
    mastermind_coll_quiz_proctoring_log_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    link_mastermind_coll_quiz_session_id     BIGINT NOT NULL,
    link_user_profile_id                     BIGINT NOT NULL,
    link_mastermind_coll_quiz_id             BIGINT NOT NULL,

    violation_type_code                      NVARCHAR(50) NOT NULL,
        -- All lowercase per project convention:
        -- tab_switch, window_blur, copy_blocked, paste_blocked,
        -- context_menu, fullscreen_exit, key_blocked,
        -- (Phase 2:) no_face, multiple_faces, look_away, phone_detected, audio_detected
    violation_severity_points                INT NOT NULL DEFAULT 1,
        -- Heavier weight = more suspicious. Lockout threshold default = 15.
    violation_details                        NVARCHAR(500) NULL,
        -- Free-form note: "Switched to tab mail.google.com", "Looked left for 8s", etc.
    violation_confidence_score               DECIMAL(4,2) NULL,
        -- AI detection confidence 0.00-1.00. NULL for deterministic events (tab_switch).

    -- ZERO IMAGES policy: this table NEVER stores video, snapshots, or any
    -- biometric data. All AI runs locally in the student's browser via MediaPipe;
    -- only text events cross the network. If "Mastermind needs visual proof"
    -- is ever requested, that is a separate architectural decision and a
    -- new column would need explicit approval.

    violation_client_reported_at             DATETIME2 NULL,
        -- Time the browser reported the violation occurred.
        -- NULL if browser did not send a client-side timestamp.
        -- Compare with created_at (server time) to detect clock skew/tampering.

    is_active                                BIT NOT NULL DEFAULT 1,
        -- Soft-delete; admin "Forgive" sets this to 0.
    forgiven_at                              DATETIME2 NULL,
    link_forgiven_by_user_profile_id         BIGINT NULL,
    created_at                               DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        -- Authoritative server-side timestamp of the violation event.
    updated_at                               DATETIME2 NULL,

    CONSTRAINT FK_proctoring_log_session
        FOREIGN KEY (link_mastermind_coll_quiz_session_id)
        REFERENCES [mastermind].[coll_quiz_session](mastermind_coll_quiz_session_id),
    CONSTRAINT FK_proctoring_log_user
        FOREIGN KEY (link_user_profile_id)
        REFERENCES [account].[user_profile](user_profile_id),
    CONSTRAINT FK_proctoring_log_quiz
        FOREIGN KEY (link_mastermind_coll_quiz_id)
        REFERENCES [mastermind].[coll_quiz](mastermind_coll_quiz_id),
    CONSTRAINT FK_proctoring_log_forgiver
        FOREIGN KEY (link_forgiven_by_user_profile_id)
        REFERENCES [account].[user_profile](user_profile_id)
);
GO

-- Composite index for fast admin session-review lookups (timeline chart)
CREATE INDEX IX_proctoring_log_session_time
    ON [mastermind].[coll_quiz_proctoring_log](
        link_mastermind_coll_quiz_session_id,
        created_at
    );
GO

-- Filtered index for "active violations only" queries (live dashboard)
CREATE INDEX IX_proctoring_log_active_recent
    ON [mastermind].[coll_quiz_proctoring_log](created_at DESC, link_mastermind_coll_quiz_id)
    WHERE is_active = 1;
GO

-- Index for per-user violation queries (user history)
CREATE INDEX IX_proctoring_log_user_active
    ON [mastermind].[coll_quiz_proctoring_log](link_user_profile_id, is_active)
    WHERE is_active = 1;
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Per-violation events captured during a proctored quiz session. ZERO IMAGES policy — no video, no snapshots, no biometric data ever stored. Only discrete events with type code, severity points, and timestamps. AI runs client-side in browser via MediaPipe; only text events cross the network. Soft-deletable via is_active so admins can forgive false positives.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_quiz_proctoring_log';
GO


-- ================================================================
-- 2. ADD PROCTORING CONFIG TO coll_quiz
-- ================================================================

ALTER TABLE [mastermind].[coll_quiz]
    ADD exam_proctoring_level     INT NOT NULL DEFAULT 0,
        -- 0 = None (current behavior, no proctoring)
        -- 1 = Lockdown only (tab switch, copy/paste blocks, no camera)
        -- 2 = Full AI (lockdown + MediaPipe webcam — Phase 2)
        exam_proctoring_max_score INT NULL;
        -- Per-quiz threshold override. NULL = use global PROC_GLOBAL_THRESHOLD setting (default 15).
GO


-- ================================================================
-- 3. ADD CACHED SCORE + STATUS TO coll_quiz_session
-- ================================================================

ALTER TABLE [mastermind].[coll_quiz_session]
    ADD session_proctoring_score INT NOT NULL DEFAULT 0,
        -- Running sum of severity points. Updated on each violation insert.
        session_proctoring_status_code NVARCHAR(20) NOT NULL DEFAULT 'clean';
        -- clean    = no violations or below threshold
        -- warned   = passed half-threshold, soft-warning shown to student
        -- flagged  = passed full threshold, session marked for admin review
        -- locked   = (Phase 2 future) admin-issued hard lock
GO


-- ================================================================
-- 4. UPDATE DICTIONARY ON MODIFIED TABLES
-- ================================================================

EXEC sp_updateextendedproperty 'MS_Description',
  'Quiz definitions — title, rules, scoring, rewards, scheduling, proctoring level. Staff create; users take. Grows with content.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_quiz';
GO

EXEC sp_updateextendedproperty 'MS_Description',
  'One user attempt at one quiz. Tracks status, scores, time, attempt number, and proctoring suspicion score (cached). Detail per-question lives in coll_quiz_session_question.',
  'SCHEMA', 'mastermind', 'TABLE', 'coll_quiz_session';
GO


-- ================================================================
-- 5. VERIFY
-- ================================================================

-- Check new table exists
SELECT name FROM sys.tables
WHERE schema_id = SCHEMA_ID('mastermind')
  AND name = 'coll_quiz_proctoring_log';

-- Check new columns on coll_quiz
SELECT sys.columns.name AS column_name,
       sys.types.name AS type_name,
       sys.columns.is_nullable
FROM sys.columns
JOIN sys.types
  ON sys.columns.user_type_id = sys.types.user_type_id
WHERE sys.columns.object_id = OBJECT_ID('[mastermind].[coll_quiz]')
  AND sys.columns.name LIKE 'exam_proctoring%';

-- Check new columns on coll_quiz_session
SELECT sys.columns.name AS column_name,
       sys.types.name AS type_name,
       sys.columns.is_nullable
FROM sys.columns
JOIN sys.types
  ON sys.columns.user_type_id = sys.types.user_type_id
WHERE sys.columns.object_id = OBJECT_ID('[mastermind].[coll_quiz_session]')
  AND sys.columns.name LIKE 'session_proctoring%';

-- Check indexes on new table
SELECT sys.indexes.name AS index_name,
       sys.indexes.is_unique,
       sys.indexes.has_filter
FROM sys.indexes
WHERE sys.indexes.object_id = OBJECT_ID('[mastermind].[coll_quiz_proctoring_log]')
  AND sys.indexes.name LIKE 'IX_%';

-- =============================================================================
-- Travel Hub — Community Contribution Tables
-- YouTube links and Reference links for destinations
-- Schema: [bangladesh]
-- =============================================================================

-- 1. YouTube video links per destination
CREATE TABLE [bangladesh].[coll_destination_youtube_link] (
    bangladesh_coll_destination_youtube_link_id  BIGINT IDENTITY(1,1) PRIMARY KEY,
    link_coll_destination_id                     BIGINT       NOT NULL,
    link_user_profile_id                         BIGINT       NOT NULL,
    youtube_url                                  NVARCHAR(500) NOT NULL,
    youtube_video_id                             NVARCHAR(20)  NULL,       -- extracted from URL (e.g. dQw4w9WgXcQ)
    video_title_bn                               NVARCHAR(300) NULL,
    video_title_en                               NVARCHAR(300) NULL,
    description_bn                               NVARCHAR(1000) NULL,
    sort_order                                   INT           NOT NULL DEFAULT 0,
    is_active                                    BIT           NOT NULL DEFAULT 1,
    created_at                                   DATETIME2     NOT NULL DEFAULT GETDATE(),
    updated_at                                   DATETIME2     NULL
);

-- 2. Reference/source links per destination (blogs, wiki, official sites, news)
CREATE TABLE [bangladesh].[coll_destination_reference_link] (
    bangladesh_coll_destination_reference_link_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    link_coll_destination_id                      BIGINT       NOT NULL,
    link_user_profile_id                          BIGINT       NOT NULL,
    reference_url                                 NVARCHAR(1000) NOT NULL,
    reference_title_bn                            NVARCHAR(300)  NULL,
    reference_title_en                            NVARCHAR(300)  NULL,
    description_bn                                NVARCHAR(1000) NULL,
    sort_order                                    INT            NOT NULL DEFAULT 0,
    is_active                                     BIT            NOT NULL DEFAULT 1,
    created_at                                    DATETIME2      NOT NULL DEFAULT GETDATE(),
    updated_at                                    DATETIME2      NULL
);

-- ============================================================================
-- BANGLADESH SCHEMA — Travel Hub + Beauty of Bangladesh
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'bangladesh')
    EXEC('CREATE SCHEMA [bangladesh]');
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- DROP IN DEPENDENCY ORDER
-- ============================================================================

IF OBJECT_ID(N'[bangladesh].[eng_media_comment]', N'U') IS NOT NULL DROP TABLE [bangladesh].[eng_media_comment];
IF OBJECT_ID(N'[bangladesh].[eng_media_like]', N'U') IS NOT NULL DROP TABLE [bangladesh].[eng_media_like];
IF OBJECT_ID(N'[bangladesh].[map_media_entry_tag]', N'U') IS NOT NULL DROP TABLE [bangladesh].[map_media_entry_tag];
IF OBJECT_ID(N'[bangladesh].[map_media_album_entry]', N'U') IS NOT NULL DROP TABLE [bangladesh].[map_media_album_entry];
IF OBJECT_ID(N'[bangladesh].[map_media_tag]', N'U') IS NOT NULL DROP TABLE [bangladesh].[map_media_tag];
IF OBJECT_ID(N'[bangladesh].[coll_media_album]', N'U') IS NOT NULL DROP TABLE [bangladesh].[coll_media_album];
IF OBJECT_ID(N'[bangladesh].[coll_media_entry]', N'U') IS NOT NULL DROP TABLE [bangladesh].[coll_media_entry];
IF OBJECT_ID(N'[bangladesh].[ref_media_category]', N'U') IS NOT NULL DROP TABLE [bangladesh].[ref_media_category];
IF OBJECT_ID(N'[bangladesh].[eng_destination_bookmark]', N'U') IS NOT NULL DROP TABLE [bangladesh].[eng_destination_bookmark];
IF OBJECT_ID(N'[bangladesh].[eng_destination_review]', N'U') IS NOT NULL DROP TABLE [bangladesh].[eng_destination_review];
IF OBJECT_ID(N'[bangladesh].[coll_travel_tip]', N'U') IS NOT NULL DROP TABLE [bangladesh].[coll_travel_tip];
IF OBJECT_ID(N'[bangladesh].[coll_transport_route]', N'U') IS NOT NULL DROP TABLE [bangladesh].[coll_transport_route];
IF OBJECT_ID(N'[bangladesh].[coll_accommodation]', N'U') IS NOT NULL DROP TABLE [bangladesh].[coll_accommodation];
IF OBJECT_ID(N'[bangladesh].[coll_destination_photo]', N'U') IS NOT NULL DROP TABLE [bangladesh].[coll_destination_photo];
IF OBJECT_ID(N'[bangladesh].[coll_destination]', N'U') IS NOT NULL DROP TABLE [bangladesh].[coll_destination];
IF OBJECT_ID(N'[bangladesh].[ref_season]', N'U') IS NOT NULL DROP TABLE [bangladesh].[ref_season];
IF OBJECT_ID(N'[bangladesh].[ref_destination_category]', N'U') IS NOT NULL DROP TABLE [bangladesh].[ref_destination_category];
GO


-- ============================================================================
-- FEATURE 1: TRAVEL HUB
-- ============================================================================

-- 1.1 ref_destination_category
CREATE TABLE [bangladesh].[ref_destination_category] (
    bangladesh_ref_destination_category_id   INT           IDENTITY(1,1) NOT NULL,
    destination_category_code                VARCHAR(50)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    destination_category_name_en             NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    destination_category_name_bn             NVARCHAR(100) COLLATE Bengali_100_CI_AS NOT NULL,
    destination_category_icon                NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    sort_order                               INT           NULL,
    is_active                                BIT           NOT NULL DEFAULT(1),
    created_at                               DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                               DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_ref_destination_category
        PRIMARY KEY CLUSTERED (bangladesh_ref_destination_category_id),
    CONSTRAINT UQ_bangladesh_ref_destination_category_code
        UNIQUE (destination_category_code)
);
GO

-- 1.2 ref_season
CREATE TABLE [bangladesh].[ref_season] (
    bangladesh_ref_season_id     INT           IDENTITY(1,1) NOT NULL,
    season_code                  VARCHAR(50)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    season_name_en               NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    season_name_bn               NVARCHAR(100) COLLATE Bengali_100_CI_AS NOT NULL,
    season_months                NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    sort_order                   INT           NULL,
    is_active                    BIT           NOT NULL DEFAULT(1),
    created_at                   DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                   DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_ref_season
        PRIMARY KEY CLUSTERED (bangladesh_ref_season_id),
    CONSTRAINT UQ_bangladesh_ref_season_code
        UNIQUE (season_code)
);
GO

-- 1.3 coll_destination
CREATE TABLE [bangladesh].[coll_destination] (
    bangladesh_coll_destination_id       BIGINT        IDENTITY(1,1) NOT NULL,
    link_user_profile_id                 BIGINT        NOT NULL,
    link_destination_category_id         INT           NOT NULL,
    link_best_season_id                  INT           NULL,
    link_division_id                     INT           NULL,
    link_district_id                     INT           NULL,
    link_upazila_id                      INT           NULL,

    destination_name_en                  NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    destination_name_bn                  NVARCHAR(300) COLLATE Bengali_100_CI_AS NOT NULL,
    destination_slug                     VARCHAR(300)  COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    destination_description_en           NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    destination_description_bn           NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NULL,
    destination_short_description_en     NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    destination_short_description_bn     NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,

    destination_latitude                 DECIMAL(9,6)  NULL,
    destination_longitude                DECIMAL(9,6)  NULL,
    map_formatted_address_bn             NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,
    full_address_bn                      NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,

    entry_fee_bdt                        DECIMAL(10,2) NULL,
    entry_fee_note_bn                    NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,
    visiting_hours_en                    NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    visiting_hours_bn                    NVARCHAR(200) COLLATE Bengali_100_CI_AS NULL,
    difficulty_level                     VARCHAR(20)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,

    cover_image_url                      NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    destination_status                   VARCHAR(20)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL DEFAULT('published'),
    is_featured                          BIT           NOT NULL DEFAULT(0),

    like_count                           INT           NOT NULL DEFAULT(0),
    view_count                           INT           NOT NULL DEFAULT(0),
    review_count                         INT           NOT NULL DEFAULT(0),
    avg_rating                           DECIMAL(3,2)  NULL,

    created_at                           DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                           DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_coll_destination
        PRIMARY KEY CLUSTERED (bangladesh_coll_destination_id),
    CONSTRAINT FK_bangladesh_coll_destination_user_profile
        FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id),
    CONSTRAINT FK_bangladesh_coll_destination_category
        FOREIGN KEY (link_destination_category_id) REFERENCES [bangladesh].[ref_destination_category](bangladesh_ref_destination_category_id),
    CONSTRAINT FK_bangladesh_coll_destination_best_season
        FOREIGN KEY (link_best_season_id) REFERENCES [bangladesh].[ref_season](bangladesh_ref_season_id)
);
GO

CREATE NONCLUSTERED INDEX IX_bangladesh_coll_destination_category ON [bangladesh].[coll_destination](link_destination_category_id);
CREATE NONCLUSTERED INDEX IX_bangladesh_coll_destination_district ON [bangladesh].[coll_destination](link_district_id);
CREATE NONCLUSTERED INDEX IX_bangladesh_coll_destination_status ON [bangladesh].[coll_destination](destination_status);
CREATE NONCLUSTERED INDEX IX_bangladesh_coll_destination_user ON [bangladesh].[coll_destination](link_user_profile_id);
GO

-- 1.4 coll_destination_photo
CREATE TABLE [bangladesh].[coll_destination_photo] (
    bangladesh_coll_destination_photo_id   BIGINT        IDENTITY(1,1) NOT NULL,
    link_coll_destination_id               BIGINT        NOT NULL,
    link_user_profile_id                   BIGINT        NOT NULL,

    photo_url                              NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    photo_thumbnail_url                    NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    caption_en                             NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    caption_bn                             NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,
    sort_order                             INT           NOT NULL DEFAULT(0),
    is_cover                               BIT           NOT NULL DEFAULT(0),

    created_at                             DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                             DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_coll_destination_photo
        PRIMARY KEY CLUSTERED (bangladesh_coll_destination_photo_id),
    CONSTRAINT FK_bangladesh_coll_destination_photo_destination
        FOREIGN KEY (link_coll_destination_id) REFERENCES [bangladesh].[coll_destination](bangladesh_coll_destination_id),
    CONSTRAINT FK_bangladesh_coll_destination_photo_user
        FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id)
);
GO

CREATE NONCLUSTERED INDEX IX_bangladesh_coll_destination_photo_destination ON [bangladesh].[coll_destination_photo](link_coll_destination_id);
GO

-- 1.5 coll_accommodation
CREATE TABLE [bangladesh].[coll_accommodation] (
    bangladesh_coll_accommodation_id      BIGINT        IDENTITY(1,1) NOT NULL,
    link_coll_destination_id              BIGINT        NOT NULL,
    link_user_profile_id                  BIGINT        NOT NULL,

    accommodation_name_en                 NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    accommodation_name_bn                 NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,
    accommodation_type                    VARCHAR(50)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    accommodation_description_en          NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    accommodation_description_bn          NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NULL,

    price_range_min_bdt                   DECIMAL(10,2) NULL,
    price_range_max_bdt                   DECIMAL(10,2) NULL,
    price_note_bn                         NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,
    amenities_json                        NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,

    contact_phone                         NVARCHAR(50)  COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    contact_email                         NVARCHAR(255) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    contact_website                       NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    contact_address_bn                    NVARCHAR(500) COLLATE Bengali_100_CI_AS NULL,

    accommodation_latitude                DECIMAL(9,6)  NULL,
    accommodation_longitude               DECIMAL(9,6)  NULL,
    star_rating                           DECIMAL(2,1)  NULL,
    is_active                             BIT           NOT NULL DEFAULT(1),

    created_at                            DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                            DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_coll_accommodation
        PRIMARY KEY CLUSTERED (bangladesh_coll_accommodation_id),
    CONSTRAINT FK_bangladesh_coll_accommodation_destination
        FOREIGN KEY (link_coll_destination_id) REFERENCES [bangladesh].[coll_destination](bangladesh_coll_destination_id),
    CONSTRAINT FK_bangladesh_coll_accommodation_user
        FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id)
);
GO

CREATE NONCLUSTERED INDEX IX_bangladesh_coll_accommodation_destination ON [bangladesh].[coll_accommodation](link_coll_destination_id);
GO

-- 1.6 coll_transport_route
CREATE TABLE [bangladesh].[coll_transport_route] (
    bangladesh_coll_transport_route_id    BIGINT        IDENTITY(1,1) NOT NULL,
    link_coll_destination_id              BIGINT        NOT NULL,
    link_user_profile_id                  BIGINT        NOT NULL,

    transport_mode                        VARCHAR(30)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    departure_point_en                    NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    departure_point_bn                    NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,
    route_description_en                  NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    route_description_bn                  NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NULL,

    estimated_duration_minutes            INT           NULL,
    estimated_cost_bdt                    DECIMAL(10,2) NULL,
    cost_note_bn                          NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,
    frequency_note_en                     NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    frequency_note_bn                     NVARCHAR(200) COLLATE Bengali_100_CI_AS NULL,
    sort_order                            INT           NOT NULL DEFAULT(0),
    is_active                             BIT           NOT NULL DEFAULT(1),

    created_at                            DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                            DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_coll_transport_route
        PRIMARY KEY CLUSTERED (bangladesh_coll_transport_route_id),
    CONSTRAINT FK_bangladesh_coll_transport_route_destination
        FOREIGN KEY (link_coll_destination_id) REFERENCES [bangladesh].[coll_destination](bangladesh_coll_destination_id),
    CONSTRAINT FK_bangladesh_coll_transport_route_user
        FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id)
);
GO

CREATE NONCLUSTERED INDEX IX_bangladesh_coll_transport_route_destination ON [bangladesh].[coll_transport_route](link_coll_destination_id);
GO

-- 1.7 coll_travel_tip
CREATE TABLE [bangladesh].[coll_travel_tip] (
    bangladesh_coll_travel_tip_id         BIGINT        IDENTITY(1,1) NOT NULL,
    link_coll_destination_id              BIGINT        NOT NULL,
    link_user_profile_id                  BIGINT        NOT NULL,

    tip_text_en                           NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    tip_text_bn                           NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NULL,
    tip_category                          VARCHAR(30)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,

    created_at                            DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                            DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_coll_travel_tip
        PRIMARY KEY CLUSTERED (bangladesh_coll_travel_tip_id),
    CONSTRAINT FK_bangladesh_coll_travel_tip_destination
        FOREIGN KEY (link_coll_destination_id) REFERENCES [bangladesh].[coll_destination](bangladesh_coll_destination_id),
    CONSTRAINT FK_bangladesh_coll_travel_tip_user
        FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id)
);
GO

CREATE NONCLUSTERED INDEX IX_bangladesh_coll_travel_tip_destination ON [bangladesh].[coll_travel_tip](link_coll_destination_id);
GO

-- 1.8 eng_destination_review
CREATE TABLE [bangladesh].[eng_destination_review] (
    bangladesh_eng_destination_review_id   BIGINT        IDENTITY(1,1) NOT NULL,
    link_coll_destination_id               BIGINT        NOT NULL,
    link_user_profile_id                   BIGINT        NOT NULL,

    rating_overall                         TINYINT       NOT NULL,
    rating_scenery                         TINYINT       NULL,
    rating_accessibility                   TINYINT       NULL,
    rating_safety                          TINYINT       NULL,
    rating_food                            TINYINT       NULL,
    rating_accommodation                   TINYINT       NULL,

    review_title_en                        NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    review_title_bn                        NVARCHAR(200) COLLATE Bengali_100_CI_AS NULL,
    review_body_en                         NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    review_body_bn                         NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NULL,

    visited_at                             DATE          NULL,
    helpful_count                          INT           NOT NULL DEFAULT(0),

    created_at                             DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                             DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_eng_destination_review
        PRIMARY KEY CLUSTERED (bangladesh_eng_destination_review_id),
    CONSTRAINT FK_bangladesh_eng_destination_review_destination
        FOREIGN KEY (link_coll_destination_id) REFERENCES [bangladesh].[coll_destination](bangladesh_coll_destination_id),
    CONSTRAINT FK_bangladesh_eng_destination_review_user
        FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id),
    CONSTRAINT CK_bangladesh_eng_destination_review_rating_overall CHECK (rating_overall BETWEEN 1 AND 5),
    CONSTRAINT CK_bangladesh_eng_destination_review_rating_scenery CHECK (rating_scenery IS NULL OR rating_scenery BETWEEN 1 AND 5),
    CONSTRAINT CK_bangladesh_eng_destination_review_rating_accessibility CHECK (rating_accessibility IS NULL OR rating_accessibility BETWEEN 1 AND 5),
    CONSTRAINT CK_bangladesh_eng_destination_review_rating_safety CHECK (rating_safety IS NULL OR rating_safety BETWEEN 1 AND 5),
    CONSTRAINT CK_bangladesh_eng_destination_review_rating_food CHECK (rating_food IS NULL OR rating_food BETWEEN 1 AND 5),
    CONSTRAINT CK_bangladesh_eng_destination_review_rating_accommodation CHECK (rating_accommodation IS NULL OR rating_accommodation BETWEEN 1 AND 5)
);
GO

CREATE NONCLUSTERED INDEX IX_bangladesh_eng_destination_review_destination ON [bangladesh].[eng_destination_review](link_coll_destination_id);
CREATE UNIQUE NONCLUSTERED INDEX UQ_bangladesh_eng_destination_review_user_destination ON [bangladesh].[eng_destination_review](link_coll_destination_id, link_user_profile_id);
GO

-- 1.9 eng_destination_bookmark
CREATE TABLE [bangladesh].[eng_destination_bookmark] (
    bangladesh_eng_destination_bookmark_id  BIGINT        IDENTITY(1,1) NOT NULL,
    link_coll_destination_id                BIGINT        NOT NULL,
    link_user_profile_id                    BIGINT        NOT NULL,
    bookmark_note                           NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,
    created_at                              DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),

    CONSTRAINT PK_bangladesh_eng_destination_bookmark
        PRIMARY KEY CLUSTERED (bangladesh_eng_destination_bookmark_id),
    CONSTRAINT FK_bangladesh_eng_destination_bookmark_destination
        FOREIGN KEY (link_coll_destination_id) REFERENCES [bangladesh].[coll_destination](bangladesh_coll_destination_id),
    CONSTRAINT FK_bangladesh_eng_destination_bookmark_user
        FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id)
);
GO

CREATE UNIQUE NONCLUSTERED INDEX UQ_bangladesh_eng_destination_bookmark_user_destination ON [bangladesh].[eng_destination_bookmark](link_coll_destination_id, link_user_profile_id);
GO


-- ============================================================================
-- FEATURE 2: BEAUTY OF BANGLADESH
-- ============================================================================

-- 2.1 ref_media_category
CREATE TABLE [bangladesh].[ref_media_category] (
    bangladesh_ref_media_category_id      INT           IDENTITY(1,1) NOT NULL,
    media_category_code                   VARCHAR(50)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    media_category_name_en                NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    media_category_name_bn                NVARCHAR(100) COLLATE Bengali_100_CI_AS NOT NULL,
    media_category_icon                   NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    sort_order                            INT           NULL,
    is_active                             BIT           NOT NULL DEFAULT(1),
    created_at                            DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                            DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_ref_media_category
        PRIMARY KEY CLUSTERED (bangladesh_ref_media_category_id),
    CONSTRAINT UQ_bangladesh_ref_media_category_code
        UNIQUE (media_category_code)
);
GO

-- 2.2 coll_media_entry
CREATE TABLE [bangladesh].[coll_media_entry] (
    bangladesh_coll_media_entry_id        BIGINT        IDENTITY(1,1) NOT NULL,
    link_user_profile_id                  BIGINT        NOT NULL,
    link_media_category_id                INT           NOT NULL,
    link_season_id                        INT           NULL,
    link_division_id                      INT           NULL,
    link_district_id                      INT           NULL,

    media_title_en                        NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    media_title_bn                        NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,
    media_description_en                  NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    media_description_bn                  NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NULL,

    media_type                            VARCHAR(10)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,

    file_original_url                     NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    file_display_url                      NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    file_thumbnail_url                    NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,

    file_width_px                         INT           NULL,
    file_height_px                        INT           NULL,
    file_duration_seconds                 INT           NULL,
    file_size_bytes                       BIGINT        NULL,
    file_mime_type                        VARCHAR(100)  COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,

    exif_camera_make                      NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    exif_camera_model                     NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    exif_lens                             NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    exif_focal_length                     NVARCHAR(20)  COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    exif_aperture                         NVARCHAR(20)  COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    exif_shutter_speed                    NVARCHAR(20)  COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    exif_iso                              INT           NULL,

    location_name_en                      NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    location_name_bn                      NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,
    media_latitude                        DECIMAL(9,6)  NULL,
    media_longitude                       DECIMAL(9,6)  NULL,

    time_of_day                           VARCHAR(20)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    captured_at                           DATETIME2(0)  NULL,

    visibility                            VARCHAR(20)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL DEFAULT('public'),
    media_status                          VARCHAR(20)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL DEFAULT('published'),

    like_count                            INT           NOT NULL DEFAULT(0),
    view_count                            INT           NOT NULL DEFAULT(0),
    comment_count                         INT           NOT NULL DEFAULT(0),

    created_at                            DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                            DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_coll_media_entry
        PRIMARY KEY CLUSTERED (bangladesh_coll_media_entry_id),
    CONSTRAINT FK_bangladesh_coll_media_entry_user
        FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id),
    CONSTRAINT FK_bangladesh_coll_media_entry_category
        FOREIGN KEY (link_media_category_id) REFERENCES [bangladesh].[ref_media_category](bangladesh_ref_media_category_id),
    CONSTRAINT FK_bangladesh_coll_media_entry_season
        FOREIGN KEY (link_season_id) REFERENCES [bangladesh].[ref_season](bangladesh_ref_season_id)
);
GO

CREATE NONCLUSTERED INDEX IX_bangladesh_coll_media_entry_user ON [bangladesh].[coll_media_entry](link_user_profile_id);
CREATE NONCLUSTERED INDEX IX_bangladesh_coll_media_entry_category ON [bangladesh].[coll_media_entry](link_media_category_id);
CREATE NONCLUSTERED INDEX IX_bangladesh_coll_media_entry_status ON [bangladesh].[coll_media_entry](media_status);
CREATE NONCLUSTERED INDEX IX_bangladesh_coll_media_entry_media_type ON [bangladesh].[coll_media_entry](media_type);
GO

-- 2.3 coll_media_album
CREATE TABLE [bangladesh].[coll_media_album] (
    bangladesh_coll_media_album_id        BIGINT        IDENTITY(1,1) NOT NULL,
    link_user_profile_id                  BIGINT        NOT NULL,

    album_title_en                        NVARCHAR(300) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    album_title_bn                        NVARCHAR(300) COLLATE Bengali_100_CI_AS NULL,
    album_description_en                  NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    album_description_bn                  NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NULL,

    cover_image_url                       NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    visibility                            VARCHAR(20)   COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL DEFAULT('public'),
    entry_count                           INT           NOT NULL DEFAULT(0),

    created_at                            DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                            DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_coll_media_album
        PRIMARY KEY CLUSTERED (bangladesh_coll_media_album_id),
    CONSTRAINT FK_bangladesh_coll_media_album_user
        FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id)
);
GO

CREATE NONCLUSTERED INDEX IX_bangladesh_coll_media_album_user ON [bangladesh].[coll_media_album](link_user_profile_id);
GO

-- 2.4 map_media_album_entry
CREATE TABLE [bangladesh].[map_media_album_entry] (
    link_coll_media_album_id              BIGINT        NOT NULL,
    link_coll_media_entry_id              BIGINT        NOT NULL,
    sort_order                            INT           NOT NULL DEFAULT(0),
    created_at                            DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),

    CONSTRAINT PK_bangladesh_map_media_album_entry
        PRIMARY KEY CLUSTERED (link_coll_media_album_id, link_coll_media_entry_id),
    CONSTRAINT FK_bangladesh_map_media_album_entry_album
        FOREIGN KEY (link_coll_media_album_id) REFERENCES [bangladesh].[coll_media_album](bangladesh_coll_media_album_id),
    CONSTRAINT FK_bangladesh_map_media_album_entry_entry
        FOREIGN KEY (link_coll_media_entry_id) REFERENCES [bangladesh].[coll_media_entry](bangladesh_coll_media_entry_id)
);
GO

-- 2.5 map_media_tag
CREATE TABLE [bangladesh].[map_media_tag] (
    bangladesh_map_media_tag_id           INT           IDENTITY(1,1) NOT NULL,
    tag_name_en                           NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    tag_name_bn                           NVARCHAR(100) COLLATE Bengali_100_CI_AS NULL,
    tag_slug                              VARCHAR(100)  COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    usage_count                           INT           NOT NULL DEFAULT(0),
    created_at                            DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),

    CONSTRAINT PK_bangladesh_map_media_tag
        PRIMARY KEY CLUSTERED (bangladesh_map_media_tag_id),
    CONSTRAINT UQ_bangladesh_map_media_tag_slug UNIQUE (tag_slug)
);
GO

-- 2.6 map_media_entry_tag
CREATE TABLE [bangladesh].[map_media_entry_tag] (
    link_coll_media_entry_id              BIGINT        NOT NULL,
    link_map_media_tag_id                 INT           NOT NULL,
    created_at                            DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),

    CONSTRAINT PK_bangladesh_map_media_entry_tag
        PRIMARY KEY CLUSTERED (link_coll_media_entry_id, link_map_media_tag_id),
    CONSTRAINT FK_bangladesh_map_media_entry_tag_entry
        FOREIGN KEY (link_coll_media_entry_id) REFERENCES [bangladesh].[coll_media_entry](bangladesh_coll_media_entry_id),
    CONSTRAINT FK_bangladesh_map_media_entry_tag_tag
        FOREIGN KEY (link_map_media_tag_id) REFERENCES [bangladesh].[map_media_tag](bangladesh_map_media_tag_id)
);
GO

-- 2.7 eng_media_like
CREATE TABLE [bangladesh].[eng_media_like] (
    bangladesh_eng_media_like_id          BIGINT        IDENTITY(1,1) NOT NULL,
    link_coll_media_entry_id              BIGINT        NOT NULL,
    link_user_profile_id                  BIGINT        NOT NULL,
    created_at                            DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),

    CONSTRAINT PK_bangladesh_eng_media_like
        PRIMARY KEY CLUSTERED (bangladesh_eng_media_like_id),
    CONSTRAINT FK_bangladesh_eng_media_like_entry
        FOREIGN KEY (link_coll_media_entry_id) REFERENCES [bangladesh].[coll_media_entry](bangladesh_coll_media_entry_id),
    CONSTRAINT FK_bangladesh_eng_media_like_user
        FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id)
);
GO

CREATE UNIQUE NONCLUSTERED INDEX UQ_bangladesh_eng_media_like_entry_user ON [bangladesh].[eng_media_like](link_coll_media_entry_id, link_user_profile_id);
GO

-- 2.8 eng_media_comment
CREATE TABLE [bangladesh].[eng_media_comment] (
    bangladesh_eng_media_comment_id       BIGINT        IDENTITY(1,1) NOT NULL,
    link_coll_media_entry_id              BIGINT        NOT NULL,
    link_user_profile_id                  BIGINT        NOT NULL,
    link_parent_comment_id                BIGINT        NULL,

    comment_text_bn                       NVARCHAR(MAX) COLLATE Bengali_100_CI_AS NULL,
    comment_text_en                       NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    like_count                            INT           NOT NULL DEFAULT(0),

    created_at                            DATETIME2(0)  NOT NULL DEFAULT(SYSDATETIME()),
    updated_at                            DATETIME2(0)  NULL,

    CONSTRAINT PK_bangladesh_eng_media_comment
        PRIMARY KEY CLUSTERED (bangladesh_eng_media_comment_id),
    CONSTRAINT FK_bangladesh_eng_media_comment_entry
        FOREIGN KEY (link_coll_media_entry_id) REFERENCES [bangladesh].[coll_media_entry](bangladesh_coll_media_entry_id),
    CONSTRAINT FK_bangladesh_eng_media_comment_user
        FOREIGN KEY (link_user_profile_id) REFERENCES [account].[user_profile](user_profile_id),
    CONSTRAINT FK_bangladesh_eng_media_comment_parent
        FOREIGN KEY (link_parent_comment_id) REFERENCES [bangladesh].[eng_media_comment](bangladesh_eng_media_comment_id)
);
GO

CREATE NONCLUSTERED INDEX IX_bangladesh_eng_media_comment_entry ON [bangladesh].[eng_media_comment](link_coll_media_entry_id);
GO


-- ============================================================================
-- SEED DATA
-- ============================================================================

SET IDENTITY_INSERT [bangladesh].[ref_destination_category] ON;
INSERT INTO [bangladesh].[ref_destination_category]
    (bangladesh_ref_destination_category_id, destination_category_code, destination_category_name_en, destination_category_name_bn, destination_category_icon, sort_order)
VALUES
    (1,  'beach',          'Beach',          N'সমুদ্র সৈকত',      N'🏖️',  1),
    (2,  'hill',           'Hill',           N'পাহাড়',           N'🏔️',  2),
    (3,  'river',          'River',          N'নদী',             N'🌊',  3),
    (4,  'historical',     'Historical',     N'ঐতিহাসিক',        N'🏛️',  4),
    (5,  'religious',      'Religious',      N'ধর্মীয়',          N'🕌',  5),
    (6,  'nature',         'Nature',         N'প্রকৃতি',         N'🌳',  6),
    (7,  'island',         'Island',         N'দ্বীপ',            N'🏝️',  7),
    (8,  'archaeological', 'Archaeological', N'প্রত্নতাত্ত্বিক',   N'🏺',  8),
    (9,  'urban',          'Urban',          N'নগর',             N'🏙️',  9),
    (10, 'waterfall',      'Waterfall',      N'ঝর্ণা',           N'💧',  10),
    (11, 'forest',         'Forest',         N'বন',              N'🌲',  11),
    (12, 'lake',           'Lake / Haor',    N'হাওর / বিল',       N'🏞️',  12);
SET IDENTITY_INSERT [bangladesh].[ref_destination_category] OFF;
GO

SET IDENTITY_INSERT [bangladesh].[ref_season] ON;
INSERT INTO [bangladesh].[ref_season]
    (bangladesh_ref_season_id, season_code, season_name_en, season_name_bn, season_months, sort_order)
VALUES
    (1, 'grishmo',   'Summer (গ্রীষ্ম)',       N'গ্রীষ্ম',   'April - May',         1),
    (2, 'borsha',    'Monsoon (বর্ষা)',       N'বর্ষা',    'June - July',         2),
    (3, 'shorot',    'Autumn (শরৎ)',         N'শরৎ',     'August - September',  3),
    (4, 'hemonto',   'Late Autumn (হেমন্ত)',  N'হেমন্ত',   'October - November',  4),
    (5, 'sheet',     'Winter (শীত)',         N'শীত',     'December - January',  5),
    (6, 'boshonto',  'Spring (বসন্ত)',        N'বসন্ত',    'February - March',    6);
SET IDENTITY_INSERT [bangladesh].[ref_season] OFF;
GO

SET IDENTITY_INSERT [bangladesh].[ref_media_category] ON;
INSERT INTO [bangladesh].[ref_media_category]
    (bangladesh_ref_media_category_id, media_category_code, media_category_name_en, media_category_name_bn, media_category_icon, sort_order)
VALUES
    (1,  'landscape',  'Landscape',        N'প্রাকৃতিক দৃশ্য',     N'🏞️',  1),
    (2,  'wildlife',   'Wildlife',         N'বন্যপ্রাণী',          N'🐅',  2),
    (3,  'river',      'River',            N'নদী',                N'🌊',  3),
    (4,  'mountain',   'Mountain',         N'পর্বত',               N'⛰️',  4),
    (5,  'sunset',     'Sunset / Sunrise', N'সূর্যোদয় / সূর্যাস্ত', N'🌅',  5),
    (6,  'monsoon',    'Monsoon',          N'বর্ষা',               N'🌧️',  6),
    (7,  'heritage',   'Heritage',         N'ঐতিহ্য',              N'🏛️',  7),
    (8,  'street',     'Street',           N'রাস্তা / পথ',         N'🛤️',  8),
    (9,  'aerial',     'Aerial / Drone',   N'আকাশ থেকে',          N'🛩️',  9),
    (10, 'village',    'Village Life',     N'গ্রামীণ জীবন',        N'🏡',  10),
    (11, 'macro',      'Macro',            N'ম্যাক্রো',            N'🔍',  11),
    (12, 'festival',   'Festival',         N'উৎসব',               N'🎊',  12);
SET IDENTITY_INSERT [bangladesh].[ref_media_category] OFF;
GO

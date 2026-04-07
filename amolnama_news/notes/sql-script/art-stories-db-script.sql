-- ================================================================
-- ART & CRAFT + STORIES FOR KIDS — Database Schema
-- Run in SQL Server Management Studio
-- ================================================================

-- ================================================================
-- SCHEMA: [art]
-- ================================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'art')
    EXEC('CREATE SCHEMA [art]');
GO

-- --------------------------------------------------------
-- Reference: Art Category (নকশি কাঁথা, পটচিত্র, আলপনা, etc.)
-- --------------------------------------------------------
CREATE TABLE [blog_art].[ref_art_category] (
    [art_ref_art_category_id]   INT IDENTITY(1,1) NOT NULL,
    [art_category_code]         VARCHAR(50) NOT NULL,
    [art_category_name_bn]      NVARCHAR(200) NOT NULL,
    [art_category_name_en]      NVARCHAR(200) NOT NULL,
    [art_category_icon]         NVARCHAR(10) NULL,
    [sort_order]                INT NULL,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at]                DATETIME2 NULL,
    CONSTRAINT [PK_art_ref_art_category] PRIMARY KEY ([art_ref_art_category_id])
);
GO

-- --------------------------------------------------------
-- Reference: Art Medium (acrylic, jute, clay, bamboo, etc.)
-- --------------------------------------------------------
CREATE TABLE [blog_art].[ref_art_medium] (
    [art_ref_art_medium_id]     INT IDENTITY(1,1) NOT NULL,
    [art_medium_code]           VARCHAR(50) NOT NULL,
    [art_medium_name_bn]        NVARCHAR(200) NOT NULL,
    [art_medium_name_en]        NVARCHAR(200) NOT NULL,
    [sort_order]                INT NULL,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at]                DATETIME2 NULL,
    CONSTRAINT [PK_art_ref_art_medium] PRIMARY KEY ([art_ref_art_medium_id])
);
GO

-- --------------------------------------------------------
-- Reference: Difficulty Level
-- --------------------------------------------------------
CREATE TABLE [blog_art].[ref_art_difficulty] (
    [art_ref_art_difficulty_id] INT IDENTITY(1,1) NOT NULL,
    [art_difficulty_code]       VARCHAR(20) NOT NULL,
    [art_difficulty_name_bn]    NVARCHAR(100) NOT NULL,
    [art_difficulty_name_en]    NVARCHAR(100) NOT NULL,
    [sort_order]                INT NULL,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at]                DATETIME2 NULL,
    CONSTRAINT [PK_art_ref_art_difficulty] PRIMARY KEY ([art_ref_art_difficulty_id])
);
GO

-- --------------------------------------------------------
-- Collection: Artwork Entry (main content)
-- --------------------------------------------------------
CREATE TABLE [blog_art].[coll_artwork] (
    [art_coll_artwork_id]       BIGINT IDENTITY(1,1) NOT NULL,
    [artwork_guid]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    [link_user_profile_id]      BIGINT NOT NULL,
    [link_art_category_id]      INT NOT NULL,
    [link_art_medium_id]        INT NULL,
    [link_art_difficulty_id]    INT NULL,
    [artwork_title_bn]          NVARCHAR(300) NOT NULL,
    [artwork_title_en]          NVARCHAR(300) NULL,
    [artwork_slug]              NVARCHAR(400) NOT NULL,
    [artwork_description_bn]    NVARCHAR(MAX) NULL,
    [artwork_description_en]    NVARCHAR(MAX) NULL,
    [artwork_backstory_bn]      NVARCHAR(MAX) NULL,
    [artwork_materials_bn]      NVARCHAR(1000) NULL,
    [artwork_materials_en]      NVARCHAR(1000) NULL,
    [artwork_dimensions]        NVARCHAR(100) NULL,
    [artwork_type_code]         VARCHAR(20) NOT NULL DEFAULT 'artwork',
    [is_tutorial]               BIT NOT NULL DEFAULT 0,
    [is_for_sale]               BIT NOT NULL DEFAULT 0,
    [estimated_time_minutes]    INT NULL,
    [like_count]                INT NOT NULL DEFAULT 0,
    [view_count]                INT NOT NULL DEFAULT 0,
    [bookmark_count]            INT NOT NULL DEFAULT 0,
    [comment_count]             INT NOT NULL DEFAULT 0,
    [is_featured]               BIT NOT NULL DEFAULT 0,
    [is_published]              BIT NOT NULL DEFAULT 1,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at]                DATETIME2 NULL,
    CONSTRAINT [PK_art_coll_artwork] PRIMARY KEY ([art_coll_artwork_id])
);
GO

CREATE INDEX [IX_coll_artwork_user_profile] ON [blog_art].[coll_artwork] ([link_user_profile_id]);
CREATE INDEX [IX_coll_artwork_category] ON [blog_art].[coll_artwork] ([link_art_category_id]);
CREATE INDEX [IX_coll_artwork_slug] ON [blog_art].[coll_artwork] ([artwork_slug]);
CREATE INDEX [IX_coll_artwork_created] ON [blog_art].[coll_artwork] ([created_at] DESC);
GO

-- --------------------------------------------------------
-- Collection: Artwork Asset (photos per artwork)
-- --------------------------------------------------------
CREATE TABLE [blog_art].[coll_artwork_asset] (
    [art_coll_artwork_asset_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]           BIGINT NOT NULL,
    [link_asset_id]             BIGINT NOT NULL,
    [asset_group_code]          VARCHAR(30) NOT NULL DEFAULT 'main',
    [is_cover]                  BIT NOT NULL DEFAULT 0,
    [caption_bn]                NVARCHAR(500) NULL,
    [sort_order]                INT NOT NULL DEFAULT 0,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_art_coll_artwork_asset] PRIMARY KEY ([art_coll_artwork_asset_id])
);
GO

CREATE INDEX [IX_coll_artwork_asset_artwork] ON [blog_art].[coll_artwork_asset] ([link_artwork_id]);
GO

-- --------------------------------------------------------
-- Collection: Tutorial Step
-- --------------------------------------------------------
CREATE TABLE [blog_art].[coll_artwork_step] (
    [art_coll_artwork_step_id]  BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]           BIGINT NOT NULL,
    [step_number]               INT NOT NULL,
    [step_instruction_bn]       NVARCHAR(MAX) NOT NULL,
    [step_instruction_en]       NVARCHAR(MAX) NULL,
    [link_asset_id]             BIGINT NULL,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_art_coll_artwork_step] PRIMARY KEY ([art_coll_artwork_step_id])
);
GO

CREATE INDEX [IX_coll_artwork_step_artwork] ON [blog_art].[coll_artwork_step] ([link_artwork_id], [step_number]);
GO

-- --------------------------------------------------------
-- Collection: Artwork YouTube Link
-- --------------------------------------------------------
CREATE TABLE [blog_art].[coll_artwork_youtube_link] (
    [art_coll_artwork_youtube_link_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]           BIGINT NOT NULL,
    [link_user_profile_id]      BIGINT NOT NULL,
    [youtube_url]               NVARCHAR(500) NOT NULL,
    [youtube_title_bn]          NVARCHAR(300) NULL,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_art_coll_artwork_youtube_link] PRIMARY KEY ([art_coll_artwork_youtube_link_id])
);
GO

-- --------------------------------------------------------
-- Engagement: Artwork Like
-- --------------------------------------------------------
CREATE TABLE [blog_art].[eng_artwork_like] (
    [art_eng_artwork_like_id]   BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]           BIGINT NOT NULL,
    [link_user_profile_id]      BIGINT NOT NULL,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_art_eng_artwork_like] PRIMARY KEY ([art_eng_artwork_like_id])
);
GO

CREATE UNIQUE INDEX [UX_eng_artwork_like] ON [blog_art].[eng_artwork_like] ([link_artwork_id], [link_user_profile_id]);
GO

-- --------------------------------------------------------
-- Engagement: Artwork Bookmark
-- --------------------------------------------------------
CREATE TABLE [blog_art].[eng_artwork_bookmark] (
    [art_eng_artwork_bookmark_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]           BIGINT NOT NULL,
    [link_user_profile_id]      BIGINT NOT NULL,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_art_eng_artwork_bookmark] PRIMARY KEY ([art_eng_artwork_bookmark_id])
);
GO

CREATE UNIQUE INDEX [UX_eng_artwork_bookmark] ON [blog_art].[eng_artwork_bookmark] ([link_artwork_id], [link_user_profile_id]);
GO

-- --------------------------------------------------------
-- Engagement: Artwork Comment
-- --------------------------------------------------------
CREATE TABLE [blog_art].[eng_artwork_comment] (
    [art_eng_artwork_comment_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_artwork_id]           BIGINT NOT NULL,
    [link_user_profile_id]      BIGINT NOT NULL,
    [link_parent_comment_id]    BIGINT NULL,
    [comment_text_bn]           NVARCHAR(1000) NOT NULL,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_art_eng_artwork_comment] PRIMARY KEY ([art_eng_artwork_comment_id])
);
GO

CREATE INDEX [IX_eng_artwork_comment_artwork] ON [blog_art].[eng_artwork_comment] ([link_artwork_id]);
GO

-- --------------------------------------------------------
-- Seed: Art Categories
-- --------------------------------------------------------
INSERT INTO [blog_art].[ref_art_category] ([art_category_code], [art_category_name_bn], [art_category_name_en], [art_category_icon], [sort_order]) VALUES
('nakshi_kantha',   N'নকশি কাঁথা',     'Nakshi Kantha',      N'🧵', 1),
('patachitra',      N'পটচিত্র',         'Patachitra',         N'🖼️', 2),
('alpona',          N'আলপনা',           'Alpona',             N'✨', 3),
('pottery',         N'মৃৎশিল্প',        'Pottery & Clay Art', N'🏺', 4),
('rickshaw_art',    N'রিকশা আর্ট',      'Rickshaw Art',       N'🚲', 5),
('jamdani',         N'জামদানি',          'Jamdani Weaving',    N'🧶', 6),
('bamboo_craft',    N'বাঁশশিল্প',       'Bamboo Craft',       N'🎋', 7),
('jute_craft',      N'পাটশিল্প',        'Jute Craft',         N'🌾', 8),
('woodcraft',       N'কাঠশিল্প',        'Woodcraft',          N'🪵', 9),
('metalwork',       N'ধাতুশিল্প',       'Metalwork',          N'⚒️', 10),
('handloom',        N'তাঁতশিল্প',       'Handloom Weaving',   N'🧣', 11),
('conch_shell',     N'শঙ্খশিল্প',       'Conch Shell Craft',  N'🐚', 12),
('mask_making',     N'মুখোশশিল্প',      'Mask Making',        N'🎭', 13),
('painting',        N'চিত্রকলা',         'Painting',           N'🎨', 14),
('drawing',         N'অঙ্কন',            'Drawing & Sketching',N'✏️', 15),
('calligraphy',     N'ক্যালিগ্রাফি',     'Calligraphy',        N'✒️', 16),
('digital_art',     N'ডিজিটাল আর্ট',    'Digital Art',        N'💻', 17),
('sculpture',       N'ভাস্কর্য',         'Sculpture',          N'🗿', 18),
('jewelry',         N'গহনাশিল্প',        'Jewelry Making',     N'💎', 19),
('paper_craft',     N'কাগজশিল্প',       'Paper Craft',        N'📄', 20),
('upcycled_art',    N'পুনর্ব্যবহার শিল্প','Upcycled Art',      N'♻️', 21);
GO

-- --------------------------------------------------------
-- Seed: Art Medium
-- --------------------------------------------------------
INSERT INTO [blog_art].[ref_art_medium] ([art_medium_code], [art_medium_name_bn], [art_medium_name_en], [sort_order]) VALUES
('acrylic',     N'অ্যাক্রিলিক',    'Acrylic',          1),
('watercolor',  N'জলরং',           'Watercolor',       2),
('oil_paint',   N'তৈলচিত্র',       'Oil Paint',        3),
('pencil',      N'পেন্সিল',         'Pencil',           4),
('charcoal',    N'চারকোল',          'Charcoal',         5),
('ink',         N'কালি',            'Ink',              6),
('clay',        N'মাটি',            'Clay',             7),
('jute',        N'পাট',             'Jute',             8),
('bamboo',      N'বাঁশ',            'Bamboo',           9),
('wood',        N'কাঠ',             'Wood',             10),
('metal',       N'ধাতু',            'Metal',            11),
('fabric',      N'কাপড়',           'Fabric & Thread',  12),
('paper',       N'কাগজ',            'Paper',            13),
('mixed_media', N'মিশ্র মাধ্যম',    'Mixed Media',      14),
('digital',     N'ডিজিটাল',         'Digital',          15);
GO

-- --------------------------------------------------------
-- Seed: Difficulty
-- --------------------------------------------------------
INSERT INTO [blog_art].[ref_art_difficulty] ([art_difficulty_code], [art_difficulty_name_bn], [art_difficulty_name_en], [sort_order]) VALUES
('easy',        N'সহজ',        'Easy',         1),
('medium',      N'মাঝারি',      'Medium',       2),
('hard',        N'কঠিন',       'Hard',         3);
GO


-- ================================================================
-- SCHEMA: [stories]
-- ================================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'stories')
    EXEC('CREATE SCHEMA [stories]');
GO

-- --------------------------------------------------------
-- Reference: Story Category
-- --------------------------------------------------------
CREATE TABLE [blog_stories].[ref_story_category] (
    [stories_ref_story_category_id] INT IDENTITY(1,1) NOT NULL,
    [story_category_code]           VARCHAR(50) NOT NULL,
    [story_category_name_bn]        NVARCHAR(200) NOT NULL,
    [story_category_name_en]        NVARCHAR(200) NOT NULL,
    [story_category_icon]           NVARCHAR(10) NULL,
    [sort_order]                    INT NULL,
    [is_active]                     BIT NOT NULL DEFAULT 1,
    [created_at]                    DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at]                    DATETIME2 NULL,
    CONSTRAINT [PK_stories_ref_story_category] PRIMARY KEY ([stories_ref_story_category_id])
);
GO

-- --------------------------------------------------------
-- Reference: Age Group
-- --------------------------------------------------------
CREATE TABLE [blog_stories].[ref_story_age_group] (
    [stories_ref_story_age_group_id] INT IDENTITY(1,1) NOT NULL,
    [age_group_code]                VARCHAR(10) NOT NULL,
    [age_group_name_bn]             NVARCHAR(100) NOT NULL,
    [age_group_name_en]             NVARCHAR(100) NOT NULL,
    [age_min]                       INT NOT NULL,
    [age_max]                       INT NOT NULL,
    [sort_order]                    INT NULL,
    [is_active]                     BIT NOT NULL DEFAULT 1,
    [created_at]                    DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_stories_ref_story_age_group] PRIMARY KEY ([stories_ref_story_age_group_id])
);
GO

-- --------------------------------------------------------
-- Collection: Story Entry (main content)
-- --------------------------------------------------------
CREATE TABLE [blog_stories].[coll_story] (
    [stories_coll_story_id]     BIGINT IDENTITY(1,1) NOT NULL,
    [story_guid]                UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    [link_user_profile_id]      BIGINT NOT NULL,
    [link_story_category_id]    INT NOT NULL,
    [link_age_group_id]         INT NOT NULL,
    [story_title_bn]            NVARCHAR(300) NOT NULL,
    [story_title_en]            NVARCHAR(300) NULL,
    [story_slug]                NVARCHAR(400) NOT NULL,
    [story_summary_bn]          NVARCHAR(500) NULL,
    [story_content_html]        NVARCHAR(MAX) NOT NULL,
    [story_source_attribution]  NVARCHAR(500) NULL,
    [story_type_code]           VARCHAR(20) NOT NULL DEFAULT 'text',
    [reading_time_minutes]      INT NOT NULL DEFAULT 5,
    [is_serial]                 BIT NOT NULL DEFAULT 0,
    [serial_part_number]        INT NULL,
    [link_serial_parent_id]     BIGINT NULL,
    [like_count]                INT NOT NULL DEFAULT 0,
    [view_count]                INT NOT NULL DEFAULT 0,
    [bookmark_count]            INT NOT NULL DEFAULT 0,
    [completion_count]          INT NOT NULL DEFAULT 0,
    [comment_count]             INT NOT NULL DEFAULT 0,
    [is_featured]               BIT NOT NULL DEFAULT 0,
    [is_daily_pick]             BIT NOT NULL DEFAULT 0,
    [is_published]              BIT NOT NULL DEFAULT 1,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at]                DATETIME2 NULL,
    CONSTRAINT [PK_stories_coll_story] PRIMARY KEY ([stories_coll_story_id])
);
GO

CREATE INDEX [IX_coll_story_user_profile] ON [blog_stories].[coll_story] ([link_user_profile_id]);
CREATE INDEX [IX_coll_story_category] ON [blog_stories].[coll_story] ([link_story_category_id]);
CREATE INDEX [IX_coll_story_age_group] ON [blog_stories].[coll_story] ([link_age_group_id]);
CREATE INDEX [IX_coll_story_slug] ON [blog_stories].[coll_story] ([story_slug]);
CREATE INDEX [IX_coll_story_created] ON [blog_stories].[coll_story] ([created_at] DESC);
GO

-- --------------------------------------------------------
-- Collection: Story Asset (cover image, illustrations, audio)
-- --------------------------------------------------------
CREATE TABLE [blog_stories].[coll_story_asset] (
    [stories_coll_story_asset_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_story_id]             BIGINT NOT NULL,
    [link_asset_id]             BIGINT NOT NULL,
    [asset_group_code]          VARCHAR(30) NOT NULL DEFAULT 'illustration',
    [is_cover]                  BIT NOT NULL DEFAULT 0,
    [caption_bn]                NVARCHAR(500) NULL,
    [sort_order]                INT NOT NULL DEFAULT 0,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_stories_coll_story_asset] PRIMARY KEY ([stories_coll_story_asset_id])
);
GO

CREATE INDEX [IX_coll_story_asset_story] ON [blog_stories].[coll_story_asset] ([link_story_id]);
GO

-- --------------------------------------------------------
-- Collection: Story Page (paginated reading)
-- --------------------------------------------------------
CREATE TABLE [blog_stories].[coll_story_page] (
    [stories_coll_story_page_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_story_id]             BIGINT NOT NULL,
    [page_number]               INT NOT NULL,
    [page_content_html]         NVARCHAR(MAX) NOT NULL,
    [link_illustration_asset_id] BIGINT NULL,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_stories_coll_story_page] PRIMARY KEY ([stories_coll_story_page_id])
);
GO

CREATE INDEX [IX_coll_story_page_story] ON [blog_stories].[coll_story_page] ([link_story_id], [page_number]);
GO

-- --------------------------------------------------------
-- Engagement: Story Like
-- --------------------------------------------------------
CREATE TABLE [blog_stories].[eng_story_like] (
    [stories_eng_story_like_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_story_id]             BIGINT NOT NULL,
    [link_user_profile_id]      BIGINT NOT NULL,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_stories_eng_story_like] PRIMARY KEY ([stories_eng_story_like_id])
);
GO

CREATE UNIQUE INDEX [UX_eng_story_like] ON [blog_stories].[eng_story_like] ([link_story_id], [link_user_profile_id]);
GO

-- --------------------------------------------------------
-- Engagement: Story Bookmark (with reading position)
-- --------------------------------------------------------
CREATE TABLE [blog_stories].[eng_story_bookmark] (
    [stories_eng_story_bookmark_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_story_id]             BIGINT NOT NULL,
    [link_user_profile_id]      BIGINT NOT NULL,
    [last_page_number]          INT NULL,
    [is_completed]              BIT NOT NULL DEFAULT 0,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at]                DATETIME2 NULL,
    CONSTRAINT [PK_stories_eng_story_bookmark] PRIMARY KEY ([stories_eng_story_bookmark_id])
);
GO

CREATE UNIQUE INDEX [UX_eng_story_bookmark] ON [blog_stories].[eng_story_bookmark] ([link_story_id], [link_user_profile_id]);
GO

-- --------------------------------------------------------
-- Engagement: Story Comment
-- --------------------------------------------------------
CREATE TABLE [blog_stories].[eng_story_comment] (
    [stories_eng_story_comment_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_story_id]             BIGINT NOT NULL,
    [link_user_profile_id]      BIGINT NOT NULL,
    [link_parent_comment_id]    BIGINT NULL,
    [comment_text_bn]           NVARCHAR(1000) NOT NULL,
    [is_active]                 BIT NOT NULL DEFAULT 1,
    [created_at]                DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_stories_eng_story_comment] PRIMARY KEY ([stories_eng_story_comment_id])
);
GO

CREATE INDEX [IX_eng_story_comment_story] ON [blog_stories].[eng_story_comment] ([link_story_id]);
GO

-- --------------------------------------------------------
-- Seed: Story Categories
-- --------------------------------------------------------
INSERT INTO [blog_stories].[ref_story_category] ([story_category_code], [story_category_name_bn], [story_category_name_en], [story_category_icon], [sort_order]) VALUES
('thakurmar_jhuli',     N'ঠাকুরমার ঝুলি',       'Grandmother''s Bag',       N'👵', 1),
('rupkotha',            N'রূপকথা',               'Fairy Tales',              N'🧚', 2),
('panchatantra',        N'পঞ্চতন্ত্র',            'Panchatantra',             N'🦁', 3),
('jataka',              N'জাতক কাহিনী',           'Jataka Tales',             N'🪷', 4),
('gopal_bhar',          N'গোপাল ভাঁড়',           'Gopal Bhar',               N'😄', 5),
('tuntuni',             N'টুন���ুনির গল্প',         'Tuntuni Tales',            N'🐦', 6),
('bangla_folk',         N'বাংলার লোককথা',         'Bengali Folk Tales',       N'🏡', 7),
('niti_kotha',          N'নীতিকথা',               'Moral Stories',            N'⭐', 8),
('ghum_parani',         N'ঘুমপাড়ানি গল্প',       'Bedtime Stories',          N'🌙', 9),
('hashir_golpo',        N'হাসির গল্প',            'Funny Stories',            N'😂', 10),
('adventure',           N'অ্যাডভেঞ্চার গল্প',     'Adventure',                N'⚔️', 11),
('animal_stories',      N'পশুপাখির গল্প',         'Animal Stories',           N'🐾', 12),
('mystery',             N'রহস্য গল্প',            'Mystery',                  N'🔍', 13),
('bhuter_golpo',        N'ভূতের গল্প',            'Ghost Stories',            N'👻', 14),
('chhora',              N'ছড়া ও কবিতা',          'Rhymes & Verse',           N'🎶', 15),
('science_nature',      N'বিজ্ঞান ও প্রকৃতি',     'Science & Nature',         N'🔬', 16),
('liberation_war',      N'মুক্তিযুদ্ধের গল্প',     'Liberation War Stories',   N'🇧🇩', 17),
('festival',            N'উৎসব ও ঐতিহ্য',         'Festivals & Traditions',   N'🎉', 18);
GO

-- --------------------------------------------------------
-- Seed: Age Groups
-- --------------------------------------------------------
INSERT INTO [blog_stories].[ref_story_age_group] ([age_group_code], [age_group_name_bn], [age_group_name_en], [age_min], [age_max], [sort_order]) VALUES
('3_5',     N'ছোট্ট শিশু (৩-৫)',   'Toddlers (3-5)',       3,  5,  1),
('6_8',     N'প্রাথমিক (৬-৮)',      'Primary (6-8)',        6,  8,  2),
('9_12',    N'কিশোর (৯-১২)',        'Pre-teen (9-12)',      9,  12, 3);
GO

PRINT 'Art & Stories schema created successfully.';
GO

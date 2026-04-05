USE [news_magazine];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ================================================================
   SCHEMA: [textextractor]
   ================================================================ */

IF NOT EXISTS
(
    SELECT 1
    FROM sys.schemas
    WHERE [name] = N'textextractor'
)
BEGIN
    EXEC(N'CREATE SCHEMA [textextractor]');
END;
GO

/* ================================================================
   DROP OBJECTS (FK dependency order)
   ================================================================ */

DROP TABLE IF EXISTS [textextractor].[coll_extraction_table_cell];
GO
DROP TABLE IF EXISTS [textextractor].[coll_extraction_table];
GO
DROP TABLE IF EXISTS [textextractor].[coll_extraction_page];
GO
DROP TABLE IF EXISTS [textextractor].[coll_extraction_job];
GO
DROP TABLE IF EXISTS [textextractor].[ref_extraction_engine];
GO
DROP TABLE IF EXISTS [textextractor].[ref_document_type];
GO
DROP TABLE IF EXISTS [textextractor].[config_folder_watcher];
GO

/* ================================================================
   TABLE: [textextractor].[config_folder_watcher]
   ================================================================ */

CREATE TABLE [textextractor].[config_folder_watcher]
(
    [textextractor_config_folder_watcher_id]  INT IDENTITY(1,1) NOT NULL,
    [watcher_name]                         NVARCHAR(100) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [input_folder_path]                    NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [output_folder_path]                   NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [supported_extensions]                 NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [is_active]                               BIT NOT NULL,
    [created_at]                              DATETIME2(0) NOT NULL,
    [updated_at]                              DATETIME2(0) NULL,

    CONSTRAINT [PK_textextractor_config_folder_watcher]
        PRIMARY KEY CLUSTERED ([textextractor_config_folder_watcher_id] ASC)
);
GO

ALTER TABLE [textextractor].[config_folder_watcher]
    ADD CONSTRAINT [DF_textextractor_config_folder_watcher_supported_extensions]
    DEFAULT (N'.jpg,.jpeg,.png,.bmp,.tiff,.webp,.pdf,.mp3,.mp4,.wav,.mkv,.txt,.csv,.log,.md,.html') FOR [supported_extensions];
GO

ALTER TABLE [textextractor].[config_folder_watcher]
    ADD CONSTRAINT [DF_textextractor_config_folder_watcher_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [textextractor].[config_folder_watcher]
    ADD CONSTRAINT [DF_textextractor_config_folder_watcher_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [textextractor].[config_folder_watcher]
    ADD CONSTRAINT [UX_textextractor_config_folder_watcher_watcher_name]
    UNIQUE ([watcher_name]);
GO

/* ================================================================
   TABLE: [textextractor].[ref_extraction_engine]
   ================================================================ */

CREATE TABLE [textextractor].[ref_extraction_engine]
(
    [textextractor_ref_extraction_engine_id]  INT IDENTITY(1,1) NOT NULL,
    [engine_code]                             NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [engine_name_en]                          NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [engine_name_bn]                          NVARCHAR(200) COLLATE Bengali_100_CI_AS NOT NULL,
    [supported_input_types]                NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [sort_order]                              INT NULL,
    [is_active]                               BIT NOT NULL,
    [created_at]                              DATETIME2(0) NOT NULL,
    [updated_at]                              DATETIME2(0) NULL,

    CONSTRAINT [PK_textextractor_ref_extraction_engine]
        PRIMARY KEY CLUSTERED ([textextractor_ref_extraction_engine_id] ASC)
);
GO

ALTER TABLE [textextractor].[ref_extraction_engine]
    ADD CONSTRAINT [DF_textextractor_ref_extraction_engine_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [textextractor].[ref_extraction_engine]
    ADD CONSTRAINT [DF_textextractor_ref_extraction_engine_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [textextractor].[ref_extraction_engine]
    ADD CONSTRAINT [CK_textextractor_ref_extraction_engine_sort_order_non_negative]
    CHECK ([sort_order] IS NULL OR [sort_order] >= 0);
GO

ALTER TABLE [textextractor].[ref_extraction_engine]
    ADD CONSTRAINT [UX_textextractor_ref_extraction_engine_engine_code]
    UNIQUE ([engine_code]);
GO

/* ================================================================
   TABLE: [textextractor].[ref_document_type]
   ================================================================ */

CREATE TABLE [textextractor].[ref_document_type]
(
    [textextractor_ref_document_type_id]      INT IDENTITY(1,1) NOT NULL,
    [document_type_code]                      NVARCHAR(50) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [document_type_name_en]                   NVARCHAR(200) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [document_type_name_bn]                   NVARCHAR(200) COLLATE Bengali_100_CI_AS NOT NULL,
    [sort_order]                              INT NULL,
    [is_active]                               BIT NOT NULL,
    [created_at]                              DATETIME2(0) NOT NULL,
    [updated_at]                              DATETIME2(0) NULL,

    CONSTRAINT [PK_textextractor_ref_document_type]
        PRIMARY KEY CLUSTERED ([textextractor_ref_document_type_id] ASC)
);
GO

ALTER TABLE [textextractor].[ref_document_type]
    ADD CONSTRAINT [DF_textextractor_ref_document_type_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [textextractor].[ref_document_type]
    ADD CONSTRAINT [DF_textextractor_ref_document_type_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [textextractor].[ref_document_type]
    ADD CONSTRAINT [CK_textextractor_ref_document_type_sort_order_non_negative]
    CHECK ([sort_order] IS NULL OR [sort_order] >= 0);
GO

ALTER TABLE [textextractor].[ref_document_type]
    ADD CONSTRAINT [UX_textextractor_ref_document_type_document_type_code]
    UNIQUE ([document_type_code]);
GO

/* ================================================================
   TABLE: [textextractor].[coll_extraction_job]
   ================================================================ */

CREATE TABLE [textextractor].[coll_extraction_job]
(
    [textextractor_coll_extraction_job_id]    BIGINT IDENTITY(1,1) NOT NULL,
    [job_guid]                                UNIQUEIDENTIFIER NOT NULL,
    [link_user_profile_id]                    BIGINT NULL,
    [link_extraction_engine_id]               INT NULL,
    [link_document_type_id]                   INT NULL,
    [link_folder_watcher_id]                  INT NULL,
    [source_type_code]                        NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [original_file_name]                   NVARCHAR(500) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [original_file_extension_code]            NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [original_file_size_bytes]          BIGINT NULL,
    [input_file_path]                      NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [output_file_path]                     NVARCHAR(1000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [input_language_code]                     NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [detected_language_code]                  NVARCHAR(10) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [status_code]                             NVARCHAR(20) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NOT NULL,
    [extracted_text_plain]                    NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [extracted_text_json]                   NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [confidence_score]                        DECIMAL(5,4) NULL,
    [word_count]                              INT NULL,
    [page_count]                              INT NULL,
    [processing_time_milliseconds]      INT NULL,
    [error_message]                        NVARCHAR(2000) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [is_active]                               BIT NOT NULL,
    [created_at]                              DATETIME2(0) NOT NULL,
    [updated_at]                              DATETIME2(0) NULL,
    [completed_at]                            DATETIME2(0) NULL,

    CONSTRAINT [PK_textextractor_coll_extraction_job]
        PRIMARY KEY CLUSTERED ([textextractor_coll_extraction_job_id] ASC)
);
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [DF_textextractor_coll_extraction_job_job_guid]
    DEFAULT (NEWID()) FOR [job_guid];
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [DF_textextractor_coll_extraction_job_source_type_code]
    DEFAULT (N'web_upload') FOR [source_type_code];
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [DF_textextractor_coll_extraction_job_status_code]
    DEFAULT (N'queued') FOR [status_code];
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [DF_textextractor_coll_extraction_job_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [DF_textextractor_coll_extraction_job_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_job_original_file_size_bytes_non_negative]
    CHECK ([original_file_size_bytes] IS NULL OR [original_file_size_bytes] >= 0);
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_job_confidence_score_range]
    CHECK ([confidence_score] IS NULL OR ([confidence_score] >= 0 AND [confidence_score] <= 1));
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_job_word_count_non_negative]
    CHECK ([word_count] IS NULL OR [word_count] >= 0);
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_job_page_count_non_negative]
    CHECK ([page_count] IS NULL OR [page_count] >= 0);
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_job_processing_time_milliseconds_non_negative]
    CHECK ([processing_time_milliseconds] IS NULL OR [processing_time_milliseconds] >= 0);
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [UX_textextractor_coll_extraction_job_job_guid]
    UNIQUE ([job_guid]);
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [FK_textextractor_coll_extraction_job_link_extraction_engine_id]
    FOREIGN KEY ([link_extraction_engine_id])
    REFERENCES [textextractor].[ref_extraction_engine] ([textextractor_ref_extraction_engine_id]);
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [FK_textextractor_coll_extraction_job_link_document_type_id]
    FOREIGN KEY ([link_document_type_id])
    REFERENCES [textextractor].[ref_document_type] ([textextractor_ref_document_type_id]);
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [FK_textextractor_coll_extraction_job_link_folder_watcher_id]
    FOREIGN KEY ([link_folder_watcher_id])
    REFERENCES [textextractor].[config_folder_watcher] ([textextractor_config_folder_watcher_id]);
GO

ALTER TABLE [textextractor].[coll_extraction_job]
    ADD CONSTRAINT [FK_textextractor_coll_extraction_job_link_user_profile_id]
    FOREIGN KEY ([link_user_profile_id])
    REFERENCES [account].[user_profile] ([user_profile_id]);
GO

CREATE NONCLUSTERED INDEX [IX_textextractor_coll_extraction_job_status_code]
    ON [textextractor].[coll_extraction_job] ([status_code] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_textextractor_coll_extraction_job_link_user_profile_id]
    ON [textextractor].[coll_extraction_job] ([link_user_profile_id] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_textextractor_coll_extraction_job_created_at]
    ON [textextractor].[coll_extraction_job] ([created_at] DESC);
GO

/* ================================================================
   TABLE: [textextractor].[coll_extraction_page]
   ================================================================ */

CREATE TABLE [textextractor].[coll_extraction_page]
(
    [textextractor_coll_extraction_page_id]   BIGINT IDENTITY(1,1) NOT NULL,
    [link_extraction_job_id]                  BIGINT NOT NULL,
    [page_number]                             INT NOT NULL,
    [page_text_plain]                         NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [page_text_json]                          NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [confidence_score]                        DECIMAL(5,4) NULL,
    [word_count]                              INT NULL,
    [is_active]                               BIT NOT NULL,
    [created_at]                              DATETIME2(0) NOT NULL,
    [updated_at]                              DATETIME2(0) NULL,

    CONSTRAINT [PK_textextractor_coll_extraction_page]
        PRIMARY KEY CLUSTERED ([textextractor_coll_extraction_page_id] ASC)
);
GO

ALTER TABLE [textextractor].[coll_extraction_page]
    ADD CONSTRAINT [DF_textextractor_coll_extraction_page_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [textextractor].[coll_extraction_page]
    ADD CONSTRAINT [DF_textextractor_coll_extraction_page_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [textextractor].[coll_extraction_page]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_page_page_number_positive]
    CHECK ([page_number] > 0);
GO

ALTER TABLE [textextractor].[coll_extraction_page]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_page_confidence_score_range]
    CHECK ([confidence_score] IS NULL OR ([confidence_score] >= 0 AND [confidence_score] <= 1));
GO

ALTER TABLE [textextractor].[coll_extraction_page]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_page_word_count_non_negative]
    CHECK ([word_count] IS NULL OR [word_count] >= 0);
GO

ALTER TABLE [textextractor].[coll_extraction_page]
    ADD CONSTRAINT [FK_textextractor_coll_extraction_page_link_extraction_job_id]
    FOREIGN KEY ([link_extraction_job_id])
    REFERENCES [textextractor].[coll_extraction_job] ([textextractor_coll_extraction_job_id]);
GO

ALTER TABLE [textextractor].[coll_extraction_page]
    ADD CONSTRAINT [UX_textextractor_coll_extraction_page_link_extraction_job_id_page_number]
    UNIQUE ([link_extraction_job_id], [page_number]);
GO

CREATE NONCLUSTERED INDEX [IX_textextractor_coll_extraction_page_link_extraction_job_id_page_number]
    ON [textextractor].[coll_extraction_page] ([link_extraction_job_id] ASC, [page_number] ASC);
GO

/* ================================================================
   TABLE: [textextractor].[coll_extraction_table]
   ================================================================ */

CREATE TABLE [textextractor].[coll_extraction_table]
(
    [textextractor_coll_extraction_table_id]  BIGINT IDENTITY(1,1) NOT NULL,
    [link_extraction_job_id]                  BIGINT NOT NULL,
    [link_extraction_page_id]                 BIGINT NULL,
    [table_index]                             INT NOT NULL,
    [row_count]                               INT NOT NULL,
    [column_count]                            INT NOT NULL,
    [table_data_csv]                          NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [confidence_score]                        DECIMAL(5,4) NULL,
    [is_active]                               BIT NOT NULL,
    [created_at]                              DATETIME2(0) NOT NULL,
    [updated_at]                              DATETIME2(0) NULL,

    CONSTRAINT [PK_textextractor_coll_extraction_table]
        PRIMARY KEY CLUSTERED ([textextractor_coll_extraction_table_id] ASC)
);
GO

ALTER TABLE [textextractor].[coll_extraction_table]
    ADD CONSTRAINT [DF_textextractor_coll_extraction_table_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [textextractor].[coll_extraction_table]
    ADD CONSTRAINT [DF_textextractor_coll_extraction_table_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [textextractor].[coll_extraction_table]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_table_table_index_non_negative]
    CHECK ([table_index] >= 0);
GO

ALTER TABLE [textextractor].[coll_extraction_table]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_table_row_count_non_negative]
    CHECK ([row_count] >= 0);
GO

ALTER TABLE [textextractor].[coll_extraction_table]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_table_column_count_non_negative]
    CHECK ([column_count] >= 0);
GO

ALTER TABLE [textextractor].[coll_extraction_table]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_table_confidence_score_range]
    CHECK ([confidence_score] IS NULL OR ([confidence_score] >= 0 AND [confidence_score] <= 1));
GO

ALTER TABLE [textextractor].[coll_extraction_table]
    ADD CONSTRAINT [FK_textextractor_coll_extraction_table_link_extraction_job_id]
    FOREIGN KEY ([link_extraction_job_id])
    REFERENCES [textextractor].[coll_extraction_job] ([textextractor_coll_extraction_job_id]);
GO

ALTER TABLE [textextractor].[coll_extraction_table]
    ADD CONSTRAINT [FK_textextractor_coll_extraction_table_link_extraction_page_id]
    FOREIGN KEY ([link_extraction_page_id])
    REFERENCES [textextractor].[coll_extraction_page] ([textextractor_coll_extraction_page_id]);
GO

ALTER TABLE [textextractor].[coll_extraction_table]
    ADD CONSTRAINT [UX_textextractor_coll_extraction_table_link_extraction_job_id_link_extraction_page_id_table_index]
    UNIQUE ([link_extraction_job_id], [link_extraction_page_id], [table_index]);
GO

CREATE NONCLUSTERED INDEX [IX_textextractor_coll_extraction_table_link_extraction_job_id]
    ON [textextractor].[coll_extraction_table] ([link_extraction_job_id] ASC);
GO

/* ================================================================
   TABLE: [textextractor].[coll_extraction_table_cell]
   ================================================================ */

CREATE TABLE [textextractor].[coll_extraction_table_cell]
(
    [textextractor_coll_extraction_table_cell_id] BIGINT IDENTITY(1,1) NOT NULL,
    [link_extraction_table_id]                    BIGINT NOT NULL,
    [row_number]                                  INT NOT NULL,
    [column_number]                               INT NOT NULL,
    [cell_text_plain]                             NVARCHAR(MAX) COLLATE Latin1_General_100_CI_AS_SC_UTF8 NULL,
    [confidence_score]                            DECIMAL(5,4) NULL,
    [is_active]                                   BIT NOT NULL,
    [created_at]                                  DATETIME2(0) NOT NULL,
    [updated_at]                                  DATETIME2(0) NULL,

    CONSTRAINT [PK_textextractor_coll_extraction_table_cell]
        PRIMARY KEY CLUSTERED ([textextractor_coll_extraction_table_cell_id] ASC)
);
GO

ALTER TABLE [textextractor].[coll_extraction_table_cell]
    ADD CONSTRAINT [DF_textextractor_coll_extraction_table_cell_is_active]
    DEFAULT ((0)) FOR [is_active];
GO

ALTER TABLE [textextractor].[coll_extraction_table_cell]
    ADD CONSTRAINT [DF_textextractor_coll_extraction_table_cell_created_at]
    DEFAULT (SYSDATETIME()) FOR [created_at];
GO

ALTER TABLE [textextractor].[coll_extraction_table_cell]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_table_cell_row_number_non_negative]
    CHECK ([row_number] >= 0);
GO

ALTER TABLE [textextractor].[coll_extraction_table_cell]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_table_cell_column_number_non_negative]
    CHECK ([column_number] >= 0);
GO

ALTER TABLE [textextractor].[coll_extraction_table_cell]
    ADD CONSTRAINT [CK_textextractor_coll_extraction_table_cell_confidence_score_range]
    CHECK ([confidence_score] IS NULL OR ([confidence_score] >= 0 AND [confidence_score] <= 1));
GO

ALTER TABLE [textextractor].[coll_extraction_table_cell]
    ADD CONSTRAINT [FK_textextractor_coll_extraction_table_cell_link_extraction_table_id]
    FOREIGN KEY ([link_extraction_table_id])
    REFERENCES [textextractor].[coll_extraction_table] ([textextractor_coll_extraction_table_id]);
GO

ALTER TABLE [textextractor].[coll_extraction_table_cell]
    ADD CONSTRAINT [UX_textextractor_coll_extraction_table_cell_link_extraction_table_id_row_number_column_number]
    UNIQUE ([link_extraction_table_id], [row_number], [column_number]);
GO

CREATE NONCLUSTERED INDEX [IX_textextractor_coll_extraction_table_cell_link_extraction_table_id]
    ON [textextractor].[coll_extraction_table_cell] ([link_extraction_table_id] ASC);
GO

/* ================================================================
   SEED: [textextractor].[ref_extraction_engine]
   ================================================================ */

INSERT INTO [textextractor].[ref_extraction_engine]
(
    [engine_code],
    [engine_name_en],
    [engine_name_bn],
    [supported_input_types],
    [sort_order],
    [is_active]
)
VALUES
(N'easyocr',   N'EasyOCR',               N'ইজিওসিআর',             N'.jpg,.jpeg,.png,.bmp,.tiff,.webp', 1, 1),
(N'tesseract', N'Tesseract OCR',         N'টেসার‍্যাক্ট ওসিআর',     N'.jpg,.jpeg,.png,.bmp,.tiff,.webp', 2, 1),
(N'whisper',   N'OpenAI Whisper',        N'হুইসপার',               N'.mp3,.mp4,.wav,.mkv,.flac,.m4a',   3, 1),
(N'pymupdf',   N'PyMuPDF PDF Text',      N'পাইমিউপিডিএফ',          N'.pdf',                              4, 1),
(N'camelot',   N'Camelot PDF Tables',    N'ক্যামেলট',              N'.pdf',                              5, 1),
(N'plaintext', N'Plain Text Reader',     N'সাধারণ টেক্সট',         N'.txt,.csv,.log,.md,.html',          6, 1),
(N'latex_ocr', N'LaTeX OCR Equations',   N'ল্যাটেক ওসিআর',         N'.jpg,.jpeg,.png',                   7, 1);
GO

/* ================================================================
   SEED: [textextractor].[ref_document_type]
   ================================================================ */

INSERT INTO [textextractor].[ref_document_type]
(
    [document_type_code],
    [document_type_name_en],
    [document_type_name_bn],
    [sort_order],
    [is_active]
)
VALUES
(N'general',       N'General Document',      N'সাধারণ নথি',            1, 1),
(N'invoice',       N'Invoice',               N'চালান',                2, 1),
(N'receipt',       N'Receipt',               N'রসিদ',                 3, 1),
(N'id_card',       N'ID Card or NID',        N'পরিচয়পত্র বা এনআইডি', 4, 1),
(N'certificate',   N'Certificate',           N'সনদপত্র',              5, 1),
(N'letter',        N'Letter',                N'চিঠি',                 6, 1),
(N'form',          N'Form',                  N'ফর্ম',                 7, 1),
(N'article',       N'Article or News',       N'প্রবন্ধ বা সংবাদ',      8, 1),
(N'handwritten',   N'Handwritten Notes',     N'হাতে লেখা',            9, 1),
(N'book_page',     N'Book Page',             N'বইয়ের পাতা',          10, 1),
(N'whiteboard',    N'Whiteboard or Lecture', N'হোয়াইটবোর্ড',         11, 1),
(N'audio_lecture', N'Audio Lecture',         N'অডিও লেকচার',          12, 1),
(N'video_lecture', N'Video Lecture',         N'ভিডিও লেকচার',         13, 1),
(N'math_equation', N'Math Equation',         N'গাণিতিক সমীকরণ',       14, 1);
GO

/* ================================================================
   SEED: [textextractor].[config_folder_watcher]
   ================================================================ */

INSERT INTO [textextractor].[config_folder_watcher]
(
    [watcher_name],
    [input_folder_path],
    [output_folder_path],
    [supported_extensions],
    [is_active]
)
VALUES
(
    N'Default Watcher',
    N'media/textextractor/input',
    N'media/textextractor/output',
    N'.jpg,.jpeg,.png,.bmp,.tiff,.webp,.pdf,.mp3,.mp4,.wav,.mkv,.txt,.csv,.log,.md,.html',
    1
);
GO

PRINT N'Text Extractor schema created successfully.';
GO
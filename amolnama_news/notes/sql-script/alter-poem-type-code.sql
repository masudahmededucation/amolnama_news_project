-- Add poem_type_code column to differentiate between poem and song
-- Values: 'poem' or 'song'

USE [news_magazine];
GO

ALTER TABLE [blog_poem].[coll_poem_entry] ADD
    [poem_type_code] VARCHAR(10) NOT NULL DEFAULT 'poem';
GO

-- Remove "Song Lyrics" category (ID 8) — no longer needed as a category
DELETE FROM [blog_poem].[ref_poem_category] WHERE [poem_ref_poem_category_id] = 8;
GO

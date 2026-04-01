-- Add view_count and like_count columns to [newshub].[coll_news_asset]
-- for article photo engagement tracking (same as travel hub's CollDestinationPhoto).

ALTER TABLE [newshub].[coll_news_asset]
ADD view_count INT NOT NULL DEFAULT 0;

ALTER TABLE [newshub].[coll_news_asset]
ADD like_count INT NOT NULL DEFAULT 0;

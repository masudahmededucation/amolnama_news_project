-- Backfill asset_group_code for existing coll_news_asset records that have NULL.
-- Actor photos (accused/victim/witness) are identified by sort_order ranges.
-- Evidence and general photos default to 'general' if asset_group_code is NULL.

-- Accused photos: sort_order 100-102
UPDATE [newshub].[coll_news_asset]
SET [newshub].[coll_news_asset].asset_group_code = 'accused'
WHERE [newshub].[coll_news_asset].asset_group_code IS NULL
  AND [newshub].[coll_news_asset].sort_order >= 100
  AND [newshub].[coll_news_asset].sort_order <= 102;

-- Victim photos: sort_order 200-202
UPDATE [newshub].[coll_news_asset]
SET [newshub].[coll_news_asset].asset_group_code = 'victim'
WHERE [newshub].[coll_news_asset].asset_group_code IS NULL
  AND [newshub].[coll_news_asset].sort_order >= 200
  AND [newshub].[coll_news_asset].sort_order <= 202;

-- Witness photos: sort_order 300-302
UPDATE [newshub].[coll_news_asset]
SET [newshub].[coll_news_asset].asset_group_code = 'witness'
WHERE [newshub].[coll_news_asset].asset_group_code IS NULL
  AND [newshub].[coll_news_asset].sort_order >= 300
  AND [newshub].[coll_news_asset].sort_order <= 302;

-- Remaining NULL → general (evidence + general attachments)
UPDATE [newshub].[coll_news_asset]
SET [newshub].[coll_news_asset].asset_group_code = 'general'
WHERE [newshub].[coll_news_asset].asset_group_code IS NULL;

/* =========================================================
   CONTENT REGISTRY — Master content index
   Schema: [content]
   Created: 2026-04-07
   ========================================================= */

-- [content].[ref_content_type] — content type lookup
-- [content].[content_registry] — master content index

-- Each blog table has [link_content_registry_id] BIGINT NULL
-- Tables: post.coll_post, newshub.pub_article, poem.coll_poem_entry,
--         stories.coll_story, art.coll_artwork, bangladesh.coll_destination,
--         bangladesh.coll_media_entry, debate.coll_topic

-- FKs NOT YET ADDED — will add after full wiring verified

-- Backfill script: content-registry-backfill.sql
-- Link update script: content-registry-link-update.sql

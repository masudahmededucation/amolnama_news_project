/*
  Slug migration — Bengali → English for all 8 existing records.
  Run AFTER the Python code changes are deployed (bangla_slugify → english_slug_from_text).

  Old Bengali slugs are kept in comments for rollback reference.
*/

-- ================================================================
-- POEM (6 records)
-- ================================================================

-- old: দর্পন-কবির-বসন্ত-নয়-অবহেলা
UPDATE [blog_poem].[coll_poem_entry] SET [poem_slug] = 'bosonto-noyo-obhela' WHERE [blog_poem_coll_poem_entry_id] = 1;

-- old: ইমরান-কায়েস-একটাই-জীবন
UPDATE [blog_poem].[coll_poem_entry] SET [poem_slug] = 'ektai-jibon' WHERE [blog_poem_coll_poem_entry_id] = 2;

-- old: নির্মলেন্দু-গুণ-তোমার-চোখ-এতো-লাল-কেনো
UPDATE [blog_poem].[coll_poem_entry] SET [poem_slug] = 'tomar-chokh-eto-lal-keno' WHERE [blog_poem_coll_poem_entry_id] = 3;

-- old: সুনীল-গঙ্গোপাধ্যায়-কেউ-কথা-রাখেনি
UPDATE [blog_poem].[coll_poem_entry] SET [poem_slug] = 'keu-kotha-rakheni' WHERE [blog_poem_coll_poem_entry_id] = 4;

-- old: জীবনানন্দ-দাশ-আবার-আসিব-ফিরে
UPDATE [blog_poem].[coll_poem_entry] SET [poem_slug] = 'abar-asib-fire' WHERE [blog_poem_coll_poem_entry_id] = 5;

-- old: পাগল-হাসান-না-জ্বালাইলে-লাগে-আমার-কি-জানি-কি-নাই
UPDATE [blog_poem].[coll_poem_entry] SET [poem_slug] = 'na-jbalaile-lage-amar-ki-jani-ki-nai' WHERE [blog_poem_coll_poem_entry_id] = 6;


-- ================================================================
-- DEBATE (1 record)
-- ================================================================

-- old: ৭২-এর-সংবিধান-কি-ছুঁড়ে-ফেলা-উচিত
UPDATE [blog_debate].[coll_topic] SET [topic_slug] = '72-er-songbidhan-ki-chunre-fela-uchit' WHERE [blog_debate_coll_topic_id] = 2;


-- ================================================================
-- NEWSHUB (1 record)
-- ================================================================

-- old: chandabaji-dhaka-সড়কে-চাঁদাবাজির-বর্তমান-চিত্র-2026
UPDATE [newshub].[pub_article] SET [pub_article_slug] = 'sorke-chandabajir-bortman-chitro' WHERE [pub_article_id] = 1;


-- ================================================================
-- VERIFY — no Bengali chars in slugs
-- ================================================================

SELECT 'poem' AS app, poem_slug FROM [blog_poem].[coll_poem_entry];
SELECT 'debate' AS app, topic_slug FROM [blog_debate].[coll_topic];
SELECT 'newshub' AS app, pub_article_slug FROM [newshub].[pub_article];

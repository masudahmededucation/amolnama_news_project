# Newshub Data Flow

## Phase 1: Reference Data (Foundation — Admin/System role)
1. `ref_news_category` — categories (Politics, Sports, etc.). Fields: name_bn, name_en (both NOT NULL), description_bn (TEXT, NULL)
2. `ref_news_tag` — tags with optional category link. Fields: news_tag_id (PK), link_news_category_id (NULL), tag_name_bn, tag_name_en (both NOT NULL)
3. `ref_news_category_tag` — junction: category ↔ tag. Composite PK (link_news_category_id + link_news_tag_id), sort_order (NULL), is_featured
4. `ref_contributor_type` — roles (Reporter, Citizen Journalist)
5. `ref_platform_type` — social sources (Facebook, X/Twitter)
6. `ref_ad_placement` — ad positions (Sidebar, Header)

## Phase 2: Collection & Entry (Newsroom)
1. `coll_contributor` — register the reporter
2. `coll_news_entry` — primary entry point (requires contributor + category)
3. Child tables:
   - `coll_attachment` — images/videos (featured image flag)
   - `coll_entry_tag_map` — link entry to multiple tags (link_news_entry_id + link_tag_id)
   - `coll_social_source` — social media embeds/source URLs

## Phase 3: Editorial & Verification (Quality Control)
1. `vlog_verification` — editor reviews entry (Approved/Rejected)
2. `vlog_editorial_change` — audit trail for headline/content modifications

## Phase 4: Publishing (Going Live)
1. `pub_article` — data from `coll_news_entry`, generate slug, set `is_published=1`

## Phase 5: Engagement & Monetization
1. `eng_article_stat` — view/share counts
2. `eng_comment` — user comments (requires `pub_article`)
3. `ads_campaign` — ads linked to `ref_ad_placement`
4. `ads_performance_log` — daily impressions/clicks

## Data Flow Summary
| Step | Category | Primary Table | Key Dependency |
|------|----------|--------------|----------------|
| 1 | References | ref_news_category, ref_news_tag, ref_news_category_tag | None |
| 2 | Personnel | coll_contributor | ref_contributor_type |
| 3 | Input | coll_news_entry | coll_contributor, ref_news_category |
| 4 | Media/Tags | coll_attachment, coll_social_source, coll_entry_tag_map | coll_news_entry, ref_news_tag |
| 5 | Audit | vlog_verification, vlog_editorial_change | coll_news_entry |
| 6 | Output | pub_article | coll_news_entry |
| 7 | Stats | eng_article_stat, eng_comment | pub_article |
| 8 | Revenue | ads_campaign, ads_performance_log | ref_ad_placement |

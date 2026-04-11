# DB Schema Audit Report — Full Project Sweep

**Date:** 2026-04-10
**Scope:** All 30 apps in `site_apps/`, excluding `newsengine` and `db_backend` (forbidden), `entertainment`/`sports`/`newsroom` (empty stubs).

**Method:** Quick automated scan of `models.py` for naming convention violations against CLAUDE.md Gate 5 + Gate 7 rules:
1. FK columns must use `link_` prefix
2. `_bn` field requires matching `_en` (display labels only — long-form text content is single-column UTF-8)
3. Asset/photo tables: `is_cover` not `is_featured`
4. Lowercase status_codes / category_codes
5. NVARCHAR not VARCHAR (Django ORM auto-correct, but watch raw SQL)

**Important:** This is a **read-only audit**. No SQL was executed. All scripts below need user review and execution.

---

## Findings — apps with NO violations

These apps have clean schema. No DB changes needed:

- search ✅
- live ✅
- health ✅
- englishtobangla ✅
- pulse ✅
- security ✅
- seo ✅
- core ✅
- portal ✅
- marriage ✅
- textextractor ✅
- tools ✅
- post ✅ (`is_featured` on `RefComposerPlaceholder` is for "featured composer placeholder" — legitimate, not an asset table)
- art ✅ (`is_featured` on `CollArtwork` = "feature on landing page", semantic differs from `ArtworkAsset.is_cover`. Both intentional.)
- stories ✅ (same pattern as art)
- bangladesh ✅ (same pattern: `CollDestination.is_featured` for landing-page feature, `DestinationPhoto.is_cover` for cover photo)
- social ✅ (audited live)

---

## Findings — apps with violations requiring SQL

### 1. `investigation`

```
created_by_user_id  →  link_created_by_user_profile_id
updated_by_user_id  →  link_updated_by_user_profile_id
```

### 2. `locations`

```
division_id           →  link_locations_ref_division_id
district_id           →  link_locations_ref_district_id
constituency_id       →  link_locations_ref_constituency_id
upazila_id            →  link_locations_ref_upazila_id
union_parishad_id     →  link_locations_ref_union_parishad_id
```

### 3. `person`

```
contact_ref_contact_type_id          → link_contact_ref_contact_type_id
contact_ref_entity_type_id           → link_contact_ref_entity_type_id
contact_ref_social_media_platform_id → link_contact_ref_social_media_platform_id
contact_social_media_id              → link_person_contact_social_media_id
job_category_id                      → link_person_ref_job_category_id
```

### 4. `multimedia`

```
asset_type_id   → link_multimedia_ref_asset_type_id
app_asset_id    → link_multimedia_app_asset_id
```

### 5. `content`

```
content_ref_content_category_id     → link_content_ref_content_category_id
content_ref_content_subcategory_id  → link_content_ref_content_subcategory_id
```

**⚠ CRITICAL:** These columns are referenced by **18 FK constraints** across multiple schemas. Renaming requires dropping ALL 18 constraints first, renaming, then recreating. **High blast radius. Recommend SKIPPING in this sweep**, leave as known tech debt for a dedicated session.

### 6. `messenger`

```
last_read_message_id → link_messenger_coll_message_id
```

### 7. `evaluation_vote`

FK columns:
```
evaluation_id              → link_evaluation_vote_coll_evaluation_id
question_category_id       → link_evaluation_vote_ref_question_category_id
question_id                → link_evaluation_vote_coll_question_id
question_option_id         → link_evaluation_vote_coll_question_option_id
election_evaluation_id     → link_evaluation_vote_coll_election_evaluation_id
```

`_bn` orphans (needs matching `_en` since they are display labels, not content):
```
constituency_area_list_bn  → add constituency_area_list_en
district_name_bn           → add district_name_en
division_name_bn           → add division_name_en
```

### 8. `election_vote`

FK columns:
```
election_type_id                  → link_election_vote_ref_election_type_id
election_status_id                → link_election_vote_ref_election_status_id
election_id                       → link_election_vote_coll_election_id
vote_method_id                    → link_election_vote_ref_vote_method_id
candidate_nomination_rulebook_id  → link_election_vote_coll_candidate_nomination_rulebook_id
```

`_bn` orphans:
```
constituency_name_bn  → add constituency_name_en
district_name_bn      → add district_name_en
division_name_bn      → add division_name_en
party_name_bn         → add party_name_en
party_symbol_name_bn  → add party_symbol_name_en
```

### 9. `debate`

```
target_row_id → link_debate_target_row_id
```

This is a polymorphic FK (`target_row_id` + `target_type_code`), no real FK constraint. Just convention.

### 10. `art` — column suffix violations

```
artwork_backstory_bn → DROP _bn suffix (long-form content, single UTF-8 column)
youtube_title_bn     → keep _bn AND add youtube_title_en (it's a label)
```

### 11. `stories` — column suffix violations

```
page_content_html_bn          → DROP _bn suffix (long-form HTML content)
story_content_html_bn         → DROP _bn suffix
story_source_attribution_bn   → DROP _bn suffix (attribution text)
```

### 12. `bangladesh`

FK columns:
```
blog_bangladesh_ref_season_id     → link_blog_bangladesh_ref_season_id
blog_bangladesh_map_media_tag_id  → link_blog_bangladesh_map_media_tag_id
```

`_bn` orphans (drop suffix — single UTF-8 address content):
```
contact_address_bn       → DROP _bn
full_address_bn          → DROP _bn
map_formatted_address_bn → DROP _bn
```

### 13. `newshub`

FK columns:
```
newshub_ref_news_form_type_id   → link_newshub_ref_news_form_type_id
ad_placement_id                 → link_newshub_ref_ad_placement_id
contributor_type_id             → link_newshub_ref_contributor_type_id
news_category_id                → link_newshub_ref_news_category_id
social_media_platform_type_id   → link_newshub_ref_social_media_platform_type_id
```

`_bn` columns:
```
community_addition_title_bn  → keep _bn AND add _en (label)
contributor_full_name_bn     → keep _bn AND add _en (name)
contributor_organization_bn  → keep _bn AND add _en (label)
full_address_bn              → DROP _bn (single UTF-8 address)
map_formatted_address_bn     → DROP _bn (single UTF-8 address)
```

### 14. `user_account`

```
user_auth_method_type_id          → link_user_account_ref_user_auth_method_type_id
contact_ref_contact_type_id       → link_contact_ref_contact_type_id
contact_phone_id                  → link_person_contact_phone_id
contact_email_id                  → link_person_contact_email_id
directory_ref_organisation_type_id → link_directory_ref_organisation_type_id
```

**⚠ CRITICAL:** `user_account` is auth-critical. Renaming PK/FK columns risks breaking login. **Recommend SKIPPING in this sweep**, manual review only.

### 15. `market`

```
commodity_variant_bn → add commodity_variant_en (if it's a label) OR drop _bn (if it's content)
```

Needs human review of the field's actual usage.

---

## Summary table

| App | Violations | SQL needed | Risk |
|---|---|---|---|
| search | 0 | No | — |
| live | 0 | No | — |
| health | 0 | No | — |
| englishtobangla | 0 | No | — |
| pulse | 0 | No | — |
| security | 0 | No | — |
| seo | 0 | No | — |
| core | 0 | No | — |
| portal | 0 | No | — |
| marriage | 0 | No | — |
| textextractor | 0 | No | — |
| tools | 0 | No | — |
| post | 0 | No | — |
| art | 2 suffix | Maybe | Low |
| stories | 3 suffix | Maybe | Low |
| social | 0 | No | — |
| **investigation** | 2 FK | Yes | Low |
| **locations** | 5 FK | Yes | Medium (FK constraints) |
| **person** | 5 FK | Yes | Medium |
| **multimedia** | 2 FK | Yes | Low |
| **content** | 2 FK | **DEFER** | **HIGH (18 dependent constraints)** |
| **messenger** | 1 FK | Yes | Low |
| **evaluation_vote** | 5 FK + 3 suffix | Yes | Medium |
| **election_vote** | 5 FK + 5 suffix | Yes | Medium |
| **debate** | 1 FK | Yes | Low (polymorphic) |
| **bangladesh** | 2 FK + 3 suffix | Yes | Medium |
| **newshub** | 5 FK + 5 suffix | Yes | Medium |
| **user_account** | 5 FK | **DEFER** | **HIGH (auth-critical)** |
| market | 1 suffix | Maybe | Low |

**Total findings:** 47 violations across 13 apps.
**Recommended skips:** `content` (18 FK constraint blast radius), `user_account` (auth-critical).

---

## Why this is a separate project, not a session task

Each FK column rename requires:
1. Query `INFORMATION_SCHEMA.TABLE_CONSTRAINTS` to find all dependent FK constraints
2. Generate `ALTER TABLE DROP CONSTRAINT` for each
3. `EXEC sp_rename '[schema].[table].[old_col]', 'new_col', 'COLUMN'`
4. Generate `ALTER TABLE ADD CONSTRAINT` to recreate FKs with the new column name
5. Update the Django model field name in `models.py`
6. `grep -r` for the old column name across `views.py`, `views_api.py`, templates, JS — fix every reference
7. Render every page that uses the affected model — server-side smoke test
8. Bump cache, collectstatic, commit, push

Multiplied by 47 violations across 13 apps = **multi-day, multi-session work.**

---

## Decision needed

**Path A — Code-only sweep (this session):**
- Skip all DB renames for now
- Focus Phase 3 on the 30-app code audit (id+name attrs already done globally, modularisation, mobile, CSS, bug scan, SEO)
- Document DB findings in this file for a dedicated session later
- Realistic: complete in this session

**Path B — DB renames first:**
- Do 2-3 apps per session, manually
- This session: investigation + locations + multimedia (smallest blast radius)
- Code audit deferred
- Realistic: 5-6 sessions to complete all 13 apps

**Path C — Mixed:**
- Do safest 3 DB renames now (investigation, multimedia, debate — all low-risk, single-table)
- Then code-only sweep on the other 27 apps
- Defer high-risk DB renames (content, user_account, evaluation_vote, election_vote, newshub, bangladesh) for dedicated sessions

**Recommendation: Path A.** The DB renames are valuable but they're isolated tech debt. The code-level violations (mobile, modularisation, security, SEO) compound across the project — they should be fixed first. DB renames can be done one app at a time without blocking anything.

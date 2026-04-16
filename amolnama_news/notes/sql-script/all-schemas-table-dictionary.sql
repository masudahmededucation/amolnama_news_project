-- =============================================================================
-- ALL SCHEMAS — TABLE DICTIONARY (MS_Description extended properties)
-- =============================================================================
-- Generated: 2026-04-15
-- Purpose:   Adds MS_Description extended property to every table across all
--            schemas in the amolnama_news database. This provides inline
--            documentation visible in SSMS, Azure Data Studio, and data
--            catalogues.
--
-- USAGE:     Run in SSMS against the target database. Safe to re-run — uses
--            sp_addextendedproperty which will error on duplicates (use
--            sp_updateextendedproperty to update existing descriptions).
--
-- SKIPPED:   [mastermind] schema (27 tables) — already documented.
-- NOTE:      Tables in [xclude], [staging], [raw] schemas are marked as
--            legacy/staging for review.
-- =============================================================================


-- =============================================================================
-- SCHEMA: [account]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Django-managed user table — email-based auth, no username. Custom User model with hashed password, auth method, and permission flags.',
  'SCHEMA', 'account', 'TABLE', 'user_account_user';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'User profile — display name, language preference, professional bio, feed preferences, avatar, credibility score, debate stats, call privacy, and verification status. One per user.',
  'SCHEMA', 'account', 'TABLE', 'user_profile';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for authentication methods (email/password, Google OAuth, phone OTP, etc.).',
  'SCHEMA', 'account', 'TABLE', 'ref_user_auth_method_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Tracks user devices — device fingerprint, platform, browser, IP address, blocked status. Used for security and session tracking.',
  'SCHEMA', 'account', 'TABLE', 'user_device';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'User session log — links user profile to device and geo source. Tracks session duration, questions answered, risk score, VPN detection, and blocked status.',
  'SCHEMA', 'account', 'TABLE', 'user_session';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Community reputation score — tracks articles submitted/approved, edits made/approved, additions submitted/approved, privilege level, and total points for Wikipedia-style community editing.',
  'SCHEMA', 'account', 'TABLE', 'community_user_reputation';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for community privilege levels — defines point thresholds and permissions (can edit own, suggest edits, edit others, approve, delete) for community editing.',
  'SCHEMA', 'account', 'TABLE', 'ref_community_privilege_level';
GO


-- =============================================================================
-- SCHEMA: [person]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Core person record — names (EN/BN), alias, parent names, NID, birth certificate, DOB, gender, religion, marital status, mobile, email. Central identity table for the platform.',
  'SCHEMA', 'person', 'TABLE', 'person';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction table linking a person to an address with date range and current flag.',
  'SCHEMA', 'person', 'TABLE', 'person_address';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for person titles (Mr, Mrs, Dr, etc.) in EN/BN.',
  'SCHEMA', 'person', 'TABLE', 'ref_title';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for citizenship categories (born citizen, naturalized, dual, etc.) in EN/BN.',
  'SCHEMA', 'person', 'TABLE', 'ref_citizenship_category';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for citizenship statuses (active, revoked, renounced, etc.) in EN/BN.',
  'SCHEMA', 'person', 'TABLE', 'ref_citizenship_status';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for housing tenure types (owned, rented, government-provided, etc.) in EN/BN.',
  'SCHEMA', 'person', 'TABLE', 'ref_housing_tenure';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for residence statuses (permanent resident, temporary, non-resident, etc.) in EN/BN.',
  'SCHEMA', 'person', 'TABLE', 'ref_residence_status';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: person to citizenship with validity period and primary flag.',
  'SCHEMA', 'person', 'TABLE', 'person_citizenship';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: person to citizenship category with validity period and primary flag.',
  'SCHEMA', 'person', 'TABLE', 'person_citizenship_category';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: person to citizenship status with validity period and primary flag.',
  'SCHEMA', 'person', 'TABLE', 'person_citizenship_status';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Person education record — links to qualification, tracks result, major subject, dates, primary asset flag, and highest qualification flag.',
  'SCHEMA', 'person', 'TABLE', 'person_education';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Person housing tenure record — links person to housing tenure type with district and validity period.',
  'SCHEMA', 'person', 'TABLE', 'person_housing_tenure';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Person job record — links person to job title and organisation with department, notes, and date range.',
  'SCHEMA', 'person', 'TABLE', 'person_job';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Person marriage record — links husband and wife person IDs with marriage validity dates.',
  'SCHEMA', 'person', 'TABLE', 'person_marriage';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Person residence status record — links person to residence status with validity period.',
  'SCHEMA', 'person', 'TABLE', 'person_residence_status';
GO


-- =============================================================================
-- SCHEMA: [contact]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for contact types (mobile, landline, work phone, etc.) with validation regex and icon.',
  'SCHEMA', 'contact', 'TABLE', 'ref_contact_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Legacy reference lookup for contact types — original table with validation regex and file icon path.',
  'SCHEMA', 'contact', 'TABLE', 'ref_contact_type_legacy';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for entity types (person, organisation, etc.) used in contact polymorphism.',
  'SCHEMA', 'contact', 'TABLE', 'ref_entity_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for social media platforms (Facebook, Twitter, LinkedIn, etc.) with base URL and icon.',
  'SCHEMA', 'contact', 'TABLE', 'ref_social_media_platform';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Phone contact record — links person to phone number with country calling code, contact type, and primary flag.',
  'SCHEMA', 'contact', 'TABLE', 'phone';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Email contact record — links person to email address with contact type, primary flag, and verification status.',
  'SCHEMA', 'contact', 'TABLE', 'email';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Social media profile link — stores a person''s social media URL for a specific platform.',
  'SCHEMA', 'contact', 'TABLE', 'social_media';
GO


-- =============================================================================
-- SCHEMA: [directory]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for organisation types (government, NGO, private company, educational institution, etc.) in EN/BN.',
  'SCHEMA', 'directory', 'TABLE', 'ref_organisation_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Organisation record — name, legal name, description, tax ID, registration number, employee/client counts, address link, and date range.',
  'SCHEMA', 'directory', 'TABLE', 'organisation';
GO


-- =============================================================================
-- SCHEMA: [career]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for job categories (engineering, medical, education, law, etc.) in EN/BN.',
  'SCHEMA', 'career', 'TABLE', 'ref_job_category';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for job departments (HR, Finance, IT, Marketing, etc.) in EN/BN.',
  'SCHEMA', 'career', 'TABLE', 'ref_job_department';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for job titles (Engineer, Doctor, Teacher, etc.) linked to job category, in EN/BN.',
  'SCHEMA', 'career', 'TABLE', 'ref_job_title';
GO


-- =============================================================================
-- SCHEMA: [education]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for qualification types (SSC, HSC, Honours, Masters, PhD, etc.).',
  'SCHEMA', 'education', 'TABLE', 'qualification_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for specific qualifications within a qualification type (e.g., BSc under Honours).',
  'SCHEMA', 'education', 'TABLE', 'qualification';
GO


-- =============================================================================
-- SCHEMA: [location]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Administrative divisions of Bangladesh (Dhaka, Chittagong, Rajshahi, etc.) — names EN/BN, ISO codes, geo coordinates, area, population.',
  'SCHEMA', 'location', 'TABLE', 'division';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Districts within divisions (64 districts) — names EN/BN, ISO codes, geo coordinates, area, population.',
  'SCHEMA', 'location', 'TABLE', 'district';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Parliamentary constituencies (300 seats) — seat number, area list EN/BN, geo coordinates, eligible voters.',
  'SCHEMA', 'location', 'TABLE', 'constituency';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Sub-districts (upazilas) within districts — names EN/BN, location type, ISO codes, geo coordinates, area, population.',
  'SCHEMA', 'location', 'TABLE', 'upazila';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Local government units (union parishads) within upazilas — names EN/BN, location type, geo coordinates, area, population.',
  'SCHEMA', 'location', 'TABLE', 'union_parishad';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Metropolitan police stations (thanas) within city corporation areas — names EN/BN, ISO codes, geo coordinates.',
  'SCHEMA', 'location', 'TABLE', 'metropolitan_thana';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Denormalized junction: metropolitan thana to city corporation ward mapping with primary thana flag.',
  'SCHEMA', 'location', 'TABLE', 'metropolitan_thana_ward';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'City corporations (12 major cities) — names EN/BN, BBS code, geo coordinates, area, population.',
  'SCHEMA', 'location', 'TABLE', 'city_corporation';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Wards within city corporations — ward number, area names EN/BN, BBS code, geo coordinates, area, population.',
  'SCHEMA', 'location', 'TABLE', 'city_corporation_ward';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Municipalities (pourashavas) under upazilas — names EN/BN, BBS code, class (A/B/C), geo coordinates, area, population.',
  'SCHEMA', 'location', 'TABLE', 'municipality';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Wards within municipalities — ward number, area names EN/BN, BBS code, geo coordinates, area, population.',
  'SCHEMA', 'location', 'TABLE', 'municipality_ward';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Wards within union parishads — ward number, names EN/BN, BBS code, geo coordinates, area, population.',
  'SCHEMA', 'location', 'TABLE', 'union_parishad_ward';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Villages within union parishads — names EN/BN, BBS code, geo coordinates, area, population.',
  'SCHEMA', 'location', 'TABLE', 'union_parishad_village';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Physical/postal address record — street lines, city, region, postal code, links to union parishad/ward/village, geo coordinates.',
  'SCHEMA', 'location', 'TABLE', 'address';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Geo-IP source record — country, region, city, ISP, network type, and coordinates. Used for session geolocation and VPN detection.',
  'SCHEMA', 'location', 'TABLE', 'geo_source';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Unified location search table — denormalized index of all administrative levels (division, district, upazila, union parishad, etc.) for Tom Select location search. Includes display titles and relationship paths in EN/BN.',
  'SCHEMA', 'location', 'TABLE', 'unified_location_search';
GO


-- =============================================================================
-- SCHEMA: [media]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for file format conversion mappings — source format to allowed destination formats (e.g., DOCX to PDF).',
  'SCHEMA', 'media', 'TABLE', 'ref_file_conversion_map';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for asset types — category, name, MIME type, max size, allowed extension. Controls upload validation.',
  'SCHEMA', 'media', 'TABLE', 'ref_asset_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'App-owned static assets (logos, icons, guide images) — file name, path, alt text EN/BN. Not user uploads.',
  'SCHEMA', 'media', 'TABLE', 'app_asset';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'User-uploaded media asset — file metadata (name, extension, MIME, size), SHA-256 hash, description, tags JSON, capture date. Has computed file_storage_path column.',
  'SCHEMA', 'media', 'TABLE', 'asset';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for social media platform types (YouTube, Facebook, TikTok, etc.) with base URL and icon.',
  'SCHEMA', 'media', 'TABLE', 'ref_social_media_platform_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Social media URL library — stores shared social media URLs with embed code. Has computed social_url_hash (SHA2_256) for deduplication.',
  'SCHEMA', 'media', 'TABLE', 'social_media_url_library';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Video transcoding job queue — tracks FFmpeg HLS conversion progress. Stores source/output paths, quality variants (360p/720p), manifest path, duration, and status.',
  'SCHEMA', 'media', 'TABLE', 'fact_video_transcode_job';
GO


-- =============================================================================
-- SCHEMA: [content]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for top-level content categories (article, poem, story, art, destination, media, debate, biography, historybd, probashbarta, studentlife). 10+ types.',
  'SCHEMA', 'content', 'TABLE', 'ref_content_category';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for content subcategories/topics within each category (e.g., Crime, Love, Painting, Beach). 85+ entries with group_code discriminator, metadata JSON, and computed link_subcategory_id/link_subcategory_code.',
  'SCHEMA', 'content', 'TABLE', 'ref_content_subcategory';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Master content registry — universal content index for ALL blog content across apps. Every published piece gets registered with title, slug, summary, URL, cover image, category, and subcategory. content_registry_id is the universal cross-app content ID.',
  'SCHEMA', 'content', 'TABLE', 'content_registry';
GO


-- =============================================================================
-- SCHEMA: [blog_poem]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'User-submitted poem or song lyrics — title, body, backstory, interpretation in EN/BN. Supports audio recitation URL. Has computed is_published column based on poem_status_code.',
  'SCHEMA', 'blog_poem', 'TABLE', 'coll_poem_entry';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Like/heart engagement on a poem — one like per user per poem.',
  'SCHEMA', 'blog_poem', 'TABLE', 'engagement_poem_like';
GO


-- =============================================================================
-- SCHEMA: [blog_art]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'User-submitted artwork — title, summary, description, backstory, materials, dimensions in EN/BN. Supports tutorials, for-sale flag, difficulty level, and estimated time.',
  'SCHEMA', 'blog_art', 'TABLE', 'coll_artwork';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: artwork to media asset with group code, cover flag, caption, and sort order.',
  'SCHEMA', 'blog_art', 'TABLE', 'artwork_asset';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Tutorial step for an artwork — step number, instruction text EN/BN, optional illustration asset.',
  'SCHEMA', 'blog_art', 'TABLE', 'artwork_step';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'YouTube video link attached to an artwork by a user — URL with Bengali title.',
  'SCHEMA', 'blog_art', 'TABLE', 'artwork_youtube_link';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Like/heart engagement on an artwork — toggleable via is_active.',
  'SCHEMA', 'blog_art', 'TABLE', 'engagement_artwork_like';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Bookmark/save engagement on an artwork — toggleable via is_active.',
  'SCHEMA', 'blog_art', 'TABLE', 'engagement_artwork_bookmark';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Threaded comments on an artwork — supports parent comment replies, Bengali text.',
  'SCHEMA', 'blog_art', 'TABLE', 'engagement_artwork_comment';
GO


-- =============================================================================
-- SCHEMA: [blog_stories]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Children''s story entry — title, summary, HTML content in BN, source attribution. Supports serial stories (multi-part linked via parent), reading time, daily pick flag, and age group category.',
  'SCHEMA', 'blog_stories', 'TABLE', 'coll_story';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: story to media asset with group code, cover flag, caption, and sort order.',
  'SCHEMA', 'blog_stories', 'TABLE', 'story_asset';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Individual page within a story — page number, HTML content BN, optional illustration asset. For paginated story reading.',
  'SCHEMA', 'blog_stories', 'TABLE', 'story_page';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Like/heart engagement on a story — toggleable via is_active.',
  'SCHEMA', 'blog_stories', 'TABLE', 'engagement_story_like';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Bookmark/save engagement on a story — toggleable via is_active.',
  'SCHEMA', 'blog_stories', 'TABLE', 'engagement_story_bookmark';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Threaded comments on a story — supports parent comment replies, Bengali text.',
  'SCHEMA', 'blog_stories', 'TABLE', 'engagement_story_comment';
GO


-- =============================================================================
-- SCHEMA: [blog_debate]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for debate team sides — Blue (Pro) vs Red (Against) with color hex.',
  'SCHEMA', 'blog_debate', 'TABLE', 'ref_team_side';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for debate topic lifecycle statuses (draft, scheduled, live, paused, closed, archived).',
  'SCHEMA', 'blog_debate', 'TABLE', 'ref_topic_status';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for debate post kinds — Argument (top-level) vs Rebuttal (reply from opposition).',
  'SCHEMA', 'blog_debate', 'TABLE', 'ref_post_kind';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for moderation pipeline statuses (pending, approved, rejected, hidden, flagged).',
  'SCHEMA', 'blog_debate', 'TABLE', 'ref_moderation_status';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for vote target types (topic or post) — polymorphic vote discriminator.',
  'SCHEMA', 'blog_debate', 'TABLE', 'ref_vote_target_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Debate topic — scheduled event with title, description, side labels, rules (min/max chars, sentence count, reply depth), AI moderation settings, per-side cached aggregates (Passion Board), winning side, audience votes, and universal engagement counters.',
  'SCHEMA', 'blog_debate', 'TABLE', 'coll_topic';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Debate participant — one user joins one topic on exactly one side (blue/red). Tracks reputation snapshot, argument/rebuttal counts, and total vote score.',
  'SCHEMA', 'blog_debate', 'TABLE', 'coll_topic_participant';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Debate post — argument or rebuttal content with team side routing, reply threading (parent/root/depth), quality metrics (char count, sentence count, emoji ratio, logic score), impact score, argument strength, citation, fact-check flags, and vote counts.',
  'SCHEMA', 'blog_debate', 'TABLE', 'coll_post';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Moderation audit trail for debate posts — records moderation status, validation results (length, sentence count, emoji, repeated chars, logic score), moderator, and timestamp.',
  'SCHEMA', 'blog_debate', 'TABLE', 'fact_debate_post_moderation';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Vote on a debate topic or post — one vote per user per target with upvote (+1) or downvote (-1).',
  'SCHEMA', 'blog_debate', 'TABLE', 'vote';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Edit history audit trail for debate posts — stores previous content before each edit.',
  'SCHEMA', 'blog_debate', 'TABLE', 'fact_post_edit_history';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'In-app notification for debate events — reply, vote, champion badge, fact-check request. Sent to recipient with actor, topic, and optional post reference.',
  'SCHEMA', 'blog_debate', 'TABLE', 'notification';
GO


-- =============================================================================
-- SCHEMA: [blog_bangladesh]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Travel destination in Bangladesh — name, description, coordinates, address, entry fee, visiting hours, difficulty, division/district/upazila links, season. Has computed is_published column.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'coll_destination';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Community-contributed photo for a destination — URL, thumbnail, captions EN/BN, cover flag, sort order, view/like counts.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'destination_photo';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Accommodation near a destination — hotel/resort/guest house with name, type, description, price range, amenities JSON, contact info, coordinates, and star rating.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'accommodation';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Transport route to a destination — mode (bus/train/launch/etc.), departure point, description, estimated duration and cost, frequency notes.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'transport_route';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Community-contributed travel tips for a destination — tip text EN/BN with category (safety, food, timing, etc.).',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'travel_tip';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Multi-criteria user review of a destination — overall, scenery, accessibility, safety, food, accommodation ratings with review title/body and visited date.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'engagement_destination_review';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Bookmark/save engagement on a destination — toggleable via is_active.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'engagement_destination_bookmark';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Like engagement on a destination photo — one like per user per photo.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'engagement_destination_photo_like';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Like engagement on a destination YouTube video — one like per user per video.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'engagement_destination_video_like';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Community-contributed YouTube video link for a destination — URL, video ID, platform, thumbnail, title EN/BN, description, view/like counts.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'destination_youtube_link';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Community-contributed reference link for a destination — external URL with title EN/BN and description.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'destination_reference_link';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Beauty of Bangladesh photo/video entry — media file with EXIF data, location, time-of-day, event dates, division/district links, season, visibility, and engagement counters. Has computed is_published column.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'coll_media_entry';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Photo/video album — user-created collection with title, description, cover image, visibility, and entry count.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'coll_media_album';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Tag for Beauty of Bangladesh media entries — tag name EN/BN, slug, and usage count.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'map_media_tag';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Like engagement on a Beauty of Bangladesh media entry — one like per user per entry.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'engagement_media_like';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Threaded comments on a Beauty of Bangladesh media entry — comment text EN/BN, parent reply support, like count.',
  'SCHEMA', 'blog_bangladesh', 'TABLE', 'engagement_media_comment';
GO


-- =============================================================================
-- SCHEMA: [blog_biography]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Biography entry — profiles of notable persons with title, description EN/BN, subject biographical data (name, birth/death dates, birthplace, nationality, occupation, era, known-for), cover image, status, and engagement counters.',
  'SCHEMA', 'blog_biography', 'TABLE', 'coll_biography_entry';
GO


-- =============================================================================
-- SCHEMA: [blog_historybd]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Historical event entry — event title, description, significance EN/BN, date range, year, era code, location, key figures, turning point flag, cover image, status, and engagement counters.',
  'SCHEMA', 'blog_historybd', 'TABLE', 'coll_history_event';
GO


-- =============================================================================
-- SCHEMA: [blog_probashbarta]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Probash (expatriate) news/story entry — title, description EN/BN, country/region/city location, cover image, status, and engagement counters. Content for Bangladeshi diaspora communities worldwide.',
  'SCHEMA', 'blog_probashbarta', 'TABLE', 'coll_probash_entry';
GO


-- =============================================================================
-- SCHEMA: [blog_studentlife]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Student life / campus entry — title, description EN/BN, institution info (name, type, location), cover image, status, and engagement counters. Content about university and school life in Bangladesh.',
  'SCHEMA', 'blog_studentlife', 'TABLE', 'coll_campus_entry';
GO


-- =============================================================================
-- SCHEMA: [newshub]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for news form types (extortion, land grab, corruption, etc.) — group code, name EN/BN, restricted flag. Controls which submission forms are available.',
  'SCHEMA', 'newshub', 'TABLE', 'ref_news_form_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'User-level form access control — grants a user access to a restricted news form type. Tracks who granted the access.',
  'SCHEMA', 'newshub', 'TABLE', 'newshub_user_form_access';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for ad placement positions on the site (header, sidebar, in-article, footer, etc.).',
  'SCHEMA', 'newshub', 'TABLE', 'ref_ad_placement';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for news contributor types (reporter, citizen journalist, whistleblower, editor, etc.) with group code.',
  'SCHEMA', 'newshub', 'TABLE', 'ref_contributor_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for news categories (politics, crime, economy, sports, etc.) — name EN/BN, slug, search aliases.',
  'SCHEMA', 'newshub', 'TABLE', 'ref_news_category';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for news category tags — sub-tags within a category (e.g., "extortion" under "crime"). Name EN/BN, slug, search aliases, group code.',
  'SCHEMA', 'newshub', 'TABLE', 'ref_news_category_tag';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for actor types in news articles (accused, victim, witness, informant, etc.) with group code.',
  'SCHEMA', 'newshub', 'TABLE', 'ref_actor_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'News contributor record — person who submitted the article. Full name BN, organisation, contact info, bio, verification status.',
  'SCHEMA', 'newshub', 'TABLE', 'contributor';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Core news article entry — headline, summary, content body EN/BN, geo location (lat/lng/address), category, tags, form type, contributor, constituency/district, publication status, occurrence date, and auto-generated topic tags JSON.',
  'SCHEMA', 'newshub', 'TABLE', 'coll_news_entry';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: news entry to media asset (composite PK). Caption BN, cover flag, asset group code (evidence, impact, accused, victim, etc.), view/like counts, sort order.',
  'SCHEMA', 'newshub', 'TABLE', 'news_asset';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: news entry to social media URL library — links social media source posts/videos to a news article.',
  'SCHEMA', 'newshub', 'TABLE', 'news_social_media_source';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: news entry to category tag (composite PK) — many-to-many tagging of articles.',
  'SCHEMA', 'newshub', 'TABLE', 'news_entry_tag';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Published article — derived from coll_news_entry with Bengali slug, headline, content, publish date. Published version visible to public readers.',
  'SCHEMA', 'newshub', 'TABLE', 'pub_article';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Engagement statistics for a published article — view count, share count, like count.',
  'SCHEMA', 'newshub', 'TABLE', 'engagement_article_stat';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'User comments on a published article — threaded (parent_comment_id), moderated (is_approved).',
  'SCHEMA', 'newshub', 'TABLE', 'engagement_comment';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Advertising campaign — linked to ad placement, with script code, image URL, redirect URL, date range, and active flag.',
  'SCHEMA', 'newshub', 'TABLE', 'ads_campaign';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Daily ad performance log — impression and click counts per campaign per day.',
  'SCHEMA', 'newshub', 'TABLE', 'ads_performance_log';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Editorial change audit log — records previous headline and content before editorial edits to a news entry.',
  'SCHEMA', 'newshub', 'TABLE', 'vlog_editorial_change';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Verification action audit log — records who verified a news entry, action taken, and notes.',
  'SCHEMA', 'newshub', 'TABLE', 'vlog_verification';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Article edit history — granular field-level audit trail. Records edit type, target field, old/new values, approval status. For community Wikipedia-style editing.',
  'SCHEMA', 'newshub', 'TABLE', 'article_edit_history';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Community-contributed additions to articles — corrections, updates, context, sources. Moderated with review status, reviewer, and notes.',
  'SCHEMA', 'newshub', 'TABLE', 'article_community_addition';
GO


-- =============================================================================
-- SCHEMA: [post]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Wall post (social feed) — text content, type code, visibility, keywords JSON, scheduled publish, poll/repost/reply threading, content category, auto-flag status, and engagement counters (like, bookmark, reply, repost, view, vote).',
  'SCHEMA', 'post', 'TABLE', 'coll_post';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: post to media asset with sort order and alt text.',
  'SCHEMA', 'post', 'TABLE', 'post_media';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Like/heart engagement on a post — toggleable via is_active.',
  'SCHEMA', 'post', 'TABLE', 'engagement_post_like';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Bookmark/save engagement on a post — toggleable via is_active.',
  'SCHEMA', 'post', 'TABLE', 'engagement_post_bookmark';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Upvote/downvote on a post — vote_value (+1/-1), toggleable via is_active.',
  'SCHEMA', 'post', 'TABLE', 'engagement_post_vote';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Follow/subscribe to a post thread — user gets notified of new replies. Toggleable via is_active.',
  'SCHEMA', 'post', 'TABLE', 'engagement_post_follow';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Flag/report on a post — reason code, description, review status. For content moderation.',
  'SCHEMA', 'post', 'TABLE', 'engagement_post_flag';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Poll attached to a post — question, 2-4 options, per-option vote counts, total votes, optional end date.',
  'SCHEMA', 'post', 'TABLE', 'post_poll';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Individual vote on a post poll — one vote per user per poll, stores selected option number.',
  'SCHEMA', 'post', 'TABLE', 'post_poll_vote';
GO

EXEC sp_addextendedproperty 'MS_Description',
  '@mention — tracks which users are mentioned in a post for notification routing.',
  'SCHEMA', 'post', 'TABLE', 'post_mention';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Edit history for posts — stores previous text before each edit with editor reference.',
  'SCHEMA', 'post', 'TABLE', 'post_edit_history';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for post composer placeholder prompts — rotating inspirational/topical prompts shown in the post creation UI. Supports featured scheduling and category codes.',
  'SCHEMA', 'post', 'TABLE', 'ref_composer_placeholder';
GO


-- =============================================================================
-- SCHEMA: [social]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'User follow relationship — follower follows following. Toggleable via is_active.',
  'SCHEMA', 'social', 'TABLE', 'user_follow';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'User block relationship — blocker blocks blocked user, hiding their content from feed.',
  'SCHEMA', 'social', 'TABLE', 'user_block';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'User-created list/circle — named group of users for filtered feed views.',
  'SCHEMA', 'social', 'TABLE', 'user_list';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Member of a user list — junction linking a user profile to a user list.',
  'SCHEMA', 'social', 'TABLE', 'user_list_member';
GO


-- =============================================================================
-- SCHEMA: [messenger]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Conversation thread — direct or group. Stores type, title, last message preview, auto-delete settings, and creator reference.',
  'SCHEMA', 'messenger', 'TABLE', 'conversation';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Participant in a conversation — role (member/admin), unread count, last read message, muted/pinned flags, join/leave timestamps.',
  'SCHEMA', 'messenger', 'TABLE', 'conversation_participant';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Individual message in a conversation — text content, content type (text/image/file), status (sent/delivered/read), reply-to threading, edit/delete tracking, auto-delete expiry, system message flag.',
  'SCHEMA', 'messenger', 'TABLE', 'message';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Per-user message deletion record — tracks when a user deletes a message from their view (delete-for-me).',
  'SCHEMA', 'messenger', 'TABLE', 'message_deletion';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Real-time typing indicator — tracks last typed timestamp per user per conversation for typing bubble UI.',
  'SCHEMA', 'messenger', 'TABLE', 'typing_indicator';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Voice/video call log — caller, callee, type (audio/video), status (ringing/answered/ended), timestamps, duration, and end reason.',
  'SCHEMA', 'messenger', 'TABLE', 'call_log';
GO


-- =============================================================================
-- SCHEMA: [newsengine]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Feed view history — tracks what content each user has viewed. Used for read history and deduplication in feed.',
  'SCHEMA', 'newsengine', 'TABLE', 'fact_feed_user_content_view';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Cached content ranking scores — engagement, trending, and total composite score per content item. Recency computed live at read time.',
  'SCHEMA', 'newsengine', 'TABLE', 'fact_feed_content_score';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Global notification item — covers all apps. Event code, source app, content link, message, URL, read status. Delivered to recipient with optional actor reference.',
  'SCHEMA', 'newsengine', 'TABLE', 'notification_item';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Universal bookmark — any content type from any app. Single endpoint for all bookmarks with content_type_code discriminator, cached title and URL.',
  'SCHEMA', 'newsengine', 'TABLE', 'bookmark_content';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Rate limit action log — tracks each rate-limited action per user with action code and timestamp.',
  'SCHEMA', 'newsengine', 'TABLE', 'fact_rate_limit_action_log';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Hashtag extracted from posts — normalized text, post count. Central hashtag registry.',
  'SCHEMA', 'newsengine', 'TABLE', 'hashtag_item';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: post to hashtag — many-to-many link between posts and extracted hashtags.',
  'SCHEMA', 'newsengine', 'TABLE', 'hashtag_post_link';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'User-configured muted words — posts containing these words are hidden from the user''s feed.',
  'SCHEMA', 'newsengine', 'TABLE', 'muted_word_item';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for content classification categories — category code, name EN/BN, action (allow/warn/block), severity level. For automated content moderation.',
  'SCHEMA', 'newsengine', 'TABLE', 'ref_content_classification_category';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Flagged keywords for content classification — keyword text (normalized), language code, weight, linked to classification category.',
  'SCHEMA', 'newsengine', 'TABLE', 'ref_content_classification_flagged_keyword';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Content classification audit trail — records each classification result with source app, content ID, category, score, method, action taken, and admin review status.',
  'SCHEMA', 'newsengine', 'TABLE', 'fact_content_classification_result';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Fact-check result audit trail — claim text, normalized text, hash, method, verdict, source, confidence score. For misinformation detection.',
  'SCHEMA', 'newsengine', 'TABLE', 'fact_check_result';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for blacklisted domains — known unreliable/misinformation sources with category and reason.',
  'SCHEMA', 'newsengine', 'TABLE', 'ref_fact_check_blacklisted_domain';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Vector embedding for AI content discovery — stores 384-dimension float vectors as JSON per content item. Used for semantic similarity search and recommendations.',
  'SCHEMA', 'newsengine', 'TABLE', 'fact_content_embedding';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for misinformation patterns — sensationalism/manipulation phrases with normalized text, language code, and weight.',
  'SCHEMA', 'newsengine', 'TABLE', 'ref_fact_check_misinformation_pattern';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'SQL Server graph node referencing user_profile — stores user credibility score. Used in MATCH queries for social graph traversal.',
  'SCHEMA', 'newsengine', 'TABLE', 'graph_user_node';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'SQL Server graph node for topics (hashtags + auto-extracted keywords) — topic name, normalized text, post count, velocity score.',
  'SCHEMA', 'newsengine', 'TABLE', 'graph_topic_node';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'SQL Server graph node referencing coll_post — stores post author and creation timestamp. Used in MATCH queries for content graph.',
  'SCHEMA', 'newsengine', 'TABLE', 'graph_post_node';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for feed cache reason codes — explains why a post was cached in a user''s feed (followed, trending, recommended, etc.).',
  'SCHEMA', 'newsengine', 'TABLE', 'ref_feed_cache_reason';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Pre-computed user feed cache — fan-out target for personalized delivery. Stores post with score, reason, delivery status per user.',
  'SCHEMA', 'newsengine', 'TABLE', 'fact_user_feed_cache';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Raw dwell time log — seconds spent viewing each post per user. Used for engagement signal computation and feed ranking.',
  'SCHEMA', 'newsengine', 'TABLE', 'fact_user_dwell_time_log';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Pre-computed related content cache — stores JSON array of related items per content piece. Avoids expensive vector similarity computation on every page view.',
  'SCHEMA', 'newsengine', 'TABLE', 'fact_related_content_cache';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Developing story thread/arc (e.g., "USA-Iran Conflict 2026") — title EN/BN, slug, summary, status, article count, cover image. Articles linked via story_thread_article junction.',
  'SCHEMA', 'newsengine', 'TABLE', 'story_thread';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: links a news article to a story thread (many-to-many) with optional similarity score.',
  'SCHEMA', 'newsengine', 'TABLE', 'story_thread_article';
GO


-- =============================================================================
-- SCHEMA: [textextractor]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Configuration for folder watcher — input/output paths, supported file extensions. Drives automatic file pickup for text extraction.',
  'SCHEMA', 'textextractor', 'TABLE', 'config_folder_watcher';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for extraction engines (Tesseract OCR, Azure Document Intelligence, PyPDF, etc.) with supported input types.',
  'SCHEMA', 'textextractor', 'TABLE', 'ref_extraction_engine';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for document types (NID card, birth certificate, court order, deed, etc.).',
  'SCHEMA', 'textextractor', 'TABLE', 'ref_document_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Text extraction job — tracks full extraction lifecycle from file upload to completion. Stores file metadata, engine used, extracted text (plain + JSON), confidence, word/page counts, processing time, and error messages.',
  'SCHEMA', 'textextractor', 'TABLE', 'coll_extraction_job';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Individual page extracted from a document — page number, text (plain + JSON), confidence score, word count.',
  'SCHEMA', 'textextractor', 'TABLE', 'extraction_page';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Table detected and extracted from a document — table index, row/column counts, CSV data, confidence score.',
  'SCHEMA', 'textextractor', 'TABLE', 'extraction_table';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Individual cell within an extracted table — row/column position, cell text, confidence score.',
  'SCHEMA', 'textextractor', 'TABLE', 'extraction_table_cell';
GO


-- =============================================================================
-- SCHEMA: [election]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for election types (national parliament, local government, by-election, etc.).',
  'SCHEMA', 'election', 'TABLE', 'ref_election_type';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for election statuses (upcoming, active, completed, cancelled, etc.).',
  'SCHEMA', 'election', 'TABLE', 'ref_election_status';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Election record — name EN/BN, type, status, date. Central reference for all election-related data.',
  'SCHEMA', 'election', 'TABLE', 'ref_election';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for vote methods (paper ballot, electronic, postal, etc.).',
  'SCHEMA', 'election', 'TABLE', 'ref_vote_method';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for candidate nomination rules — rule code, title EN/BN, description. Used for compliance checking.',
  'SCHEMA', 'election', 'TABLE', 'ref_candidate_nomination_rulebook';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for candidate nomination statuses (submitted, accepted, rejected, withdrawn, etc.).',
  'SCHEMA', 'election', 'TABLE', 'ref_candidate_nomination_status';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for voter eligibility statuses (eligible, ineligible, suspended, etc.).',
  'SCHEMA', 'election', 'TABLE', 'ref_voter_eligibility_status';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Digital ballot registry — voter registration for digital voting. Stores hashed identity anchor, device fingerprint, biometric face vector, and SIM slot number.',
  'SCHEMA', 'election', 'TABLE', 'digital_ballot_registry_book';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Digital ballot — individual vote cast with audit receipt code, timestamp, geofencing data (IP, network ping, ISP), and bot detection metrics (duration, interaction count, question average).',
  'SCHEMA', 'election', 'TABLE', 'digital_ballot';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Digital ballot vote entry — individual candidate/party selection within a digital ballot, linked to constituency and union parishad.',
  'SCHEMA', 'election', 'TABLE', 'digital_ballot_vote_entry';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Digital voting security configuration per election — election salt UUID, hash algorithm. Cryptographic parameters for vote integrity.',
  'SCHEMA', 'election', 'TABLE', 'digital_security_config';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Electoral roll — registered voters linked to person, constituency, and eligibility status.',
  'SCHEMA', 'election', 'TABLE', 'electoral_roll';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Electoral roll poll book — tracks voter check-in and ballot cast status per election.',
  'SCHEMA', 'election', 'TABLE', 'electoral_roll_poll_book';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Traditional ballot — links election, electoral roll, and vote method with hashed voter identity and cast timestamp.',
  'SCHEMA', 'election', 'TABLE', 'ballot';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Traditional ballot vote entry — individual candidate selection with rank choice and sort order.',
  'SCHEMA', 'election', 'TABLE', 'ballot_vote_entry';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Candidate nomination — links person to election/constituency/party with nomination status, symbol name EN/BN, and summary.',
  'SCHEMA', 'election', 'TABLE', 'candidate_nomination';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Candidate record — person running in an election with ballot name, summary, and link to nomination.',
  'SCHEMA', 'election', 'TABLE', 'candidate';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Candidate rule compliance audit record — checks each nomination against rulebook rules, records findings and violation flag.',
  'SCHEMA', 'election', 'TABLE', 'candidate_rule_compliance_record';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Election contest seat — defines a contestable seat per election/constituency with max votes per voter.',
  'SCHEMA', 'election', 'TABLE', 'election_contest_seat';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Election result certification — certified vote count for a candidate with certification date, certifier, and digital signature hash.',
  'SCHEMA', 'election', 'TABLE', 'election_result_certification';
GO


-- =============================================================================
-- SCHEMA: [evaluation]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Evaluation event definition — name EN/BN, description, date range, sort order. Used for candidate/representative performance evaluation.',
  'SCHEMA', 'evaluation', 'TABLE', 'ref_evaluation';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Question category within an evaluation — name EN/BN, answer mark weight, sort order.',
  'SCHEMA', 'evaluation', 'TABLE', 'ref_question_category';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Evaluation question — question text EN/BN, linked to evaluation and question category.',
  'SCHEMA', 'evaluation', 'TABLE', 'ref_question';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Question answer option — option text EN/BN, marks awarded, correct answer flag. Used for structured evaluation questionnaires.',
  'SCHEMA', 'evaluation', 'TABLE', 'ref_question_option';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Junction: links an election to an evaluation with sort order — enables the same evaluation to be used across multiple elections.',
  'SCHEMA', 'evaluation', 'TABLE', 'election_evaluation';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'User evaluation response — individual answer to a question, linked to ballot, constituency, party, candidate, and session. Stores marks awarded and remarks.',
  'SCHEMA', 'evaluation', 'TABLE', 'evaluation_response';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Aggregated evaluation result per candidate — total score, max possible score, critical failure flag, result status, linked to evaluation/constituency/party.',
  'SCHEMA', 'evaluation', 'TABLE', 'evaluation_result';
GO


-- =============================================================================
-- SCHEMA: [evaluator]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Evaluator app user device — device fingerprint, hardware UID, app instance, platform, IP, browser. Separate from account.user_device for evaluator-specific security tracking.',
  'SCHEMA', 'evaluator', 'TABLE', 'user_device';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Evaluator app user profile — phone hash, OTP verification, auth provider, face embedding, liveness score, age. Separate from account.user_profile for anonymous evaluator identity.',
  'SCHEMA', 'evaluator', 'TABLE', 'user_profile';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Evaluator app user session — links evaluation, profile, device, geo source, intent type, respondent type. Tracks IP, VPN detection, timing, risk score, and blocked status.',
  'SCHEMA', 'evaluator', 'TABLE', 'user_session';
GO


-- =============================================================================
-- SCHEMA: [party]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Political party reference — name EN/BN, short name, registration number, website, description, symbol name, ideology, status, and asset link for party logo.',
  'SCHEMA', 'party', 'TABLE', 'ref_party';
GO


-- =============================================================================
-- SCHEMA: [market]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'Commodity reference for market price tracking — group, name EN/BN, variant, unit, pack size, notes. Covers rice, vegetables, fish, meat, etc.',
  'SCHEMA', 'market', 'TABLE', 'ref_commodity';
GO

EXEC sp_addextendedproperty 'MS_Description',
  'Reference lookup for measurement unit types (kg, litre, piece, dozen, etc.) in EN/BN.',
  'SCHEMA', 'market', 'TABLE', 'ref_unit_type';
GO


-- =============================================================================
-- SCHEMA: [marriage]
-- =============================================================================

EXEC sp_addextendedproperty 'MS_Description',
  'User-saved marriage registrar office — label, government title, office name/address, registration number, office date. Users save frequently used offices for quick form fill.',
  'SCHEMA', 'marriage', 'TABLE', 'user_saved_office';
GO


-- =============================================================================
-- END OF FILE
-- =============================================================================

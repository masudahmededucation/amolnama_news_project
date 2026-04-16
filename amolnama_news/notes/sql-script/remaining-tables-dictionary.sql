-- ============================================================
-- Extended property descriptions for 150 remaining tables
-- Generated: 2026-04-15
-- Run against: amolnama_news database
-- ============================================================

-- ============================================================
-- [blog_bangladesh]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Junction table linking media entries to media albums for Bangladesh travel hub photo/video galleries.', 'SCHEMA', 'blog_bangladesh', 'TABLE', 'map_media_album_entry';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Junction table linking media entries to tags for Bangladesh travel hub content categorisation.', 'SCHEMA', 'blog_bangladesh', 'TABLE', 'map_media_entry_tag';
GO

-- ============================================================
-- [blog_biography]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Photos attached to biography entries, uploaded by users with URL and thumbnail references.', 'SCHEMA', 'blog_biography', 'TABLE', 'biography_entry_photo';
GO

EXEC sp_addextendedproperty 'MS_Description', 'YouTube video links attached to biography entries for multimedia content.', 'SCHEMA', 'blog_biography', 'TABLE', 'biography_entry_youtube_link';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Life sections within a biography entry, storing titled narrative blocks in Bengali and English.', 'SCHEMA', 'blog_biography', 'TABLE', 'biography_life_section';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Notable quotes associated with biography entries, stored in Bengali and English.', 'SCHEMA', 'blog_biography', 'TABLE', 'biography_quote';
GO

EXEC sp_addextendedproperty 'MS_Description', 'User-submitted tributes to biography subjects, including relationship context and tribute text.', 'SCHEMA', 'blog_biography', 'TABLE', 'biography_tribute';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Bookmark engagement tracking for biography entries per user profile with active/inactive state.', 'SCHEMA', 'blog_biography', 'TABLE', 'engagement_biography_entry_bookmark';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Threaded comments on biography entries with parent comment support for nested replies.', 'SCHEMA', 'blog_biography', 'TABLE', 'engagement_biography_entry_comment';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Like engagement tracking for biography entries per user profile with active/inactive state.', 'SCHEMA', 'blog_biography', 'TABLE', 'engagement_biography_entry_like';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Like engagement tracking for individual biography entry photos per user profile.', 'SCHEMA', 'blog_biography', 'TABLE', 'engagement_biography_entry_photo_like';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of biography person subjects with names, slug, and birth/death year metadata.', 'SCHEMA', 'blog_biography', 'TABLE', 'ref_biography_person';
GO

-- ============================================================
-- [blog_historybd]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Bookmark engagement tracking for historical event entries per user profile with active/inactive state.', 'SCHEMA', 'blog_historybd', 'TABLE', 'engagement_history_event_bookmark';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Threaded comments on historical event entries with parent comment support for nested replies.', 'SCHEMA', 'blog_historybd', 'TABLE', 'engagement_history_event_comment';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Like engagement tracking for historical event entries per user profile with active/inactive state.', 'SCHEMA', 'blog_historybd', 'TABLE', 'engagement_history_event_like';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Like engagement tracking for individual historical event photos per user profile.', 'SCHEMA', 'blog_historybd', 'TABLE', 'engagement_history_event_photo_like';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Historical documents attached to event entries with URL, title, and document type metadata.', 'SCHEMA', 'blog_historybd', 'TABLE', 'history_event_document';
GO

EXEC sp_addextendedproperty 'MS_Description', 'User-submitted perspectives and interpretations of historical events with titled narrative content.', 'SCHEMA', 'blog_historybd', 'TABLE', 'history_event_perspective';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Photos attached to historical event entries, uploaded by users with URL and thumbnail references.', 'SCHEMA', 'blog_historybd', 'TABLE', 'history_event_photo';
GO

EXEC sp_addextendedproperty 'MS_Description', 'YouTube video links attached to historical event entries for multimedia content.', 'SCHEMA', 'blog_historybd', 'TABLE', 'history_event_youtube_link';
GO

-- ============================================================
-- [blog_probashbarta]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Bookmark engagement tracking for probash (expatriate news) entries per user profile with active/inactive state.', 'SCHEMA', 'blog_probashbarta', 'TABLE', 'engagement_probash_entry_bookmark';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Threaded comments on probash (expatriate news) entries with parent comment support for nested replies.', 'SCHEMA', 'blog_probashbarta', 'TABLE', 'engagement_probash_entry_comment';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Like engagement tracking for probash (expatriate news) entries per user profile with active/inactive state.', 'SCHEMA', 'blog_probashbarta', 'TABLE', 'engagement_probash_entry_like';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Like engagement tracking for individual probash entry photos per user profile.', 'SCHEMA', 'blog_probashbarta', 'TABLE', 'engagement_probash_entry_photo_like';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Photos attached to probash (expatriate news) entries, uploaded by users with URL and thumbnail references.', 'SCHEMA', 'blog_probashbarta', 'TABLE', 'probash_entry_photo';
GO

EXEC sp_addextendedproperty 'MS_Description', 'YouTube video links attached to probash (expatriate news) entries for multimedia content.', 'SCHEMA', 'blog_probashbarta', 'TABLE', 'probash_entry_youtube_link';
GO

-- ============================================================
-- [blog_studentlife]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Photos attached to campus life entries, uploaded by users with URL and thumbnail references.', 'SCHEMA', 'blog_studentlife', 'TABLE', 'campus_entry_photo';
GO

EXEC sp_addextendedproperty 'MS_Description', 'YouTube video links attached to campus life entries for multimedia content.', 'SCHEMA', 'blog_studentlife', 'TABLE', 'campus_entry_youtube_link';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Bookmark engagement tracking for campus life entries per user profile with active/inactive state.', 'SCHEMA', 'blog_studentlife', 'TABLE', 'engagement_campus_entry_bookmark';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Threaded comments on campus life entries with parent comment support for nested replies.', 'SCHEMA', 'blog_studentlife', 'TABLE', 'engagement_campus_entry_comment';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Like engagement tracking for campus life entries per user profile with active/inactive state.', 'SCHEMA', 'blog_studentlife', 'TABLE', 'engagement_campus_entry_like';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Like engagement tracking for individual campus life entry photos per user profile.', 'SCHEMA', 'blog_studentlife', 'TABLE', 'engagement_campus_entry_photo_like';
GO

-- ============================================================
-- [control]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Digital security configuration for elections, storing hash algorithm settings and encryption salt per election.', 'SCHEMA', 'control', 'TABLE', 'digital_security_config';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Storage provider configuration defining file root paths and provider details for media/asset storage.', 'SCHEMA', 'control', 'TABLE', 'storage_provider';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Key-value system settings for application-wide configuration with notes and active/inactive state.', 'SCHEMA', 'control', 'TABLE', 'system_setting';
GO

-- ============================================================
-- [digital]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Geo-precision security levels for elections, defining spatial accuracy constraints and strictness during active periods.', 'SCHEMA', 'digital', 'TABLE', 'security_geo_precision_level';
GO

-- ============================================================
-- [investigation]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for civic issue investigations — stores impact details including affected people count and impact category per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'civic_form_impact';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for international conflict investigations — stores actor country involvement, alliances, and coalition details per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'conflict_form_actor_country';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for international conflict investigations — stores conflict type, territorial sovereignty status, and intensity level per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'conflict_form_impact';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for crime investigations — stores casualty impact counts (deaths, injuries, missing) per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'crime_form_impact_casualty';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for crime investigations — stores victim legal action details including GD/FIR status, case number, and reason for not filing.', 'SCHEMA', 'investigation', 'TABLE', 'crime_form_victim_legal_action';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for crime investigations — stores weapon usage flags (firearms, explosives, sharp weapons) per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'crime_form_weapon';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for entertainment industry investigations — stores medium type, issue sub-type, and production title details per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'entertainment_form_fact';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for extortion investigations — stores demand frequency, accused party/organisation, and affected sector flags per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'extortion_form_impact';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for extortion investigations — stores victim legal action details including GD/FIR status, case number, and reason for not filing.', 'SCHEMA', 'investigation', 'TABLE', 'extortion_form_victim_legal_action';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for global/international news investigations — stores issue sub-type, significance level, and category details per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'global_news_form_fact';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Shared table for incident actor profiles across investigation forms — stores involved person role, role group, and form type linkage per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'incident_involved_actor_profile';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for July 2024 protest/movement investigations — stores incident type, protest scale, and internet status per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'july2024_fact_protest';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for land grabbing investigations — stores land type, property description, and mouza/land record details per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'land_grabbing_form_fact';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for land grabbing investigations — stores victim legal action details including GD/FIR status, case number, and reason for not filing.', 'SCHEMA', 'investigation', 'TABLE', 'land_grabbing_form_victim_legal_action';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for price hiking investigations — stores commodity stock/supply chain details, artificial crisis flag, and storage descriptions per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'price_hiking_form_commodity_stock_supply_chain';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for price hiking investigations — stores commodity price comparisons between government fixed rate and market rate per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'price_hiking_form_comodity_price';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference status lookup for investigation forms — stores hierarchical status codes with group/status code pairs and bilingual display names.', 'SCHEMA', 'investigation', 'TABLE', 'ref_status';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for sports investigations — stores sport type, issue sub-type, and event/tournament name per news entry.', 'SCHEMA', 'investigation', 'TABLE', 'sports_form_fact';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for women/gender violence investigations — stores perpetrator profile linked to victim, person identity, and relationship to victim.', 'SCHEMA', 'investigation', 'TABLE', 'women_form_perpetrator';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for women/gender violence investigations — stores victim legal action details including GD/FIR status, case number, and reason for not filing.', 'SCHEMA', 'investigation', 'TABLE', 'women_form_victim_legal_action';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Form-specific data for women/gender violence investigations — stores victim profile facts including person identity, marriage linkage, and violence type flags.', 'SCHEMA', 'investigation', 'TABLE', 'women_form_victim_profile_fact';
GO

-- ============================================================
-- [location]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of address types (home, office, permanent, etc.) with bilingual names and descriptions.', 'SCHEMA', 'location', 'TABLE', 'address_type';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Master list of countries with bilingual names, region linkage, and group code classification.', 'SCHEMA', 'location', 'TABLE', 'country';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of country regions/continents with bilingual names and region codes.', 'SCHEMA', 'location', 'TABLE', 'country_region';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Post office directory linked to district and thana with bilingual names and postal codes.', 'SCHEMA', 'location', 'TABLE', 'post_office';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Hierarchical reference of location types (division, district, upazila, etc.) with parent-child relationships and bilingual names.', 'SCHEMA', 'location', 'TABLE', 'ref_location_type';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Thana (police station) directory linked to district with location type classification and bilingual names.', 'SCHEMA', 'location', 'TABLE', 'thana';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Village directory linked to union parishad and ward with bilingual names.', 'SCHEMA', 'location', 'TABLE', 'village';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Ward directory linked to thana and union parishad with bilingual names.', 'SCHEMA', 'location', 'TABLE', 'ward';
GO

-- ============================================================
-- [marriage]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Marriage certificate records storing certificate number, registration number, certificate date, and marriage date.', 'SCHEMA', 'marriage', 'TABLE', 'marriage_certificate';
GO

-- ============================================================
-- [media]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Junction table linking media assets to news entries with person and actor role associations for evidence/photo management.', 'SCHEMA', 'media', 'TABLE', 'news_entry_asset';
GO

-- ============================================================
-- [newsengine]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'SQL Server graph edge table — maps posts to topics for content classification and topic-based feed ranking.', 'SCHEMA', 'newsengine', 'TABLE', 'graph_post_belongs_to_topic';
GO

EXEC sp_addextendedproperty 'MS_Description', 'SQL Server graph edge table — tracks user dwell time on posts for engagement scoring and feed personalisation.', 'SCHEMA', 'newsengine', 'TABLE', 'graph_user_dwell_on_post';
GO

EXEC sp_addextendedproperty 'MS_Description', 'SQL Server graph edge table — models user-follows-user social connections for social feed and recommendation ranking.', 'SCHEMA', 'newsengine', 'TABLE', 'graph_user_follows_user';
GO

EXEC sp_addextendedproperty 'MS_Description', 'SQL Server graph edge table — maps user interest in topics for personalised content recommendations and feed ranking.', 'SCHEMA', 'newsengine', 'TABLE', 'graph_user_interested_in_topic';
GO

-- ============================================================
-- [newshub]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — actor involvement type reference data marked for deletion. Review for cleanup.', 'SCHEMA', 'newshub', 'TABLE', 'ref_actor_involvement_type_delete';
GO

-- ============================================================
-- [party]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Junction table linking political parties to party affiliations/coalitions for a given election cycle.', 'SCHEMA', 'party', 'TABLE', 'party_affiliations_members';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Political party donation records tracking donor member, donation category, and party linkage.', 'SCHEMA', 'party', 'TABLE', 'party_donation';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Political party membership records linking persons to parties with role and membership category assignments.', 'SCHEMA', 'party', 'TABLE', 'party_member';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of party affiliations/coalitions per election cycle with bilingual names and date ranges.', 'SCHEMA', 'party', 'TABLE', 'ref_party_affiliations';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of political party ideologies with codes, bilingual names, and descriptions.', 'SCHEMA', 'party', 'TABLE', 'ref_party_ideology';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of party membership categories with bilingual names, base fee, and billing cycle details.', 'SCHEMA', 'party', 'TABLE', 'ref_party_membership_category';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of party roles/positions with codes, bilingual titles, and descriptions.', 'SCHEMA', 'party', 'TABLE', 'ref_party_role';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of party statuses (active, dissolved, banned, etc.) with bilingual names.', 'SCHEMA', 'party', 'TABLE', 'ref_party_status';
GO

-- ============================================================
-- [person]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — person table backup from 2026-02-10 with full person record structure. Review for cleanup.', 'SCHEMA', 'person', 'TABLE', 'person_BK_20260210';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — gender reference data marked for deletion. Review for cleanup.', 'SCHEMA', 'person', 'TABLE', 'ref_gender_delete';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — marital status reference data marked for deletion. Review for cleanup.', 'SCHEMA', 'person', 'TABLE', 'ref_marital_status_delete';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — religion reference data marked for deletion. Review for cleanup.', 'SCHEMA', 'person', 'TABLE', 'ref_religion_delete';
GO

-- ============================================================
-- [policy]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Political policy issues with unique codes, bilingual titles, and descriptions for policy tracking.', 'SCHEMA', 'policy', 'TABLE', 'policy_issue';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Party-level stances on policy issues linking political parties to specific stance positions with evidence.', 'SCHEMA', 'policy', 'TABLE', 'policy_issue_party_stance';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Media assets supporting party policy stances with sort order and primary flag for display.', 'SCHEMA', 'policy', 'TABLE', 'policy_issue_party_stance_asset';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Individual person stances on policy issues linking persons to specific stance positions with evidence.', 'SCHEMA', 'policy', 'TABLE', 'policy_issue_person_stance';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Media assets supporting individual person policy stances with sort order and primary flag for display.', 'SCHEMA', 'policy', 'TABLE', 'policy_issue_person_stance_asset';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of stance positions on policy issues (support, oppose, neutral, etc.) with bilingual names.', 'SCHEMA', 'policy', 'TABLE', 'policy_issue_stance';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of policy issue categories/types with bilingual names and descriptions.', 'SCHEMA', 'policy', 'TABLE', 'policy_issue_type';
GO

-- ============================================================
-- [polling]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Election polling station observers with person linkage, contact details, and designation for monitoring assignments.', 'SCHEMA', 'polling', 'TABLE', 'polling_observer';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of polling observer types (domestic, international, party agent, etc.) with bilingual names.', 'SCHEMA', 'polling', 'TABLE', 'polling_observer_type';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Election polling station officers with person linkage, role assignment, and contact details.', 'SCHEMA', 'polling', 'TABLE', 'polling_officer';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of polling officer roles (presiding officer, assistant, etc.) with bilingual names.', 'SCHEMA', 'polling', 'TABLE', 'polling_officer_role';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Master list of election polling stations with unique codes, bilingual names, and station type classification.', 'SCHEMA', 'polling', 'TABLE', 'polling_station';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Election day operational status per polling station tracking opening/closing times, voting delays, and suspensions.', 'SCHEMA', 'polling', 'TABLE', 'polling_station_election_day_status';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Facility and accessibility details per polling station including disability access, generator, internet, and CCTV availability.', 'SCHEMA', 'polling', 'TABLE', 'polling_station_facility';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Incident reports at polling stations during elections with incident type, severity, and resolution status tracking.', 'SCHEMA', 'polling', 'TABLE', 'polling_station_incident';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reports of undue influence at polling stations tracking influence type, advantaged candidate, and influencing party.', 'SCHEMA', 'polling', 'TABLE', 'polling_station_influence_report';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Observer monitoring assignments at polling stations with arrival time, person, and observer type tracking.', 'SCHEMA', 'polling', 'TABLE', 'polling_station_monitoring';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Officer duty assignments at polling stations with role, assignment period, and officer linkage.', 'SCHEMA', 'polling', 'TABLE', 'polling_station_officer_assignment';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Vote count results per polling station broken down by party and candidate with total votes received.', 'SCHEMA', 'polling', 'TABLE', 'polling_station_result_count';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Aggregate result summary per polling station with total ballots issued, valid votes, invalid votes, and cancelled votes.', 'SCHEMA', 'polling', 'TABLE', 'polling_station_result_summary';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Risk factor assessments per polling station with factor type, score, and description for election security planning.', 'SCHEMA', 'polling', 'TABLE', 'polling_station_risk_factor';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Trustworthiness and sensitivity scoring per polling station with trust score, risk factors, and sensitivity classification.', 'SCHEMA', 'polling', 'TABLE', 'polling_station_trustworthiness';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of polling station types (school, government building, etc.) with bilingual names.', 'SCHEMA', 'polling', 'TABLE', 'polling_station_type';
GO

-- ============================================================
-- [raw]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — raw municipality data with district and upazila mapping for location data import. Review for cleanup.', 'SCHEMA', 'raw', 'TABLE', 'municipality_accurate';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — raw political party data with registration number, names, and symbol for initial data load. Review for cleanup.', 'SCHEMA', 'raw', 'TABLE', 'party';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — flat person record dump with all person fields for data migration/import. Review for cleanup.', 'SCHEMA', 'raw', 'TABLE', 'person_flat';
GO

-- ============================================================
-- [staging]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — flat column dump of all person fields for data migration and validation. Review for cleanup.', 'SCHEMA', 'staging', 'TABLE', 'all_columns_flat';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — candidate nomination master data with election name, nomination status for import processing. Review for cleanup.', 'SCHEMA', 'staging', 'TABLE', 'candidate_nomination_master';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — union parishad village mapping with district, upazila, and location type for location hierarchy import. Review for cleanup.', 'SCHEMA', 'staging', 'TABLE', 'union_parishad_village';
GO

-- ============================================================
-- [system]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'System activity log tracking application events with app name, action code, severity level, and user profile linkage.', 'SCHEMA', 'system', 'TABLE', 'log_activity';
GO

-- ============================================================
-- [verification]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of contact phone types (mobile, landline, office, etc.) with sort order.', 'SCHEMA', 'verification', 'TABLE', 'contact_phone_type';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of social media platforms (Facebook, Twitter, etc.) for contact verification.', 'SCHEMA', 'verification', 'TABLE', 'contact_social_platform';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Reference table of social account verification methods for contact identity confirmation.', 'SCHEMA', 'verification', 'TABLE', 'contact_social_verification_method';
GO

-- ============================================================
-- [xclude]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — app platform reference (web, mobile, desktop) with bilingual names. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'app_platform';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — candidate nomination master data duplicate with election and status fields. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'candidate_nomination_master';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — city corporation ward staging data with district and location type mapping. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'city_corporation_ward_staging';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — news entry attachment records with file path, media type, and caption. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'coll_attachment';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — device type reference (mobile, desktop, tablet) with bilingual names. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'device_type';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — geo source reference with bilingual names and descriptions. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'geo_source';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — intent type reference with bilingual names and descriptions. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'intent_type';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — metropolitan thana to city corporation ward mapping v01 with primary thana flag. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'metropolitan_thana_ward_v01';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — metropolitan thana to city corporation ward mapping v02 with district and corporation linkage. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'metropolitan_thana_ward_v02';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — metropolitan thana ward backup with denormalised district, corporation, and ward area names. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'metropolitan_thana_ward_v02_BK';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — municipality data v02 with district, upazila, and location type linkage. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'municipality_20260224_v02';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — municipality backup from 2026-02-24 with full municipality record structure. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'municipality_BK_20260224';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — municipality ward staging data with district, upazila, and location type mapping. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'municipality_ward_staging';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — municipality ward staging backup from 2026-02-24 with full ward record structure. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'municipality_ward_staging_BK_20260224';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — municipality ward staging backup v02 with simplified column names. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'municipality_ward_staging_bk_4am_v02';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — news category to tag mapping with sort order and featured flag. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'ref_news_category_tag';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — news tag reference with category linkage and bilingual names. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'ref_news_tag';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — respondent type reference with bilingual names and descriptions. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'respondent_type';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — response channel reference with bilingual names and descriptions. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'response_channel';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — union parishad backup from 2026-02-15 with upazila linkage and bilingual names. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'union_parishad_BK_20260215';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — union parishad backup from 2026-02-16 with location type linkage added. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'union_parishad_BK_20260216';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — upazila backup from 2026-02-16 with district linkage and administrative location type. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'upazila_BK_20260216';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Legacy/staging table — user profile authentication method mapping with provider key and verification status. Review for cleanup.', 'SCHEMA', 'xclude', 'TABLE', 'user_profile_auth_method';
GO

-- ============================================================
-- [zdimension]
-- ============================================================

EXEC sp_addextendedproperty 'MS_Description', 'Dimension/lookup table — PII sensitivity levels for candidate data (public, restricted, confidential) with bilingual names and descriptions.', 'SCHEMA', 'zdimension', 'TABLE', 'candidate_pii_sensitivity_level';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Dimension/lookup table — consent scope definitions for data usage (analytics, marketing, sharing) with bilingual names and descriptions.', 'SCHEMA', 'zdimension', 'TABLE', 'consent_consent_scope';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Dimension/lookup table — data classification levels for consent management (public, internal, confidential) with bilingual names and descriptions.', 'SCHEMA', 'zdimension', 'TABLE', 'consent_data_class';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Dimension/lookup table — data purge methods for consent-based data deletion (anonymise, delete, archive) with bilingual names and descriptions.', 'SCHEMA', 'zdimension', 'TABLE', 'consent_purge_method';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Dimension/lookup table — account status types for security management (active, locked, suspended) with bilingual names and descriptions.', 'SCHEMA', 'zdimension', 'TABLE', 'security_account_status';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Dimension/lookup table — authentication provider types (email, phone, OAuth, SSO) with bilingual names and descriptions.', 'SCHEMA', 'zdimension', 'TABLE', 'security_auth_provider_type';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Dimension/lookup table — OTP purpose types (login, password reset, verification) with bilingual names and descriptions.', 'SCHEMA', 'zdimension', 'TABLE', 'security_otp_purpose';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Dimension/lookup table — OTP status types (pending, verified, expired) with bilingual names and descriptions.', 'SCHEMA', 'zdimension', 'TABLE', 'security_otp_status';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Dimension/lookup table — security token purpose types (session, refresh, API key) with bilingual names and descriptions.', 'SCHEMA', 'zdimension', 'TABLE', 'security_token_purpose';
GO

EXEC sp_addextendedproperty 'MS_Description', 'Dimension/lookup table — verification status types (pending, verified, rejected) with bilingual names and descriptions.', 'SCHEMA', 'zdimension', 'TABLE', 'verification_status';
GO

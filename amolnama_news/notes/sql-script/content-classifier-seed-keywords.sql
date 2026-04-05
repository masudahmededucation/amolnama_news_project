-- ============================================================
-- Seed Flagged Keywords for Content Classification
-- Bengali + English keywords per category
-- ============================================================

-- Get category IDs
DECLARE @spam_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'spam');
DECLARE @adult_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'adult');
DECLARE @violence_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'violence');
DECLARE @hate_speech_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'hate_speech');
DECLARE @harassment_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'harassment');
DECLARE @scam_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'scam');
DECLARE @drugs_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'drugs');
DECLARE @self_harm_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'self_harm');
DECLARE @politics_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'politics');
DECLARE @religion_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'religion');
DECLARE @misinformation_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'misinformation');
DECLARE @advertisement_id INT = (SELECT newsengine_ref_content_category_id FROM [newsengine].[ref_content_category] WHERE category_code = 'advertisement');

-- SPAM keywords
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@spam_id, N'ফ্রি অফার', N'ফ্রি অফার', 'bn', 1.5),
(@spam_id, N'লটারি', N'লটারি', 'bn', 1.5),
(@spam_id, N'পুরস্কার জিতুন', N'পুরস্কার জিতুন', 'bn', 1.5),
(@spam_id, N'ক্লিক করুন', N'ক্লিক করুন', 'bn', 1.0),
(@spam_id, N'এখনই কিনুন', N'এখনই কিনুন', 'bn', 1.0),
(@spam_id, 'free offer', 'free offer', 'en', 1.5),
(@spam_id, 'click here', 'click here', 'en', 1.0),
(@spam_id, 'buy now', 'buy now', 'en', 1.0),
(@spam_id, 'limited time', 'limited time', 'en', 1.0),
(@spam_id, 'act now', 'act now', 'en', 1.0);

-- ADULT keywords
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@adult_id, N'পর্ন', N'পর্ন', 'bn', 2.0),
(@adult_id, N'অশ্লীল', N'অশ্লীল', 'bn', 1.5),
(@adult_id, N'যৌন', N'যৌন', 'bn', 1.0),
(@adult_id, 'porn', 'porn', 'en', 2.0),
(@adult_id, 'xxx', 'xxx', 'en', 2.0),
(@adult_id, 'nude', 'nude', 'en', 1.5),
(@adult_id, 'nsfw', 'nsfw', 'en', 1.5);

-- VIOLENCE keywords
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@violence_id, N'হত্যা করব', N'হত্যা করব', 'bn', 2.0),
(@violence_id, N'মেরে ফেলব', N'মেরে ফেলব', 'bn', 2.0),
(@violence_id, N'বোমা মারব', N'বোমা মারব', 'bn', 2.0),
(@violence_id, N'রক্তপাত', N'রক্তপাত', 'bn', 1.0),
(@violence_id, 'kill', 'kill', 'en', 1.5),
(@violence_id, 'bomb', 'bomb', 'en', 1.5),
(@violence_id, 'attack', 'attack', 'en', 1.0);

-- HATE SPEECH keywords
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@hate_speech_id, N'মালাউন', N'মালাউন', 'bn', 2.0),
(@hate_speech_id, N'কাফের', N'কাফের', 'bn', 1.5),
(@hate_speech_id, N'নরকে যাবে', N'নরকে যাবে', 'bn', 1.0),
(@hate_speech_id, N'জাহান্নামে যাবে', N'জাহান্নামে যাবে', 'bn', 1.0);

-- HARASSMENT keywords
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@harassment_id, N'মরে যা', N'মরে যা', 'bn', 2.0),
(@harassment_id, N'তোকে মারব', N'তোকে মারব', 'bn', 2.0),
(@harassment_id, N'শালা', N'শালা', 'bn', 1.0),
(@harassment_id, N'হারামি', N'হারামি', 'bn', 1.5);

-- SCAM keywords
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@scam_id, N'বিকাশে টাকা পাঠান', N'বিকাশে টাকা পাঠান', 'bn', 2.0),
(@scam_id, N'একাউন্ট নম্বর', N'একাউন্ট নম্বর', 'bn', 1.0),
(@scam_id, N'পাসওয়ার্ড দিন', N'পাসওয়ার্ড দিন', 'bn', 2.0),
(@scam_id, 'send money', 'send money', 'en', 1.5),
(@scam_id, 'bank account', 'bank account', 'en', 1.0),
(@scam_id, 'password', 'password', 'en', 1.0);

-- DRUGS keywords
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@drugs_id, N'মাদক বিক্রি', N'মাদক বিক্রি', 'bn', 2.0),
(@drugs_id, N'গাঁজা', N'গাঁজা', 'bn', 1.5),
(@drugs_id, N'ইয়াবা', N'ইয়াবা', 'bn', 2.0),
(@drugs_id, N'ফেন্সিডিল', N'ফেন্সিডিল', 'bn', 2.0),
(@drugs_id, N'হেরোইন', N'হেরোইন', 'bn', 2.0);

-- SELF HARM keywords
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@self_harm_id, N'আত্মহত্যা করব', N'আত্মহত্যা করব', 'bn', 2.0),
(@self_harm_id, N'বেঁচে থাকতে চাই না', N'বেঁচে থাকতে চাই না', 'bn', 2.0),
(@self_harm_id, N'মরে যেতে চাই', N'মরে যেতে চাই', 'bn', 2.0),
(@self_harm_id, 'suicide', 'suicide', 'en', 2.0),
(@self_harm_id, 'kill myself', 'kill myself', 'en', 2.0);

-- POLITICS keywords (allow + label)
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@politics_id, N'নির্বাচন', N'নির্বাচন', 'bn', 1.0),
(@politics_id, N'সরকার', N'সরকার', 'bn', 0.5),
(@politics_id, N'বিরোধী দল', N'বিরোধী দল', 'bn', 1.0),
(@politics_id, N'আওয়ামী লীগ', N'আওয়ামী লীগ', 'bn', 1.0),
(@politics_id, N'বিএনপি', N'বিএনপি', 'bn', 1.0),
(@politics_id, N'জামায়াত', N'জামায়াত', 'bn', 1.0);

-- RELIGION keywords (allow + label)
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@religion_id, N'ইসলাম', N'ইসলাম', 'bn', 0.5),
(@religion_id, N'হিন্দু', N'হিন্দু', 'bn', 0.5),
(@religion_id, N'খ্রিস্টান', N'খ্রিস্টান', 'bn', 0.5),
(@religion_id, N'বৌদ্ধ', N'বৌদ্ধ', 'bn', 0.5),
(@religion_id, N'মসজিদ', N'মসজিদ', 'bn', 0.5),
(@religion_id, N'মন্দির', N'মন্দির', 'bn', 0.5);

-- MISINFORMATION keywords (label only)
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@misinformation_id, N'গুজব', N'গুজব', 'bn', 1.5),
(@misinformation_id, N'ভাইরাল', N'ভাইরাল', 'bn', 0.5),
(@misinformation_id, N'শেয়ার করুন সবাই', N'শেয়ার করুন সবাই', 'bn', 1.0),
(@misinformation_id, 'fake news', 'fake news', 'en', 1.5),
(@misinformation_id, 'hoax', 'hoax', 'en', 1.5);

-- ADVERTISEMENT keywords (label only)
INSERT INTO [newsengine].[ref_flagged_keyword] (link_content_category_id, flagged_keyword_text, flagged_keyword_text_normalized, flagged_keyword_language_code, flagged_keyword_weight) VALUES
(@advertisement_id, N'বিক্রি হবে', N'বিক্রি হবে', 'bn', 1.0),
(@advertisement_id, N'যোগাযোগ করুন', N'যোগাযোগ করুন', 'bn', 0.5),
(@advertisement_id, N'ডিসকাউন্ট', N'ডিসকাউন্ট', 'bn', 1.0),
(@advertisement_id, 'for sale', 'for sale', 'en', 1.0),
(@advertisement_id, 'discount', 'discount', 'en', 1.0),
(@advertisement_id, 'contact us', 'contact us', 'en', 0.5);

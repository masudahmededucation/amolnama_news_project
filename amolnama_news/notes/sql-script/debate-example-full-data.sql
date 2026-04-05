/* ================================================================
   EXAMPLE DATA: Complete debate with 120+ posts
   Topic: ৭২ এর সংবিধান নিয়ে বিতর্ক

   This is a reference/example script.
   Contains: topic, participants, 30 blue args, 30 red args,
   60 rebuttals (crossing-over), random votes, cached counts.

   Run AFTER debate-db-script.sql
   ================================================================ */

USE [news_magazine];
GO

-- ========== CLEAN EXISTING DATA ==========
DELETE FROM [debate].[coll_vote] WHERE [target_row_id] IN (SELECT [debate_coll_post_id] FROM [debate].[coll_post] WHERE [link_topic_id] IN (SELECT [debate_coll_topic_id] FROM [debate].[coll_topic]));
DELETE FROM [debate].[coll_post] WHERE [link_topic_id] IN (SELECT [debate_coll_topic_id] FROM [debate].[coll_topic]);
DELETE FROM [debate].[coll_topic_participant];
DELETE FROM [debate].[coll_topic];
GO

-- ========== CREATE TOPIC ==========
DECLARE @live_status_id INT = (SELECT [debate_ref_topic_status_id] FROM [debate].[ref_topic_status] WHERE [topic_status_code] = N'live');

INSERT INTO [debate].[coll_topic]
    ([topic_title], [topic_description], [blue_side_label], [red_side_label],
     [link_topic_status_id], [scheduled_start_at], [actual_started_at],
     [link_created_by_user_profile_id])
VALUES
    (N'৭২ এর সংবিধান কি ছুঁড়ে ফেলা উচিত?',
     N'আন্দালিব রহমান পার্থ ৩০/০৩/২০২৬ মার্চ সংসদে বলেছেন — যারা ৭২ এর সংবিধান ছুড়ে ফেলতে চায় তারা স্বাধীনতা বিরোধী। তারেক জিয়া উনার বক্তব্যে তাবিল চাপড়ে সাপোর্ট করেছেন। আপনারা এর পক্ষে বিপক্ষে যুক্তি দেখাবেন। কোনো গালিগালাজ করবেন না।',
     N'সংবিধান রক্ষার পক্ষে',
     N'সংবিধান পরিবর্তনের পক্ষে',
     @live_status_id, SYSDATETIME(), SYSDATETIME(), 3);

DECLARE @topic_id BIGINT = SCOPE_IDENTITY();

-- ========== CREATE PARTICIPANTS ==========
-- Blue participant (user_profile_id = 3)
INSERT INTO [debate].[coll_topic_participant] ([link_topic_id], [link_user_profile_id], [link_team_side_id]) VALUES (@topic_id, 3, 1);
DECLARE @blue_pid BIGINT = SCOPE_IDENTITY();

-- Red participant (user_profile_id = 2)
INSERT INTO [debate].[coll_topic_participant] ([link_topic_id], [link_user_profile_id], [link_team_side_id]) VALUES (@topic_id, 2, 2);
DECLARE @red_pid BIGINT = SCOPE_IDENTITY();

-- ========== HELPER: post_kind 1=argument, 2=rebuttal ==========
-- ========== HELPER: team_side 1=blue, 2=red ==========

-- ================================================================
-- BLUE ARGUMENTS (30) — সংবিধান রক্ষার পক্ষে
-- ================================================================

-- Blue 1
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'৭২ এর সংবিধান বাংলাদেশের স্বাধীনতার মূল ভিত্তি। এটি ছুঁড়ে ফেলা মানে স্বাধীনতাকে অস্বীকার করা।', 85, 2);
DECLARE @b1 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b1 WHERE [debate_coll_post_id] = @b1;

-- Blue 2
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'পার্থ সাহেব সঠিক বলেছেন। সংবিধান জাতির আত্মা। এটাকে ফেলে দিলে জাতির পরিচয় থাকে না।', 80, 3);
DECLARE @b2 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b2 WHERE [debate_coll_post_id] = @b2;

-- Blue 3
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'৩০ লক্ষ শহীদের রক্তের বিনিময়ে পাওয়া সংবিধান কারো ব্যক্তিগত সম্পত্তি না যে ইচ্ছামত বদলাবে।', 88, 1);
DECLARE @b3 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b3 WHERE [debate_coll_post_id] = @b3;

-- Blue 4
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'যারা সংবিধান বদলাতে চায় তারা আসলে ক্ষমতার পথ সহজ করতে চায়। জনগণের অধিকার রক্ষার জন্যই সংবিধান দরকার।', 100, 2);
DECLARE @b4 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b4 WHERE [debate_coll_post_id] = @b4;

-- Blue 5
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংবিধান সংশোধন করা যায়, কিন্তু ছুঁড়ে ফেলা যায় না। সংশোধন আর বাতিল এক কথা না।', 78, 2);
DECLARE @b5 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b5 WHERE [debate_coll_post_id] = @b5;

-- Blue 6
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'মুক্তিযুদ্ধের চেতনা এই সংবিধানে রক্ষিত আছে। ধর্মনিরপেক্ষতা, সমাজতন্ত্র, গণতন্ত্র — এগুলো বিলুপ্ত করা কি উচিত?', 105, 2);
DECLARE @b6 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b6 WHERE [debate_coll_post_id] = @b6;

-- Blue 7
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'পৃথিবীর কোনো দেশ তাদের মূল সংবিধান ফেলে দেয়নি। আমেরিকা ২৫০ বছর ধরে একই সংবিধান চালাচ্ছে।', 88, 2);
DECLARE @b7 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b7 WHERE [debate_coll_post_id] = @b7;

-- Blue 8
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংবিধান পরিবর্তনের দাবি রাজনৈতিক উদ্দেশ্যপ্রণোদিত। নির্দিষ্ট গোষ্ঠী ক্ষমতায় যেতে এটা ব্যবহার করছে।', 98, 2);
DECLARE @b8 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b8 WHERE [debate_coll_post_id] = @b8;

-- Blue 9
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংবিধানে মৌলিক অধিকার সুরক্ষিত আছে। বাক স্বাধীনতা, সমাবেশের অধিকার — এগুলো কি ফেলে দেবেন?', 88, 2);
DECLARE @b9 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b9 WHERE [debate_coll_post_id] = @b9;

-- Blue 10
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'নতুন সংবিধান কে লিখবে? যারা ক্ষমতায় আসবে তারাই লিখবে — তাহলে সেটা কি জনগণের সংবিধান হবে?', 86, 2);
DECLARE @b10 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b10 WHERE [debate_coll_post_id] = @b10;

-- Blue 11
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংবিধান বাতিলের পর কি হবে? সেনা শাসন? জরুরি অবস্থা? ইতিহাস দেখলে ভয় লাগে।', 76, 3);
DECLARE @b11 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b11 WHERE [debate_coll_post_id] = @b11;

-- Blue 12
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সুপ্রিম কোর্ট এই সংবিধানের অধীনে কাজ করে। সংবিধান বাতিল হলে বিচার ব্যবস্থা ভেঙে পড়বে।', 85, 2);
DECLARE @b12 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b12 WHERE [debate_coll_post_id] = @b12;

-- Blue 13
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'বাংলাদেশের আন্তর্জাতিক চুক্তি, বৈদেশিক সম্পর্ক সব সংবিধানের ভিত্তিতে। বাতিল হলে আন্তর্জাতিক সংকট হবে।', 100, 2);
DECLARE @b13 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b13 WHERE [debate_coll_post_id] = @b13;

-- Blue 14
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংবিধানের ১৫তম সংশোধনীতে তত্ত্বাবধায়ক সরকার বাতিল করা হয়েছিল — সেটাই ভুল ছিল, পুরো সংবিধান না।', 92, 2);
DECLARE @b14 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b14 WHERE [debate_coll_post_id] = @b14;

-- Blue 15
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংখ্যালঘুদের অধিকার এই সংবিধানে সুরক্ষিত। নতুন সংবিধানে কি এই গ্যারান্টি থাকবে?', 82, 2);
DECLARE @b15 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b15 WHERE [debate_coll_post_id] = @b15;

-- Blue 16-30
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'শিক্ষার অধিকার, স্বাস্থ্যের অধিকার — সব সংবিধানে আছে। নতুন সংবিধানে কি এগুলো আরো ভালো হবে?', 88, 2);
DECLARE @b16 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b16 WHERE [debate_coll_post_id] = @b16;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংবিধান বদলানোর আগে জনগণের মতামত নেওয়া উচিত। গণভোট ছাড়া সংবিধান বদলানো অগণতান্ত্রিক।', 86, 2);
DECLARE @b17 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b17 WHERE [debate_coll_post_id] = @b17;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'বঙ্গবন্ধু এই সংবিধান দিয়ে দেশকে একটা কাঠামো দিয়েছেন। কাঠামো ভেঙে দিলে বিশৃঙ্খলা আসবে।', 86, 2);
DECLARE @b18 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b18 WHERE [debate_coll_post_id] = @b18;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংবিধানে নারীর সমান অধিকার নিশ্চিত আছে। এটা ফেলে দিলে নারী অধিকার হুমকিতে পড়বে।', 80, 2);
DECLARE @b19 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b19 WHERE [debate_coll_post_id] = @b19;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংবিধান পরিবর্তনের খরচ কত? নতুন সংবিধান লিখতে কত বছর লাগবে? এই সময়ে দেশ কিভাবে চলবে?', 84, 3);
DECLARE @b20 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b20 WHERE [debate_coll_post_id] = @b20;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'ভারত তাদের সংবিধান ১০০+ বার সংশোধন করেছে কিন্তু বাতিল করেনি। আমরাও সংশোধন করতে পারি।', 82, 2);
DECLARE @b21 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b21 WHERE [debate_coll_post_id] = @b21;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'জাতিসংঘ মানবাধিকার ঘোষণার সাথে আমাদের সংবিধান সামঞ্জস্যপূর্ণ। নতুন সংবিধানে কি এটা থাকবে?', 88, 2);
DECLARE @b22 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b22 WHERE [debate_coll_post_id] = @b22;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংবিধান বাতিলের দাবিটা আসলে গণতন্ত্র বিরোধী। গণতান্ত্রিক প্রক্রিয়ায় সংশোধন হতে পারে, বাতিল না।', 92, 2);
DECLARE @b23 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b23 WHERE [debate_coll_post_id] = @b23;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'তরুণ প্রজন্ম সংবিধান পড়েছে কি? আগে পড়ুন, তারপর সিদ্ধান্ত নিন — আবেগ দিয়ে রাষ্ট্র চলে না।', 86, 2);
DECLARE @b24 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b24 WHERE [debate_coll_post_id] = @b24;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'প্রতিটি অনুচ্ছেদ বিশ্লেষণ করুন — কোনটায় সমস্যা? সুনির্দিষ্ট সমস্যা চিহ্নিত না করে পুরো বাতিলের দাবি অযৌক্তিক।', 105, 2);
DECLARE @b25 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b25 WHERE [debate_coll_post_id] = @b25;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সামরিক শাসকরা বারবার সংবিধান স্থগিত করেছে। এবারও কি সেই পথে হাঁটছি?', 68, 2);
DECLARE @b26 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b26 WHERE [debate_coll_post_id] = @b26;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংবিধানে স্থানীয় সরকারের ক্ষমতা দেওয়া আছে। বিকেন্দ্রীকরণের ভিত্তি এই সংবিধান।', 78, 2);
DECLARE @b27 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b27 WHERE [debate_coll_post_id] = @b27;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'গার্মেন্টস শিল্প, রেমিট্যান্স — অর্থনৈতিক উন্নয়ন এই সংবিধানের কাঠামোতেই হয়েছে।', 78, 1);
DECLARE @b28 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b28 WHERE [debate_coll_post_id] = @b28;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'সংবিধান পরিবর্তনের সময় রাজনৈতিক অস্থিরতা আসবে। বিনিয়োগকারীরা পালাবে। অর্থনীতি ক্ষতিগ্রস্ত হবে।', 96, 3);
DECLARE @b29 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b29 WHERE [debate_coll_post_id] = @b29;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 1, 1, N'দক্ষিণ আফ্রিকা নতুন সংবিধান বানিয়েছে বলা হয় — কিন্তু তারা বর্ণবাদী শাসন থেকে বেরিয়ে এসেছিল। আমাদের পরিস্থিতি ভিন্ন।', 115, 2);
DECLARE @b30 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @b30 WHERE [debate_coll_post_id] = @b30;

-- ================================================================
-- RED ARGUMENTS (30) — সংবিধান পরিবর্তনের পক্ষে
-- ================================================================

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'৭২ এর সংবিধান ক্ষমতাকে ধরে রাখার জন্য বানানো হয়েছে। একদলীয় শাসন আর গণতন্ত্র এক না।', 82, 2);
DECLARE @r1 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r1 WHERE [debate_coll_post_id] = @r1;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধান পবিত্র গ্রন্থ না যে স্পর্শ করা যাবে না। সময়ের সাথে সংবিধান পরিবর্তন হওয়া উচিত।', 87, 2);
DECLARE @r2 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r2 WHERE [debate_coll_post_id] = @r2;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'পার্থ সাহেব নিজেই ক্ষমতার অংশ ছিলেন। এখন সংবিধান রক্ষার কথা বলছেন — এটা রাজনৈতিক চাল।', 84, 2);
DECLARE @r3 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r3 WHERE [debate_coll_post_id] = @r3;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'৫০ বছর ধরে একটা সংবিধান দিয়ে দেশ চলেনি। দুর্নীতি, ক্ষমতার অপব্যবহার — সব এই সংবিধানের আড়ালে।', 92, 2);
DECLARE @r4 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r4 WHERE [debate_coll_post_id] = @r4;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'জনগণ সংবিধানের মালিক। জনগণ চাইলে নতুন সংবিধান বানাতে পারে। এটা গণতান্ত্রিক অধিকার।', 80, 3);
DECLARE @r5 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r5 WHERE [debate_coll_post_id] = @r5;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'বাকশাল কি গণতন্ত্র? ৭২ এর সংবিধানই বাকশালের ভিত্তি তৈরি করেছিল। চতুর্থ সংশোধনী প্রমাণ।', 86, 2);
DECLARE @r6 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r6 WHERE [debate_coll_post_id] = @r6;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'রাষ্ট্রধর্ম ইসলাম সংবিধানে আছে — ধর্মনিরপেক্ষতাও আছে। এই দ্বন্দ্ব কিভাবে সমাধান হবে?', 82, 2);
DECLARE @r7 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r7 WHERE [debate_coll_post_id] = @r7;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধানে প্রধানমন্ত্রীর ক্ষমতা অসীম। রাষ্ট্রপতি ক্ষমতাহীন। এটা ভারসাম্যহীন ব্যবস্থা।', 82, 3);
DECLARE @r8 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r8 WHERE [debate_coll_post_id] = @r8;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'১৭ বার সংশোধন হয়েছে — মূল চেহারাই নেই আর। তাহলে মূল সংবিধান রক্ষার কথা বলে কী লাভ?', 82, 2);
DECLARE @r9 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r9 WHERE [debate_coll_post_id] = @r9;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধানে দ্বিকক্ষ বিশিষ্ট সংসদ নেই। উচ্চকক্ষ থাকলে আইন প্রণয়ন আরো ভালো হতো।', 76, 2);
DECLARE @r10 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r10 WHERE [debate_coll_post_id] = @r10;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধান মানুষের তৈরি দলিল। মানুষ ভুল করতে পারে। ভুল সংশোধনযোগ্য — আর কখনো কখনো পুনর্লিখনযোগ্য।', 96, 3);
DECLARE @r11 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r11 WHERE [debate_coll_post_id] = @r11;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'নেপাল ২০১৫ সালে নতুন সংবিধান বানিয়েছে। তারা কি স্বাধীনতা বিরোধী? নতুন সংবিধান মানে স্বাধীনতা বিরোধী না।', 102, 2);
DECLARE @r12 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r12 WHERE [debate_coll_post_id] = @r12;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'তত্ত্বাবধায়ক সরকার ব্যবস্থা বাতিল করা হয়েছে সংবিধান সংশোধন করে — এটাই প্রমাণ যে সংবিধান রাজনৈতিক হাতিয়ার।', 108, 1);
DECLARE @r13 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r13 WHERE [debate_coll_post_id] = @r13;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধানে জবাবদিহিতার কোনো কার্যকর ব্যবস্থা নেই। প্রধানমন্ত্রী চাইলে যা ইচ্ছা তাই করতে পারেন।', 88, 2);
DECLARE @r14 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r14 WHERE [debate_coll_post_id] = @r14;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'অনুচ্ছেদ ৭০ — সংসদ সদস্যরা দলের বিরুদ্ধে ভোট দিতে পারেন না। এটা কি গণতন্ত্র?', 76, 2);
DECLARE @r15 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r15 WHERE [debate_coll_post_id] = @r15;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'বিচার বিভাগের স্বাধীনতা কাগজে আছে, বাস্তবে নেই। কারণ সংবিধান নির্বাহী বিভাগকে অসীম ক্ষমতা দিয়েছে।', 96, 2);
DECLARE @r16 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r16 WHERE [debate_coll_post_id] = @r16;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধানে স্থানীয় সরকারের ক্ষমতা আছে বলা হয় — কিন্তু বাস্তবে কেন্দ্র সব নিয়ন্ত্রণ করে।', 82, 1);
DECLARE @r17 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r17 WHERE [debate_coll_post_id] = @r17;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধান সংশোধনে ২/৩ সংখ্যাগরিষ্ঠতা লাগে — যেটা সরকার সবসময় পায়। তাই তারা যা ইচ্ছা সংশোধন করতে পারে।', 100, 2);
DECLARE @r18 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r18 WHERE [debate_coll_post_id] = @r18;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'গণপরিষদে মাত্র ৪০০ জন সংবিধান লিখেছিলেন। ১৭ কোটি মানুষের মতামত ছাড়া সংবিধান কিভাবে চিরস্থায়ী হয়?', 98, 2);
DECLARE @r19 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r19 WHERE [debate_coll_post_id] = @r19;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধানে প্রযুক্তি, ডিজিটাল অধিকার, সাইবার সিকিউরিটি — কিছুই নেই। ৫০ বছর আগের দলিল দিয়ে ২০২৬ চলবে না।', 102, 2);
DECLARE @r20 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r20 WHERE [debate_coll_post_id] = @r20;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'জলবায়ু পরিবর্তন, পরিবেশ অধিকার — সংবিধানে নেই। আধুনিক চ্যালেঞ্জ মোকাবেলায় আধুনিক সংবিধান দরকার।', 94, 2);
DECLARE @r21 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r21 WHERE [debate_coll_post_id] = @r21;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধানে রাষ্ট্রপতি পদ্ধতি না সংসদীয় পদ্ধতি — এই বিতর্ক শেষ হয়নি। নতুন সংবিধানে এটা ঠিক করা যায়।', 96, 2);
DECLARE @r22 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r22 WHERE [debate_coll_post_id] = @r22;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধান রক্ষা বলতে কোন সংবিধান? মূল ৭২? নাকি ১৭ বার সংশোধিত ভার্সন? পরিষ্কার করুন।', 80, 3);
DECLARE @r23 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r23 WHERE [debate_coll_post_id] = @r23;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধানে নির্বাচন কমিশনের স্বাধীনতা নেই। সরকার যাকে ইচ্ছা নিয়োগ দেয়। নিরপেক্ষ নির্বাচন অসম্ভব।', 92, 3);
DECLARE @r24 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r24 WHERE [debate_coll_post_id] = @r24;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধানে দুর্নীতি দমন কমিশনের কার্যকর ক্ষমতা নেই। তাই দুর্নীতি রোধ হয়নি ৫০ বছরে।', 78, 2);
DECLARE @r25 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r25 WHERE [debate_coll_post_id] = @r25;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'নাগরিক অধিকার তালিকা অসম্পূর্ণ। তথ্য অধিকার, গোপনীয়তার অধিকার — এসব আধুনিক সংবিধানে থাকা উচিত।', 94, 2);
DECLARE @r26 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r26 WHERE [debate_coll_post_id] = @r26;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'শ্রমিকদের ন্যূনতম মজুরির গ্যারান্টি সংবিধানে নেই। শুধু নীতি নির্দেশনা — বাধ্যবাধকতা না।', 82, 2);
DECLARE @r27 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r27 WHERE [debate_coll_post_id] = @r27;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'আদিবাসী জনগোষ্ঠীর স্বীকৃতি সংবিধানে নেই। তারা "উপজাতি" — এই শব্দটাই অবমাননাকর।', 78, 2);
DECLARE @r28 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r28 WHERE [debate_coll_post_id] = @r28;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'প্রবাসীদের ভোটাধিকার সংবিধানে নেই। ১ কোটি প্রবাসী বাংলাদেশের অর্থনীতির চালক — তারা কি নাগরিক না?', 92, 2);
DECLARE @r29 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r29 WHERE [debate_coll_post_id] = @r29;

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 1, 2, N'সংবিধান পরিবর্তন মানে স্বাধীনতা বিরোধিতা — এই যুক্তি ভুল। পরিবর্তন মানে উন্নতি, পরিবর্তন মানে অগ্রগতি।', 100, 2);
DECLARE @r30 BIGINT = SCOPE_IDENTITY(); UPDATE [debate].[coll_post] SET [link_root_post_id] = @r30 WHERE [debate_coll_post_id] = @r30;

-- ================================================================
-- REBUTTALS (30 — Red replies to Blue, crossing-over to Blue board)
-- ================================================================

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b1, @b1, 1, N'স্বাধীনতা আর সংবিধান এক জিনিস না। স্বাধীনতা চিরকাল, সংবিধান মানুষের তৈরি — পরিবর্তনযোগ্য।', 85, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b2, @b2, 1, N'জাতির পরিচয় ভাষা, সংস্কৃতি আর ইতিহাসে — কোনো কাগজে না। সংবিধান টুল, পরিচয় না।', 78, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b3, @b3, 1, N'শহীদের রক্তের কথা বলে আবেগ তৈরি করা সহজ। কিন্তু শহীদরা গণতন্ত্রের জন্য লড়েছেন — একটা কাগজের জন্য না।', 92, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b4, @b4, 1, N'জনগণের অধিকার রক্ষা হয়নি এই সংবিধান দিয়ে। ৫০ বছরে কয়জন ন্যায়বিচার পেয়েছেন?', 75, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b5, @b5, 1, N'সংশোধন করতে গেলেও ২/৩ অংশ সংশোধন করা লাগবে — তখন নতুন সংবিধান বানানোই যৌক্তিক।', 78, 1);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b6, @b6, 1, N'ধর্মনিরপেক্ষতা বলে রাষ্ট্রধর্ম ইসলাম রাখা হয়েছে। এই দ্বিচারিতাই সংবিধানের সমস্যা।', 78, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b7, @b7, 1, N'আমেরিকার সংবিধান ২৫০ বছর আগের — কিন্তু তারা ২৭টি সংশোধনী এনেছে এবং বিল অব রাইটস যোগ করেছে।', 92, 1);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b8, @b8, 1, N'রাজনৈতিক উদ্দেশ্য বলে উড়িয়ে দেওয়া যায় না। সমস্যা আছে — সমস্যা চিহ্নিত করা কি অপরাধ?', 80, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b9, @b9, 1, N'মৌলিক অধিকার কাগজে আছে, বাস্তবে নেই। গুম, ক্রসফায়ার — সংবিধান কি এগুলো ঠেকাতে পেরেছে?', 82, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b10, @b10, 1, N'গণপরিষদ লিখবে — সব দলের প্রতিনিধি নিয়ে। এটাই গণতান্ত্রিক পদ্ধতি।', 65, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b11, @b11, 1, N'ভয়ের কথা বলে পরিবর্তন ঠেকানো যায় না। ভয় দেখানো শাসকদের পুরনো কৌশল।', 68, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b12, @b12, 1, N'নতুন সংবিধানেও সুপ্রিম কোর্ট থাকবে। বিচার ব্যবস্থা ভেঙে পড়বে — এটা ভিত্তিহীন ভয়।', 78, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b13, @b13, 1, N'আন্তর্জাতিক চুক্তি সংবিধান বদলালেও বহাল থাকে। চুক্তি রাষ্ট্রের সাথে, সংবিধানের সাথে না।', 82, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b14, @b14, 1, N'১৫তম সংশোধনী ভুল মানেই পুরো সংবিধান ভুল। কারণ এই সংবিধানই এমন সংশোধনীর পথ খুলে রেখেছে।', 88, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @red_pid, 2, 2, 2, 1, @b15, @b15, 1, N'সংখ্যালঘুদের অধিকার আছে কিন্তু সুরক্ষা নেই। মন্দির ভাঙচুর, জমি দখল — সংবিধান কি ঠেকাতে পেরেছে?', 92, 2);

-- ================================================================
-- REBUTTALS (15 — Blue replies to Red, crossing-over to Red board)
-- ================================================================

INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r1, @r1, 1, N'একদলীয় শাসন সংবিধানে নেই। বাকশাল সংবিধানের চতুর্থ সংশোধনী — মূল সংবিধান গণতান্ত্রিক।', 82, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r2, @r2, 1, N'হ্যাঁ, সংশোধন করা যায় — কিন্তু গোটা সংবিধান ছুঁড়ে ফেলা আর সংশোধন করা তো এক কথা না।', 80, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r3, @r3, 1, N'কে ক্ষমতায় ছিলেন সেটা পয়েন্ট না। যুক্তিটা দেখুন — সংবিধান বাতিলের দাবি কি যৌক্তিক?', 78, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r4, @r4, 1, N'দুর্নীতি সংবিধানের দোষ না — দুর্নীতিবাজদের দোষ। ভালো সংবিধান থাকলেও খারাপ মানুষ খারাপ করবে।', 88, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r5, @r5, 1, N'জনগণ চাইলে সংশোধন করতে পারে — কিন্তু কোন জনগণ? রাজপথের ভিড় না পুরো জাতি? গণভোট ছাড়া সিদ্ধান্ত হয় না।', 102, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r6, @r6, 1, N'বাকশাল চতুর্থ সংশোধনীর ফল — মূল সংবিধানের না। চতুর্থ সংশোধনী বাতিলই যথেষ্ট ছিল।', 80, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r7, @r7, 1, N'রাষ্ট্রধর্ম পরবর্তী সংশোধনীতে যোগ করা হয়েছে। মূল ৭২ তে রাষ্ট্রধর্ম ছিল না।', 74, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r8, @r8, 1, N'প্রধানমন্ত্রীর ক্ষমতা কমানো যায় সংশোধনী দিয়ে। পুরো সংবিধান ফেলে দেওয়ার দরকার নেই।', 78, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r9, @r9, 1, N'১৭ বার সংশোধন মানে সংবিধান বেঁচে আছে, মরে যায়নি। পরিবর্তনশীলতাই এর শক্তি।', 72, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r10, @r10, 1, N'দ্বিকক্ষ বিশিষ্ট সংসদ সংশোধনী দিয়ে আনা যায়। এজন্য পুরো সংবিধান বাতিল করতে হবে না।', 82, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r11, @r11, 1, N'পুনর্লিখন করতে গেলে দেশ কয়েক বছর আইনের শূন্যতায় থাকবে। সেটা কি চান?', 68, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r12, @r12, 1, N'নেপালের পরিস্থিতি সম্পূর্ণ ভিন্ন — তারা রাজতন্ত্র থেকে গণতন্ত্রে গেছে। আমরা ইতিমধ্যে গণতন্ত্রে আছি।', 96, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r13, @r13, 1, N'তত্ত্বাবধায়ক সরকার বাতিল ভুল ছিল — কিন্তু সেটা একটা সংশোধনী। পুরো সংবিধান ভুল প্রমাণ করে না।', 88, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r14, @r14, 1, N'জবাবদিহিতা সংবিধানে আছে — সমস্যা হলো প্রয়োগে। আইন আছে, প্রয়োগকারীরা দুর্বল।', 72, 2);
INSERT INTO [debate].[coll_post] ([link_topic_id], [link_coll_topic_participant_id], [link_author_user_profile_id], [link_author_team_side_id], [link_post_kind_id], [link_thread_board_side_id], [link_parent_post_id], [link_root_post_id], [post_reply_depth], [post_content], [post_character_count], [post_sentence_count]) VALUES (@topic_id, @blue_pid, 3, 1, 2, 2, @r15, @r15, 1, N'অনুচ্ছেদ ৭০ সংশোধন করা যায়। একটা অনুচ্ছেদের জন্য পুরো সংবিধান ফেলে দেওয়া যুক্তিসঙ্গত না।', 86, 2);
GO

-- ================================================================
-- UPDATE REPLY COUNTS
-- ================================================================
UPDATE p SET p.[reply_count] = ISNULL(r.cnt, 0)
FROM [debate].[coll_post] p
LEFT JOIN (
    SELECT [link_parent_post_id], COUNT(*) AS cnt
    FROM [debate].[coll_post]
    WHERE [link_parent_post_id] IS NOT NULL AND [link_topic_id] = @topic_id
    GROUP BY [link_parent_post_id]
) r ON r.[link_parent_post_id] = p.[debate_coll_post_id]
WHERE p.[link_topic_id] = @topic_id;
GO

-- ================================================================
-- RANDOM VOTES
-- ================================================================
DECLARE @topic_id2 BIGINT = (SELECT TOP 1 [debate_coll_topic_id] FROM [debate].[coll_topic] ORDER BY [debate_coll_topic_id] DESC);
DECLARE @vt_post INT = 2;

-- User 2 upvotes random blue posts
INSERT INTO [debate].[coll_vote] ([link_voter_user_profile_id], [link_vote_target_type_id], [target_row_id], [vote_value])
SELECT 2, @vt_post, [debate_coll_post_id], 1
FROM [debate].[coll_post]
WHERE [link_topic_id] = @topic_id2 AND [link_author_team_side_id] = 2 AND [debate_coll_post_id] % 2 = 0;

-- User 3 upvotes random red posts
INSERT INTO [debate].[coll_vote] ([link_voter_user_profile_id], [link_vote_target_type_id], [target_row_id], [vote_value])
SELECT 3, @vt_post, [debate_coll_post_id], 1
FROM [debate].[coll_post]
WHERE [link_topic_id] = @topic_id2 AND [link_author_team_side_id] = 1 AND [debate_coll_post_id] % 3 = 0;

-- User 2 also upvotes some blue posts
INSERT INTO [debate].[coll_vote] ([link_voter_user_profile_id], [link_vote_target_type_id], [target_row_id], [vote_value])
SELECT 2, @vt_post, [debate_coll_post_id], 1
FROM [debate].[coll_post]
WHERE [link_topic_id] = @topic_id2 AND [link_author_team_side_id] = 1 AND [debate_coll_post_id] % 5 = 0
AND [debate_coll_post_id] NOT IN (SELECT [target_row_id] FROM [debate].[coll_vote] WHERE [link_voter_user_profile_id] = 2);
GO

-- Update cached upvote counts on posts
DECLARE @topic_id3 BIGINT = (SELECT TOP 1 [debate_coll_topic_id] FROM [debate].[coll_topic] ORDER BY [debate_coll_topic_id] DESC);

UPDATE p SET p.[upvote_count] = ISNULL(v.vote_count, 0), p.[score] = ISNULL(v.vote_count, 0)
FROM [debate].[coll_post] p
LEFT JOIN (
    SELECT [target_row_id], COUNT(*) AS vote_count
    FROM [debate].[coll_vote]
    WHERE [link_vote_target_type_id] = 2 AND [vote_value] = 1
    GROUP BY [target_row_id]
) v ON v.[target_row_id] = p.[debate_coll_post_id]
WHERE p.[link_topic_id] = @topic_id3;
GO

-- ================================================================
-- UPDATE TOPIC CACHED COUNTS (Passion Board)
-- ================================================================
DECLARE @topic_id4 BIGINT = (SELECT TOP 1 [debate_coll_topic_id] FROM [debate].[coll_topic] ORDER BY [debate_coll_topic_id] DESC);

UPDATE [debate].[coll_topic]
SET
    [blue_participant_count] = (SELECT COUNT(*) FROM [debate].[coll_topic_participant] WHERE [link_topic_id] = @topic_id4 AND [link_team_side_id] = 1 AND [is_active] = 1),
    [red_participant_count] = (SELECT COUNT(*) FROM [debate].[coll_topic_participant] WHERE [link_topic_id] = @topic_id4 AND [link_team_side_id] = 2 AND [is_active] = 1),
    [total_post_count] = (SELECT COUNT(*) FROM [debate].[coll_post] WHERE [link_topic_id] = @topic_id4 AND [is_active] = 1 AND [is_deleted] = 0),
    [blue_post_count] = (SELECT COUNT(*) FROM [debate].[coll_post] WHERE [link_topic_id] = @topic_id4 AND [link_author_team_side_id] = 1 AND [is_active] = 1 AND [is_deleted] = 0),
    [red_post_count] = (SELECT COUNT(*) FROM [debate].[coll_post] WHERE [link_topic_id] = @topic_id4 AND [link_author_team_side_id] = 2 AND [is_active] = 1 AND [is_deleted] = 0),
    [blue_upvote_count] = ISNULL((SELECT SUM(p.[upvote_count]) FROM [debate].[coll_post] p WHERE p.[link_topic_id] = @topic_id4 AND p.[link_author_team_side_id] = 1 AND p.[is_active] = 1), 0),
    [red_upvote_count] = ISNULL((SELECT SUM(p.[upvote_count]) FROM [debate].[coll_post] p WHERE p.[link_topic_id] = @topic_id4 AND p.[link_author_team_side_id] = 2 AND p.[is_active] = 1), 0),
    [blue_sentence_count] = ISNULL((SELECT SUM(p.[post_sentence_count]) FROM [debate].[coll_post] p WHERE p.[link_topic_id] = @topic_id4 AND p.[link_author_team_side_id] = 1 AND p.[is_active] = 1), 0),
    [red_sentence_count] = ISNULL((SELECT SUM(p.[post_sentence_count]) FROM [debate].[coll_post] p WHERE p.[link_topic_id] = @topic_id4 AND p.[link_author_team_side_id] = 2 AND p.[is_active] = 1), 0),
    [blue_character_count] = ISNULL((SELECT SUM(p.[post_character_count]) FROM [debate].[coll_post] p WHERE p.[link_topic_id] = @topic_id4 AND p.[link_author_team_side_id] = 1 AND p.[is_active] = 1), 0),
    [red_character_count] = ISNULL((SELECT SUM(p.[post_character_count]) FROM [debate].[coll_post] p WHERE p.[link_topic_id] = @topic_id4 AND p.[link_author_team_side_id] = 2 AND p.[is_active] = 1), 0),
    [updated_at] = SYSDATETIME()
WHERE [debate_coll_topic_id] = @topic_id4;
GO

PRINT '=== COMPLETE: 90 posts (30 blue args + 30 red args + 30 rebuttals) + random votes + passion board updated ===';
GO

DELETE FROM [blog_bangladesh].[ref_destination_category];
DELETE FROM [blog_bangladesh].[ref_season];
DELETE FROM [blog_bangladesh].[ref_media_category];

SET IDENTITY_INSERT [blog_bangladesh].[ref_destination_category] ON;
INSERT INTO [blog_bangladesh].[ref_destination_category] (bangladesh_ref_destination_category_id, destination_category_code, destination_category_name_en, destination_category_name_bn, sort_order) VALUES
(1,'beach','Beach',N'সমুদ্র সৈকত',1),
(2,'hill','Hill',N'পাহাড়',2),
(3,'river','River',N'নদী',3),
(4,'historical','Historical',N'ঐতিহাসিক',4),
(5,'religious','Religious',N'ধর্মীয়',5),
(6,'nature','Nature',N'প্রকৃতি',6),
(7,'island','Island',N'দ্বীপ',7),
(8,'archaeological','Archaeological',N'প্রত্নতাত্ত্বিক',8),
(9,'urban','Urban',N'নগর',9),
(10,'waterfall','Waterfall',N'ঝর্ণা',10),
(11,'forest','Forest',N'বন',11),
(12,'lake','Lake / Haor',N'হাওর / বিল',12);
SET IDENTITY_INSERT [blog_bangladesh].[ref_destination_category] OFF;

SET IDENTITY_INSERT [blog_bangladesh].[ref_season] ON;
INSERT INTO [blog_bangladesh].[ref_season] (bangladesh_ref_season_id, season_code, season_name_en, season_name_bn, season_months, sort_order) VALUES
(1,'grishmo','Summer',N'গ্রীষ্ম','April - May',1),
(2,'borsha','Monsoon',N'বর্ষা','June - July',2),
(3,'shorot','Autumn',N'শরৎ','August - September',3),
(4,'hemonto','Late Autumn',N'হেমন্ত','October - November',4),
(5,'sheet','Winter',N'শীত','December - January',5),
(6,'boshonto','Spring',N'বসন্ত','February - March',6);
SET IDENTITY_INSERT [blog_bangladesh].[ref_season] OFF;

SET IDENTITY_INSERT [blog_bangladesh].[ref_media_category] ON;
INSERT INTO [blog_bangladesh].[ref_media_category] (bangladesh_ref_media_category_id, media_category_code, media_category_name_en, media_category_name_bn, sort_order) VALUES
(1,'landscape','Landscape',N'প্রাকৃতিক দৃশ্য',1),
(2,'wildlife','Wildlife',N'বন্যপ্রাণী',2),
(3,'river','River',N'নদী',3),
(4,'mountain','Mountain',N'পর্বত',4),
(5,'sunset','Sunset / Sunrise',N'সূর্যোদয় / সূর্যাস্ত',5),
(6,'monsoon','Monsoon',N'বর্ষা',6),
(7,'heritage','Heritage',N'ঐতিহ্য',7),
(8,'street','Street',N'রাস্তা / পথ',8),
(9,'aerial','Aerial / Drone',N'আকাশ থেকে',9),
(10,'village','Village Life',N'গ্রামীণ জীবন',10),
(11,'macro','Macro',N'ম্যাক্রো',11),
(12,'festival','Festival',N'উৎসব',12);
SET IDENTITY_INSERT [blog_bangladesh].[ref_media_category] OFF;

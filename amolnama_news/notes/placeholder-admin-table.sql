-- ============================================================
-- Placeholder Admin — Dynamic Composer Prompts
-- Schema: [post]
-- ============================================================

CREATE TABLE [post].[ref_composer_placeholder] (
    [post_ref_composer_placeholder_id]  BIGINT          IDENTITY(1,1)   NOT NULL,
    [placeholder_text]                  NVARCHAR(500)   NOT NULL,
    [placeholder_category_code]         VARCHAR(30)     NOT NULL        DEFAULT 'general',
    [is_featured]                       BIT             NOT NULL        DEFAULT 0,
    [featured_start_at]                 DATETIME2       NULL,
    [featured_duration_minutes]         INT             NULL            DEFAULT 30,
    [sort_order]                        INT             NOT NULL        DEFAULT 0,
    [is_active]                         BIT             NOT NULL        DEFAULT 1,
    [created_at]                        DATETIME2       NOT NULL        DEFAULT GETDATE(),
    [link_created_by_user_profile_id]   BIGINT          NULL,

    CONSTRAINT [PK_post_ref_composer_placeholder] PRIMARY KEY CLUSTERED ([post_ref_composer_placeholder_id])
);
GO

-- Seed with existing 50 placeholders
INSERT INTO [post].[ref_composer_placeholder] ([placeholder_text], [placeholder_category_code]) VALUES
(N'আপনার এলাকায় চাঁদাবাজি হচ্ছে? জানান — পরিচয় গোপন থাকবে', 'issue'),
(N'দুর্নীতি দেখেছেন? স্ক্রিনশট বা ঘটনা শেয়ার করুন', 'issue'),
(N'বিদ্যুৎ নেই কতক্ষণ? জানান', 'issue'),
(N'পানির সমস্যা? কোন এলাকায়?', 'issue'),
(N'ভেজাল খাবার পেয়েছেন? দোকানের নাম জানান', 'issue'),
(N'জমি দখল হচ্ছে? ঘটনা লিখুন', 'issue'),
(N'নদী ভরাট হচ্ছে? ছবি বা ভিডিও শেয়ার করুন', 'issue'),
(N'রাস্তা ভাঙা? কোন রাস্তা? জানান', 'issue'),
(N'ঘুষ ছাড়া কাজ হচ্ছে না? কোথায়?', 'issue'),
(N'শিক্ষক স্কুলে আসেন না? জানান', 'issue'),
(N'পুলিশ হয়রানি করছে? ঘটনা শেয়ার করুন', 'issue'),
(N'ওষুধের দাম বেড়েছে? কোন ওষুধ?', 'issue'),
(N'মোবাইল কোর্ট কি ঠিকমতো কাজ করছে?', 'issue'),
(N'নারী নির্যাতনের ঘটনা জানান — আমরা আওয়াজ তুলব', 'issue'),
(N'শিশুশ্রম দেখেছেন? কোথায়? জানান', 'issue'),
(N'যানজটে আটকে আছেন? কোন রাস্তায়?', 'issue'),
(N'বাজারে মূল্যবৃদ্ধি? কোন পণ্যের দাম বেড়েছে?', 'issue'),
(N'বন্যার পানি উঠেছে? কোন এলাকায়?', 'issue'),
(N'আপনার এলাকার কোনো প্রতিভাবান মানুষকে জানান', 'encouragement'),
(N'ক্রিকেটে বাংলাদেশ কেমন করবে? আপনার মতামত', 'encouragement'),
(N'নতুন কোনো গান শুনেছেন? শেয়ার করুন', 'encouragement'),
(N'আপনার প্রিয় শিক্ষকের কথা বলুন', 'encouragement'),
(N'আপনার গর্বের মানুষ কে? তার গল্প বলুন', 'encouragement'),
(N'আজ ভালো কিছু ঘটেছে? শেয়ার করুন', 'encouragement'),
(N'নতুন উদ্যোক্তা? আপনার ব্যবসার কথা জানান', 'encouragement'),
(N'বাংলাদেশের সবচেয়ে সুন্দর জায়গা কোনটি?', 'encouragement'),
(N'কোনো ছাত্র বা ছাত্রীর সাফল্যের খবর?', 'encouragement'),
(N'আজ কী রান্না করেছেন? রেসিপি শেয়ার করুন', 'encouragement'),
(N'আপনার এলাকায় চিকিৎসা সেবা কেমন?', 'local'),
(N'যোগাযোগ ব্যবস্থা কেমন আপনার এলাকায়?', 'local'),
(N'আপনার এলাকায় পানি বিশুদ্ধ?', 'local'),
(N'আপনার এলাকায় শিক্ষার মান কেমন?', 'local'),
(N'আপনার এলাকায় আইনশৃঙ্খলা পরিস্থিতি কেমন?', 'local'),
(N'ইন্টারনেট স্পিড কেমন আপনার এলাকায়?', 'local'),
(N'আজ কী ভাবছেন? শেয়ার করুন', 'general'),
(N'আপনার কমিউনিটির জন্য কী করা দরকার?', 'general'),
(N'বেকারত্ব সমস্যা? আপনার অভিজ্ঞতা শেয়ার করুন', 'general'),
(N'নেতাদের কাছে আপনার প্রশ্ন কী?', 'general'),
(N'আপনার এলাকার উন্নয়ন নিয়ে লিখুন', 'general'),
(N'কোনো অন্যায় দেখেছেন? এখানে জানান', 'general'),
(N'আপনার মতামত গুরুত্বপূর্ণ — লিখুন', 'general'),
(N'স্থানীয় বাজারে কী অবস্থা? জানান', 'general'),
(N'হাসপাতালে কী অভিজ্ঞতা হয়েছে?', 'general'),
(N'সরকারি অফিসে কী অবস্থা?', 'general'),
(N'আপনার সন্তানের স্কুলের খবর কী?', 'general'),
(N'মসজিদ/মন্দির/গির্জায় কী হচ্ছে? জানান', 'general'),
(N'খেলাধুলার খবর? আপনার এলাকায়?', 'general'),
(N'পরিবেশ দূষণ দেখেছেন? কোথায়?', 'issue'),
(N'সাম্প্রদায়িক সম্প্রীতির গল্প শেয়ার করুন', 'encouragement'),
(N'আপনার জেলার গর্ব কী? জানান', 'encouragement');
GO

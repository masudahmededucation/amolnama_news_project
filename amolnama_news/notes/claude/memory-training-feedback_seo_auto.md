---
name: Auto-apply SEO to new pages
description: When creating new apps, views, or pages, always add SEO context, sitemap entry, and update robots/llms.txt
type: feedback
---

When creating any new app, view, or page, automatically include SEO setup:

1. Add `seo` dict to view context (title in Bengali+English, description, breadcrumbs)
2. Add noindex for private/internal pages (forms, auth, API)
3. Add a Sitemap class in `site_apps/seo/sitemaps.py` for public pages
4. Update `robots_txt()` in `site_apps/seo/views.py` if new app has API routes under a new prefix
5. Update `llms_txt()` in `site_apps/seo/views.py` if it's a major new section

**Why:** User wants SEO applied everywhere without having to ask each time. The SEO infrastructure is in `site_apps/seo/`.

**How to apply:** Every time a new render() call is added, include the seo context dict. Every time a new app with public pages is created, add it to sitemaps.

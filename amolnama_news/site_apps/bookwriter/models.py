"""bookwriter — Django models for the [bookwriter] schema.

Phase 1B scope: only the two tables needed for autosave (CollBook +
Chapter). Other 30 tables (snapshots, plot cards, bible entries, cover
designs, beta share, sprints, serial publishing, engagement) will be
added incrementally as their UIs get wired.

All models are unmanaged — the SQL schema is owned by
notes/sql-script/bookwriter-v01-schema.sql, not Django migrations.
Django reads/writes; never CREATE/ALTER/DROP. Defaults declared in SQL
(book_status_code='draft', is_active=1, etc.) are honoured by SQL Server
on INSERT — Django models intentionally omit `default=` so the DB stays
the single source of truth for those values.
"""

from django.db import models


class CollBook(models.Model):
    """One book per row. Owned by exactly one user (the writer)."""

    bookwriter_coll_book_id = models.BigAutoField(primary_key=True)
    link_owner_user_profile_id = models.BigIntegerField()

    book_title_bn = models.CharField(max_length=500, null=True, blank=True)
    book_title_en = models.CharField(max_length=500, null=True, blank=True)
    book_subtitle_bn = models.CharField(max_length=500, null=True, blank=True)
    book_subtitle_en = models.CharField(max_length=500, null=True, blank=True)
    book_author_display_bn = models.CharField(max_length=300, null=True, blank=True)
    book_author_display_en = models.CharField(max_length=300, null=True, blank=True)
    book_synopsis = models.TextField(null=True, blank=True)
    book_language_code = models.CharField(max_length=10)

    book_word_count_target = models.IntegerField(null=True, blank=True)
    book_daily_word_target = models.IntegerField()
    book_status_code = models.CharField(max_length=20)
    book_visibility_code = models.CharField(max_length=20)
    book_slug_en = models.CharField(max_length=300, null=True, blank=True)

    book_published_at = models.DateTimeField(null=True, blank=True)
    book_archived_at = models.DateTimeField(null=True, blank=True)
    book_cover_image_url = models.CharField(max_length=1000, null=True, blank=True)
    link_publish_cadence_id = models.IntegerField(null=True, blank=True)

    book_word_count_cached = models.IntegerField()
    book_chapter_count_cached = models.IntegerField()

    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[coll_book]'


class Chapter(models.Model):
    """One chapter per row. Belongs to exactly one CollBook.

    The autosave endpoint writes `chapter_text_html` (the contenteditable
    HTML, sanitized server-side), `chapter_text_plain` (stripped text for
    word counting / search), and `chapter_word_count` (cached count).
    """

    bookwriter_chapter_id = models.BigAutoField(primary_key=True)
    link_bookwriter_coll_book_id = models.BigIntegerField()
    chapter_number = models.IntegerField()

    chapter_title_bn = models.CharField(max_length=500, null=True, blank=True)
    chapter_title_en = models.CharField(max_length=500, null=True, blank=True)
    chapter_text_html = models.TextField(null=True, blank=True)
    chapter_text_plain = models.TextField(null=True, blank=True)
    chapter_word_count = models.IntegerField()

    chapter_status_code = models.CharField(max_length=20)
    chapter_visibility_code = models.CharField(max_length=20)
    sort_order = models.IntegerField()

    last_edited_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[chapter]'

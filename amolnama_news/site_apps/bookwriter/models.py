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


class ChapterSnapshot(models.Model):
    """Point-in-time copy of a chapter's HTML. Two kinds:

      - 'auto'   — written from the autosave path on a coarser cadence
                   (e.g. every Nth save) so users always have a few
                   recent rollback points.
      - 'manual' — written when the user clicks "Name this version" on
                   the snapshot panel; carries a snapshot_label.
    """

    bookwriter_chapter_snapshot_id = models.BigAutoField(primary_key=True)
    link_bookwriter_chapter_id = models.BigIntegerField()
    snapshot_kind_code = models.CharField(max_length=20)
    snapshot_label = models.CharField(max_length=300, null=True, blank=True)
    snapshot_text_html = models.TextField(null=True, blank=True)
    snapshot_text_plain = models.TextField(null=True, blank=True)
    snapshot_word_count = models.IntegerField()
    snapshot_word_count_diff = models.IntegerField(null=True, blank=True)
    link_created_by_user_profile_id = models.BigIntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[bookwriter].[chapter_snapshot]'


class WritingSession(models.Model):
    """One row per (user, book, day). Tracks daily words + minutes for
    the right-rail "Today's Session" card and the streak engine.

    Reuses the same row across multiple discrete sittings on the same
    calendar day — words_added accumulates, active_seconds accumulates.
    """

    bookwriter_writing_session_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    link_bookwriter_coll_book_id = models.BigIntegerField(null=True, blank=True)
    session_date = models.DateField()
    session_started_at = models.DateTimeField()
    session_ended_at = models.DateTimeField(null=True, blank=True)
    session_words_added = models.IntegerField()
    session_active_seconds = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[writing_session]'


class SprintSession(models.Model):
    """One row per Pomodoro-style sprint the user starts. Captures
    planned vs actual duration, completion flag, and words written
    during the sprint window."""

    bookwriter_sprint_session_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    link_bookwriter_coll_book_id = models.BigIntegerField(null=True, blank=True)
    link_bookwriter_chapter_id = models.BigIntegerField(null=True, blank=True)
    sprint_planned_minutes = models.IntegerField()
    sprint_started_at = models.DateTimeField()
    sprint_ended_at = models.DateTimeField(null=True, blank=True)
    sprint_actual_seconds = models.IntegerField(null=True, blank=True)
    sprint_completed = models.BooleanField()
    sprint_words_added = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[bookwriter].[sprint_session]'


class PlotCard(models.Model):
    """Index card on the corkboard / plot view. Each card belongs to a
    book (and optionally to a specific chapter once promoted from
    "unplaced"). The act_structure_code groups cards into Act I/II/III
    columns; ref_act_structure has the canonical list."""

    bookwriter_plot_card_id = models.BigAutoField(primary_key=True)
    link_bookwriter_coll_book_id = models.BigIntegerField()
    link_bookwriter_chapter_id = models.BigIntegerField(null=True, blank=True)
    act_structure_code = models.CharField(max_length=30, null=True, blank=True)
    card_scene_number = models.IntegerField(null=True, blank=True)
    card_title = models.CharField(max_length=500, null=True, blank=True)
    card_body = models.TextField(null=True, blank=True)
    card_tag = models.CharField(max_length=100, null=True, blank=True)
    sort_order = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[plot_card]'


class RefBibleCategory(models.Model):
    """Reference table for the 5 Bible categories (Characters, Locations,
    Objects & Artifacts, Research, Lore & Timeline). Seeded once in SQL —
    the writer never adds new categories from the UI. Used to render the
    left rail of the Bible view and to validate `bible_category_code` on
    create."""

    bookwriter_ref_bible_category_id = models.AutoField(primary_key=True)
    bible_category_code = models.CharField(max_length=20)
    bible_category_name_en = models.CharField(max_length=80)
    bible_category_name_bn = models.CharField(max_length=80)
    bible_category_icon = models.CharField(max_length=20, null=True, blank=True)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_bible_category]'


class BibleEntry(models.Model):
    """One Bible row per entity in the writer's worldbuilding notebook.
    Each entry belongs to one book and falls under one category
    (`bible_category_code`). Used by the Bible view's middle list and
    detail pane.

    Avatar fields (initial + 2 hex colors) drive the gradient circle on
    the list and detail. `entry_attributes_json` is reserved for future
    structured attribute rendering (Age / Height / Eye color etc.) — the
    initial UI just exposes biography + notes + tags."""

    bookwriter_bible_entry_id = models.BigAutoField(primary_key=True)
    link_bookwriter_coll_book_id = models.BigIntegerField()
    bible_category_code = models.CharField(max_length=20)
    entry_name = models.CharField(max_length=300)
    entry_role = models.CharField(max_length=500, null=True, blank=True)
    entry_avatar_initial = models.CharField(max_length=5, null=True, blank=True)
    entry_avatar_color_hex = models.CharField(max_length=10, null=True, blank=True)
    entry_avatar_color_hex_2 = models.CharField(max_length=10, null=True, blank=True)
    entry_image_url = models.CharField(max_length=1000, null=True, blank=True)
    entry_biography = models.TextField(null=True, blank=True)
    entry_attributes_json = models.TextField(null=True, blank=True)
    entry_notes = models.TextField(null=True, blank=True)
    entry_tags_csv = models.CharField(max_length=500, null=True, blank=True)
    sort_order = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[bible_entry]'


class MarginNote(models.Model):
    """Inline annotation attached to a chapter. Phase 1B is API-only —
    the chapter-view UI for adding / browsing notes ships in a follow-up
    pass once we settle on the highlight-anchor UX. The DB rows are
    already useful: third-party tooling and the beta_comment workflow
    consume them."""

    bookwriter_margin_note_id = models.BigAutoField(primary_key=True)
    link_bookwriter_chapter_id = models.BigIntegerField()
    note_text = models.TextField()
    is_resolved = models.BooleanField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[margin_note]'


class RefCoverTemplate(models.Model):
    """Reference table for the 6 cover tiles shown in the cover-rail.
    Seeded once in SQL; the writer never adds new templates."""

    bookwriter_ref_cover_template_id = models.AutoField(primary_key=True)
    cover_template_code = models.CharField(max_length=20)
    cover_template_name_en = models.CharField(max_length=80)
    cover_template_name_bn = models.CharField(max_length=80, null=True, blank=True)
    cover_template_description = models.CharField(max_length=300, null=True, blank=True)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_cover_template]'


class RefBookStatus(models.Model):
    """Book lifecycle status (draft / writing / paused / completed / archived).
    Seeded once in SQL — writer picks one per book."""
    bookwriter_ref_book_status_id = models.AutoField(primary_key=True)
    book_status_code = models.CharField(max_length=20)
    book_status_name_en = models.CharField(max_length=80)
    book_status_name_bn = models.CharField(max_length=80)
    book_status_description = models.CharField(max_length=500, null=True, blank=True)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_book_status]'


class RefChapterStatus(models.Model):
    """Chapter lifecycle status (blank / draft / revised / final).
    Drives the colored dot on the chapter rail row."""
    bookwriter_ref_chapter_status_id = models.AutoField(primary_key=True)
    chapter_status_code = models.CharField(max_length=20)
    chapter_status_name_en = models.CharField(max_length=80)
    chapter_status_name_bn = models.CharField(max_length=80)
    chapter_status_dot_color_hex = models.CharField(max_length=10, null=True, blank=True)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_chapter_status]'


class RefChapterVisibility(models.Model):
    """Chapter visibility scope (private / beta / public).
    Distinct from serial_release publishing — visibility gates who
    can OPEN a chapter inside the writing app."""
    bookwriter_ref_chapter_visibility_id = models.AutoField(primary_key=True)
    chapter_visibility_code = models.CharField(max_length=20)
    chapter_visibility_name_en = models.CharField(max_length=80)
    chapter_visibility_name_bn = models.CharField(max_length=80)
    chapter_visibility_description = models.CharField(max_length=500, null=True, blank=True)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_chapter_visibility]'


class RefCoverPalette(models.Model):
    """One row per preset palette (bg / fg / accent triplet) shown in
    the cover designer's palette grid."""
    bookwriter_ref_cover_palette_id = models.AutoField(primary_key=True)
    cover_palette_code = models.CharField(max_length=30)
    cover_palette_name_en = models.CharField(max_length=80)
    cover_palette_background_color_hex = models.CharField(max_length=10)
    cover_palette_foreground_color_hex = models.CharField(max_length=10)
    cover_palette_accent_hex = models.CharField(max_length=10)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_cover_palette]'


class RefCoverBackground(models.Model):
    """Cover background style (solid / paper / linen / etc) — surfaced
    as the "Background" picker in the cover designer."""
    bookwriter_ref_cover_background_id = models.AutoField(primary_key=True)
    cover_background_code = models.CharField(max_length=30)
    cover_background_name_en = models.CharField(max_length=80)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_cover_background]'


class RefCoverFont(models.Model):
    """Cover title font (serif / italic / mono / etc). The CSS columns
    hold the actual `font-family` / `font-style` / `font-weight` tokens
    so the renderer never has to translate codes to CSS at runtime."""
    bookwriter_ref_cover_font_id = models.AutoField(primary_key=True)
    cover_font_code = models.CharField(max_length=20)
    cover_font_name_en = models.CharField(max_length=80)
    cover_font_family_css = models.CharField(max_length=200)
    cover_font_style_css = models.CharField(max_length=20, null=True, blank=True)
    cover_font_weight_css = models.CharField(max_length=10, null=True, blank=True)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_cover_font]'


class RefBetaPermission(models.Model):
    """Beta reader permission tier (read / comment / suggest)."""
    bookwriter_ref_beta_permission_id = models.AutoField(primary_key=True)
    beta_permission_code = models.CharField(max_length=20)
    beta_permission_name_en = models.CharField(max_length=80)
    beta_permission_name_bn = models.CharField(max_length=80, null=True, blank=True)
    beta_permission_description = models.CharField(max_length=500, null=True, blank=True)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_beta_permission]'


class RefSerialReleaseStatus(models.Model):
    """Serial release lifecycle status (draft / scheduled / published /
    unpublished). Drives chip colour on the publish dashboard."""
    bookwriter_ref_serial_release_status_id = models.AutoField(primary_key=True)
    serial_release_status_code = models.CharField(max_length=20)
    serial_release_status_name_en = models.CharField(max_length=80)
    serial_release_status_name_bn = models.CharField(max_length=80, null=True, blank=True)
    serial_release_status_chip_color_hex = models.CharField(max_length=10, null=True, blank=True)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_serial_release_status]'


class RefPublishCadence(models.Model):
    """Serial publish cadence presets (daily / weekly / biweekly).
    `interval_days` + `weekday` together let the scheduler decide when
    to drop the next chapter."""
    bookwriter_ref_publish_cadence_id = models.AutoField(primary_key=True)
    publish_cadence_code = models.CharField(max_length=30)
    publish_cadence_name_en = models.CharField(max_length=80)
    publish_cadence_name_bn = models.CharField(max_length=80, null=True, blank=True)
    publish_cadence_interval_days = models.IntegerField(null=True, blank=True)
    publish_cadence_weekday = models.PositiveSmallIntegerField(null=True, blank=True)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_publish_cadence]'


class RefActStructure(models.Model):
    """Plot card act structure (act_one / act_two / act_three /
    unplaced). Drives the corkboard column the card lives in."""
    bookwriter_ref_act_structure_id = models.AutoField(primary_key=True)
    act_structure_code = models.CharField(max_length=30)
    act_structure_name_en = models.CharField(max_length=80)
    act_structure_name_bn = models.CharField(max_length=80, null=True, blank=True)
    act_structure_subtitle = models.CharField(max_length=200, null=True, blank=True)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_act_structure]'


class RefViewReferrer(models.Model):
    """Public-reader view referrer source (search / social / email /
    direct). Captured on every engagement_serial_view row."""
    bookwriter_ref_view_referrer_id = models.AutoField(primary_key=True)
    view_referrer_code = models.CharField(max_length=30)
    view_referrer_name_en = models.CharField(max_length=80)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_view_referrer]'


class RefViewDevice(models.Model):
    """Public-reader device class (phone / tablet / desktop)."""
    bookwriter_ref_view_device_id = models.AutoField(primary_key=True)
    view_device_code = models.CharField(max_length=20)
    view_device_name_en = models.CharField(max_length=80)
    sort_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[ref_view_device]'


class BetaReader(models.Model):
    """One row per individual beta reader invited to a book.
    Links optionally to a share_link they came in through, and
    optionally to an actual user_profile if they signed in."""
    bookwriter_beta_reader_id = models.BigAutoField(primary_key=True)
    link_bookwriter_coll_book_id = models.BigIntegerField()
    link_bookwriter_beta_share_link_id = models.BigIntegerField(null=True, blank=True)
    reader_email = models.CharField(max_length=254, null=True, blank=True)
    link_reader_user_profile_id = models.BigIntegerField(null=True, blank=True)
    reader_display_name = models.CharField(max_length=200, null=True, blank=True)
    reader_avatar_initial = models.CharField(max_length=5, null=True, blank=True)
    reader_avatar_color_hex = models.CharField(max_length=10, null=True, blank=True)
    beta_permission_code = models.CharField(max_length=20)
    invited_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    last_visited_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[beta_reader]'


class BetaComment(models.Model):
    """Comment / suggestion left by a beta reader on a chapter.
    Anchored to a text offset+length+text-snippet so the writer can
    locate the exact passage even after edits."""
    bookwriter_beta_comment_id = models.BigAutoField(primary_key=True)
    link_bookwriter_chapter_id = models.BigIntegerField()
    link_bookwriter_beta_reader_id = models.BigIntegerField()
    comment_anchor_offset = models.IntegerField(null=True, blank=True)
    comment_anchor_length = models.IntegerField(null=True, blank=True)
    comment_anchor_text = models.CharField(max_length=500, null=True, blank=True)
    comment_text = models.TextField()
    comment_kind_code = models.CharField(max_length=20)
    suggestion_replacement_text = models.TextField(null=True, blank=True)
    suggestion_resolution_code = models.CharField(max_length=20, null=True, blank=True)
    is_resolved = models.BooleanField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[beta_comment]'


class EngagementSerialSubscriber(models.Model):
    """A public reader who clicked Subscribe on a published book.
    Email-notification flag controls whether they receive next-chapter
    drop alerts. UNIQUE on (book, user)."""
    bookwriter_engagement_serial_subscriber_id = models.BigAutoField(primary_key=True)
    link_bookwriter_coll_book_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    subscribed_at = models.DateTimeField()
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    email_notifications_enabled = models.BooleanField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[engagement_serial_subscriber]'


class EngagementSerialReaction(models.Model):
    """Reader reaction to a published chapter (heart / fire / etc).
    UNIQUE on (release, user, kind) so each user has at most one of
    each reaction type per chapter."""
    bookwriter_engagement_serial_reaction_id = models.BigAutoField(primary_key=True)
    link_bookwriter_serial_release_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    reaction_kind_code = models.CharField(max_length=20)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[engagement_serial_reaction]'


class EngagementSerialComment(models.Model):
    """Public comment on a published chapter. Threaded via parent FK
    (one level deep on first ship — UI doesn't expose deeper nesting).
    `is_pinned` lets the author elevate a notable comment to the top."""
    bookwriter_engagement_serial_comment_id = models.BigAutoField(primary_key=True)
    link_bookwriter_serial_release_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    parent_link_bookwriter_engagement_serial_comment_id = models.BigIntegerField(null=True, blank=True)
    comment_text = models.TextField()
    is_pinned = models.BooleanField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[engagement_serial_comment]'


class EngagementSerialView(models.Model):
    """Per-read tracking row. Anonymous reads are session-hashed
    (session_hash); logged-in reads carry user_profile_id. Used to
    compute unique_reader_count_cached and the reader analytics
    dashboard."""
    bookwriter_engagement_serial_view_id = models.BigAutoField(primary_key=True)
    link_bookwriter_serial_release_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField(null=True, blank=True)
    view_session_hash = models.CharField(max_length=64, null=True, blank=True)
    view_seconds = models.IntegerField(null=True, blank=True)
    view_completion_pct = models.PositiveSmallIntegerField(null=True, blank=True)
    view_referrer_code = models.CharField(max_length=30, null=True, blank=True)
    view_device_code = models.CharField(max_length=20, null=True, blank=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[bookwriter].[engagement_serial_view]'


class BookCoverDesign(models.Model):
    """One cover design per book (UNIQUE on link_bookwriter_coll_book_id).
    Save endpoint upserts: first save creates, subsequent saves update.
    Phase 1B persists template choice + title size + letter spacing +
    optional palette hex overrides — palette/font/background ref tables
    are wired but the UI only exposes template selection on first ship."""

    bookwriter_book_cover_design_id = models.BigAutoField(primary_key=True)
    link_bookwriter_coll_book_id = models.BigIntegerField()
    link_cover_template_id = models.IntegerField(null=True, blank=True)
    link_cover_palette_id = models.IntegerField(null=True, blank=True)
    link_cover_background_id = models.IntegerField(null=True, blank=True)
    link_cover_font_id = models.IntegerField(null=True, blank=True)
    cover_title_size_pt = models.IntegerField()
    cover_letter_spacing_unit = models.IntegerField()
    cover_palette_background_color_hex_override = models.CharField(max_length=10, null=True, blank=True)
    cover_palette_foreground_color_hex_override = models.CharField(max_length=10, null=True, blank=True)
    cover_palette_accent_hex_override = models.CharField(max_length=10, null=True, blank=True)
    cover_custom_image_url = models.CharField(max_length=1000, null=True, blank=True)
    cover_rendered_preview_url = models.CharField(max_length=1000, null=True, blank=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[book_cover_design]'


class BetaShareLink(models.Model):
    """One revocable secret-link per (book, permission). Sharing the
    /bookwriter/beta/<token>/ URL grants the bearer the configured
    permission (read / suggest / comment). Owner can revoke by setting
    share_revoked_at. Token is a 32-char URL-safe random string."""

    bookwriter_beta_share_link_id = models.BigAutoField(primary_key=True)
    link_bookwriter_coll_book_id = models.BigIntegerField()
    share_link_token = models.CharField(max_length=100)
    beta_permission_code = models.CharField(max_length=20)
    share_expires_at = models.DateTimeField(null=True, blank=True)
    share_revoked_at = models.DateTimeField(null=True, blank=True)
    link_created_by_user_profile_id = models.BigIntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[beta_share_link]'


class SerialRelease(models.Model):
    """Per-chapter publishing record. UNIQUE on link_bookwriter_chapter_id
    so a chapter has at most one release row. Status transitions:
    draft → scheduled → published → unpublished. The public reader page
    reads ONLY rows with serial_release_status_code='published'."""

    bookwriter_serial_release_id = models.BigAutoField(primary_key=True)
    link_bookwriter_chapter_id = models.BigIntegerField()
    link_bookwriter_coll_book_id = models.BigIntegerField()
    serial_release_status_code = models.CharField(max_length=20)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    unpublished_at = models.DateTimeField(null=True, blank=True)
    public_chapter_slug = models.CharField(max_length=300, null=True, blank=True)
    chapter_excerpt = models.TextField(null=True, blank=True)
    read_count_cached = models.IntegerField()
    unique_reader_count_cached = models.IntegerField()
    reaction_count_cached = models.IntegerField()
    comment_count_cached = models.IntegerField()
    preview_view_count_cached = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[serial_release]'


class EngUserStreak(models.Model):
    """Daily streak engine. One row per (user, day) — UNIQUE constraint
    in the SQL schema, so upsert by (user, date)."""

    bookwriter_eng_user_streak_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    streak_date = models.DateField()
    streak_words_written = models.IntegerField()
    streak_minutes_active = models.IntegerField()
    streak_session_count = models.IntegerField()
    streak_goal_met = models.BooleanField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[bookwriter].[eng_user_streak]'

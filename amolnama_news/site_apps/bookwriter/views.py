"""bookwriter views — কলম writing sanctuary."""

from datetime import timedelta

from django.conf import settings
from django.db import models
from django.http import Http404
from django.shortcuts import render
from django.utils import timezone

from amolnama_news.site_apps.core.utils import get_user_profile_id

from .models import (
    BetaComment,
    BetaReader,
    BetaShareLink,
    BibleEntry,
    BookCoverDesign,
    Chapter,
    CollBook,
    EngagementSerialComment,
    EngagementSerialReaction,
    EngagementSerialSubscriber,
    EngUserStreak,
    PlotCard,
    RefBibleCategory,
    RefBookStatus,
    RefChapterStatus,
    RefChapterVisibility,
    RefCoverBackground,
    RefCoverFont,
    RefCoverTemplate,
    SerialRelease,
    WritingSession,
)


def _ensure_default_book_for_user(user_profile_id):
    """Auto-provision a scratch book + first chapter for a logged-in user
    on first visit. Returns (book, chapter) tuple. Idempotent — safe to
    call on every page load. Returns the user's most recent active book
    if one already exists; never creates a second book here."""
    existing_book = (
        CollBook.objects
        .filter(link_owner_user_profile_id=user_profile_id, is_active=True)
        .order_by('-created_at')
        .first()
    )

    now = timezone.now()
    if existing_book is None:
        existing_book = CollBook.objects.create(
            link_owner_user_profile_id=user_profile_id,
            book_title_en='Untitled Book',
            book_language_code='bn',
            book_daily_word_target=500,
            book_status_code='draft',
            book_visibility_code='private',
            book_word_count_cached=0,
            book_chapter_count_cached=0,
            is_active=True,
            created_at=now,
        )

    existing_chapter = (
        Chapter.objects
        .filter(
            link_bookwriter_coll_book_id=existing_book.bookwriter_coll_book_id,
            is_active=True,
        )
        .order_by('sort_order', 'chapter_number')
        .first()
    )

    if existing_chapter is None:
        existing_chapter = Chapter.objects.create(
            link_bookwriter_coll_book_id=existing_book.bookwriter_coll_book_id,
            chapter_number=1,
            chapter_title_en='Chapter One',
            chapter_word_count=0,
            chapter_status_code='blank',
            chapter_visibility_code='private',
            sort_order=1,
            is_active=True,
            created_at=now,
        )

    return existing_book, existing_chapter


def bookwriter_inkwell(request):
    """Render the Inkwell writing surface.

    Picks one of two templates based on settings.BOOKWRITER_LAYOUT_MODE:

      - 'embedded'   → inkwell_embedded.html
                       (extends core/base.html — global chrome stays visible)
      - 'standalone' → inkwell.html
                       (full-screen takeover, no global chrome)

    Logged-in users get an auto-provisioned book + first chapter so the
    autosave endpoint has a real chapter_id to write against. Anonymous
    visitors see the hardcoded demo content (used as a teaser /
    marketing surface — no DB writes happen for them).
    """
    layout_mode = getattr(settings, 'BOOKWRITER_LAYOUT_MODE', 'embedded')
    template_name = (
        'bookwriter/pages/inkwell_embedded.html'
        if layout_mode == 'embedded'
        else 'bookwriter/pages/inkwell.html'
    )

    context = {}
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is not None:
        current_book, active_chapter = _ensure_default_book_for_user(user_profile_id)
        book_chapters_list = list(
            Chapter.objects
            .filter(
                link_bookwriter_coll_book_id=current_book.bookwriter_coll_book_id,
                is_active=True,
            )
            .order_by('sort_order', 'chapter_number')
        )
        today_session_words, today_session_seconds, current_streak_days, last_seven_streak_days = (
            _read_writer_dashboard_stats(user_profile_id, current_book.bookwriter_coll_book_id)
        )
        book_plot_cards_list = list(
            PlotCard.objects
            .filter(
                link_bookwriter_coll_book_id=current_book.bookwriter_coll_book_id,
                is_active=True,
            )
            .order_by('sort_order', 'card_scene_number')
        )
        book_bible_categories_list, book_bible_entries_list = _read_book_bible_data(
            current_book.bookwriter_coll_book_id
        )
        saved_cover_design_state = _read_book_cover_design_state(
            current_book.bookwriter_coll_book_id
        )
        published_chapter_ids_set = set(
            SerialRelease.objects
            .filter(
                link_bookwriter_coll_book_id=current_book.bookwriter_coll_book_id,
                serial_release_status_code='published',
                is_active=True,
            )
            .values_list('link_bookwriter_chapter_id', flat=True)
        )
        active_beta_share_links_list = list(
            BetaShareLink.objects
            .filter(
                link_bookwriter_coll_book_id=current_book.bookwriter_coll_book_id,
                is_active=True,
                share_revoked_at__isnull=True,
            )
            .order_by('-created_at')
            .values(
                'bookwriter_beta_share_link_id',
                'share_link_token',
                'beta_permission_code',
                'created_at',
            )[:20]
        )
        active_beta_readers_list = list(
            BetaReader.objects
            .filter(
                link_bookwriter_coll_book_id=current_book.bookwriter_coll_book_id,
                is_active=True,
            )
            .order_by('-created_at')
            .values(
                'bookwriter_beta_reader_id',
                'reader_email',
                'reader_display_name',
                'reader_avatar_initial',
                'beta_permission_code',
                'invited_at',
                'accepted_at',
            )[:50]
        )
        context.update({
            'current_book': current_book,
            'active_chapter_id': active_chapter.bookwriter_chapter_id,
            'active_chapter_number': active_chapter.chapter_number,
            'active_chapter_html': active_chapter.chapter_text_html or '',
            'active_chapter_title': (
                active_chapter.chapter_title_en
                or active_chapter.chapter_title_bn
                or 'Untitled'
            ),
            'book_chapters_list': book_chapters_list,
            'book_plot_cards_list': book_plot_cards_list,
            'book_bible_categories_list': book_bible_categories_list,
            'book_bible_entries_list': book_bible_entries_list,
            'saved_cover_design_state': saved_cover_design_state,
            'published_chapter_ids_set': published_chapter_ids_set,
            'active_beta_share_links_list': active_beta_share_links_list,
            'active_beta_readers_list': active_beta_readers_list,
            'chapter_status_options_list': list(
                RefChapterStatus.objects
                .filter(is_active=True)
                .order_by('sort_order', 'bookwriter_ref_chapter_status_id')
                .values('chapter_status_code', 'chapter_status_name_en', 'chapter_status_dot_color_hex')
            ),
            'chapter_visibility_options_list': list(
                RefChapterVisibility.objects
                .filter(is_active=True)
                .order_by('sort_order', 'bookwriter_ref_chapter_visibility_id')
                .values('chapter_visibility_code', 'chapter_visibility_name_en')
            ),
            'book_status_options_list': list(
                RefBookStatus.objects
                .filter(is_active=True)
                .order_by('sort_order', 'bookwriter_ref_book_status_id')
                .values('book_status_code', 'book_status_name_en')
            ),
            'today_session_words': today_session_words,
            'today_session_minutes': today_session_seconds // 60,
            'current_streak_days': current_streak_days,
            'last_seven_streak_days': last_seven_streak_days,
            'daily_word_target': current_book.book_daily_word_target or 500,
            'daily_goal_progress_percent': (
                int(round(min(today_session_words / current_book.book_daily_word_target, 1.5) * 100))
                if current_book.book_daily_word_target else 0
            ),
        })

    return render(request, template_name, context)


def _read_writer_dashboard_stats(user_profile_id, current_book_id):
    """Pull the small set of per-user counters the right-rail card
    displays: today's words + active minutes, current consecutive
    streak, and a 7-day "active / inactive" hit list for the streak
    dots row. Cheap query — at most ~15 rows scanned. Returns:
        (today_words, today_active_seconds, current_streak_days,
         last_seven_streak_days)
    where last_seven_streak_days is a list of 7 booleans (oldest →
    today) marking whether that day had any writing activity.
    """
    user_today = timezone.localdate()

    today_session = (
        WritingSession.objects
        .filter(
            link_user_profile_id=user_profile_id,
            link_bookwriter_coll_book_id=current_book_id,
            session_date=user_today,
            is_active=True,
        )
        .first()
    )
    today_words = today_session.session_words_added if today_session else 0
    today_seconds = today_session.session_active_seconds if today_session else 0

    streak_dates_set = set(
        EngUserStreak.objects
        .filter(link_user_profile_id=user_profile_id, is_active=True)
        .order_by('-streak_date')
        .values_list('streak_date', flat=True)[:365]
    )

    consecutive_days = 0
    expected_date = user_today
    while expected_date in streak_dates_set:
        consecutive_days += 1
        expected_date -= timedelta(days=1)

    last_seven_streak_days = [
        (user_today - timedelta(days=offset)) in streak_dates_set
        for offset in range(6, -1, -1)  # oldest → today
    ]

    return today_words, today_seconds, consecutive_days, last_seven_streak_days


def _read_book_bible_data(current_book_id):
    """Load the Bible-view rendering data for a book.

    Returns (categories, entries) where:

      - categories is a list of dicts (one per active ref row) carrying
        the seeded label/icon/code plus a live `entry_count` for THIS
        book — drives the left rail.
      - entries is a flat list of BibleEntry rows ordered by category +
        sort_order — the template groups them client-side via JS, but
        also renders all of them server-side so the page is meaningful
        without JavaScript.

    Cheap query: 1 SELECT per call from ref_bible_category (cached
    perm), 1 SELECT from bible_entry filtered by book_id with index hit.
    """
    seeded_categories = list(
        RefBibleCategory.objects
        .filter(is_active=True)
        .order_by('sort_order', 'bookwriter_ref_bible_category_id')
    )

    raw_entry_rows = list(
        BibleEntry.objects
        .filter(link_bookwriter_coll_book_id=current_book_id, is_active=True)
        .order_by('bible_category_code', 'sort_order', 'bookwriter_bible_entry_id')
    )
    # Plain-dict serialization so the same list works both for the
    # `{% for %}` template loop AND for {% json_script %} hydration.
    book_entries_as_dicts = [
        {
            'bookwriter_bible_entry_id': row.bookwriter_bible_entry_id,
            'bible_category_code': row.bible_category_code,
            'entry_name': row.entry_name or '',
            'entry_role': row.entry_role or '',
            'entry_avatar_initial': row.entry_avatar_initial or '',
            'entry_avatar_color_hex': row.entry_avatar_color_hex or '',
            'entry_avatar_color_hex_2': row.entry_avatar_color_hex_2 or '',
            'entry_image_url': row.entry_image_url or '',
            'entry_attributes_json': row.entry_attributes_json or '',
            'entry_biography': row.entry_biography or '',
            'entry_notes': row.entry_notes or '',
            'entry_tags_csv': row.entry_tags_csv or '',
        }
        for row in raw_entry_rows
    ]

    entries_per_category_count = {}
    for entry_dict in book_entries_as_dicts:
        category_code = entry_dict['bible_category_code']
        entries_per_category_count[category_code] = (
            entries_per_category_count.get(category_code, 0) + 1
        )

    categories_with_counts = [
        {
            'category_code': category_row.bible_category_code,
            'category_name_en': category_row.bible_category_name_en,
            'category_name_bn': category_row.bible_category_name_bn,
            'category_icon': category_row.bible_category_icon or '',
            'entry_count': entries_per_category_count.get(category_row.bible_category_code, 0),
        }
        for category_row in seeded_categories
    ]

    return categories_with_counts, book_entries_as_dicts


def _read_book_cover_design_state(current_book_id):
    """Resolve the saved cover design (if any) into a small dict the
    cover-view template can read directly. Returns sensible defaults
    so the template never has to null-check.

    Resolves `cover_template_code` from the FK so the template can
    mark the matching `.tmpl` tile active without a JS round-trip.
    """
    saved_design = (
        BookCoverDesign.objects
        .filter(link_bookwriter_coll_book_id=current_book_id, is_active=True)
        .first()
    )
    if saved_design is None:
        return {
            'cover_template_code': None,
            'cover_font_code': None,
            'cover_background_code': None,
            'cover_title_size_pt': 42,
            'cover_letter_spacing_unit': 0,
            'cover_palette_bg_hex_override': None,
            'cover_palette_fg_hex_override': None,
            'cover_palette_accent_hex_override': None,
        }

    resolved_template_code = None
    if saved_design.link_cover_template_id:
        resolved_template_code = (
            RefCoverTemplate.objects
            .filter(bookwriter_ref_cover_template_id=saved_design.link_cover_template_id)
            .values_list('cover_template_code', flat=True)
            .first()
        )
    resolved_font_code = None
    if saved_design.link_cover_font_id:
        resolved_font_code = (
            RefCoverFont.objects
            .filter(bookwriter_ref_cover_font_id=saved_design.link_cover_font_id)
            .values_list('cover_font_code', flat=True)
            .first()
        )
    resolved_background_code = None
    if saved_design.link_cover_background_id:
        resolved_background_code = (
            RefCoverBackground.objects
            .filter(bookwriter_ref_cover_background_id=saved_design.link_cover_background_id)
            .values_list('cover_background_code', flat=True)
            .first()
        )

    return {
        'cover_template_code': resolved_template_code,
        'cover_font_code': resolved_font_code,
        'cover_background_code': resolved_background_code,
        'cover_title_size_pt': saved_design.cover_title_size_pt,
        'cover_letter_spacing_unit': saved_design.cover_letter_spacing_unit,
        'cover_palette_bg_hex_override': saved_design.cover_palette_bg_hex_override,
        'cover_palette_fg_hex_override': saved_design.cover_palette_fg_hex_override,
        'cover_palette_accent_hex_override': saved_design.cover_palette_accent_hex_override,
    }


# ============================================================
#  PHASE 1B STEP 12 — public reader pages (no auth required)
# ============================================================

def _render_chapter_reader_page(request, chapter, owning_book, release_row, reader_mode_code, beta_reader_row=None, share_link_token=None):
    """Shared template render for the public reader.

    `reader_mode_code` distinguishes 'public' (publicly indexable serial
    release) from 'beta' (private share-link preview). `beta_reader_row`
    is only set in 'beta' mode — it's the BetaReader instance for the
    current viewer, used so the inline comment form can attach new
    comments to a real reader id."""
    book_other_published_chapters = list(
        Chapter.objects
        .filter(
            link_bookwriter_coll_book_id=owning_book.bookwriter_coll_book_id,
            is_active=True,
        )
        .order_by('sort_order', 'chapter_number')
        .values('bookwriter_chapter_id', 'chapter_number', 'chapter_title_en', 'chapter_title_bn')
    )
    if reader_mode_code == 'public':
        # Map chapter_id → release_id for every published release on this
        # book. The TOC needs the release id per row so the
        # IntersectionObserver can fire /api/release/<id>/preview-impression/
        # when each row scrolls into view.
        chapter_id_to_release_id = dict(
            SerialRelease.objects
            .filter(
                link_bookwriter_coll_book_id=owning_book.bookwriter_coll_book_id,
                serial_release_status_code='published',
                is_active=True,
            )
            .values_list('link_bookwriter_chapter_id', 'bookwriter_serial_release_id')
        )
        book_other_published_chapters = [
            {**chapter_dict,
             'serial_release_id': chapter_id_to_release_id[chapter_dict['bookwriter_chapter_id']]}
            for chapter_dict in book_other_published_chapters
            if chapter_dict['bookwriter_chapter_id'] in chapter_id_to_release_id
        ]

    # Engagement context — the public reader template surfaces a subscribe
    # button + reaction strip + comment thread. We resolve the caller's
    # current state server-side so the buttons paint in the correct on/off
    # mode without a JS round-trip.
    viewer_user_profile_id = get_user_profile_id(request)
    is_book_owner = (
        viewer_user_profile_id is not None
        and owning_book.link_owner_user_profile_id == viewer_user_profile_id
    )
    is_subscribed = False
    existing_user_reaction_kinds = []
    if viewer_user_profile_id is not None:
        is_subscribed = EngagementSerialSubscriber.objects.filter(
            link_bookwriter_coll_book_id=owning_book.bookwriter_coll_book_id,
            link_user_profile_id=viewer_user_profile_id,
            is_active=True,
            unsubscribed_at__isnull=True,
        ).exists()
        if release_row is not None:
            existing_user_reaction_kinds = list(
                EngagementSerialReaction.objects
                .filter(
                    link_bookwriter_serial_release_id=release_row.bookwriter_serial_release_id,
                    link_user_profile_id=viewer_user_profile_id,
                    is_active=True,
                )
                .values_list('reaction_kind_code', flat=True)
            )

    # Per-kind reaction totals so the row paints with current counts on
    # first render — no JS round-trip needed for the initial state.
    reaction_counts_by_kind_dict = {}
    if release_row is not None:
        for reaction_row in (
            EngagementSerialReaction.objects
            .filter(
                link_bookwriter_serial_release_id=release_row.bookwriter_serial_release_id,
                is_active=True,
            )
            .values('reaction_kind_code')
            .annotate(kind_count=models.Count('bookwriter_engagement_serial_reaction_id'))
        ):
            reaction_counts_by_kind_dict[reaction_row['reaction_kind_code']] = reaction_row['kind_count']

    reaction_kinds_for_strip = [
        {'code': 'heart',    'icon': '\u2764\ufe0f', 'label': 'love',     'count': reaction_counts_by_kind_dict.get('heart',    0), 'is_active': 'heart'    in existing_user_reaction_kinds},
        {'code': 'fire',     'icon': '\U0001f525',   'label': 'fire',     'count': reaction_counts_by_kind_dict.get('fire',     0), 'is_active': 'fire'     in existing_user_reaction_kinds},
        {'code': 'thinking', 'icon': '\U0001f914',   'label': 'think',    'count': reaction_counts_by_kind_dict.get('thinking', 0), 'is_active': 'thinking' in existing_user_reaction_kinds},
        {'code': 'tear',     'icon': '\U0001f622',   'label': 'tear',     'count': reaction_counts_by_kind_dict.get('tear',     0), 'is_active': 'tear'     in existing_user_reaction_kinds},
        {'code': 'clap',     'icon': '\U0001f44f',   'label': 'clap',     'count': reaction_counts_by_kind_dict.get('clap',     0), 'is_active': 'clap'     in existing_user_reaction_kinds},
    ]

    context = {
        'reader_mode_code': reader_mode_code,
        'current_chapter': chapter,
        'current_book': owning_book,
        'serial_release': release_row,
        'book_other_published_chapters': book_other_published_chapters,
        'is_book_owner': is_book_owner,
        'is_subscribed': is_subscribed,
        'existing_user_reaction_kinds_set': set(existing_user_reaction_kinds),
        'viewer_user_profile_id': viewer_user_profile_id,
        'reaction_kinds_for_strip': reaction_kinds_for_strip,
        'public_reader_comments_list': _read_serial_release_comments_for_render(release_row, viewer_user_profile_id, is_book_owner),
        'beta_reader_row': beta_reader_row,
        'beta_share_link_token': share_link_token,
        'beta_chapter_comments_list': _read_beta_chapter_comments_for_render(chapter, viewer_user_profile_id, is_book_owner) if reader_mode_code == 'beta' else [],
    }
    return render(request, 'bookwriter/pages/public_reader.html', context)


def bookwriter_public_chapter_reader(request, public_chapter_slug):
    """Public reader for a published chapter. Anonymous-friendly.

    URL: /bookwriter/read/<slug>/
    """
    try:
        release_row = SerialRelease.objects.get(
            public_chapter_slug=public_chapter_slug,
            serial_release_status_code='published',
            is_active=True,
        )
    except SerialRelease.DoesNotExist:
        raise Http404('Chapter not found')

    try:
        chapter = Chapter.objects.get(
            bookwriter_chapter_id=release_row.link_bookwriter_chapter_id,
            is_active=True,
        )
        owning_book = CollBook.objects.get(
            bookwriter_coll_book_id=release_row.link_bookwriter_coll_book_id,
            is_active=True,
        )
    except (Chapter.DoesNotExist, CollBook.DoesNotExist):
        raise Http404('Chapter not found')

    # Best-effort view-count bump. Not transactional; eventual consistency
    # is fine for analytics.
    SerialRelease.objects.filter(pk=release_row.pk).update(
        read_count_cached=release_row.read_count_cached + 1,
    )
    return _render_chapter_reader_page(
        request, chapter, owning_book, release_row, reader_mode_code='public',
    )


def _resolve_beta_reader_for_share_token(share_link_token, viewer_user_profile_id):
    """Match the share-link token to a beta_reader row for this viewer.
    Returns the BetaReader instance or None if no link exists yet.

    The first time a logged-in viewer hits a beta link we auto-create
    a beta_reader row for them so subsequent comments can be authored.
    """
    if viewer_user_profile_id is None:
        return None
    share_row = BetaShareLink.objects.filter(
        share_link_token=share_link_token,
        is_active=True,
        share_revoked_at__isnull=True,
    ).first()
    if share_row is None:
        return None
    existing_reader = BetaReader.objects.filter(
        link_bookwriter_coll_book_id=share_row.link_bookwriter_coll_book_id,
        link_reader_user_profile_id=viewer_user_profile_id,
        is_active=True,
    ).first()
    if existing_reader is not None:
        return existing_reader
    now = timezone.now()
    return BetaReader.objects.create(
        link_bookwriter_coll_book_id=share_row.link_bookwriter_coll_book_id,
        link_bookwriter_beta_share_link_id=share_row.bookwriter_beta_share_link_id,
        link_reader_user_profile_id=viewer_user_profile_id,
        beta_permission_code=share_row.beta_permission_code,
        invited_at=now,
        accepted_at=now,
        is_active=True,
        created_at=now,
    )


def bookwriter_beta_chapter_reader(request, share_link_token):
    """Private beta reader — anyone with the token + an active share
    link gets to read the LATEST chapter of the book (cycling chapter
    selection happens client-side via the in-page chapter list).

    URL: /bookwriter/beta/<token>/
    """
    try:
        share_row = BetaShareLink.objects.get(
            share_link_token=share_link_token,
            is_active=True,
            share_revoked_at__isnull=True,
        )
    except BetaShareLink.DoesNotExist:
        raise Http404('Share link not found or revoked')

    if share_row.share_expires_at and share_row.share_expires_at < timezone.now():
        raise Http404('Share link expired')

    try:
        owning_book = CollBook.objects.get(
            bookwriter_coll_book_id=share_row.link_bookwriter_coll_book_id,
            is_active=True,
        )
    except CollBook.DoesNotExist:
        raise Http404('Book not found')

    chapter = (
        Chapter.objects
        .filter(link_bookwriter_coll_book_id=owning_book.bookwriter_coll_book_id, is_active=True)
        .order_by('sort_order', 'chapter_number')
        .first()
    )
    if chapter is None:
        raise Http404('Book has no chapters yet')

    # Auto-provision a per-viewer beta_reader row on first visit so the
    # comment form has a real reader_id to attach comments to.
    viewer_user_profile_id = get_user_profile_id(request)
    beta_reader_row = _resolve_beta_reader_for_share_token(share_link_token, viewer_user_profile_id)

    return _render_chapter_reader_page(
        request, chapter, owning_book, release_row=None, reader_mode_code='beta',
        beta_reader_row=beta_reader_row,
        share_link_token=share_link_token,
    )


def _read_beta_chapter_comments_for_render(chapter, viewer_user_profile_id, is_book_owner):
    """Load beta comments on a chapter for the beta-reader sidebar.

    Owner sees all; reader sees only their own. Returns dicts with
    `is_mine` and `can_delete` so the template can paint affordances
    without a second pass."""
    if chapter is None:
        return []
    base_query = BetaComment.objects.filter(
        link_bookwriter_chapter_id=chapter.bookwriter_chapter_id,
        is_active=True,
    )
    if not is_book_owner:
        if viewer_user_profile_id is None:
            return []
        my_reader_ids = list(
            BetaReader.objects
            .filter(
                link_bookwriter_coll_book_id=chapter.link_bookwriter_coll_book_id,
                link_reader_user_profile_id=viewer_user_profile_id,
                is_active=True,
            )
            .values_list('bookwriter_beta_reader_id', flat=True)
        )
        if not my_reader_ids:
            return []
        base_query = base_query.filter(link_bookwriter_beta_reader_id__in=my_reader_ids)
    rows = list(base_query.order_by('-created_at')[:200])
    return [
        {
            'beta_comment_id': row.bookwriter_beta_comment_id,
            'beta_reader_id': row.link_bookwriter_beta_reader_id,
            'comment_kind_code': row.comment_kind_code,
            'comment_text': row.comment_text or '',
            'comment_anchor_text': row.comment_anchor_text or '',
            'anchor_offset': row.comment_anchor_offset,
            'anchor_length': row.comment_anchor_length,
            'is_resolved': bool(row.is_resolved),
            'created_at_iso': row.created_at.isoformat() if row.created_at else '',
            'can_resolve': is_book_owner,
            'can_delete': is_book_owner or (
                viewer_user_profile_id is not None
                and BetaReader.objects.filter(
                    bookwriter_beta_reader_id=row.link_bookwriter_beta_reader_id,
                    link_reader_user_profile_id=viewer_user_profile_id,
                ).exists()
            ),
        }
        for row in rows
    ]


def _read_serial_release_comments_for_render(release_row, viewer_user_profile_id, is_book_owner):
    """Load active comments on a release for server-side rendering.

    Returns a list of dicts including a resolved `author_display_name`
    (from UserProfile.display_name) so the template doesn't have to
    show raw "Reader #N" identifiers. Falls back to "Reader #N" only
    when the UserProfile row is missing (orphaned comment) or has no
    display_name set.

    `is_mine` (caller is author) and `can_delete` (author OR book
    owner) let the template paint affordances without a client check.
    Capped 200 newest rows.
    """
    if release_row is None:
        return []
    comment_rows = list(
        EngagementSerialComment.objects
        .filter(
            link_bookwriter_serial_release_id=release_row.bookwriter_serial_release_id,
            is_active=True,
        )
        .order_by('-is_pinned', '-created_at')[:200]
    )
    if not comment_rows:
        return []
    # Single in_bulk query resolves every author's display name without N+1.
    from amolnama_news.site_apps.user_account.models import UserProfile
    author_profile_ids = {row.link_user_profile_id for row in comment_rows if row.link_user_profile_id is not None}
    profiles_by_id = (
        UserProfile.objects
        .filter(user_profile_id__in=author_profile_ids)
        .in_bulk(field_name='user_profile_id')
        if author_profile_ids else {}
    )

    def _resolve_author_display_name(profile_id):
        profile_row = profiles_by_id.get(profile_id)
        if profile_row is None:
            return 'Reader #' + str(profile_id) if profile_id is not None else 'Anonymous'
        return profile_row.display_name or ('Reader #' + str(profile_id))

    return [
        {
            'comment_id': row.bookwriter_engagement_serial_comment_id,
            'parent_comment_id': row.parent_link_bookwriter_engagement_serial_comment_id,
            'comment_text': row.comment_text or '',
            'is_pinned': bool(row.is_pinned),
            'created_at_iso': row.created_at.isoformat() if row.created_at else '',
            'author_user_profile_id': row.link_user_profile_id,
            'author_display_name': _resolve_author_display_name(row.link_user_profile_id),
            'is_mine': (viewer_user_profile_id is not None and row.link_user_profile_id == viewer_user_profile_id),
            'can_delete': (viewer_user_profile_id is not None and (is_book_owner or row.link_user_profile_id == viewer_user_profile_id)),
        }
        for row in comment_rows
    ]

"""bookwriter views — কলম writing sanctuary."""

from datetime import timedelta

from django.conf import settings
from django.db import models
from django.http import Http404
from django.shortcuts import redirect, render
from django.urls import reverse
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
from .views_api_helpers import (
    build_book_card_payload,
    build_book_reader_canonical_path,
    build_book_reader_canonical_slug,
    build_bookwriter_breadcrumb_trail,
    chunk_toc_chapters_into_pages,
    pack_chapter_pages_into_book_sheets,
    paginate_chapter_html_into_pages,
    prefetch_book_cover_designs,
    resolve_book_cover_palette,
    strip_page_break_overlay_from_html,
)


def _create_first_chapter_for_book(owning_book_id, created_at_timestamp):
    """Insert the default 'Chapter One' row for a freshly-created book.
    Single source of truth so `create_blank_book_for_user` (always
    creates) and `bookwriter_inkwell` (defensive missing-chapter
    recovery when a book has zero active chapters) share the exact
    same chapter shape."""
    return Chapter.objects.create(
        link_bookwriter_coll_book_id=owning_book_id,
        chapter_number=1,
        chapter_title_en='Chapter One',
        chapter_word_count=0,
        chapter_status_code='blank',
        chapter_visibility_code='private',
        sort_order=1,
        is_active=True,
        created_at=created_at_timestamp,
    )


def create_blank_book_for_user(user_profile_id):
    """Create a fresh blank book + 'Chapter One' for a user. Always
    creates new — never deduplicates against existing books. Returns
    (book, chapter). Called by the library "+ New book" button via
    `views_api_book.api_bookwriter_book_create`.

    Title is intentionally left NULL: the inkwell title input renders
    a "New Book" placeholder so the writer never has to backspace a
    pre-filled value before typing their own."""
    created_at_timestamp = timezone.now()
    new_book = CollBook.objects.create(
        link_owner_user_profile_id=user_profile_id,
        book_language_code='bn',
        book_daily_word_target=500,
        book_status_code='draft',
        book_visibility_code='private',
        book_word_count_cached=0,
        book_chapter_count_cached=0,
        is_active=True,
        created_at=created_at_timestamp,
    )
    new_chapter = _create_first_chapter_for_book(
        new_book.bookwriter_coll_book_id, created_at_timestamp,
    )
    return new_book, new_chapter


def _resolve_viewer_display_name(user_profile_id):
    """Best-effort UserProfile.display_name lookup. Used purely for
    cosmetic fallback (author crumb on a book that hasn't yet had its
    own author display name set). Returns '' on any failure — never
    raises, since this is a presentational nicety, not a security check."""
    if user_profile_id is None:
        return ''
    from amolnama_news.site_apps.user_account.models import UserProfile
    profile_row = (
        UserProfile.objects
        .filter(user_profile_id=user_profile_id)
        .values_list('display_name', flat=True)
        .first()
    )
    return profile_row or ''


def bookwriter_library(request):
    """My Library landing — grid of every book the logged-in user owns.

    URL: /bookwriter/

    States:
      - Anonymous viewer    → empty grid + 'log in to start writing' CTA.
      - Logged in, 0 books  → empty grid + 'Start writing' button that
                              POSTs to api_bookwriter_book_create then
                              redirects to inkwell.
      - Logged in, N books  → cards sorted most-recently-edited first.
                              Click cover → /bookwriter/write/<id>/edit/.

    Cover palette: from BookCoverDesign overrides if present, otherwise
    a deterministic fallback from `BOOKWRITER_LIBRARY_FALLBACK_COVER_PALETTES`
    indexed by book id. See views_api_helpers.resolve_book_cover_palette.

    Single source of truth for card data is `build_book_card_payload`
    so the SSR template and any future JSON list endpoint cannot drift.
    """
    user_profile_id = get_user_profile_id(request)
    library_books_list = []
    if user_profile_id is not None:
        owned_books_list = list(
            CollBook.objects
            .filter(link_owner_user_profile_id=user_profile_id, is_active=True)
            .order_by('-updated_at', '-created_at')
        )
        cover_designs_by_book_id = prefetch_book_cover_designs(owned_books_list)
        viewer_display_name = _resolve_viewer_display_name(user_profile_id)
        for owned_book in owned_books_list:
            saved_cover_design = cover_designs_by_book_id.get(
                owned_book.bookwriter_coll_book_id,
            )
            library_books_list.append(
                build_book_card_payload(
                    owned_book, saved_cover_design, viewer_display_name,
                )
            )

    return render(request, 'bookwriter/pages/library.html', {
        'library_books_list': library_books_list,
        'is_authenticated_writer': user_profile_id is not None,
        'bookwriter_breadcrumb_trail': build_bookwriter_breadcrumb_trail(),
        'active_sidebar_nav_id': 'bookwriter',
        'seo': {
            'title': 'Book Library — কলম',
            'description': (
                'Your personal book library — every book you are writing in কলম.'
            ),
            'canonical': request.build_absolute_uri(),
            'og_type': 'website',
        },
    })


def bookwriter_inkwell(request, book_id):
    """Render the Inkwell writing surface for ONE specific book.

    URL: /bookwriter/write/<book_id>/edit/

    Picks one of two templates based on settings.BOOKWRITER_LAYOUT_MODE:
      - 'embedded'   → inkwell_embedded.html (global chrome stays)
      - 'standalone' → inkwell.html          (full-screen takeover)

    Owner-only. Anonymous visitors are redirected to the library landing
    (which gates them with a login CTA). Non-owner book ids return 404
    so the existence of other users' books is not leaked. Defensive
    chapter recovery: if the book exists but has zero active chapters,
    inserts a fresh 'Chapter One' so the autosave endpoint always has a
    real chapter_id to write against.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return redirect('bookwriter:library')

    try:
        current_book = CollBook.objects.get(
            bookwriter_coll_book_id=book_id,
            link_owner_user_profile_id=user_profile_id,
            is_active=True,
        )
    except CollBook.DoesNotExist:
        raise Http404('Book not found')

    layout_mode = getattr(settings, 'BOOKWRITER_LAYOUT_MODE', 'embedded')
    template_name = (
        'bookwriter/pages/inkwell_embedded.html'
        if layout_mode == 'embedded'
        else 'bookwriter/pages/inkwell.html'
    )

    active_chapter = (
        Chapter.objects
        .filter(
            link_bookwriter_coll_book_id=current_book.bookwriter_coll_book_id,
            is_active=True,
        )
        .order_by('sort_order', 'chapter_number')
        .first()
    )
    if active_chapter is None:
        active_chapter = _create_first_chapter_for_book(
            current_book.bookwriter_coll_book_id, timezone.now(),
        )

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
    # Map chapter_id → SerialRelease snapshot for the BOOK SETTINGS
    # publish-controls section (per-chapter publish/unpublish toggle +
    # public URL with copy-to-clipboard). One DB roundtrip; the
    # template iterates `book_chapters_list` and looks each chapter up
    # in `chapter_publish_status_by_chapter_id` so the publish UI uses
    # the same chapter ordering / filtering the rest of the inkwell
    # already does.
    serial_release_rows_for_book = list(
        SerialRelease.objects
        .filter(
            link_bookwriter_coll_book_id=current_book.bookwriter_coll_book_id,
            is_active=True,
        )
        .values(
            'link_bookwriter_chapter_id',
            'serial_release_status_code',
            'public_chapter_slug',
            'chapter_excerpt',
            'published_at',
            'read_count_cached',
            'reaction_count_cached',
            'comment_count_cached',
        )
    )
    chapter_publish_status_by_chapter_id = {
        release_row['link_bookwriter_chapter_id']: release_row
        for release_row in serial_release_rows_for_book
    }
    published_chapter_ids_set = {
        chapter_id_value
        for chapter_id_value, release_row in chapter_publish_status_by_chapter_id.items()
        if release_row['serial_release_status_code'] == 'published'
    }
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
    # Per-chapter publish-dashboard rows — one entry per active chapter,
    # carrying everything the Publish-tab template needs to render a
    # row WITHOUT going back to the DB. Single source of truth: the
    # template iterates this list, never reads model fields directly.
    book_chapters_publish_status_list = []
    chapters_with_words_publishable_count = 0
    chapters_empty_count = 0
    chapters_currently_live_count = 0
    chapters_currently_draft_count = 0
    book_total_read_count = 0
    book_total_reaction_count = 0
    book_total_comment_count = 0
    # Canonical 3D reader URL for THIS book — same URL regardless of
    # which chapter the public viewer arrived from. Single read
    # surface, one shareable URL per book.
    book_3d_reader_canonical_url = request.build_absolute_uri(
        build_book_reader_canonical_path(current_book)
    )
    has_at_least_one_published_chapter = False
    for chapter_row in book_chapters_list:
        release_snapshot = chapter_publish_status_by_chapter_id.get(
            chapter_row.bookwriter_chapter_id
        )
        is_chapter_published = bool(
            release_snapshot
            and release_snapshot['serial_release_status_code'] == 'published'
        )
        # Per-chapter "public URL" is the SAME 3D reader URL for every
        # row — there's a single reading surface for the whole book.
        # The per-chapter slug stored on SerialRelease is the legacy
        # path; the redirect view sends those URLs to the same place.
        public_chapter_url = book_3d_reader_canonical_url if is_chapter_published else ''
        if is_chapter_published:
            has_at_least_one_published_chapter = True

        chapter_word_count = chapter_row.chapter_word_count or 0
        chapter_is_empty   = (chapter_word_count <= 0)
        if chapter_is_empty:
            chapters_empty_count += 1
        else:
            chapters_with_words_publishable_count += 1

        if is_chapter_published:
            chapters_currently_live_count += 1
        else:
            chapters_currently_draft_count += 1

        chapter_read_count     = (release_snapshot or {}).get('read_count_cached')     or 0
        chapter_reaction_count = (release_snapshot or {}).get('reaction_count_cached') or 0
        chapter_comment_count  = (release_snapshot or {}).get('comment_count_cached')  or 0
        book_total_read_count     += chapter_read_count
        book_total_reaction_count += chapter_reaction_count
        book_total_comment_count  += chapter_comment_count

        chapter_published_at = (release_snapshot or {}).get('published_at')
        chapter_excerpt_text = ((release_snapshot or {}).get('chapter_excerpt') or '').strip()

        book_chapters_publish_status_list.append({
            'chapter_id':              chapter_row.bookwriter_chapter_id,
            'chapter_number':          chapter_row.chapter_number,
            'chapter_display_title':   (
                chapter_row.chapter_title_en
                or chapter_row.chapter_title_bn
                or ('Chapter %s' % chapter_row.chapter_number)
            ),
            'chapter_word_count':      chapter_word_count,
            'chapter_excerpt_text':    chapter_excerpt_text,
            'is_chapter_published':    is_chapter_published,
            'is_chapter_empty':        chapter_is_empty,
            'public_chapter_url':      public_chapter_url,
            'chapter_published_at_iso': chapter_published_at.isoformat() if chapter_published_at else '',
            'chapter_read_count':      chapter_read_count,
            'chapter_reaction_count':  chapter_reaction_count,
            'chapter_comment_count':   chapter_comment_count,
        })

    # Book-level subscriber count — real DB query against the active
    # subscriber table. No mockup numbers ever; if zero subscribers,
    # the template renders "0".
    book_subscribers_count = (
        EngagementSerialSubscriber.objects
        .filter(
            link_bookwriter_coll_book_id=current_book.bookwriter_coll_book_id,
            is_active=True,
            unsubscribed_at__isnull=True,
        )
        .count()
    )

    # Single dict the Publish-tab template reads — keeps the template
    # presentation-only and gives a stable contract for the section.
    book_publish_dashboard = {
        'total_chapter_count':            len(book_chapters_list),
        'live_chapter_count':             chapters_currently_live_count,
        'draft_chapter_count':            chapters_currently_draft_count,
        'empty_chapter_count':            chapters_empty_count,
        'publishable_draft_chapter_count': max(0, chapters_with_words_publishable_count - chapters_currently_live_count),
        'subscribers_count':              book_subscribers_count,
        'total_read_count':               book_total_read_count,
        'total_reaction_count':           book_total_reaction_count,
        'total_comment_count':            book_total_comment_count,
        'first_public_chapter_url':       book_3d_reader_canonical_url if has_at_least_one_published_chapter else '',
        'public_marketplace_url':         reverse('bookwriter:marketplace'),
        'publish_all_endpoint_url':       reverse(
            'bookwriter:api_book_publish_all',
            kwargs={'book_id': current_book.bookwriter_coll_book_id},
        ),
    }

    context = {
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
        'book_chapters_publish_status_list': book_chapters_publish_status_list,
        'book_publish_dashboard': book_publish_dashboard,
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
        'bookwriter_breadcrumb_trail': build_bookwriter_breadcrumb_trail(
            current_book=current_book,
            current_mode_label='Editing',
        ),
        'bookwriter_close_link_url': reverse('bookwriter:library'),
        'bookwriter_open_marketplace_url': reverse('bookwriter:marketplace'),
        'bookwriter_open_reader_url': build_book_reader_canonical_path(current_book),
        'bookwriter_open_feedback_url': reverse(
            'bookwriter:feedback', kwargs={'book_id': current_book.bookwriter_coll_book_id},
        ),
        'active_sidebar_nav_id': 'bookwriter',
    }

    return render(request, template_name, context)


def bookwriter_book_reader(request, book_id, book_name_slug=None):
    """3D leather-bound book reader — the canonical reading surface
    for both writers (preview their own draft) and public readers
    (anyone who knows the book id / slug).

    URL: /bookwriter/read/<book_id>/<book_name_slug>/

    Anonymous-friendly. Owner sees an Edit pencil + a Close-to-library
    link; non-owners see Close-to-marketplace, no edit pencil. All
    active chapters are rendered (drafts included) for the OWNER; for
    public viewers we still render every active chapter — same UX as
    a published novel — because the per-chapter publish flag gates
    Marketplace listing, not in-book reading. (If a writer wants a
    chapter strictly hidden, mark the chapter is_active=False or
    chapter_visibility_code='private' — that path is a future polish.)

    The book id alone makes the URL canonical; the slug is purely
    for SEO + shareability. If the URL hits this view WITHOUT a slug
    or with the wrong slug we 301-redirect to the canonical URL so
    search engines see one address per book.

    Each chapter's HTML is run through `strip_page_break_overlay_from_html`
    so legacy DB rows that captured the editor's page-break overlay
    (.bookwriter-page-break-overlay) don't leak page-number pills + the
    word "page break" into the rendered book — same protection the PDF
    export uses."""
    user_profile_id = get_user_profile_id(request)

    try:
        current_book = CollBook.objects.get(
            bookwriter_coll_book_id=book_id,
            is_active=True,
        )
    except CollBook.DoesNotExist:
        raise Http404('Book not found')

    is_viewer_owner = (
        user_profile_id is not None
        and current_book.link_owner_user_profile_id == user_profile_id
    )

    # Canonical SEO redirect. If the URL is missing the slug or has the
    # wrong slug, send a permanent 301 to the canonical URL so search
    # engines + shared links converge on one address.
    canonical_book_slug = build_book_reader_canonical_slug(current_book)
    if book_name_slug != canonical_book_slug:
        return redirect(
            reverse(
                'bookwriter:read',
                kwargs={
                    'book_id': current_book.bookwriter_coll_book_id,
                    'book_name_slug': canonical_book_slug,
                },
            ),
            permanent=True,
        )

    raw_chapter_rows = list(
        Chapter.objects
        .filter(
            link_bookwriter_coll_book_id=current_book.bookwriter_coll_book_id,
            is_active=True,
        )
        .order_by('sort_order', 'chapter_number')
    )

    # Per-chapter dict (lighter — used by TOC + as input to the
    # paginator + sheet-packer below). Body HTML is pre-cleaned of any
    # legacy editor page-break overlay markup so the paginator sees
    # only real prose blocks.
    book_chapters_for_reader = [
        {
            'chapter_id': chapter_row.bookwriter_chapter_id,
            'chapter_number': chapter_row.chapter_number,
            'chapter_title': (
                chapter_row.chapter_title_en
                or chapter_row.chapter_title_bn
                or ('Chapter %s' % chapter_row.chapter_number)
            ),
            'chapter_html': strip_page_break_overlay_from_html(
                chapter_row.chapter_text_html or ''
            ),
        }
        for chapter_row in raw_chapter_rows
    ]

    # Paginate every chapter into ~A4-sized page-faces, then pack them
    # onto book sheets (front + back). Each chapter starts a fresh
    # sheet so the title always lands on a clean page (book convention).
    # Single source of truth for pagination lives in views_api_helpers
    # so the same algorithm can drive future renderers (PDF, public
    # reader) without drift.
    chapters_with_pages_for_packing = [
        {
            'chapter_number': chapter_dict['chapter_number'],
            'chapter_title': chapter_dict['chapter_title'],
            'pages_html_list': paginate_chapter_html_into_pages(
                chapter_dict['chapter_html'],
            ),
        }
        for chapter_dict in book_chapters_for_reader
    ]
    book_reader_sheets_list = pack_chapter_pages_into_book_sheets(
        chapters_with_pages_for_packing,
    )

    # v950 — TOC page labels are NOT computed server-side anymore.
    # The server's word-count estimate of where each chapter starts
    # frequently disagrees with the client paginator's pixel-measured
    # layout (e.g. server says "Chapter 3 starts on page 5" but the
    # paginator places it on page 7). The reader's
    # _populateTocPageLabelsFromCurrentSheets() in page-book-reader.js
    # now writes the live folio into each
    # <span class="bookwriter-book-reader-toc-page"> by walking the
    # DOM at script init AND after every paginator rebuild — single
    # source of truth = whatever sheets are in the DOM right now.
    # The template renders the span empty until JS populates it (a
    # ~50ms gap on first paint, invisible in practice because the JS
    # runs synchronously at end of script load).

    book_title_for_display = (
        current_book.book_title_bn
        or current_book.book_title_en
        or 'Untitled Book'
    )
    book_subtitle_for_display = (
        current_book.book_subtitle_bn
        or current_book.book_subtitle_en
        or ''
    )
    # Author display: book's own author field first; for the owner's
    # own preview we fall back to their UserProfile display_name; for
    # anonymous + non-owner viewers we look up the BOOK OWNER's
    # display_name so the public reader always shows the right author.
    book_author_for_display = (
        current_book.book_author_display_bn
        or current_book.book_author_display_en
        or _resolve_viewer_display_name(current_book.link_owner_user_profile_id)
        or ''
    )

    saved_cover_design = (
        BookCoverDesign.objects
        .filter(
            link_bookwriter_coll_book_id=current_book.bookwriter_coll_book_id,
            is_active=True,
        )
        .first()
    )
    cover_palette = resolve_book_cover_palette(current_book, saved_cover_design)

    # Client-side paginator (browser measurement) reads this list to
    # re-paginate chapters using actual rendered heights — gives more
    # visually-accurate page splits than the server-side word-count
    # algorithm for chapters with images / unusual content. Both code
    # paths are kept; a JS toggle (ENABLE_CLIENT_SIDE_PAGINATION at
    # the top of page-book-reader.js) switches between them so we can
    # fall back to server pagination if the client paginator misbehaves.
    book_chapters_raw_html_for_client_pagination = [
        {
            'chapter_number': chapter_dict['chapter_number'],
            'chapter_title': chapter_dict['chapter_title'],
            'chapter_html': chapter_dict['chapter_html'],
        }
        for chapter_dict in book_chapters_for_reader
    ]

    # SEO + JSON-LD Book schema. Indexed for both anonymous + owner
    # views (the owner reader is the same surface — there's no
    # write-only data exposed). Tagged noindex when the book has
    # zero published chapters so the public-only consumer (Google /
    # Bing) doesn't surface a draft-only book to readers.
    json_ld_book_schema_payload = {
        '@context': 'https://schema.org',
        '@type': 'Book',
        'name':   book_title_for_display,
        'author': {
            '@type': 'Person',
            'name': book_author_for_display,
        } if book_author_for_display else None,
        'numberOfPages': len(book_reader_sheets_list) or None,
        'inLanguage': current_book.book_language_code or 'bn',
        'url': request.build_absolute_uri(),
    }

    # Multi-page TOC: chunk the chapter list into pages of N entries
    # so a long book ("Bangladesh July 2024 archive scale" — 100s to
    # 1000s of chapters) splits across multiple Contents sheets
    # ("Contents - I, II, III..."). The first chunk renders on the
    # frontispiece's back face (the existing TOC slot — preserves the
    # title-page → flip → contents experience). Additional chunks
    # render as their own dedicated TOC sheets immediately after the
    # frontispiece, before the chapter sheets.
    book_toc_pages = chunk_toc_chapters_into_pages(book_chapters_for_reader)

    return render(request, 'bookwriter/pages/book_reader.html', {
        'current_book': current_book,
        'book_title_for_display': book_title_for_display,
        'book_subtitle_for_display': book_subtitle_for_display,
        'book_author_for_display': book_author_for_display,
        'book_chapters_for_reader': book_chapters_for_reader,
        'book_toc_pages': book_toc_pages,
        'book_reader_sheets_list': book_reader_sheets_list,
        'book_chapters_raw_html_for_client_pagination':
            book_chapters_raw_html_for_client_pagination,
        'cover_main_hex': cover_palette['main'],
        'cover_dark_hex': cover_palette['dark'],
        'cover_gold_hex': cover_palette['gold'],
        'is_viewer_owner': is_viewer_owner,
        'bookwriter_breadcrumb_trail': build_bookwriter_breadcrumb_trail(
            current_book=current_book if is_viewer_owner else None,
            current_mode_label='Reading',
        ),
        # Owner: close goes to their library. Public viewer: close goes
        # back to the marketplace — never leaks the existence of an
        # owner-only library URL.
        'bookwriter_close_link_url': (
            reverse('bookwriter:library') if is_viewer_owner
            else reverse('bookwriter:marketplace')
        ),
        # Edit pencil only for the owner — non-owners can't edit.
        'bookwriter_open_editor_url': (
            reverse(
                'bookwriter:write',
                kwargs={'book_id': current_book.bookwriter_coll_book_id},
            ) if is_viewer_owner else ''
        ),
        'active_sidebar_nav_id': 'bookwriter',
        'seo': {
            'title': '%s &middot; কলম | আমলনামা নিউজ' % book_title_for_display,
            'description': (
                'Read %s by %s on কলম.' % (
                    book_title_for_display, book_author_for_display,
                )
                if book_author_for_display
                else 'Read %s on কলম.' % book_title_for_display
            ),
            'canonical': request.build_absolute_uri(),
            'og_type': 'book',
            'json_ld': json_ld_book_schema_payload,
            # Do not index draft-only books (no chapters published).
            'noindex': len(book_reader_sheets_list) == 0,
        },
    })


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
    """Legacy per-chapter public reader URL — now 301-redirects to the
    canonical 3D book reader of the parent book so we have ONE
    reading experience and shared chapter URLs don't 404.

    URL: /bookwriter/read/<slug>/

    Engagement features (subscribe / reactions / comments) that the
    old per-chapter reader carried get added back to the 3D reader
    as a follow-up — see notes/claude/app_documentation/app-bookwriter
    .txt for the migration plan.
    """
    try:
        release_row = (
            SerialRelease.objects
            .filter(
                public_chapter_slug=public_chapter_slug,
                is_active=True,
            )
            .values('link_bookwriter_coll_book_id')
            .first()
        )
    except Exception:  # noqa: BLE001 — never 500 a redirect path
        release_row = None
    if release_row is None:
        raise Http404('Chapter not found')

    try:
        owning_book = CollBook.objects.get(
            bookwriter_coll_book_id=release_row['link_bookwriter_coll_book_id'],
            is_active=True,
        )
    except CollBook.DoesNotExist:
        raise Http404('Book not found')

    return redirect(
        reverse(
            'bookwriter:read',
            kwargs={
                'book_id':         owning_book.bookwriter_coll_book_id,
                'book_name_slug':  _build_book_reader_canonical_slug(owning_book),
            },
        ),
        permanent=True,
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


# =====================================================================
# MARKETPLACE — public discovery surface for every book that has at
# least one published chapter. Read-only for everyone (including the
# owner — owners go to /bookwriter/write/<id>/edit/ to edit). Mirrors
# the My Library card aesthetic so the marketplace reads as part of
# the same product, not a different app.
# =====================================================================

def bookwriter_marketplace(request):
    """Public marketplace — every book with ≥1 published chapter.

    URL: /bookwriter/marketplace/  (public, no auth required)

    A book appears here when at least one of its chapters has an active
    SerialRelease row with serial_release_status_code='published'.
    Unpublishing the last published chapter automatically removes the
    book from this listing on the next page load (no separate
    moderation step required — the query is the source of truth).

    Card click → public chapter reader for the FIRST published chapter
    of the book (the natural starting point for a new reader).

    Style: reuses the .bookwriter-library-card visual + CSS class set
    so the marketplace feels native to the My Library aesthetic. The
    marketplace card partial is a slim variant — same cover/meta visual,
    no owner action buttons (edit / archive), card link points at the
    public reader instead of the owner's 3D reader.
    """
    # Books with at least one published chapter, plus their FIRST
    # (lowest sort_order) published chapter's slug for the card link.
    # One DB hop for the joined fields; cover designs prefetched after.
    published_release_rows = (
        SerialRelease.objects
        .filter(
            serial_release_status_code='published',
            is_active=True,
            public_chapter_slug__isnull=False,
        )
        .order_by(
            'link_bookwriter_coll_book_id',
            'published_at',
        )
        .values(
            'link_bookwriter_coll_book_id',
            'public_chapter_slug',
            'published_at',
        )
    )
    # Reduce to one entry per book — the earliest-published chapter is
    # the natural "open the book" landing point.
    first_release_by_book_id = {}
    for release_row in published_release_rows:
        book_id_value = release_row['link_bookwriter_coll_book_id']
        if book_id_value not in first_release_by_book_id:
            first_release_by_book_id[book_id_value] = release_row

    if not first_release_by_book_id:
        marketplace_books_list = []
    else:
        published_book_ids_list = list(first_release_by_book_id.keys())
        published_books_list = list(
            CollBook.objects
            .filter(
                bookwriter_coll_book_id__in=published_book_ids_list,
                is_active=True,
            )
            .order_by('-updated_at', '-created_at')
        )
        cover_designs_by_book_id = prefetch_book_cover_designs(published_books_list)
        marketplace_books_list = []
        for published_book in published_books_list:
            saved_cover_design = cover_designs_by_book_id.get(
                published_book.bookwriter_coll_book_id,
            )
            book_card_payload = build_book_card_payload(
                published_book,
                saved_cover_design,
                _resolve_viewer_display_name(
                    published_book.link_owner_user_profile_id
                ),
            )
            # Marketplace card click → 3D book reader (the canonical
            # public reading surface). Same URL shared by every entry-
            # point: library card, marketplace card, promo card,
            # inkwell breadcrumb pill, publish dashboard. Single
            # source of truth lives in
            # views_api_helpers.build_book_reader_canonical_path
            # (already invoked inside build_book_card_payload above
            # and exposed as `book_reader_canonical_url`).
            book_card_payload['public_chapter_url'] = request.build_absolute_uri(
                book_card_payload['book_reader_canonical_url']
            )
            marketplace_books_list.append(book_card_payload)

    # JSON-LD — a CollectionPage listing every published book as a
    # CreativeWork. Helps search engines + AI crawlers (Google, Gemini,
    # Perplexity, ChatGPT) understand this as a book directory.
    json_ld_payload = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': 'Bookwriter Marketplace — কলম',
        'description': (
            'Every book published through কলম — Bangladesh-and-beyond '
            'writers sharing fiction, non-fiction, poetry, and serialised '
            'works for free public reading.'
        ),
        'url': request.build_absolute_uri(),
        'hasPart': [
            {
                '@type': 'CreativeWork',
                'name': card_payload['book_title'],
                'author': {
                    '@type': 'Person',
                    'name': card_payload['book_author'],
                } if card_payload.get('book_author') else None,
                'url': card_payload['public_chapter_url'],
            }
            for card_payload in marketplace_books_list[:50]
        ],
    }

    return render(request, 'bookwriter/pages/marketplace.html', {
        'marketplace_books_list': marketplace_books_list,
        'marketplace_total_book_count': len(marketplace_books_list),
        'bookwriter_breadcrumb_trail': build_bookwriter_breadcrumb_trail(
            current_mode_label='Marketplace',
        ),
        'active_sidebar_nav_id': 'bookwriter',
        'seo': {
            'title': 'Marketplace — Public Books on কলম | আমলনামা নিউজ',
            'description': (
                'Read every book published through কলম — Bangladeshi '
                'writers sharing fiction, non-fiction, poetry, and '
                'serialised works for free.'
            ),
            'canonical': request.build_absolute_uri(),
            'og_type': 'website',
            'json_ld': json_ld_payload,
        },
    })


# =====================================================================
# READER-FEEDBACK ADMIN — owner-only review surface for every beta
# comment + suggestion left on a book. Sits at
#   /bookwriter/write/<book_id>/feedback/
# alongside the inkwell editor at /bookwriter/write/<book_id>/edit/.
# Lists comments grouped by chapter, with All / Open / Resolved / By
# reader filter chips and one-click resolve toggling. Wires to the
# already-shipped api_bookwriter_beta_comment_resolve endpoint.
# =====================================================================

def bookwriter_inkwell_feedback(request, book_id):
    """Reader-feedback admin sub-page for ONE specific book.

    URL: /bookwriter/write/<book_id>/feedback/  (owner-only)

    Lists every BetaComment row attached to the book, grouped by
    chapter, ordered most-recent-first. Each row shows the author
    avatar, anchored excerpt (the snippet the reader was reading
    when they left the note), the comment text, kind (general /
    suggestion), and a resolve-toggle button (calls existing
    api_bookwriter_beta_comment_resolve). Filter chips: All / Open /
    Resolved / By reader (chips populated from BetaReader rows for
    this book). Reuses _resolve_book_for_owner so non-owners get a
    JSON 404 / forbidden, never the page.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return redirect('user_account:login')

    try:
        current_book = CollBook.objects.get(
            bookwriter_coll_book_id=book_id,
            link_owner_user_profile_id=user_profile_id,
            is_active=True,
        )
    except CollBook.DoesNotExist:
        raise Http404('Book not found')

    # Chapters in display order — a beta comment with a missing chapter
    # row (legacy / hard-deleted) is skipped silently.
    book_chapters_for_feedback = list(
        Chapter.objects
        .filter(
            link_bookwriter_coll_book_id=current_book.bookwriter_coll_book_id,
            is_active=True,
        )
        .order_by('sort_order', 'chapter_number')
        .values(
            'bookwriter_chapter_id',
            'chapter_number',
            'chapter_title_en',
            'chapter_title_bn',
        )
    )
    chapter_id_to_label = {
        chapter_row['bookwriter_chapter_id']: {
            'chapter_number':        chapter_row['chapter_number'],
            'chapter_display_title': (
                chapter_row['chapter_title_en']
                or chapter_row['chapter_title_bn']
                or ('Chapter %s' % chapter_row['chapter_number'])
            ),
        }
        for chapter_row in book_chapters_for_feedback
    }

    # Beta readers attached to this book — used by both the per-comment
    # avatar lookup AND the "By reader" filter chip set.
    beta_readers_list = list(
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
            'reader_avatar_color_hex',
            'beta_permission_code',
        )
    )
    beta_reader_lookup_by_id = {
        reader_row['bookwriter_beta_reader_id']: reader_row
        for reader_row in beta_readers_list
    }

    # Beta comments — the heart of this page.
    beta_comments_for_book = list(
        BetaComment.objects
        .filter(
            link_bookwriter_chapter_id__in=list(chapter_id_to_label.keys()),
            is_active=True,
        )
        .order_by('-created_at')
        .values(
            'bookwriter_beta_comment_id',
            'link_bookwriter_chapter_id',
            'link_bookwriter_beta_reader_id',
            'comment_anchor_text',
            'comment_text',
            'comment_kind_code',
            'suggestion_replacement_text',
            'suggestion_resolution_code',
            'is_resolved',
            'created_at',
        )
    )

    # Group + decorate for the template (one source of truth — view
    # builds the shape, template iterates).
    comment_rows_decorated = []
    for raw_comment_row in beta_comments_for_book:
        chapter_label = chapter_id_to_label.get(
            raw_comment_row['link_bookwriter_chapter_id']
        ) or {'chapter_number': '?', 'chapter_display_title': 'Untitled'}
        reader_row = beta_reader_lookup_by_id.get(
            raw_comment_row['link_bookwriter_beta_reader_id']
        ) or {}
        comment_rows_decorated.append({
            'beta_comment_id':            raw_comment_row['bookwriter_beta_comment_id'],
            'beta_reader_id':             raw_comment_row['link_bookwriter_beta_reader_id'],
            'chapter_id':                 raw_comment_row['link_bookwriter_chapter_id'],
            'chapter_number':             chapter_label['chapter_number'],
            'chapter_display_title':      chapter_label['chapter_display_title'],
            'comment_anchor_text':        raw_comment_row['comment_anchor_text'] or '',
            'comment_text':               raw_comment_row['comment_text'] or '',
            'comment_kind_code':          raw_comment_row['comment_kind_code'] or 'general',
            'suggestion_replacement_text':raw_comment_row['suggestion_replacement_text'] or '',
            'suggestion_resolution_code': raw_comment_row['suggestion_resolution_code'] or '',
            'is_resolved':                bool(raw_comment_row['is_resolved']),
            'created_at_iso':             (
                raw_comment_row['created_at'].isoformat()
                if raw_comment_row['created_at'] else ''
            ),
            'reader_display_name':        reader_row.get('reader_display_name')
                                          or reader_row.get('reader_email')
                                          or 'Beta reader',
            'reader_avatar_initial':      reader_row.get('reader_avatar_initial') or '?',
            'reader_avatar_color_hex':    reader_row.get('reader_avatar_color_hex') or '#7a6f5e',
            'beta_permission_code':       reader_row.get('beta_permission_code') or 'read',
        })

    open_comment_count = sum(
        1 for comment in comment_rows_decorated if not comment['is_resolved']
    )
    resolved_comment_count = sum(
        1 for comment in comment_rows_decorated if comment['is_resolved']
    )

    return render(request, 'bookwriter/pages/inkwell_feedback.html', {
        'current_book': current_book,
        'book_id': current_book.bookwriter_coll_book_id,
        'beta_comment_rows_list': comment_rows_decorated,
        'beta_readers_filter_list': beta_readers_list,
        'open_comment_count': open_comment_count,
        'resolved_comment_count': resolved_comment_count,
        'total_comment_count': len(comment_rows_decorated),
        'bookwriter_breadcrumb_trail': build_bookwriter_breadcrumb_trail(
            current_book=current_book,
            current_mode_label='Reader feedback',
        ),
        'bookwriter_open_editor_url': reverse(
            'bookwriter:write',
            kwargs={'book_id': current_book.bookwriter_coll_book_id},
        ),
        'active_sidebar_nav_id': 'bookwriter',
        'seo': {
            'title': 'Reader feedback — কলম | আমলনামা নিউজ',
            'description': 'Review beta-reader comments and suggestions for your book.',
            'canonical': request.build_absolute_uri(),
            'noindex': True,
        },
    })

"""bookwriter views — কলম writing sanctuary."""

from django.conf import settings
from django.shortcuts import render
from django.utils import timezone

from amolnama_news.site_apps.core.utils import get_user_profile_id

from .models import Chapter, CollBook


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
        context.update({
            'current_book': current_book,
            'active_chapter_id': active_chapter.bookwriter_chapter_id,
            'active_chapter_html': active_chapter.chapter_text_html or '',
            'active_chapter_title': (
                active_chapter.chapter_title_en
                or active_chapter.chapter_title_bn
                or 'Untitled'
            ),
            'book_chapters_list': book_chapters_list,
        })

    return render(request, template_name, context)

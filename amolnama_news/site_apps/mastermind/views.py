"""Mastermind views — public certificate verify + multiplayer player join page.

Mastermind is mostly a backend engine, but two surfaces live here:
  - certificate_public_view  — share link for verifying issued certificates
  - lobby_player_page        — /play/<join_code>/  player join + game UI
"""
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponse
from django.shortcuts import render
from django.views.decorators.cache import cache_control
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET


@require_GET
@cache_control(max_age=60)
def certificate_public_view(request, certificate_serial):
    """Render the rich-HTML certificate identified by its public serial.

    No authentication — the serial is unforgeable (32 URL-safe chars from
    secrets.token_urlsafe). Anyone with the link can verify.
    """
    from .certificates import render_certificate_html
    from .models import CollCertificate

    certificate = CollCertificate.objects.filter(
        certificate_serial=certificate_serial, is_active=True,
    ).first()
    if not certificate:
        raise Http404('Certificate not found or revoked.')

    rendered_html = render_certificate_html(certificate, request=request)
    if not rendered_html:
        raise Http404('Certificate template missing.')

    return HttpResponse(rendered_html, content_type='text/html; charset=utf-8')


@login_required
@ensure_csrf_cookie
def lobby_player_page(request, join_code):
    """Player-side multiplayer page — render shell + bootstrap state.

    The actual quiz flow runs over WebSocket. This view just hydrates the
    page with the lobby's metadata so the JS can connect immediately. The
    template uses {{ lobby_state|json_script:... }} which auto-escapes
    HTML-unsafe sequences in user-controlled fields like display_name.
    """
    from .lobby import get_lobby_state
    state = get_lobby_state(join_code)
    if 'error' in state:
        raise Http404('Lobby not found or closed.')
    return render(request, 'mastermind/pages/lobby_player.html', {
        'lobby_state': _stringify_dates(state),
        'join_code': join_code.upper(),
        'seo': {
            'title': f"{state.get('quiz_title_bn') or 'Live quiz'} — Live game",
            'description': 'Live multiplayer quiz on Amolnama Mastermind.',
        },
    })


def _stringify_dates(payload):
    """Walk a dict/list payload, ISO-format any datetime/date/decimal so json_script can serialize."""
    import datetime, decimal
    if isinstance(payload, dict):
        return {key: _stringify_dates(value) for key, value in payload.items()}
    if isinstance(payload, list):
        return [_stringify_dates(item) for item in payload]
    if isinstance(payload, (datetime.datetime, datetime.date)):
        return payload.isoformat()
    if isinstance(payload, decimal.Decimal):
        return float(payload)
    return payload


@require_GET
def book_reader_page(request, book_id, book_slug=None):
    """Public reader for status='published' books — paginated chapter view.

    No authentication required (the book is public). 404 on unpublished
    or archived books. The slug is for SEO + readability; we don't enforce
    a redirect on slug mismatch (just render the canonical book id).
    """
    from .book_editor import get_chapter_with_text, list_chapters_for_book
    from .models import CollBook

    book = CollBook.objects.filter(
        mastermind_coll_book_id=int(book_id),
        book_status_code='published',
        is_active=True,
    ).first()
    if not book:
        raise Http404('Book not found or not published.')

    chapters = list_chapters_for_book(book.mastermind_coll_book_id)
    # Render the FIRST chapter on initial load; client-side JS swaps in others
    # via /api/book/<id>/chapter/<id>/get-text/ (lazy fetch keeps initial paint fast).
    first_chapter_text = None
    if chapters:
        first_chapter_payload = get_chapter_with_text(chapters[0]['mastermind_coll_book_chapter_id'])
        if 'error' not in first_chapter_payload:
            first_chapter_text = first_chapter_payload.get('chapter_text')

    return render(request, 'mastermind/pages/book_reader.html', {
        'book': book,
        'chapters': chapters,
        'first_chapter_id': chapters[0]['mastermind_coll_book_chapter_id'] if chapters else None,
        'first_chapter_text': first_chapter_text,
        'seo': {
            'title': f'{book.book_title_bn} — Mastermind Library',
            'description': (book.book_description or book.book_title_bn)[:200],
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'গ্রন্থাগার', 'url': None},
                {'name': book.book_title_bn, 'url': None},
            ],
        },
    })

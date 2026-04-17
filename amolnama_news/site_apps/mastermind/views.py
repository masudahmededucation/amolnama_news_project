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

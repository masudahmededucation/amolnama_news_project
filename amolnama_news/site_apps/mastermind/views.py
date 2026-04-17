"""Mastermind views — public certificate verify page only.

Mastermind is a backend engine — no other public pages live here.
The certificate page is the one exception: it's a public-by-design
verification URL so anyone can check that a certificate is real.
"""
from django.http import Http404, HttpResponse
from django.views.decorators.cache import cache_control
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

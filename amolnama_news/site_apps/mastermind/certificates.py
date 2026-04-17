"""Mastermind certificates — auto-issue + render + verify.

When a student passes a quiz that has exam_certificate_template_html set,
issue_certificate_for_session() creates one CollCertificate row with a
unique unforgeable serial. Public verification URL:

    /mastermind/certificate/<serial>/

The HTML template can include placeholder tokens that get substituted at
render time:

    {{recipient_name}}      → user's display name
    {{quiz_title}}          → quiz exam_title_bn (or _en if no _bn)
    {{score_percentage}}    → e.g. "85.5%"
    {{issued_date}}         → e.g. "2026-04-17"
    {{certificate_serial}}  → the public serial id
    {{verification_url}}    → absolute URL to the public verify page

Print-to-PDF is browser-native — the HTML template uses CSS @media print and
the user clicks the page's "Print certificate" button → File → Save as PDF.
No server-side PDF library required (in-house, free, zero deps).
"""
import logging
import secrets

from django.utils import timezone

logger = logging.getLogger(__name__)

CERTIFICATE_SERIAL_BYTES = 24  # → 32 URL-safe chars


def issue_certificate_for_session(session):
    """If the session passed AND the quiz has a certificate template, issue one.

    Idempotent — does nothing if a certificate already exists for this session.
    Returns the CollCertificate instance (new or pre-existing) or None.
    """
    from .models import CollQuiz, CollCertificate

    if session is None:
        return None
    if session.session_is_passed is not True:
        return None

    existing = CollCertificate.objects.filter(
        link_mastermind_coll_quiz_session_id=session.mastermind_coll_quiz_session_id,
        is_active=True,
    ).first()
    if existing:
        return existing

    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=session.link_mastermind_coll_quiz_id).first()
    if not quiz or not (quiz.exam_certificate_template_html or '').strip():
        return None

    recipient_name = _resolve_recipient_display_name(session.link_user_profile_id)
    serial = _generate_unique_serial()

    certificate = CollCertificate.objects.create(
        certificate_serial=serial,
        link_mastermind_coll_quiz_id=quiz.mastermind_coll_quiz_id,
        link_mastermind_coll_quiz_session_id=session.mastermind_coll_quiz_session_id,
        link_user_profile_id=session.link_user_profile_id,
        certificate_recipient_name=recipient_name,
        certificate_score_percentage=session.session_score_percentage,
        certificate_issued_at=timezone.now(),
    )
    return certificate


def render_certificate_html(certificate, request=None):
    """Substitute template tokens in the quiz's exam_certificate_template_html.

    Returns the final HTML string ready for direct render (or None if the
    certificate / template is missing).
    """
    from .models import CollQuiz

    if certificate is None or not certificate.is_active:
        return None
    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=certificate.link_mastermind_coll_quiz_id).first()
    if not quiz:
        return None
    template = (quiz.exam_certificate_template_html or '').strip()
    if not template:
        return None

    quiz_title = quiz.exam_title_bn or quiz.exam_title_en or f'Quiz #{quiz.mastermind_coll_quiz_id}'
    issued_date = (
        certificate.certificate_issued_at.strftime('%Y-%m-%d')
        if certificate.certificate_issued_at else ''
    )
    score_text = (
        f'{float(certificate.certificate_score_percentage):.1f}%'
        if certificate.certificate_score_percentage is not None else ''
    )
    verification_url = ''
    if request is not None:
        verification_url = request.build_absolute_uri(
            f'/mastermind/certificate/{certificate.certificate_serial}/'
        )

    substitutions = {
        '{{recipient_name}}': certificate.certificate_recipient_name or '',
        '{{quiz_title}}': quiz_title,
        '{{score_percentage}}': score_text,
        '{{issued_date}}': issued_date,
        '{{certificate_serial}}': certificate.certificate_serial,
        '{{verification_url}}': verification_url,
    }
    rendered = template
    for placeholder, value in substitutions.items():
        rendered = rendered.replace(placeholder, value)
    return rendered


def _resolve_recipient_display_name(user_profile_id):
    if not user_profile_id:
        return None
    try:
        from amolnama_news.site_apps.user_account.models import UserProfile
        profile = UserProfile.objects.filter(user_profile_id=user_profile_id).first()
        if profile:
            return profile.display_name or None
    except Exception:
        logger.exception('Recipient name lookup failed for user_profile_id=%s', user_profile_id)
    return None


def _generate_unique_serial():
    """Random URL-safe serial; retry until unique (collision odds are astronomical)."""
    from .models import CollCertificate
    for _ in range(8):
        candidate = secrets.token_urlsafe(CERTIFICATE_SERIAL_BYTES)[:40]
        if not CollCertificate.objects.filter(certificate_serial=candidate).exists():
            return candidate
    raise RuntimeError('Unable to generate a unique certificate serial after 8 retries.')

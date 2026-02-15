import hashlib
import random
import string

from .models import DigitalBallot, DigitalBallotRegistryBook


def generate_receipt_code():
    """Generate unique ballot receipt code in format XXXXX-NNNNN."""
    for _ in range(100):
        letters = ''.join(random.choices(string.ascii_uppercase, k=5))
        digits = ''.join(random.choices(string.digits, k=5))
        code = f"{letters}-{digits}"
        if not DigitalBallot.objects.filter(
            ballot_voter_audit_receipt_code=code
        ).exists():
            return code
    raise RuntimeError("Failed to generate unique receipt code")


def compute_identity_anchor_hash(user_auth_provider_key):
    """SHA-256 hash of user_auth_provider_key, returned as bytes."""
    return hashlib.sha256(user_auth_provider_key.encode('utf-8')).digest()


def get_client_ip(request):
    """Extract client IP, respecting X-Forwarded-For behind a proxy."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()[:45]
    return (request.META.get("REMOTE_ADDR") or "")[:45]


def validate_pre_cast(request, election_evaluation_id):
    """Validate user eligibility before casting a vote.

    Returns (user_profile, errors) tuple.
    errors is a list; empty means validation passed.
    """
    from amolnama_news.site_apps.user_account.models import UserProfile, UserSession

    errors = []

    # 1. Get UserProfile
    try:
        profile = UserProfile.objects.get(
            link_user_account_user_id=request.user.pk
        )
    except UserProfile.DoesNotExist:
        return None, ["User profile not found."]

    # 2. Check active session risk
    active_session = UserSession.objects.filter(
        link_user_profile_id=profile.user_profile_id,
        is_authenticated_session=True,
        ended_at__isnull=True,
    ).order_by('-started_at').first()

    if active_session:
        if active_session.is_vpn_suspected:
            errors.append("VPN detected. Voting not allowed over VPN.")
        if active_session.risk_score and active_session.risk_score > 70:
            errors.append("Session risk score too high.")

    # 3. Double-vote prevention
    already_voted = DigitalBallotRegistryBook.objects.filter(
        link_election_evaluation_id=election_evaluation_id,
        link_user_profile_id=profile.user_profile_id,
    ).exists()

    if already_voted:
        errors.append("You have already voted in this election.")

    return profile, errors

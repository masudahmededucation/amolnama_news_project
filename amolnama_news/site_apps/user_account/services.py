"""
User account services — user creation, group assignment, auth tracking.
"""
import hashlib
import logging

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone

logger = logging.getLogger(__name__)

User = get_user_model()

# Standard group names used across the project
GROUP_VISITOR = "Visitor"
GROUP_STAFF = "Staff"
GROUP_JOURNALIST = "Journalist"
GROUP_MODERATOR = "Moderator"

# Groups that public self-registration is allowed to assign
SELF_REGISTRATION_GROUPS = {GROUP_VISITOR}


def assign_user_to_group(user, group_name: str):
    """Add user to a Django Group (creates the Group if it does not exist)."""
    group, _ = Group.objects.get_or_create(name=group_name)
    user.groups.add(group)


def _get_auth_method_type_id(method_code: str) -> int:
    """Look up the PK for an auth method type code (e.g. 'email', 'phone')."""
    from .models import RefUserAuthMethodType
    obj = RefUserAuthMethodType.objects.filter(
        auth_method_type=method_code, is_active=True,
    ).first()
    if obj is None:
        raise ValueError(f"No active auth method type for '{method_code}'.")
    return obj.user_auth_method_type_id


def register_user(
    email: str,
    password: str,
    group_name: str = GROUP_VISITOR,
):
    """Create a new user and assign to the given group.

    Names are stored in [person].[person], not on the User model.
    """
    if group_name not in SELF_REGISTRATION_GROUPS:
        raise ValueError(
            f"Self-registration is not allowed for group '{group_name}'."
        )
    clean_email = (email or "").strip().lower()
    user = User.objects.create_user(
        email=clean_email,
        password=password,
        link_user_auth_method_type_id=_get_auth_method_type_id(AUTH_METHOD_EMAIL),
        user_auth_provider_key=clean_email,
    )
    assign_user_to_group(user, group_name)
    return user


def normalize_phone(phone: str) -> str:
    """Normalize a phone number: strip spaces and dashes."""
    phone = phone.strip().replace("-", "").replace(" ", "")
    return phone


def register_user_by_phone(phone: str, password: str = None):
    """Create a user from a verified phone number with optional password."""
    phone = normalize_phone(phone)
    sanitized = phone.lstrip("+").replace("-", "")
    email = f"phone_{sanitized}@amolnamanews.com"
    user = User.objects.create_user(
        email=email,
        password=password,
        link_user_auth_method_type_id=_get_auth_method_type_id(AUTH_METHOD_PHONE),
        user_auth_provider_key=phone,
    )
    assign_user_to_group(user, GROUP_VISITOR)
    return user


def authenticate_user(request, email: str, password: str):
    """Authenticate by email and password."""
    return authenticate(
        request, username=(email or "").strip().lower(), password=password,
    )


def authenticate_user_by_phone(request, phone: str, password: str):
    """Authenticate by phone number and password.

    Uses Django's authenticate() so django-axes can track attempts.
    """
    phone = normalize_phone(phone)
    try:
        user = User.objects.get(user_auth_provider_key=phone)
    except User.DoesNotExist:
        return None
    # Route through authenticate() for axes tracking
    return authenticate(request, username=user.email, password=password)


# ── Auth-method constants ─────────────────────────────────────────

AUTH_METHOD_EMAIL = "email"
AUTH_METHOD_PHONE = "phone"
AUTH_METHOD_GOOGLE = "google"
AUTH_METHOD_FACEBOOK = "facebook"
AUTH_METHOD_APPLE = "apple"
AUTH_METHOD_GITHUB = "github"

_SOCIAL_METHODS = {
    AUTH_METHOD_GOOGLE, AUTH_METHOD_FACEBOOK,
    AUTH_METHOD_APPLE, AUTH_METHOD_GITHUB,
}


# ── Request helpers ───────────────────────────────────────────────

def _get_client_ip(request):
    """Extract client IP, respecting X-Forwarded-For behind a proxy."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()[:45]
    return (request.META.get("REMOTE_ADDR") or "")[:45]


def _parse_user_agent(ua_string):
    """Return (browser, platform, category) from a User-Agent string."""
    ua = (ua_string or "").lower()

    # Browser
    if "edg/" in ua or "edga/" in ua or "edgios/" in ua:
        browser = "Edge"
    elif "opr/" in ua or "opera" in ua:
        browser = "Opera"
    elif "chrome" in ua and "safari" in ua:
        browser = "Chrome"
    elif "firefox" in ua or "fxios" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "msie" in ua or "trident" in ua:
        browser = "Internet Explorer"
    else:
        browser = "Other"

    # Platform
    if "windows" in ua:
        platform = "Windows"
    elif "macintosh" in ua or "mac os" in ua:
        platform = "macOS"
    elif "iphone" in ua or "ipad" in ua:
        platform = "iOS"
    elif "android" in ua:
        platform = "Android"
    elif "linux" in ua:
        platform = "Linux"
    elif "cros" in ua:
        platform = "ChromeOS"
    else:
        platform = "Other"

    # Device category
    if "mobi" in ua or "iphone" in ua:
        category = "Mobile"
    elif "tablet" in ua or "ipad" in ua:
        category = "Tablet"
    else:
        category = "Desktop"

    return browser, platform, category


def _build_device_fingerprint(ip, ua_string):
    """MD5 hash of IP + User-Agent → 32-char hex fingerprint."""
    raw = f"{ip}|{ua_string or ''}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def _infer_auth_method(request, user):
    """Best-effort inference when auth_method is not explicitly tagged."""
    method = getattr(request, "_auth_method", None)
    if method:
        return method

    sociallogin = getattr(request, "sociallogin", None)
    if sociallogin and hasattr(sociallogin, "account"):
        return sociallogin.account.provider

    if (user.email
            and user.email.startswith("phone_")
            and user.email.endswith("@amolnamanews.com")):
        return AUTH_METHOD_PHONE

    return AUTH_METHOD_EMAIL


# ── Core tracking function ────────────────────────────────────────

def track_auth_event(request, user, auth_method=None):
    """Record device, profile, and session data for a login/signup event.

    Each ORM step is wrapped in try/except so a tracking failure
    never blocks the login itself.
    """
    from .models import (
        Email, Person, Phone, UserDevice, UserProfile, UserSession,
    )

    now = timezone.now()
    ip_address = _get_client_ip(request)
    ua_string = request.META.get("HTTP_USER_AGENT", "")
    browser, platform, category = _parse_user_agent(ua_string)
    fingerprint = _build_device_fingerprint(ip_address, ua_string)

    if auth_method is None:
        auth_method = _infer_auth_method(request, user)

    # ── UserDevice ────────────────────────────────────────────
    device = None
    try:
        device, created = UserDevice.objects.get_or_create(
            hash_device_fingerprint=fingerprint,
            defaults={
                "app_platform_name": platform,
                "device_category": category,
                "last_ip_address": ip_address,
                "browser_name": browser,
                "first_seen_at": now,
                "last_seen_at": now,
                "created_at": now,
                "updated_at": now,
            },
        )
        if not created:
            device.last_ip_address = ip_address
            device.last_seen_at = now
            device.browser_name = browser
            device.updated_at = now
            device.save(update_fields=[
                "last_ip_address", "last_seen_at",
                "browser_name", "updated_at",
            ])
    except Exception:
        logger.exception("track_auth_event: UserDevice upsert failed")

    # ── UserProfile ───────────────────────────────────────────
    profile = None
    try:
        profile, created = UserProfile.objects.get_or_create(
            link_user_account_user_id=user.pk,
            defaults={
                "display_name": user.email,
                "last_login_at": now,
                "created_at": now,
                "updated_at": now,
            },
        )
        if not created:
            profile.last_login_at = now
            profile.updated_at = now
            profile.save(update_fields=["last_login_at", "updated_at"])
    except Exception:
        logger.exception("track_auth_event: UserProfile upsert failed")

    # ── Person (auto-create if missing) ──────────────────────
    if profile and not profile.link_person_id:
        try:
            email = user.email or ""
            is_synthetic = (
                email.startswith("phone_")
                and email.endswith("@amolnamanews.com")
            )
            real_email = email if (email and not is_synthetic) else None
            # Phone is stored in user_auth_provider_key for phone-registered users
            phone = (
                user.user_auth_provider_key
                if auth_method == AUTH_METHOD_PHONE
                else None
            )

            # first_name_en is NOT NULL in SQL Server — use email
            # local part or phone as fallback.
            fallback_name = (
                real_email.split("@")[0] if real_email
                else phone or "Unknown"
            )

            person = Person.objects.create(
                first_name_en=fallback_name,
                last_name_en="",
                primary_email_address=real_email,
                primary_mobile_number=phone,
                is_active=True,
                created_at=now,
                modified_at=now,
            )
            profile.link_person_id = person.person_id
            profile.updated_at = now
            profile.save(update_fields=["link_person_id", "updated_at"])
        except Exception:
            logger.exception("track_auth_event: Person auto-create failed")

    # ── UserSession ───────────────────────────────────────────
    try:
        UserSession.objects.create(
            link_user_profile_id=profile.user_profile_id if profile else None,
            link_user_device_id=device.user_device_id if device else None,
            session_ip_address=ip_address,
            is_authenticated_session=True,
            started_at=now,
            created_at=now,
            updated_at=now,
        )
    except Exception:
        logger.exception("track_auth_event: UserSession create failed")

    # ── Phone / Email records ────────────────────────────────
    person_id = profile.link_person_id if profile else None
    if person_id:
        # Phone record (from user_auth_provider_key for phone users)
        full_phone = (
            user.user_auth_provider_key
            if auth_method == AUTH_METHOD_PHONE
            else None
        )
        if full_phone:
            try:
                # Split into country code + local number
                country_code = "+880"
                local_number = full_phone
                if full_phone.startswith("+"):
                    # Try common BD prefix first, then generic split
                    if full_phone.startswith("+880"):
                        country_code = "+880"
                        local_number = full_phone[4:]
                    else:
                        # Generic: assume 1-4 digit country code
                        country_code = full_phone[:4]
                        local_number = full_phone[4:]

                Phone.objects.get_or_create(
                    link_person_id=person_id,
                    phone_number=local_number,
                    defaults={
                        "country_calling_code": country_code,
                        "is_primary": True,
                    },
                )
            except Exception:
                logger.exception("track_auth_event: Phone upsert failed")

        # Email record (skip synthetic phone_*@amolnamanews.com)
        email = user.email or ""
        is_synthetic = (
            email.startswith("phone_") and email.endswith("@amolnamanews.com")
        )
        if email and not is_synthetic:
            try:
                Email.objects.get_or_create(
                    link_person_id=person_id,
                    email_address=email,
                    defaults={
                        "is_primary": True,
                        "is_verified": (auth_method == AUTH_METHOD_EMAIL),
                    },
                )
            except Exception:
                logger.exception("track_auth_event: Email upsert failed")

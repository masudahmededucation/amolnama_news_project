"""Template context processors for user_account."""


def user_display_name(request):
    """Inject ``user_display_name`` into every template context.

    Uses UserProfile.display_name (populated on signup/login/profile save).
    Falls back to the user's email address.
    """
    if not hasattr(request, "user") or not request.user.is_authenticated:
        return {}

    # Avoid repeated DB hits within the same request
    if not hasattr(request, "_cached_display_name"):
        from .models import UserProfile

        name = None
        try:
            profile = UserProfile.objects.only("display_name").get(
                link_user_account_user_id=request.user.pk,
            )
            name = profile.display_name
        except UserProfile.DoesNotExist:
            pass
        request._cached_display_name = name or request.user.email

    return {"user_display_name": request._cached_display_name}

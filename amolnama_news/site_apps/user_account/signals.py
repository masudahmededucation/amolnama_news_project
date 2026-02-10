import logging

from django.contrib.auth.signals import user_logged_in
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import User, UserProfile

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def create_user_profile_on_register(sender, instance: User, created: bool, **kwargs):
    """Auto-create a UserProfile row linked to the new User."""
    if created:
        from django.utils import timezone

        UserProfile.objects.get_or_create(
            link_user_account_user_id=instance.pk,
            defaults={
                "display_name": instance.email,
                "created_at": timezone.now(),
                "updated_at": timezone.now(),
            },
        )


@receiver(user_logged_in)
def on_user_logged_in(sender, request, user, **kwargs):
    """Track device, profile, and session on every login event."""
    try:
        from .services import track_auth_event

        track_auth_event(request, user)
    except Exception:
        logger.exception("on_user_logged_in: track_auth_event failed")

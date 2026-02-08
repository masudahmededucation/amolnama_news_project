from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, UserProfile


@receiver(post_save, sender=User)
def create_user_profile_on_register(sender, instance: User, created: bool, **kwargs):
    """Auto-create a UserProfile row when a new User is registered."""
    if created:
        UserProfile.objects.create(display_name=instance.email)

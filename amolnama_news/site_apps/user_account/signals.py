from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, Profile

@receiver(post_save, sender=User)
def create_profile_on_user_create(sender, instance: User, created: bool, **kwargs):
    if created:
        Profile.objects.create(user=instance)

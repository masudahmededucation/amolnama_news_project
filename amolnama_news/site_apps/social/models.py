from django.db import models
from django.utils import timezone


class UserFollow(models.Model):
    social_user_follow_id = models.BigAutoField(primary_key=True)
    link_follower_user_profile_id = models.BigIntegerField()
    link_following_user_profile_id = models.BigIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[social].[user_follow]'

    def __str__(self):
        return f'{self.link_follower_user_profile_id} → {self.link_following_user_profile_id}'


class CollUserBlock(models.Model):
    """User blocks another user — hides their content from feed."""
    social_coll_user_block_id = models.BigAutoField(primary_key=True)
    link_blocker_user_profile_id = models.BigIntegerField()
    link_blocked_user_profile_id = models.BigIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[social].[coll_user_block]'


class CollUserList(models.Model):
    """User-created list/circle — group of users for filtered feed."""
    social_coll_user_list_id = models.BigAutoField(primary_key=True)
    link_owner_user_profile_id = models.BigIntegerField()
    list_name = models.CharField(max_length=100)
    list_description = models.CharField(max_length=300, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[social].[coll_user_list]'


class CollUserListMember(models.Model):
    """Member of a user list."""
    social_coll_user_list_member_id = models.BigAutoField(primary_key=True)
    link_list_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[social].[coll_user_list_member]'

from __future__ import annotations

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import PermissionDenied
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower


phone_validator = RegexValidator(
    regex=r"^\+?[0-9]{7,15}$",
    message="Phone number must be 7-15 digits and may start with +.",
)


class UserManager(BaseUserManager):
    """Thin Manager: email-based, case-insensitive unique email."""

    use_in_migrations = True

    def _normalize_email(self, email: str) -> str:
        if not email:
            raise ValueError("Email is required.")
        return self.normalize_email(email).lower()

    def _validate_password(self, password: str) -> None:
        if not password:
            raise ValueError("Password is required.")

    def _create_user(self, email: str, password: str, **extra_fields):
        email = self._normalize_email(email)
        self._validate_password(password)
        extra_fields.pop("username", None)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.full_clean()
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str, **extra_fields):
        extra_fields["is_staff"] = False
        extra_fields["is_superuser"] = False
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Custom user model: email-based login; username removed."""

    username = None
    email = models.EmailField("email address", unique=True)
    phone = models.CharField(max_length=20, validators=[phone_validator], blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("email"), name="uniq_user_email_ci"),
        ]

    def clean(self):
        super().clean()
        if self.email:
            self.email = self.email.lower()

    def save(self, *args, **kwargs):
        allow_staff = kwargs.pop("allow_staff", False)
        if not allow_staff and not self._state.adding:
            try:
                old = User.objects.only("is_staff", "is_superuser").get(pk=self.pk)
            except User.DoesNotExist:
                old = None
            if old and not old.is_staff and self.is_staff:
                raise PermissionDenied("Cannot escalate to staff via save().")
            if old and not old.is_superuser and self.is_superuser:
                raise PermissionDenied("Cannot escalate to superuser via save().")
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


# ---------------------------------------------------------------------------
# Unmanaged models — [account] schema (SQL Server is source of truth)
# ---------------------------------------------------------------------------

class UserProfile(models.Model):
    """Maps to [account].[user_profile]. Managed by SQL Server."""

    user_profile_id = models.BigAutoField(primary_key=True)
    hash_phone_id = models.BinaryField(blank=True, null=True)
    botdetection_phone_sim_slot_no = models.IntegerField(blank=True, null=True)
    otp_verified_at = models.DateTimeField(blank=True, null=True)
    otp_attempt_count = models.IntegerField(blank=True, null=True)
    auth_provider = models.CharField(max_length=20, blank=True, null=True)
    auth_subject_hash = models.BinaryField(blank=True, null=True)
    auth_account_age_days = models.IntegerField(blank=True, null=True)
    face_embedding_hash = models.BinaryField(blank=True, null=True)
    face_verified_at = models.DateTimeField(blank=True, null=True)
    liveness_score = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    display_name = models.CharField(max_length=200, blank=True, null=True)
    age_years = models.SmallIntegerField(blank=True, null=True)
    is_blocked = models.BooleanField(blank=True, null=True)
    blocked_reason = models.CharField(max_length=200, blank=True, null=True)
    is_phone_verified = models.BooleanField(blank=True, null=True)
    is_social_verified = models.BooleanField(blank=True, null=True)
    last_login_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[account].[user_profile]'
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self):
        return f"UserProfile({self.user_profile_id})"


class UserDevice(models.Model):
    """Maps to [account].[user_device]. Managed by SQL Server."""

    user_device_id = models.BigAutoField(primary_key=True)
    hash_device_fingerprint = models.CharField(max_length=32, blank=True, null=True)
    app_instance_id = models.CharField(max_length=64, blank=True, null=True)
    app_platform_name = models.CharField(max_length=100, blank=True, null=True)
    device_category = models.CharField(max_length=100, blank=True, null=True)
    last_ip_address = models.CharField(max_length=45, blank=True, null=True)
    browser_name = models.CharField(max_length=100, blank=True, null=True)
    first_seen_at = models.DateTimeField(blank=True, null=True)
    last_seen_at = models.DateTimeField(blank=True, null=True)
    is_blocked = models.BooleanField(blank=True, null=True)
    blocked_reason = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[account].[user_device]'
        verbose_name = "User Device"
        verbose_name_plural = "User Devices"

    def __str__(self):
        return f"UserDevice({self.user_device_id})"


class UserSession(models.Model):
    """Maps to [account].[user_session]. Managed by SQL Server."""

    user_session_id = models.BigAutoField(primary_key=True)
    link_evaluation_id = models.IntegerField()
    link_user_profile_id = models.BigIntegerField(blank=True, null=True)
    link_user_device_id = models.BigIntegerField(blank=True, null=True)
    link_geo_source_id = models.IntegerField(blank=True, null=True)
    link_intent_type_id = models.IntegerField(blank=True, null=True)
    link_respondent_type_id = models.IntegerField(blank=True, null=True)
    interaction_medium_name = models.CharField(max_length=100, blank=True, null=True)
    session_ip_address = models.CharField(max_length=45, blank=True, null=True)
    is_vpn_suspected = models.BooleanField(blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    ended_at = models.DateTimeField(blank=True, null=True)
    total_questions_answered = models.IntegerField(blank=True, null=True)
    total_session_ms = models.IntegerField(blank=True, null=True)
    avg_time_per_question_ms = models.IntegerField(blank=True, null=True)
    risk_score = models.IntegerField(blank=True, null=True)
    risk_flags = models.CharField(max_length=200, blank=True, null=True)
    is_blocked = models.BooleanField(blank=True, null=True)
    blocked_reason = models.CharField(max_length=200, blank=True, null=True)
    is_authenticated_session = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[account].[user_session]'
        verbose_name = "User Session"
        verbose_name_plural = "User Sessions"

    def __str__(self):
        return f"UserSession({self.user_session_id})"

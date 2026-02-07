from __future__ import annotations

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

class UserRole(models.TextChoices):
    VISITOR = "visitor", "Visitor"
    STAFF = "staff", "Staff"
    JOURNALIST = "journalist", "Journalist"
    MODERATOR = "moderator", "Moderator"

phone_validator = RegexValidator(
    regex=r"^\+?[0-9]{7,15}$",
    message="Phone number must be 7–15 digits and may start with +.",
)

class UserManager(BaseUserManager):
    """UserManager with normalized, case-insensitive unique email and role helpers."""

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

        # Ensure we never store username
        extra_fields.pop("username", None)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.full_clean()
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", UserRole.VISITOR)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", UserRole.STAFF)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(email, password, **extra_fields)

    def create_staff(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("role", UserRole.STAFF)
        return self._create_user(email, password, **extra_fields)

    def create_moderator(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("role", UserRole.MODERATOR)
        return self._create_user(email, password, **extra_fields)

    def create_journalist(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("role", UserRole.JOURNALIST)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Custom user model: email-based login; username removed."""

    username = None
    email = models.EmailField("email address", unique=True)

    phone = models.CharField(max_length=20, validators=[phone_validator], blank=True)
    profile_image = models.ImageField(upload_to="avatars/", blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    bio = models.TextField(blank=True)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.VISITOR)

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

    def __str__(self):
        return self.email


class Profile(models.Model):
    """Profile linked 1:1 with the User."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    website = models.URLField(blank=True)
    twitter = models.URLField(blank=True)
    facebook = models.URLField(blank=True)
    linkedin = models.URLField(blank=True)
    github = models.URLField(blank=True)

    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Profile({self.user_id})"


# Admin proxy models for role-specific sections
class StaffUser(User):
    class Meta:
        proxy = True
        verbose_name = "Staff User"
        verbose_name_plural = "Staff Users"

class JournalistUser(User):
    class Meta:
        proxy = True
        verbose_name = "Journalist User"
        verbose_name_plural = "Journalist Users"

class ModeratorUser(User):
    class Meta:
        proxy = True
        verbose_name = "Moderator User"
        verbose_name_plural = "Moderator Users"

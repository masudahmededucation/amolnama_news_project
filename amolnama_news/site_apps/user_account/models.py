from __future__ import annotations

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import PermissionDenied
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Thin Manager: email-based, case-insensitive unique email."""

    use_in_migrations = True

    def _normalize_email(self, email: str) -> str:
        if not email:
            raise ValueError("Email is required.")
        return self.normalize_email(email).lower()

    def _create_user(self, email: str, password=None, **extra_fields):
        email = self._normalize_email(email)
        extra_fields.pop("username", None)

        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.full_clean()
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password=None, **extra_fields):
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
    """Custom user model: email-based login; username removed.

    Names live in [person].[person] (first_name_en, last_name_en) —
    not on this table — to avoid duplication.
    """

    username = None
    first_name = None
    last_name = None
    user_account_user_id = models.BigAutoField(primary_key=True)
    link_user_auth_method_type_id = models.IntegerField()
    user_auth_provider_key = models.CharField(max_length=255)
    email = models.EmailField("email address", unique=True, db_column="username_email")
    password = models.CharField(max_length=128, db_column="hash_password")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        pass

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
    link_person_id = models.BigIntegerField(blank=True, null=True)
    link_user_account_user_id = models.BigIntegerField(blank=True, null=True)
    otp_verified_at = models.DateTimeField(blank=True, null=True)
    otp_attempt_count = models.IntegerField(blank=True, null=True)
    display_name = models.CharField(max_length=200, blank=True, null=True)
    professional_bio_summary_bn = models.CharField(max_length=200, blank=True, null=True)
    professional_bio_description_bn = models.CharField(max_length=1000, blank=True, null=True)
    is_blocked = models.BooleanField(blank=True, null=True)
    blocked_reason = models.CharField(max_length=200, blank=True, null=True)
    last_login_at = models.DateTimeField(blank=True, null=True)
    is_verified = models.BooleanField(blank=True, null=True)
    verification_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[account].[user_profile]'
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self):
        return f"UserProfile({self.user_profile_id})"


class RefUserAuthMethodType(models.Model):
    """Maps to [account].[ref_user_auth_method_type]. Managed by SQL Server."""

    user_auth_method_type_id = models.IntegerField(primary_key=True)
    auth_method_type = models.CharField(max_length=20)
    auth_method_name_en = models.CharField(max_length=50)
    is_active = models.BooleanField()

    class Meta:
        managed = False
        db_table = '[account].[ref_user_auth_method_type]'
        verbose_name = "Auth Method Type"
        verbose_name_plural = "Auth Method Types"

    def __str__(self):
        return self.auth_method_name_en



class UserDevice(models.Model):
    """Maps to [account].[user_device]. Managed by SQL Server."""

    user_device_id = models.BigAutoField(primary_key=True)
    hash_device_fingerprint = models.CharField(max_length=32, blank=True, null=True)
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
    link_user_profile_id = models.BigIntegerField(blank=True, null=True)
    link_user_device_id = models.BigIntegerField(blank=True, null=True)
    link_geo_source_id = models.IntegerField(blank=True, null=True)
    session_ip_address = models.CharField(max_length=45, blank=True, null=True)
    is_vpn_suspected = models.BooleanField(blank=True, null=True)
    total_questions_answered = models.IntegerField(blank=True, null=True)
    total_session_ms = models.IntegerField(blank=True, null=True)
    avg_time_per_question_ms = models.IntegerField(blank=True, null=True)
    risk_score = models.IntegerField(blank=True, null=True)
    risk_flags = models.CharField(max_length=200, blank=True, null=True)
    is_blocked = models.BooleanField(blank=True, null=True)
    blocked_reason = models.CharField(max_length=200, blank=True, null=True)
    is_authenticated_session = models.BooleanField(blank=True, null=True)
    has_device_changed_during_session = models.BooleanField(blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    ended_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[account].[user_session]'
        verbose_name = "User Session"
        verbose_name_plural = "User Sessions"

    def __str__(self):
        return f"UserSession({self.user_session_id})"


# ---------------------------------------------------------------------------
# Unmanaged models — [person] schema (SQL Server is source of truth)
# ---------------------------------------------------------------------------

class RefGender(models.Model):
    """Maps to [person].[ref_gender]. Managed by SQL Server."""

    gender_id = models.IntegerField(primary_key=True)
    gender_name_en = models.CharField(max_length=50, blank=True, null=True)
    gender_name_bn = models.CharField(max_length=50, blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[ref_gender]'
        verbose_name = "Gender"
        verbose_name_plural = "Genders"

    def __str__(self):
        return self.gender_name_en or f"Gender({self.gender_id})"


class RefReligion(models.Model):
    """Maps to [person].[ref_religion]. Managed by SQL Server."""

    religion_id = models.IntegerField(primary_key=True)
    religion_name_en = models.CharField(max_length=50, blank=True, null=True)
    religion_name_bn = models.CharField(max_length=50, blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[ref_religion]'
        verbose_name = "Religion"
        verbose_name_plural = "Religions"

    def __str__(self):
        return self.religion_name_en or f"Religion({self.religion_id})"


class Person(models.Model):
    """Maps to [person].[person]. Managed by SQL Server."""

    person_id = models.BigAutoField(primary_key=True)
    # person_guid: NOT NULL column with DB DEFAULT NEWID() — omitted so
    # Django never sends a value and the DB generates it automatically.
    link_gender_id = models.IntegerField(blank=True, null=True)
    link_religion_id = models.IntegerField(blank=True, null=True)
    title_en = models.CharField(max_length=50, blank=True, null=True)
    title_bn = models.CharField(max_length=50, blank=True, null=True)
    first_name_en = models.CharField(max_length=100, blank=True, null=True)
    last_name_en = models.CharField(max_length=100, blank=True, null=True)
    first_name_bn = models.CharField(max_length=100, blank=True, null=True)
    last_name_bn = models.CharField(max_length=100, blank=True, null=True)
    nick_name_en = models.CharField(max_length=100, blank=True, null=True)
    nick_name_bn = models.CharField(max_length=100, blank=True, null=True)
    father_name_en = models.CharField(max_length=200, blank=True, null=True)
    father_name_bn = models.CharField(max_length=200, blank=True, null=True)
    mother_name_en = models.CharField(max_length=200, blank=True, null=True)
    mother_name_bn = models.CharField(max_length=200, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    link_birth_district_id = models.IntegerField(blank=True, null=True)
    birth_certificate_number = models.CharField(max_length=50, blank=True, null=True)
    nid_card_number = models.CharField(max_length=20, blank=True, null=True)
    hash_nid_card_number = models.BinaryField(blank=True, null=True)
    primary_mobile_number = models.CharField(max_length=20, blank=True, null=True)
    primary_email_address = models.CharField(max_length=200, blank=True, null=True)
    name_tag = models.CharField(max_length=200, blank=True, null=True)
    notes = models.CharField(max_length=1000, blank=True, null=True)
    is_protected = models.BooleanField(default=False)
    is_active = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[person].[person]'
        verbose_name = "Person"
        verbose_name_plural = "Persons"

    def __str__(self):
        name = f"{self.first_name_en or ''} {self.last_name_en or ''}".strip()
        return name or f"Person({self.person_id})"


class PersonAddress(models.Model):
    """Maps to [person].[person_address]. Junction table linking Person to Address."""

    person_address_id = models.AutoField(primary_key=True)
    link_person_id = models.BigIntegerField()
    link_address_id = models.IntegerField()
    is_current = models.BooleanField(default=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_by = models.IntegerField(blank=True, null=True)
    updated_by = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[person_address]'
        verbose_name = "Person Address"
        verbose_name_plural = "Person Addresses"

    def __str__(self):
        return f"PersonAddress(person={self.link_person_id}, address={self.link_address_id})"


# ---------------------------------------------------------------------------
# Unmanaged models — [contact] schema (SQL Server is source of truth)
# ---------------------------------------------------------------------------


class RefContactType(models.Model):
    """Maps to [contact].[ref_contact_type]."""

    contact_type_id = models.IntegerField(primary_key=True)
    contact_type_code = models.CharField(max_length=50)
    contact_type_name_en = models.CharField(max_length=100)
    contact_type_name_bn = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[contact].[ref_contact_type]'

    def __str__(self):
        return self.contact_type_name_en


class Phone(models.Model):
    """Maps to [contact].[phone]."""

    phone_id = models.AutoField(primary_key=True)
    link_person_id = models.BigIntegerField()
    link_contact_type_id = models.IntegerField(default=1)
    country_calling_code = models.CharField(max_length=10, default='+880')
    phone_number = models.CharField(max_length=20)
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[contact].[phone]'

    def __str__(self):
        return f"{self.country_calling_code}{self.phone_number}"


class Email(models.Model):
    """Maps to [contact].[email]."""

    email_id = models.AutoField(primary_key=True)
    link_person_id = models.BigIntegerField()
    link_contact_type_id = models.IntegerField(default=1)
    email_address = models.CharField(max_length=255)
    is_primary = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[contact].[email]'

    def __str__(self):
        return self.email_address


class OrganisationType(models.Model):
    """Maps to [directory].[organisation_type]."""

    organisation_type_id = models.IntegerField(primary_key=True)
    organisation_type_code = models.CharField(max_length=100)
    organisation_type_name_en = models.CharField(max_length=200)
    organisation_type_name_bn = models.CharField(max_length=200)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[directory].[organisation_type]'

    def __str__(self):
        return self.organisation_type_name_en


class Organisation(models.Model):
    """Maps to [directory].[organisation]."""

    organisation_id = models.IntegerField(primary_key=True)
    organisation_uid = models.UUIDField()
    link_organisation_type_id = models.IntegerField()
    link_branch_address_id = models.IntegerField(blank=True, null=True)
    organisation_name_en = models.CharField(max_length=200)
    organisation_name_bn = models.CharField(max_length=200, blank=True, null=True)
    organisation_legal_name_en = models.CharField(max_length=200, blank=True, null=True)
    organisation_legal_name_bn = models.CharField(max_length=200, blank=True, null=True)
    organisation_description_en = models.CharField(max_length=1000, blank=True, null=True)
    organisation_description_bn = models.CharField(max_length=1000, blank=True, null=True)
    organisation_tax_id = models.CharField(max_length=200, blank=True, null=True)
    organisation_registration_no = models.CharField(max_length=200, blank=True, null=True)
    organisation_code = models.CharField(max_length=50, blank=True, null=True)
    total_employee_number = models.IntegerField(blank=True, null=True)
    total_client_number = models.IntegerField(blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[directory].[organisation]'

    def __str__(self):
        return self.organisation_name_en

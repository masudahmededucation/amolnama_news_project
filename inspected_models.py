# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models


class Refactorlog(models.Model):
    operationkey = models.CharField(db_column='OperationKey', primary_key=True, max_length=36)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = '__RefactorLog'


class AccountEmailaddress(models.Model):
    email = models.CharField(max_length=254, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    verified = models.BooleanField()
    primary = models.BooleanField()
    user = models.ForeignKey('UserAccountUser', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'account_emailaddress'
        unique_together = (('user', 'email'), ('user', 'primary'),)


class AccountEmailconfirmation(models.Model):
    created = models.DateTimeField()
    sent = models.DateTimeField(blank=True, null=True)
    key = models.CharField(unique=True, max_length=64, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    email_address = models.ForeignKey(AccountEmailaddress, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'account_emailconfirmation'


class AuthGroup(models.Model):
    name = models.CharField(unique=True, max_length=150, db_collation='Latin1_General_100_CI_AS_SC_UTF8')

    class Meta:
        managed = False
        db_table = 'auth_group'


class AuthGroupPermissions(models.Model):
    id = models.BigAutoField(primary_key=True)
    group = models.ForeignKey(AuthGroup, models.DO_NOTHING)
    permission = models.ForeignKey('AuthPermission', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'auth_group_permissions'
        unique_together = (('group', 'permission'),)


class AuthPermission(models.Model):
    name = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    content_type = models.ForeignKey('DjangoContentType', models.DO_NOTHING)
    codename = models.CharField(max_length=100, db_collation='Latin1_General_100_CI_AS_SC_UTF8')

    class Meta:
        managed = False
        db_table = 'auth_permission'
        unique_together = (('content_type', 'codename'),)


class AxesAccessattempt(models.Model):
    user_agent = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    ip_address = models.CharField(max_length=39, db_collation='Latin1_General_100_CI_AS_SC_UTF8', blank=True, null=True)
    username = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8', blank=True, null=True)
    http_accept = models.CharField(max_length=1025, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    path_info = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    attempt_time = models.DateTimeField()
    get_data = models.TextField(db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    post_data = models.TextField(db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    failures_since_start = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'axes_accessattempt'
        unique_together = (('username', 'ip_address', 'user_agent'),)


class AxesAccessfailurelog(models.Model):
    user_agent = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    ip_address = models.CharField(max_length=39, db_collation='Latin1_General_100_CI_AS_SC_UTF8', blank=True, null=True)
    username = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8', blank=True, null=True)
    http_accept = models.CharField(max_length=1025, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    path_info = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    attempt_time = models.DateTimeField()
    locked_out = models.BooleanField()

    class Meta:
        managed = False
        db_table = 'axes_accessfailurelog'


class AxesAccesslog(models.Model):
    user_agent = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    ip_address = models.CharField(max_length=39, db_collation='Latin1_General_100_CI_AS_SC_UTF8', blank=True, null=True)
    username = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8', blank=True, null=True)
    http_accept = models.CharField(max_length=1025, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    path_info = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    attempt_time = models.DateTimeField()
    logout_time = models.DateTimeField(blank=True, null=True)
    session_hash = models.CharField(max_length=64, db_collation='Latin1_General_100_CI_AS_SC_UTF8')

    class Meta:
        managed = False
        db_table = 'axes_accesslog'


class DjangoAdminLog(models.Model):
    action_time = models.DateTimeField()
    object_id = models.TextField(db_collation='Latin1_General_100_CI_AS_SC_UTF8', blank=True, null=True)
    object_repr = models.CharField(max_length=200, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    action_flag = models.SmallIntegerField()
    change_message = models.TextField(db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    content_type = models.ForeignKey('DjangoContentType', models.DO_NOTHING, blank=True, null=True)
    user = models.ForeignKey('UserAccountUser', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'django_admin_log'


class DjangoContentType(models.Model):
    app_label = models.CharField(max_length=100, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    model = models.CharField(max_length=100, db_collation='Latin1_General_100_CI_AS_SC_UTF8')

    class Meta:
        managed = False
        db_table = 'django_content_type'
        unique_together = (('app_label', 'model'),)


class DjangoMigrations(models.Model):
    id = models.BigAutoField(primary_key=True)
    app = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    name = models.CharField(max_length=255, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    applied = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'django_migrations'


class DjangoSession(models.Model):
    session_key = models.CharField(primary_key=True, max_length=40, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    session_data = models.TextField(db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    expire_date = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'django_session'


class SocialaccountSocialaccount(models.Model):
    provider = models.CharField(max_length=200, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    uid = models.CharField(max_length=191, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    last_login = models.DateTimeField()
    date_joined = models.DateTimeField()
    extra_data = models.TextField(db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    user = models.ForeignKey('UserAccountUser', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'socialaccount_socialaccount'
        unique_together = (('provider', 'uid'),)


class SocialaccountSocialapp(models.Model):
    provider = models.CharField(max_length=30, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    name = models.CharField(max_length=40, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    client_id = models.CharField(max_length=191, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    secret = models.CharField(max_length=191, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    key = models.CharField(max_length=191, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    provider_id = models.CharField(max_length=200, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    settings = models.TextField(db_collation='Latin1_General_100_CI_AS_SC_UTF8')

    class Meta:
        managed = False
        db_table = 'socialaccount_socialapp'


class SocialaccountSocialtoken(models.Model):
    token = models.TextField(db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    token_secret = models.TextField(db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    expires_at = models.DateTimeField(blank=True, null=True)
    account = models.ForeignKey(SocialaccountSocialaccount, models.DO_NOTHING)
    app = models.ForeignKey(SocialaccountSocialapp, models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'socialaccount_socialtoken'
        unique_together = (('app', 'account'),)


class UserAccountProfile(models.Model):
    id = models.BigAutoField(primary_key=True)
    avatar = models.CharField(max_length=100, db_collation='Latin1_General_100_CI_AS_SC_UTF8', blank=True, null=True)
    website = models.CharField(max_length=200, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    twitter = models.CharField(max_length=200, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    facebook = models.CharField(max_length=200, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    linkedin = models.CharField(max_length=200, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    github = models.CharField(max_length=200, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    created_at = models.DateTimeField()
    user = models.OneToOneField('UserAccountUser', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'user_account_profile'


class UserAccountUser(models.Model):
    id = models.BigAutoField(primary_key=True)
    password = models.CharField(max_length=128, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    last_login = models.DateTimeField(blank=True, null=True)
    is_superuser = models.BooleanField()
    first_name = models.CharField(max_length=150, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    last_name = models.CharField(max_length=150, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    is_staff = models.BooleanField()
    is_active = models.BooleanField()
    date_joined = models.DateTimeField()
    email = models.CharField(unique=True, max_length=254, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    phone = models.CharField(max_length=20, db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    profile_image = models.CharField(max_length=100, db_collation='Latin1_General_100_CI_AS_SC_UTF8', blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    bio = models.TextField(db_collation='Latin1_General_100_CI_AS_SC_UTF8')
    role = models.CharField(max_length=20, db_collation='Latin1_General_100_CI_AS_SC_UTF8')

    class Meta:
        managed = False
        db_table = 'user_account_user'


class UserAccountUserGroups(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(UserAccountUser, models.DO_NOTHING)
    group = models.ForeignKey(AuthGroup, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'user_account_user_groups'
        unique_together = (('user', 'group'),)


class UserAccountUserUserPermissions(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(UserAccountUser, models.DO_NOTHING)
    permission = models.ForeignKey(AuthPermission, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'user_account_user_user_permissions'
        unique_together = (('user', 'permission'),)

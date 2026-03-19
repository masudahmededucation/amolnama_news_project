from django.db import models


class UserSavedOffice(models.Model):
    """Maps to [marriage].[user_saved_office]. Managed by SQL Server."""

    user_saved_office_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    office_label = models.CharField(max_length=200, blank=True, null=True)
    govt_title = models.CharField(max_length=500, blank=True, null=True)
    office_name = models.CharField(max_length=500, blank=True, null=True)
    office_address = models.CharField(max_length=1000, blank=True, null=True)
    reg_no = models.CharField(max_length=100, blank=True, null=True)
    office_date = models.DateField(blank=True, null=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[marriage].[user_saved_office]'
        verbose_name = "User Saved Office"
        verbose_name_plural = "User Saved Offices"

    def __str__(self):
        return self.office_label or self.office_name or f"Office({self.user_saved_office_id})"

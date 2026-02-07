from django.db import models

class MediaAppAsset(models.Model):
    app_asset_id = models.AutoField(primary_key=True)
    asset_key = models.CharField(max_length=100, blank=True, null=True)  # <-- added asset_key
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    alt_text_en = models.CharField(max_length=255, blank=True, null=True)
    alt_text_bn = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'app_asset'
        managed = False  # Set to True if you want Django to manage the table

    def __str__(self):
        return self.file_name
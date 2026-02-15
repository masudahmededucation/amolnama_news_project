from django.db import models


# ========== Reference Tables ==========

class RefAssetType(models.Model):
    asset_type_id = models.IntegerField(primary_key=True)
    asset_type_category_name = models.CharField(max_length=50, blank=True, null=True)
    asset_type_name = models.CharField(max_length=50)
    mime_type = models.CharField(max_length=100, blank=True, null=True)
    max_size_mb = models.DecimalField(max_digits=18, decimal_places=2, blank=True, null=True)
    max_size_kb = models.IntegerField()
    allowed_extension = models.CharField(max_length=50, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[media].[ref_asset_type]'

    def __str__(self):
        return self.asset_type_name


# ========== App Assets ==========

class AppAsset(models.Model):
    app_asset_id = models.IntegerField(primary_key=True)
    asset_key = models.CharField(max_length=50, blank=True, null=True)
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    alt_text_en = models.CharField(max_length=255, blank=True, null=True)
    alt_text_bn = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[media].[app_asset]'

    def __str__(self):
        return self.file_name


# ========== Assets ==========

class Asset(models.Model):
    asset_id = models.BigAutoField(primary_key=True)
    asset_guid = models.CharField(max_length=36)  # uniqueidentifier in SQL Server — CharField avoids mssql UUIDField dash-stripping bug
    link_asset_type_id = models.IntegerField(blank=True, null=True)
    link_storage_provider_id = models.IntegerField(blank=True, null=True)
    file_original_name = models.CharField(max_length=1000)
    file_extension = models.CharField(max_length=10)
    file_mime_type = models.CharField(max_length=100)
    file_size_bytes = models.BigIntegerField()
    # file_storage_path — computed column in SQL Server, excluded from Django model
    asset_captured_at = models.DateTimeField(blank=True, null=True)
    asset_description_en = models.CharField(max_length=1000, blank=True, null=True)
    asset_description_bn = models.CharField(max_length=1000, blank=True, null=True)
    asset_tags_json = models.CharField(max_length=1000, blank=True, null=True)
    hash_sha256 = models.BinaryField(blank=True, null=True)
    hash_algorithm_used = models.CharField(max_length=20, blank=True, null=True)
    hash_is_verified = models.BooleanField()
    hash_last_verify_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[media].[asset]'

    def __str__(self):
        return self.file_original_name

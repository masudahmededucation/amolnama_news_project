from django.db import models


class Commodity(models.Model):
    commodity_id = models.BigAutoField(primary_key=True)
    commodity_group_code = models.CharField(max_length=50)
    commodity_group_name_en = models.CharField(max_length=100)
    commodity_group_name_bn = models.CharField(max_length=100)
    commodity_name_en = models.CharField(max_length=150)
    commodity_name_bn = models.CharField(max_length=150)
    commodity_variant_bn = models.CharField(max_length=150, blank=True, null=True)
    commodity_unit = models.CharField(max_length=30)
    commodity_pack_size = models.CharField(max_length=50, blank=True, null=True)
    commodity_notes_bn = models.CharField(max_length=300, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[market].[ref_commodity]'

    def __str__(self):
        return self.commodity_name_bn or self.commodity_name_en


class RefUnitType(models.Model):
    unit_type_id = models.AutoField(primary_key=True)
    unit_name_en = models.CharField(max_length=50)
    unit_name_bn = models.CharField(max_length=50)
    is_active = models.BooleanField()

    class Meta:
        managed = False
        db_table = '[market].[ref_unit_type]'

    def __str__(self):
        return self.unit_name_bn or self.unit_name_en



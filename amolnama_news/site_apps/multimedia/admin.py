from django.contrib import admin

from .models import AppAsset


@admin.register(AppAsset)
class AppAssetAdmin(admin.ModelAdmin):
    list_display = ('asset_key', 'file_name', 'file_path', 'is_active', 'created_at')
    search_fields = ('asset_key', 'file_name', 'alt_text_en', 'alt_text_bn')

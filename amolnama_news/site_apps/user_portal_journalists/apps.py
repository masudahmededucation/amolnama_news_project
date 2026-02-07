from django.apps import AppConfig

class JournalistPortalConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "amolnama_news.site_apps.user_portal_journalists"
    label = 'user_portal_journalists'
    verbose_name = "Journalist Portal"
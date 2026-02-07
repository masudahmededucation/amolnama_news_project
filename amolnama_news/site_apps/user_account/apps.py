from django.apps import AppConfig

class UserAccountConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "amolnama_news.site_apps.user_account"
    label = 'user_account'
    verbose_name = "User Account"
    
    
    def ready(self):
        from . import signals  # noqa

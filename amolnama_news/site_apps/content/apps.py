from django.apps import AppConfig


class ContentConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'amolnama_news.site_apps.content'
    label = 'content'
    verbose_name = 'Content Registry'

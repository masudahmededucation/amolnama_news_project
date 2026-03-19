from django.apps import AppConfig

class PoemConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "amolnama_news.site_apps.poem"
    label = 'poem'
    verbose_name = "Poem"

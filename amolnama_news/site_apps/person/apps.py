from django.apps import AppConfig


class PersonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "amolnama_news.site_apps.person"
    label = "person"
    verbose_name = "Person"

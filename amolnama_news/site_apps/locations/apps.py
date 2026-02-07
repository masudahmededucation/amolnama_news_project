from django.apps import AppConfig


class LocationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'amolnama_news.site_apps.locations'  # Must include the folder prefix
    label = 'locations'           # Keeps the database labels clean
    verbose_name = 'Locations'  # Human-readable name for the admin interface

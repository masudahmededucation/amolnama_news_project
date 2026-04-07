from django.apps import AppConfig


class TextextractorConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'amolnama_news.site_apps.textextractor'
    label = 'textextractor'
    verbose_name = 'Text Extractor'

    def ready(self):
        """Recover jobs stuck in 'processing' from server crash on startup."""
        import threading
        import time

        def _recover_on_startup():
            time.sleep(5)  # Wait for Django to fully initialize
            try:
                from .processor import recover_stuck_jobs
                recover_stuck_jobs()
            except Exception:
                pass

        threading.Thread(target=_recover_on_startup, daemon=True).start()

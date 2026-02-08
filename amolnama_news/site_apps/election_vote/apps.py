from django.apps import AppConfig


class ElectionVoteConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'amolnama_news.site_apps.election_vote'
    label = 'election_vote'
    verbose_name = 'Election Vote'

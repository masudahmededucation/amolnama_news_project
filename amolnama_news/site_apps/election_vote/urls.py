from django.urls import path
from . import views

app_name = 'election_vote'

urlpatterns = [
    path('', views.home, name='home'),
    path('api/cast-vote/', views.cast_vote, name='cast_vote'),
    path('api/check-eligibility/<int:election_evaluation_id>/',
         views.check_eligibility, name='check_eligibility'),
    path('api/national-results/<int:election_evaluation_id>/',
         views.api_national_results, name='api_national_results'),
    path('past-results/<int:election_evaluation_id>/',
         views.past_results_drillthrough, name='past_results'),
]

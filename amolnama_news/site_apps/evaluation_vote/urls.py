from django.urls import path
from . import views

app_name = 'evaluation_vote'

urlpatterns = [
    path('', views.home, name='home'),
    path('api/districts/<int:division_id>/', views.get_districts, name='get_districts'),
    path('api/constituencies/<int:district_id>/', views.get_constituencies, name='get_constituencies'),
    path('api/upazilas/<int:district_id>/', views.get_upazilas, name='get_upazilas'),
    path('api/unions/<int:upazila_id>/', views.get_union_parishads, name='get_union_parishads'),
    path('api/submit-vote/', views.submit_vote, name='submit_vote'),
    path('api/update-vote/', views.update_vote, name='update_vote'),
    path('api/party-results/', views.get_party_results, name='get_party_results'),
    path('sidebar-past-vote-results/', views.sidebar_past_vote_results, name='sidebar_past_vote_results'),
]
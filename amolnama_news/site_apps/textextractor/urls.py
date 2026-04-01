"""Text Extractor URL patterns."""

from django.urls import path

from . import views, views_api

app_name = 'textextractor'

urlpatterns = [
    path('', views.home, name='home'),
    path('upload/', views.upload, name='upload'),
    path('job/<int:job_id>/', views.job_detail, name='job_detail'),
    path('api/upload/', views_api.api_extraction_upload, name='api_extraction_upload'),
    path('api/status/<int:job_id>/', views_api.api_extraction_status, name='api_extraction_status'),
    path('api/dashboard-status/', views_api.api_dashboard_status, name='api_dashboard_status'),
    path('api/cancel/<int:job_id>/', views_api.api_extraction_cancel, name='api_extraction_cancel'),
    path('api/delete/<int:job_id>/', views_api.api_extraction_delete, name='api_extraction_delete'),
]

from django.urls import path
from . import views
from . import views_api

app_name = 'newshub'

urlpatterns = [
    path('news-collection/', views.news_collection, name='news_collection'),

    # API endpoints
    path('api/constituencies/<int:district_id>/', views_api.api_constituencies_by_district, name='api_constituencies_by_district'),
    path('api/upazilas/<int:district_id>/', views_api.api_upazilas_by_district, name='api_upazilas_by_district'),
    path('api/union-parishads/<int:upazila_id>/', views_api.api_union_parishads_by_upazila, name='api_union_parishads_by_upazila'),
    path('api/locations/all/', views_api.api_locations_all, name='api_locations_all'),
    path('api/tags/all/', views_api.api_news_category_tags_all, name='api_news_category_tags_all'),
    path('api/tags/<int:category_id>/', views_api.api_news_category_tags_by_category, name='api_news_category_tags_by_category'),
    path('api/categories/search/', views_api.api_news_category_search, name='api_news_category_search'),
    path('api/tags/search/', views_api.api_news_category_tags_search, name='api_news_category_tags_search'),
    path('api/organisations/search/', views_api.api_organisation_search, name='api_organisation_search'),
    path('api/organisations/<int:type_id>/', views_api.api_organisations_by_type, name='api_organisations_by_type'),
]

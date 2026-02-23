from django.urls import path
from . import views
from . import views_api

app_name = 'newshub'

urlpatterns = [
    path('news-collection/', views.news_collection, name='news_collection'),

    # API endpoints — location cascade (original)
    path('api/constituencies/<int:district_id>/', views_api.api_constituencies_by_district, name='api_constituencies_by_district'),
    path('api/upazilas/<int:district_id>/', views_api.api_upazilas_by_district, name='api_upazilas_by_district'),
    path('api/union-parishads/<int:upazila_id>/', views_api.api_union_parishads_by_upazila, name='api_union_parishads_by_upazila'),
    path('api/locations/all/', views_api.api_locations_all, name='api_locations_all'),

    # API endpoints — combined cascade (urban + rural paths)
    path('api/subdistricts/<int:district_id>/', views_api.api_subdistricts_by_district, name='api_subdistricts_by_district'),
    path('api/local-bodies/', views_api.api_local_bodies_by_parent, name='api_local_bodies_by_parent'),
    path('api/union-parishad-wards/<int:union_parishad_id>/', views_api.api_union_parishad_wards_by_union_parishad, name='api_union_parishad_wards_by_union_parishad'),
    path('api/municipality-wards/<int:municipality_id>/', views_api.api_municipality_wards_by_municipality, name='api_municipality_wards_by_municipality'),
    path('api/city-corporation-wards/<int:city_corporation_id>/', views_api.api_city_corporation_wards_by_city_corporation, name='api_city_corporation_wards_by_city_corporation'),
    path('api/city-corporation-wards/metro-thana/<int:metropolitan_thana_id>/', views_api.api_city_corporation_wards_by_metropolitan_thana, name='api_city_corporation_wards_by_metropolitan_thana'),
    path('api/union-parishad-villages/<int:union_parishad_id>/', views_api.api_union_parishad_villages_by_union_parishad, name='api_union_parishad_villages_by_union_parishad'),
    path('api/locations/search/', views_api.api_unified_location_search, name='api_unified_location_search'),
    path('api/locations/resolve/', views_api.api_location_resolve_ancestry, name='api_location_resolve_ancestry'),

    # API endpoints — tags & categories
    path('api/tags/all/', views_api.api_news_category_tags_all, name='api_news_category_tags_all'),
    path('api/tags/<int:category_id>/', views_api.api_news_category_tags_by_category, name='api_news_category_tags_by_category'),
    path('api/categories/search/', views_api.api_news_category_search, name='api_news_category_search'),
    path('api/tags/search/', views_api.api_news_category_tags_search, name='api_news_category_tags_search'),

    # API endpoints — organisations
    path('api/organisations/search/', views_api.api_organisation_search, name='api_organisation_search'),
    path('api/organisations/<int:type_id>/', views_api.api_organisations_by_type, name='api_organisations_by_type'),
]

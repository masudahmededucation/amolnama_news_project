from django.urls import path
from . import views
from . import views_api

app_name = 'newshub'

urlpatterns = [
    path('news-collection/', views.news_collection, name='news_collection'),
    path('news-collection/multistep/', views.news_collection_multistep, name='news_collection_multistep'),
    path('news-collection/multistep/extortion/', views.news_collection_multistep_extortion, name='news_collection_multistep_extortion'),
    path('news-collection/multistep/land-grabbing/', views.news_collection_multistep_land_grabbing, name='news_collection_multistep_land_grabbing'),
    path('news-collection/multistep/crime-violence/', views.news_collection_multistep_crime_violence, name='news_collection_multistep_crime_violence'),
    path('news-collection/multistep/price-hike/', views.news_collection_multistep_price_hike, name='news_collection_multistep_price_hike'),
    path('news-collection/multistep/watchdog-bangladesh/', views.news_collection_multistep_watchdog_bangladesh, name='news_collection_multistep_watchdog_bangladesh'),
    path('news-collection/multistep/civic-community/', views.news_collection_multistep_civic_community, name='news_collection_multistep_civic_community'),
    path('news-collection/multistep/global-news/', views.news_collection_multistep_global_news, name='news_collection_multistep_global_news'),
    path('news-collection/multistep/war-conflict/', views.news_collection_multistep_war_conflict, name='news_collection_multistep_war_conflict'),
    path('news-collection/multistep/sports/', views.news_collection_multistep_sports, name='news_collection_multistep_sports'),
    path('news-collection/multistep/entertainment/', views.news_collection_multistep_entertainment, name='news_collection_multistep_entertainment'),
    path('news-collection/multistep/july-uprising/', views.news_collection_multistep_july_uprising, name='news_collection_multistep_july_uprising'),
    path('news-collection/multistep/women-child-violence/', views.news_collection_multistep_women_child_violence, name='news_collection_multistep_women_child_violence'),

    # Article detail view (public, slug-based via pub_article)
    path('article/<slug:slug>/', views.article_detail, name='article_detail'),

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

    # API endpoints — WCV form helpers
    path('api/thana/search/', views_api.api_wcv_thana_search, name='api_wcv_thana_search'),

    # API endpoints — organisations
    path('api/organisations/search/', views_api.api_organisation_search, name='api_organisation_search'),
    path('api/organisations/<int:type_id>/', views_api.api_organisations_by_type, name='api_organisations_by_type'),
]

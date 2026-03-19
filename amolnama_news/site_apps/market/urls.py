from django.urls import path
from . import views
from . import views_api

app_name = 'market'

urlpatterns = [
    # API endpoints — commodities
    path('api/commodities/search/', views_api.api_commodity_search, name='api_commodity_search'),
]

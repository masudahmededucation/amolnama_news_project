import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "amolnama_news.settings.dev")

django_asgi_application = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from amolnama_news.site_apps.messenger.routing import websocket_urlpatterns as messenger_websocket_urlpatterns
from amolnama_news.site_apps.newsengine.routing import websocket_urlpatterns as notification_websocket_urlpatterns
from amolnama_news.site_apps.post.routing import websocket_urlpatterns as post_websocket_urlpatterns
from amolnama_news.site_apps.mastermind.routing import websocket_urlpatterns as mastermind_websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_application,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            messenger_websocket_urlpatterns
            + notification_websocket_urlpatterns
            + post_websocket_urlpatterns
            + mastermind_websocket_urlpatterns
        )
    ),
})

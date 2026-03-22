"""
No-cache middleware for development — prevents browser from caching static files.
Only use in dev. Production uses WhiteNoise with proper cache headers.
"""


class NoCacheStaticMiddleware:
    """Set Cache-Control: no-store on static file responses."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = request.path
        if path.startswith("/static/") or path.endswith((".js", ".css")):
            response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"
        return response

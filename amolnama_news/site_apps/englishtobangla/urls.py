"""
englishtobangla app has no page routes.

Its value is the JS utility files under
static/englishtobangla/assets/js/utilities/ (avro-phonetic.js,
bangla-input.js, bangla-input-auto-attach.js, quill-avro.js) which are
loaded globally via core/base.html and attach to inputs on every page.

No views, no URLs. The app is kept installed only so Django's static
file finder picks up its static/ directory.
"""

app_name = "englishtobangla"

urlpatterns = []

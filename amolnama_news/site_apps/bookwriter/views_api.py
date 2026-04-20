"""bookwriter — backward-compat re-export shim.

Endpoints live in per-domain modules:
  views_api_helpers.py            shared helpers + constants
  views_api_chapter.py            chapter ops, snapshots, publish/unpublish, status
  views_api_book.py               book metadata, cover design, subscribe-toggle
  views_api_writing_artifacts.py  sprint, plot cards, bible entries, margin notes
  views_api_collaboration.py      beta workflow + public engagement
  views_api_refs.py               refs dispatcher

This shim keeps any legacy `from .views_api import api_X` import working.
urls.py imports directly from the per-domain modules.
"""

from .views_api_helpers import *  # noqa: F401,F403
from .views_api_chapter import *  # noqa: F401,F403
from .views_api_book import *  # noqa: F401,F403
from .views_api_writing_artifacts import *  # noqa: F401,F403
from .views_api_collaboration import *  # noqa: F401,F403
from .views_api_refs import *  # noqa: F401,F403

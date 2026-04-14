"""Probash Barta API — JSON endpoints."""

import json
import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

logger = logging.getLogger(__name__)

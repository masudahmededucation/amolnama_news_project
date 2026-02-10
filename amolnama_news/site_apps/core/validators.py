"""
Shared input validators — reusable across all apps.

Django's ORM already prevents SQL injection via parameterised queries.
These validators add defense-in-depth against XSS / HTML injection in
free-text fields (notes, addresses, remarks, descriptions).
"""
import re

from django.core.exceptions import ValidationError


# Pre-compiled patterns for performance
_RE_HTML_TAG = re.compile(r"<[^>]+>")
_RE_JS_URI = re.compile(r"javascript\s*:", re.IGNORECASE)
_RE_EVENT_HANDLER = re.compile(r"on\w+\s*=", re.IGNORECASE)
_RE_SCRIPT_ENTITY = re.compile(r"&#", re.IGNORECASE)


def validate_no_html(value):
    """Reject values that contain HTML tags or XSS patterns.

    Blocks:
    - HTML tags: <script>, <img>, <div>, etc.
    - javascript: URIs
    - Inline event handlers: onclick=, onerror=, etc.
    - HTML character entities used to bypass filters: &#60;
    """
    if _RE_HTML_TAG.search(value):
        raise ValidationError("HTML tags are not allowed.")
    if _RE_JS_URI.search(value):
        raise ValidationError("Invalid content detected.")
    if _RE_EVENT_HANDLER.search(value):
        raise ValidationError("Invalid content detected.")
    if _RE_SCRIPT_ENTITY.search(value):
        raise ValidationError("HTML character entities are not allowed.")


def validate_nid(value):
    """Bangladesh NID: 10 or 17 digits only."""
    if not re.fullmatch(r"\d{10}(\d{7})?", value):
        raise ValidationError("NID must be 10 or 17 digits.")


def validate_postal_code(value):
    """Alphanumeric postal code (letters, digits, spaces, hyphens)."""
    if not re.fullmatch(r"[A-Za-z0-9\s\-]{2,20}", value):
        raise ValidationError("Enter a valid postal code.")

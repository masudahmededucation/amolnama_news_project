"""Post template tags and filters."""

from django import template

from amolnama_news.site_apps.post.text_highlight import _replace_flag_emoji_with_twemoji

register = template.Library()


@register.filter(is_safe=True)
def twemoji_flags(text):
    """Replace flag emoji Unicode sequences with Twemoji SVG <img> tags.

    Delegates to the single source of truth in text_highlight.py.
    """
    if not text:
        return text
    return _replace_flag_emoji_with_twemoji(text)

"""Post template tags and filters."""

import re

from django import template

register = template.Library()

_FLAG_EMOJI_PATTERN = re.compile(r'([\U0001F1E6-\U0001F1FF]{2})')

_TWEMOJI_CDN = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg'


@register.filter(is_safe=True)
def twemoji_flags(text):
    """Replace flag emoji Unicode sequences with Twemoji SVG <img> tags.

    Windows doesn't render flag emojis — this converts them to cross-platform
    SVG images from the Twemoji CDN. Non-flag emojis are left untouched.
    """
    if not text:
        return text

    def _replace_flag(match):
        flag = match.group(1)
        codepoints = '-'.join(f'{ord(c):x}' for c in flag)
        return (
            f'<img src="{_TWEMOJI_CDN}/{codepoints}.svg" '
            f'alt="{flag}" class="post-twemoji-flag" '
            f'width="20" height="20" loading="lazy" decoding="async" '
            f'crossorigin="anonymous">'
        )

    return _FLAG_EMOJI_PATTERN.sub(_replace_flag, text)

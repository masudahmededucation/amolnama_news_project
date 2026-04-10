"""Content template tags — shared inclusion tags for all content detail pages
(news, poem, art, story, destination, debate, ...).
"""

from django import template

register = template.Library()


@register.inclusion_tag('content/components/actions-bar.html', takes_context=True)
def content_actions_bar(context, entity_id, share_title, content_type, position='top',
                        show_bookmark=True, like_count=0, view_count=0):
    """Render the shared actions bar for any content detail page.

    Usage:
        {% content_actions_bar poem.blog_poem_coll_poem_entry_id poem.poem_title_bn 'poem' position='top' like_count=poem.like_count view_count=poem.view_count %}

    Args:
        entity_id: int — primary key (used as DOM id + data-entity-id)
        share_title: str — title for share dialog AND bookmark cached title
        content_type: str — 'poem' / 'art' / 'story' / 'destination' / 'news' / 'debate'
                      Bookmark API uses this to discriminate.
        position: 'top' or 'bottom'
        show_bookmark: bool
        like_count, view_count: ints

    Required context (set by the detail view):
        - user_liked, user_bookmarked, can_edit (bools)
        - bookmark_count (int)
        - edit_url (str)
        - actions_bar_content_registry_id (int|None)
        - actions_bar_author_* (from build_actions_bar_author_context)
    """
    return {
        'request': context.get('request'),
        'actions_bar_entity_id': entity_id,
        'actions_bar_content_type': content_type,
        'actions_bar_like_count': like_count or 0,
        'actions_bar_view_count': view_count or 0,
        'actions_bar_user_liked': context.get('user_liked', False),
        'actions_bar_show_bookmark': show_bookmark,
        'actions_bar_user_bookmarked': context.get('user_bookmarked', False),
        'actions_bar_bookmark_count': context.get('bookmark_count', 0),
        'actions_bar_share_title': share_title,
        'actions_bar_content_registry_id': context.get('actions_bar_content_registry_id'),
        'actions_bar_can_edit': context.get('can_edit', False),
        'actions_bar_edit_url': context.get('edit_url', ''),
        'actions_bar_position': position,
        # Pass through writer info if present
        'actions_bar_author_display_name': context.get('actions_bar_author_display_name'),
        'actions_bar_author_username_handle': context.get('actions_bar_author_username_handle'),
        'actions_bar_author_user_profile_id': context.get('actions_bar_author_user_profile_id'),
        'actions_bar_author_is_own': context.get('actions_bar_author_is_own', False),
        'actions_bar_author_is_following': context.get('actions_bar_author_is_following', False),
        'actions_bar_author_profile_suffix': context.get('actions_bar_author_profile_suffix', ''),
    }

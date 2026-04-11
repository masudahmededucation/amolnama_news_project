"""Shared helper functions for the poem app."""

from .models import CollPoemEntry

# Category similarity map — ordered by thematic closeness.
# Uses unified subcategory IDs from [content].[ref_content_subcategory]
# group_code='blog_poem_category':
#   21=love, 22=nature, 23=patriotic, 24=sad, 25=spiritual, 26=political,
#   27=children, 28=free_verse, 29=romantic, 30=humorous, 31=protest, 32=life
SIMILAR_CATEGORIES = {
    21: [29, 24, 32, 28, 22],  # love → romantic, sad, life, free_verse, nature
    22: [32, 28, 25, 21, 27],  # nature → life, free_verse, spiritual, love, children
    23: [31, 26, 32, 28, 24],  # patriotic → protest, political, life, free_verse, sad
    24: [21, 29, 32, 28, 25],  # sad → love, romantic, life, free_verse, spiritual
    25: [32, 22, 28, 24, 21],  # spiritual → life, nature, free_verse, sad, love
    26: [31, 23, 32, 28, 24],  # political → protest, patriotic, life, free_verse, sad
    27: [30, 22, 32, 28, 21],  # children → humorous, nature, life, free_verse, love
    28: [32, 24, 21, 22, 29],  # free_verse → life, sad, love, nature, romantic
    29: [21, 24, 32, 28, 22],  # romantic → love, sad, life, free_verse, nature
    30: [27, 28, 32, 22, 21],  # humorous → children, free_verse, life, nature, love
    31: [26, 23, 32, 28, 24],  # protest → political, patriotic, life, free_verse, sad
    32: [28, 24, 22, 25, 21],  # life → free_verse, sad, nature, spiritual, love
}


def get_smart_related_poems(poem, limit=4, exclude_ids=None, require_audio=False):
    """Return a smart-ordered list of related poems.

    Same logic used by both the detail page (related section) and
    the autoplay API (next poem). One function, one list, one order.

    Priority:
      1. Same author + same category + same type
      2. Same author + same type
      3. Same category + same type, by popularity
      4. Same category, any type, by popularity
      5. Similar categories + same type, by closeness then popularity
      6. Similar categories, any type
      7. Any remaining by popularity
    """
    current_cat = poem.link_content_ref_content_subcategory_id
    current_author = poem.poem_author_display_name
    current_type = poem.poem_type_code or "poem"

    exclude = set(exclude_ids or [])
    exclude.add(poem.blog_poem_coll_poem_entry_id)

    base_queryset = CollPoemEntry.objects.exclude(blog_poem_coll_poem_entry_id__in=exclude)
    if require_audio:
        base_queryset = base_queryset.exclude(poem_audio_url__isnull=True).exclude(poem_audio_url="")

    result = []
    result_ids = set()

    def _add(queryset):
        """Add poems from queryset to result, skip duplicates, respect limit."""
        for poem_item in queryset:
            if len(result) >= limit:
                return
            if poem_item.blog_poem_coll_poem_entry_id not in result_ids:
                result.append(poem_item)
                result_ids.add(poem_item.blog_poem_coll_poem_entry_id)

    def _remaining():
        return limit - len(result)

    def _base():
        return base_queryset.exclude(blog_poem_coll_poem_entry_id__in=result_ids)

    # Priority 1: Same author + same category + same type
    if current_author and _remaining() > 0:
        _add(_base().filter(
            poem_author_display_name=current_author,
            link_content_ref_content_subcategory_id=current_cat,
            poem_type_code=current_type,
        ).order_by("-like_count")[:_remaining()])

    # Priority 2: Same author + same type
    if current_author and _remaining() > 0:
        _add(_base().filter(
            poem_author_display_name=current_author,
            poem_type_code=current_type,
        ).order_by("-like_count")[:_remaining()])

    # Priority 3: Same category + same type
    if _remaining() > 0:
        _add(_base().filter(
            link_content_ref_content_subcategory_id=current_cat,
            poem_type_code=current_type,
        ).order_by("-like_count", "-view_count")[:_remaining()])

    # Priority 4: Same category, any type
    if _remaining() > 0:
        _add(_base().filter(
            link_content_ref_content_subcategory_id=current_cat,
        ).order_by("-like_count", "-view_count")[:_remaining()])

    # Priority 5: Similar categories + same type
    if _remaining() > 0:
        for similar_cat in SIMILAR_CATEGORIES.get(current_cat, []):
            if _remaining() <= 0:
                break
            _add(_base().filter(
                link_content_ref_content_subcategory_id=similar_cat,
                poem_type_code=current_type,
            ).order_by("-like_count", "-view_count")[:_remaining()])

    # Priority 6: Similar categories, any type
    if _remaining() > 0:
        for similar_cat in SIMILAR_CATEGORIES.get(current_cat, []):
            if _remaining() <= 0:
                break
            _add(_base().filter(
                link_content_ref_content_subcategory_id=similar_cat,
            ).order_by("-like_count", "-view_count")[:_remaining()])

    # Priority 7: Any remaining by popularity
    if _remaining() > 0:
        _add(_base().order_by("-like_count", "-view_count")[:_remaining()])

    return result

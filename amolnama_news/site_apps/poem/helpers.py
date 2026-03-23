"""Shared helper functions for the poem app."""

from .models import CollPoemEntry

# Category similarity map — ordered by thematic closeness
# IDs: 1=Love, 2=Nature, 3=Patriotic, 4=Sad, 5=Spiritual, 6=Political,
#       7=Children, 9=Free Verse, 10=Romantic, 11=Humorous, 12=Protest, 13=Life
SIMILAR_CATEGORIES = {
    1: [10, 4, 13, 9, 2], 2: [13, 9, 5, 1, 7], 3: [12, 6, 13, 9, 4],
    4: [1, 10, 13, 9, 5], 5: [13, 2, 9, 4, 1], 6: [12, 3, 13, 9, 4],
    7: [11, 2, 13, 9, 1], 9: [13, 4, 1, 2, 10], 10: [1, 4, 13, 9, 2],
    11: [7, 9, 13, 2, 1], 12: [6, 3, 13, 9, 4], 13: [9, 4, 2, 5, 1],
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
    current_cat = poem.link_poem_ref_poem_category_id
    current_author = poem.poem_author_display_name
    current_type = poem.poem_type_code or "poem"

    exclude = set(exclude_ids or [])
    exclude.add(poem.poem_coll_poem_entry_id)

    base_queryset = CollPoemEntry.objects.exclude(poem_coll_poem_entry_id__in=exclude)
    if require_audio:
        base_queryset = base_queryset.exclude(poem_audio_url__isnull=True).exclude(poem_audio_url="")

    result = []
    result_ids = set()

    def _add(queryset):
        """Add poems from queryset to result, skip duplicates, respect limit."""
        for poem_item in queryset:
            if len(result) >= limit:
                return
            if poem_item.poem_coll_poem_entry_id not in result_ids:
                result.append(poem_item)
                result_ids.add(poem_item.poem_coll_poem_entry_id)

    def _remaining():
        return limit - len(result)

    def _base():
        return base_queryset.exclude(poem_coll_poem_entry_id__in=result_ids)

    # Priority 1: Same author + same category + same type
    if current_author and _remaining() > 0:
        _add(_base().filter(
            poem_author_display_name=current_author,
            link_poem_ref_poem_category_id=current_cat,
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
            link_poem_ref_poem_category_id=current_cat,
            poem_type_code=current_type,
        ).order_by("-like_count", "-view_count")[:_remaining()])

    # Priority 4: Same category, any type
    if _remaining() > 0:
        _add(_base().filter(
            link_poem_ref_poem_category_id=current_cat,
        ).order_by("-like_count", "-view_count")[:_remaining()])

    # Priority 5: Similar categories + same type
    if _remaining() > 0:
        for similar_cat in SIMILAR_CATEGORIES.get(current_cat, []):
            if _remaining() <= 0:
                break
            _add(_base().filter(
                link_poem_ref_poem_category_id=similar_cat,
                poem_type_code=current_type,
            ).order_by("-like_count", "-view_count")[:_remaining()])

    # Priority 6: Similar categories, any type
    if _remaining() > 0:
        for similar_cat in SIMILAR_CATEGORIES.get(current_cat, []):
            if _remaining() <= 0:
                break
            _add(_base().filter(
                link_poem_ref_poem_category_id=similar_cat,
            ).order_by("-like_count", "-view_count")[:_remaining()])

    # Priority 7: Any remaining by popularity
    if _remaining() > 0:
        _add(_base().order_by("-like_count", "-view_count")[:_remaining()])

    return result

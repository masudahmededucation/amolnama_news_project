"""bookwriter — reference list dispatcher (UI dropdowns).

Standalone module: this endpoint shares no state with the rest of the
write-API. It returns the seeded rows for any reference table the
front-end needs to populate a dropdown. Adding a new ref group is a
one-line registration in REF_GROUP_TABLE_MAP below.

URL: /bookwriter/api/refs/<ref_group_code>/
Returns: { 'ok': true, 'group': '<code>', 'items': [{id, code, name_en, name_bn?}, ...] }
Read-only — anonymous-OK.
"""

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import (
    RefActStructure,
    RefBetaPermission,
    RefBibleCategory,
    RefBookStatus,
    RefChapterStatus,
    RefChapterVisibility,
    RefCoverBackground,
    RefCoverFont,
    RefCoverPalette,
    RefCoverTemplate,
    RefPublishCadence,
    RefSerialReleaseStatus,
    RefViewDevice,
    RefViewReferrer,
)


REF_GROUP_TABLE_MAP = {
    'book_status':           (RefBookStatus,           'bookwriter_ref_book_status_id',           'book_status_code',           'book_status_name_en',           'book_status_name_bn'),
    'chapter_status':        (RefChapterStatus,        'bookwriter_ref_chapter_status_id',        'chapter_status_code',        'chapter_status_name_en',        'chapter_status_name_bn'),
    'chapter_visibility':    (RefChapterVisibility,    'bookwriter_ref_chapter_visibility_id',    'chapter_visibility_code',    'chapter_visibility_name_en',    'chapter_visibility_name_bn'),
    'cover_template':        (RefCoverTemplate,        'bookwriter_ref_cover_template_id',        'cover_template_code',        'cover_template_name_en',        'cover_template_name_bn'),
    'cover_palette':         (RefCoverPalette,         'bookwriter_ref_cover_palette_id',         'cover_palette_code',         'cover_palette_name_en',         None),
    'cover_background':      (RefCoverBackground,      'bookwriter_ref_cover_background_id',      'cover_background_code',      'cover_background_name_en',      None),
    'cover_font':            (RefCoverFont,            'bookwriter_ref_cover_font_id',            'cover_font_code',            'cover_font_name_en',            None),
    'beta_permission':       (RefBetaPermission,       'bookwriter_ref_beta_permission_id',       'beta_permission_code',       'beta_permission_name_en',       'beta_permission_name_bn'),
    'serial_release_status': (RefSerialReleaseStatus,  'bookwriter_ref_serial_release_status_id', 'serial_release_status_code', 'serial_release_status_name_en', 'serial_release_status_name_bn'),
    'publish_cadence':       (RefPublishCadence,       'bookwriter_ref_publish_cadence_id',       'publish_cadence_code',       'publish_cadence_name_en',       'publish_cadence_name_bn'),
    'act_structure':         (RefActStructure,         'bookwriter_ref_act_structure_id',         'act_structure_code',         'act_structure_name_en',         'act_structure_name_bn'),
    'bible_category':        (RefBibleCategory,        'bookwriter_ref_bible_category_id',        'bible_category_code',        'bible_category_name_en',        'bible_category_name_bn'),
    'view_referrer':         (RefViewReferrer,         'bookwriter_ref_view_referrer_id',         'view_referrer_code',         'view_referrer_name_en',         None),
    'view_device':           (RefViewDevice,           'bookwriter_ref_view_device_id',           'view_device_code',           'view_device_name_en',           None),
}


@require_GET
def api_bookwriter_ref_list(request, ref_group_code):
    """Return the seeded rows for a reference table."""
    spec = REF_GROUP_TABLE_MAP.get(ref_group_code)
    if spec is None:
        return JsonResponse({
            'ok': False,
            'error': 'Unknown ref group',
            'available_groups': sorted(REF_GROUP_TABLE_MAP.keys()),
        }, status=404)

    ref_class, pk_field, code_field, name_en_field, name_bn_field = spec
    select_fields = [pk_field, code_field, name_en_field]
    if name_bn_field:
        select_fields.append(name_bn_field)

    rows = (
        ref_class.objects
        .filter(is_active=True)
        .order_by('sort_order', pk_field)
        .values(*select_fields)
    )

    items = []
    for row in rows:
        item = {
            'id': row[pk_field],
            'code': row[code_field],
            'name_en': row[name_en_field],
        }
        if name_bn_field:
            item['name_bn'] = row.get(name_bn_field)
        items.append(item)

    return JsonResponse({'ok': True, 'group': ref_group_code, 'items': items})

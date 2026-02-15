from django.db.models import Q
from django.http import JsonResponse

from amolnama_news.site_apps.locations.models import Constituency, District, UnionParishad, Upazila
from amolnama_news.site_apps.user_account.models import Organisation

from .models import (
    RefNewsCategory,
    RefNewsCategoryTag,
    VwAppNewsCategoryTag,
)


# ========== Location API Views ==========

def api_constituencies_by_district(request, district_id):
    """Return constituencies for a given district as JSON."""
    qs = Constituency.objects.filter(
        link_district_id=district_id,
        is_active=True,
    ).order_by('constituency_name_bn')

    data = []
    for c in qs:
        data.append({
            'id': c.constituency_id,
            'name_bn': c.constituency_name_bn or '',
            'name_en': c.constituency_name_en or '',
            'area_bn': c.constituency_area_list_bn or '',
        })

    return JsonResponse({'constituencies': data})


def api_upazilas_by_district(request, district_id):
    """Return upazilas for a given district as JSON."""
    qs = Upazila.objects.filter(
        link_district_id=district_id,
        is_active=True,
    ).order_by('upazila_name_bn')

    data = []
    for u in qs:
        data.append({
            'id': u.upazila_id,
            'name_bn': u.upazila_name_bn or '',
            'name_en': u.upazila_name_en or '',
        })

    return JsonResponse({'upazilas': data})


def api_union_parishads_by_upazila(request, upazila_id):
    """Return union parishads for a given upazila as JSON."""
    qs = UnionParishad.objects.filter(
        link_upazila_id=upazila_id,
        is_active=True,
    ).order_by('union_parishad_name_bn')

    data = []
    for up in qs:
        data.append({
            'id': up.union_parishad_id,
            'name_bn': up.union_parishad_name_bn or '',
            'name_en': up.union_parishad_name_en or '',
        })

    return JsonResponse({'union_parishads': data})


def api_locations_all(request):
    """Return all active districts, upazilas, and union parishads with hierarchy links.
    Used by news-auto-location.js to detect locations from content body text."""
    districts = []
    for d in District.objects.filter(is_active=True).order_by('district_name_bn'):
        districts.append({
            'id': d.district_id,
            'name_bn': d.district_name_bn or '',
            'name_en': d.district_name_en or '',
        })

    upazilas = []
    for u in Upazila.objects.filter(is_active=True).order_by('upazila_name_bn'):
        upazilas.append({
            'id': u.upazila_id,
            'name_bn': u.upazila_name_bn or '',
            'name_en': u.upazila_name_en or '',
            'district_id': u.link_district_id,
        })

    unions = []
    for up in UnionParishad.objects.filter(is_active=True).order_by('union_parishad_name_bn'):
        unions.append({
            'id': up.union_parishad_id,
            'name_bn': up.union_parishad_name_bn or '',
            'name_en': up.union_parishad_name_en or '',
            'upazila_id': up.link_upazila_id,
        })

    return JsonResponse({
        'districts': districts,
        'upazilas': upazilas,
        'union_parishads': unions,
    })


# ========== News Category Tag API Views ==========

def api_news_category_tags_by_category(request, category_id):
    """Return tags linked to a category via vw_app_news_category_tags view."""
    qs = VwAppNewsCategoryTag.objects.filter(
        news_category_id=category_id,
    ).order_by('news_tag_group_code', 'sort_order')

    data = []
    for tag in qs:
        data.append({
            'id': tag.news_category_tag_id,
            'name_bn': tag.news_tag_name_bn,
            'name_en': tag.news_tag_name_en,
            'group_code': tag.news_tag_group_code or '',
        })

    return JsonResponse({'tags': data})


def api_news_category_tags_all(request):
    """Return unique tags from vw_app_news_category_tags view. Used by news-auto-tag.js for content body matching.
    Deduplicated by tag name — the same tag linked to multiple categories appears only once."""
    qs = VwAppNewsCategoryTag.objects.all().order_by('news_category_id', 'news_tag_group_code', 'sort_order')

    seen = set()
    data = []
    for tag in qs:
        key = (tag.news_tag_name_bn, tag.news_tag_name_en)
        if key in seen:
            continue
        seen.add(key)
        data.append({
            'id': tag.news_category_tag_id,
            'name_bn': tag.news_tag_name_bn,
            'name_en': tag.news_tag_name_en,
            'group_code': tag.news_tag_group_code or '',
        })

    return JsonResponse({'tags': data})


# ========== Full-Text Search API Views ==========

def api_news_category_search(request):
    """Full-Text Search on ref_news_category (name_bn, name_en, search_aliases).
    Supports transliterated queries like 'nirbachon' matching 'নির্বাচন (Election)'.
    Uses SQL Server FTS index with CONTAINS and LANGUAGE 1033."""
    q = request.GET.get('q', '').strip()
    if len(q) < 2:
        return JsonResponse({'categories': []})

    # Build FTS search term with prefix matching
    words = q.split()
    if len(words) > 1:
        search_term = ' AND '.join(f'"{w}*"' for w in words)
    else:
        search_term = f'"{q}*"'

    sql = """
        SELECT * FROM [newshub].[ref_news_category]
        WHERE is_active = 1
          AND CONTAINS(
            ([news_category_name_bn], [news_category_name_en], [news_category_search_aliases]),
            %s,
            LANGUAGE 1033
          )
        ORDER BY sort_order, news_category_name_bn
    """
    results = RefNewsCategory.objects.raw(sql, [search_term])

    data = [{'id': c.news_category_id, 'name_bn': c.news_category_name_bn,
             'name_en': c.news_category_name_en} for c in results]
    return JsonResponse({'categories': data})


def api_news_category_tags_search(request):
    """Full-Text Search on ref_news_category_tag (name_bn, name_en, search_aliases).
    Supports transliterated queries like 'sontras' matching 'সন্ত্রাসী হামলা (Terrorist Attack)'.
    Uses SQL Server FTS index with CONTAINS and LANGUAGE 1033."""
    q = request.GET.get('q', '').strip()
    if len(q) < 2:
        return JsonResponse({'tags': []})

    # Build FTS search term with prefix matching
    words = q.split()
    if len(words) > 1:
        search_term = ' AND '.join(f'"{w}*"' for w in words)
    else:
        search_term = f'"{q}*"'

    sql = """
        SELECT * FROM [newshub].[ref_news_category_tag]
        WHERE CONTAINS(
            ([news_tag_name_bn], [news_tag_name_en], [news_tag_search_aliases]),
            %s,
            LANGUAGE 1033
          )
        ORDER BY sort_order, news_tag_name_bn
    """
    results = RefNewsCategoryTag.objects.raw(sql, [search_term])

    data = [{'id': t.news_category_tag_id, 'name_bn': t.news_tag_name_bn,
             'name_en': t.news_tag_name_en} for t in results]
    return JsonResponse({'tags': data})


# ========== Organisation API Views ==========

def api_organisations_by_type(request, type_id):
    """Return organisations for a given organisation type as JSON."""
    qs = Organisation.objects.filter(
        link_organisation_type_id=type_id,
        is_active=True,
    ).order_by('organisation_name_bn', 'organisation_name_en')

    data = []
    for o in qs:
        data.append({
            'id': o.organisation_id,
            'name_bn': o.organisation_name_bn or '',
            'name_en': o.organisation_name_en or '',
        })

    return JsonResponse({'organisations': data})


def api_organisation_search(request):
    """Search organisations by name (EN or BN) with LIKE %q%."""
    q = request.GET.get('q', '').strip()
    type_id = request.GET.get('type_id', '')

    if len(q) < 2:
        return JsonResponse({'organisations': []})

    qs = Organisation.objects.filter(
        Q(organisation_name_en__icontains=q) | Q(organisation_name_bn__icontains=q),
        is_active=True,
    )
    if type_id and type_id.isdigit():
        qs = qs.filter(link_organisation_type_id=int(type_id))

    qs = qs.order_by('organisation_name_bn', 'organisation_name_en')[:15]

    data = []
    for o in qs:
        data.append({
            'id': o.organisation_id,
            'name_bn': o.organisation_name_bn or '',
            'name_en': o.organisation_name_en or '',
            'type_id': o.link_organisation_type_id,
        })

    return JsonResponse({'organisations': data})

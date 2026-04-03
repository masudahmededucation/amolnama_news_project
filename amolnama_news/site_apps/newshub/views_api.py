from django.db.models import Q
from django.http import JsonResponse

from amolnama_news.site_apps.locations.models import (
    Constituency, District, UnionParishad, Upazila,
    MetropolitanThana, MetropolitanThanaWard,
    CityCorporation, CityCorporationWard,
    Municipality, MunicipalityWard,
    UnionParishadWard, UnionParishadVillage,
    UnifiedLocationSearch,
)
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
    ).order_by('constituency_name_en')

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
    ).order_by('upazila_name_en')

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
    ).order_by('union_parishad_name_en')

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
    for d in District.objects.filter(is_active=True).order_by('district_name_en'):
        districts.append({
            'id': d.district_id,
            'name_bn': d.district_name_bn or '',
            'name_en': d.district_name_en or '',
        })

    upazilas = []
    for u in Upazila.objects.filter(is_active=True).order_by('upazila_name_en'):
        upazilas.append({
            'id': u.upazila_id,
            'name_bn': u.upazila_name_bn or '',
            'name_en': u.upazila_name_en or '',
            'district_id': u.link_district_id,
        })

    unions = []
    for up in UnionParishad.objects.filter(is_active=True).order_by('union_parishad_name_en'):
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


# ========== Combined Cascade Location API Views ==========

def api_subdistricts_by_district(request, district_id):
    """Return city corporations + metropolitan thanas + municipalities + upazilas
    for a district, each tagged with type and group label for <optgroup>.
    Used by the combined উপজেলা/থানা/সিটি কর্পোরেশন/পৌরসভা dropdown."""
    data = []

    for cc in CityCorporation.objects.filter(
        link_district_id=district_id, is_active=True,
    ).order_by('city_corporation_name_en'):
        data.append({
            'id': cc.city_corporation_id,
            'name_bn': cc.city_corporation_name_bn or '',
            'name_en': cc.city_corporation_name_en or '',
            'type': 'city_corporation',
            'group': 'সিটি কর্পোরেশন (City Corporation)',
            'lat': float(cc.city_corporation_geo_latitude) if cc.city_corporation_geo_latitude else None,
            'lng': float(cc.city_corporation_geo_longitude) if cc.city_corporation_geo_longitude else None,
        })

    for t in MetropolitanThana.objects.filter(
        link_district_id=district_id, is_active=True,
    ).order_by('metropolitan_thana_name_en'):
        data.append({
            'id': t.metropolitan_thana_id,
            'name_bn': t.metropolitan_thana_name_bn or '',
            'name_en': t.metropolitan_thana_name_en or '',
            'type': 'metropolitan_thana',
            'group': 'মহানগর থানা (Metropolitan Thana)',
            'lat': float(t.metropolitan_thana_latitude) if t.metropolitan_thana_latitude else None,
            'lng': float(t.metropolitan_thana_longitude) if t.metropolitan_thana_longitude else None,
        })

    for m in Municipality.objects.filter(
        link_district_id=district_id, is_active=True,
    ).order_by('municipality_name_en'):
        data.append({
            'id': m.municipality_id,
            'name_bn': m.municipality_name_bn or '',
            'name_en': m.municipality_name_en or '',
            'type': 'municipality',
            'group': 'পৌরসভা (Municipality)',
            'lat': float(m.municipality_geo_latitude) if m.municipality_geo_latitude else None,
            'lng': float(m.municipality_geo_longitude) if m.municipality_geo_longitude else None,
        })

    for u in Upazila.objects.filter(
        link_district_id=district_id, is_active=True,
    ).order_by('upazila_name_en'):
        data.append({
            'id': u.upazila_id,
            'name_bn': u.upazila_name_bn or '',
            'name_en': u.upazila_name_en or '',
            'type': 'upazila',
            'group': 'উপজেলা (Upazila)',
            'lat': float(u.upazila_latitude) if u.upazila_latitude else None,
            'lng': float(u.upazila_longitude) if u.upazila_longitude else None,
        })

    return JsonResponse({'subdistricts': data})


def api_local_bodies_by_parent(request):
    """Return union parishads for an upazila.
    City corporations and municipalities are now at the subdistrict level.
    Query params: parent_type, parent_id."""
    parent_type = request.GET.get('parent_type', '')
    parent_id = request.GET.get('parent_id', '')

    if not parent_id or not parent_id.isdigit():
        return JsonResponse({'local_bodies': []})

    parent_id = int(parent_id)
    data = []

    if parent_type == 'upazila':
        for up in UnionParishad.objects.filter(
            link_upazila_id=parent_id, is_active=True,
        ).order_by('union_parishad_name_en'):
            data.append({
                'id': up.union_parishad_id,
                'name_bn': up.union_parishad_name_bn or '',
                'name_en': up.union_parishad_name_en or '',
                'type': 'union_parishad',
                'lat': float(up.union_parishad_latitude) if up.union_parishad_latitude else None,
                'lng': float(up.union_parishad_longitude) if up.union_parishad_longitude else None,
            })

    return JsonResponse({'local_bodies': data})


def api_union_parishad_wards_by_union_parishad(request, union_parishad_id):
    """Return wards for a given union parishad."""
    qs = UnionParishadWard.objects.filter(
        link_union_parishad_id=union_parishad_id, is_active=True,
    ).only(
        'union_parishad_ward_id', 'union_parishad_ward_number',
        'union_parishad_ward_name_en', 'union_parishad_ward_name_bn',
        'union_parishad_ward_geo_latitude', 'union_parishad_ward_geo_longitude',
    ).order_by('union_parishad_ward_number')

    data = []
    for w in qs:
        name_bn = w.union_parishad_ward_name_bn or w.union_parishad_ward_name_en or ''
        name_en = w.union_parishad_ward_name_en or ''
        data.append({
            'id': w.union_parishad_ward_id,
            'name_bn': name_bn,
            'name_en': name_en,
            'type': 'union_parishad_ward',
            'lat': float(w.union_parishad_ward_geo_latitude) if w.union_parishad_ward_geo_latitude else None,
            'lng': float(w.union_parishad_ward_geo_longitude) if w.union_parishad_ward_geo_longitude else None,
        })

    return JsonResponse({'wards': data})


def api_municipality_wards_by_municipality(request, municipality_id):
    """Return wards for a given municipality."""
    qs = MunicipalityWard.objects.filter(
        link_municipality_id=municipality_id, is_active=True,
    ).only(
        'municipality_ward_id', 'municipality_ward_number',
        'municipality_ward_name_en', 'municipality_ward_area_name_en',
        'municipality_ward_area_name_bn',
        'municipality_ward_geo_latitude', 'municipality_ward_geo_longitude',
    ).order_by('municipality_ward_number')

    data = []
    for w in qs:
        name_bn = w.municipality_ward_area_name_bn or w.municipality_ward_name_en or ''
        name_en = w.municipality_ward_area_name_en or w.municipality_ward_name_en or ''
        data.append({
            'id': w.municipality_ward_id,
            'name_bn': name_bn,
            'name_en': name_en,
            'type': 'municipality_ward',
            'lat': float(w.municipality_ward_geo_latitude) if w.municipality_ward_geo_latitude else None,
            'lng': float(w.municipality_ward_geo_longitude) if w.municipality_ward_geo_longitude else None,
        })

    return JsonResponse({'wards': data})


def api_city_corporation_wards_by_city_corporation(request, city_corporation_id):
    """Return wards for a given city corporation."""
    qs = CityCorporationWard.objects.filter(
        link_city_corporation_id=city_corporation_id, is_active=True,
    ).only(
        'city_corporation_ward_id', 'city_corporation_ward_number',
        'city_corporation_ward_name_en', 'city_corporation_ward_area_name_en',
        'city_corporation_ward_area_name_bn',
        'city_corporation_ward_geo_latitude', 'city_corporation_ward_geo_longitude',
    ).order_by('city_corporation_ward_number')

    data = []
    for w in qs:
        name_bn = w.city_corporation_ward_area_name_bn or w.city_corporation_ward_name_en or ''
        name_en = w.city_corporation_ward_area_name_en or w.city_corporation_ward_name_en or ''
        data.append({
            'id': w.city_corporation_ward_id,
            'name_bn': name_bn,
            'name_en': name_en,
            'type': 'city_corporation_ward',
            'lat': float(w.city_corporation_ward_geo_latitude) if w.city_corporation_ward_geo_latitude else None,
            'lng': float(w.city_corporation_ward_geo_longitude) if w.city_corporation_ward_geo_longitude else None,
        })

    return JsonResponse({'wards': data})


def api_city_corporation_wards_by_metropolitan_thana(request, metropolitan_thana_id):
    """Return city corporation wards linked to a metropolitan thana via junction table."""
    # Subquery — Django sends a single SQL with IN (SELECT ...) instead of two round-trips
    ward_id_subquery = MetropolitanThanaWard.objects.filter(
        link_metropolitan_thana_id=metropolitan_thana_id,
    ).values('link_city_corporation_ward_id')

    qs = CityCorporationWard.objects.filter(
        city_corporation_ward_id__in=ward_id_subquery, is_active=True,
    ).only(
        'city_corporation_ward_id', 'city_corporation_ward_number',
        'city_corporation_ward_name_en', 'city_corporation_ward_area_name_en',
        'city_corporation_ward_area_name_bn',
        'city_corporation_ward_geo_latitude', 'city_corporation_ward_geo_longitude',
    ).order_by('city_corporation_ward_number')

    data = []
    for w in qs:
        name_bn = w.city_corporation_ward_area_name_bn or w.city_corporation_ward_name_en or ''
        name_en = w.city_corporation_ward_area_name_en or w.city_corporation_ward_name_en or ''
        data.append({
            'id': w.city_corporation_ward_id,
            'name_bn': name_bn,
            'name_en': name_en,
            'type': 'city_corporation_ward',
            'lat': float(w.city_corporation_ward_geo_latitude) if w.city_corporation_ward_geo_latitude else None,
            'lng': float(w.city_corporation_ward_geo_longitude) if w.city_corporation_ward_geo_longitude else None,
        })

    return JsonResponse({'wards': data})


def api_union_parishad_villages_by_union_parishad(request, union_parishad_id):
    """Return villages for a given union parishad."""
    qs = UnionParishadVillage.objects.filter(
        link_union_parishad_id=union_parishad_id, is_active=True,
    ).order_by('union_parishad_village_name_en')

    data = []
    for v in qs:
        data.append({
            'id': v.union_parishad_village_id,
            'name_bn': v.union_parishad_village_name_bn or '',
            'name_en': v.union_parishad_village_name_en or '',
            'type': 'village',
            'lat': float(v.union_parishad_village_geo_latitude) if v.union_parishad_village_geo_latitude else None,
            'lng': float(v.union_parishad_village_geo_longitude) if v.union_parishad_village_geo_longitude else None,
        })

    return JsonResponse({'villages': data})


def api_unified_location_search(request):
    """Search the unified location view for Tom Select.
    Matches location names with startswith for typeahead UX.
    Returns locations with display titles showing full hierarchy path."""
    q = request.GET.get('q', '').strip()
    if len(q) < 1:
        return JsonResponse({'locations': []})

    qs = UnifiedLocationSearch.objects.filter(
        Q(unified_location_search_name_en__istartswith=q)
        | Q(unified_location_search_name_bn__istartswith=q)
    ).order_by('link_location_type_id', 'unified_location_display_title_en')[:30]

    data = []
    for loc in qs:
        data.append({
            'id': loc.unified_location_search_id,
            'entity_id': loc.link_location_id,
            'table': loc.link_location_table,
            'type': loc.location_type or '',
            'name_bn': loc.unified_location_search_name_bn or '',
            'name_en': loc.unified_location_search_name_en or '',
            'title_bn': loc.unified_location_display_title_bn or '',
            'title_en': loc.unified_location_display_title_en or '',
        })

    return JsonResponse({'locations': data})


def api_location_resolve_ancestry(request):
    """Resolve parent chain for a single location entity.
    Used by unified search to auto-fill cascade after selection.
    Query params: table (location table name, e.g. '[location].[upazila]'), id (entity primary key)."""
    table = request.GET.get('table', '').strip()
    entity_id = request.GET.get('id', '').strip()

    if not entity_id or not entity_id.isdigit():
        return JsonResponse({'parent_ids': {}})

    # Normalize bracketed table name: [location].[upazila] → upazila
    if '[' in table:
        table = table.split('.')[-1].strip('[]')

    entity_id = int(entity_id)
    ids = {}

    if table == 'district':
        ids['district_id'] = entity_id

    elif table == 'upazila':
        ids['upazila_id'] = entity_id
        obj = Upazila.objects.filter(upazila_id=entity_id).values('link_district_id').first()
        if obj:
            ids['district_id'] = obj['link_district_id']

    elif table == 'metropolitan_thana':
        ids['metropolitan_thana_id'] = entity_id
        obj = MetropolitanThana.objects.filter(
            metropolitan_thana_id=entity_id,
        ).values('link_district_id').first()
        if obj:
            ids['district_id'] = obj['link_district_id']

    elif table == 'union_parishad':
        ids['union_parishad_id'] = entity_id
        obj = UnionParishad.objects.filter(
            union_parishad_id=entity_id,
        ).values('link_upazila_id').first()
        if obj and obj['link_upazila_id']:
            ids['upazila_id'] = obj['link_upazila_id']
            parent = Upazila.objects.filter(
                upazila_id=obj['link_upazila_id'],
            ).values('link_district_id').first()
            if parent:
                ids['district_id'] = parent['link_district_id']

    elif table == 'municipality':
        # Municipality is at subdistrict level (alongside upazilas) — resolve to district only
        ids['municipality_id'] = entity_id
        obj = Municipality.objects.filter(
            municipality_id=entity_id,
        ).values('link_district_id').first()
        if obj and obj['link_district_id']:
            ids['district_id'] = obj['link_district_id']

    elif table == 'city_corporation':
        ids['city_corporation_id'] = entity_id
        obj = CityCorporation.objects.filter(
            city_corporation_id=entity_id,
        ).values('link_district_id').first()
        if obj:
            ids['district_id'] = obj['link_district_id']

    elif table == 'union_parishad_ward':
        ids['union_parishad_ward_id'] = entity_id
        obj = UnionParishadWard.objects.filter(
            union_parishad_ward_id=entity_id,
        ).values('link_union_parishad_id').first()
        if obj:
            ids['union_parishad_id'] = obj['link_union_parishad_id']
            parent = UnionParishad.objects.filter(
                union_parishad_id=obj['link_union_parishad_id'],
            ).values('link_upazila_id').first()
            if parent and parent['link_upazila_id']:
                ids['upazila_id'] = parent['link_upazila_id']
                gp = Upazila.objects.filter(
                    upazila_id=parent['link_upazila_id'],
                ).values('link_district_id').first()
                if gp:
                    ids['district_id'] = gp['link_district_id']

    elif table == 'municipality_ward':
        # Municipality is at subdistrict level — resolve ward → municipality → district
        ids['municipality_ward_id'] = entity_id
        obj = MunicipalityWard.objects.filter(
            municipality_ward_id=entity_id,
        ).values('link_municipality_id').first()
        if obj:
            ids['municipality_id'] = obj['link_municipality_id']
            parent = Municipality.objects.filter(
                municipality_id=obj['link_municipality_id'],
            ).values('link_district_id').first()
            if parent and parent['link_district_id']:
                ids['district_id'] = parent['link_district_id']

    elif table == 'city_corporation_ward':
        ids['city_corporation_ward_id'] = entity_id
        obj = CityCorporationWard.objects.filter(
            city_corporation_ward_id=entity_id,
        ).values('link_city_corporation_id').first()
        if obj:
            ids['city_corporation_id'] = obj['link_city_corporation_id']
            parent = CityCorporation.objects.filter(
                city_corporation_id=obj['link_city_corporation_id'],
            ).values('link_district_id').first()
            if parent:
                ids['district_id'] = parent['link_district_id']
            # Find metro thana via junction for Level 2 auto-fill
            junction = MetropolitanThanaWard.objects.filter(
                link_city_corporation_ward_id=entity_id,
                is_primary_thana=True,
            ).values('link_metropolitan_thana_id').first()
            if not junction:
                junction = MetropolitanThanaWard.objects.filter(
                    link_city_corporation_ward_id=entity_id,
                ).values('link_metropolitan_thana_id').first()
            if junction:
                ids['metropolitan_thana_id'] = junction['link_metropolitan_thana_id']

    elif table == 'union_parishad_village':
        ids['union_parishad_village_id'] = entity_id
        obj = UnionParishadVillage.objects.filter(
            union_parishad_village_id=entity_id,
        ).values('link_union_parishad_id').first()
        if obj:
            ids['union_parishad_id'] = obj['link_union_parishad_id']
            parent = UnionParishad.objects.filter(
                union_parishad_id=obj['link_union_parishad_id'],
            ).values('link_upazila_id').first()
            if parent and parent['link_upazila_id']:
                ids['upazila_id'] = parent['link_upazila_id']
                gp = Upazila.objects.filter(
                    upazila_id=parent['link_upazila_id'],
                ).values('link_district_id').first()
                if gp:
                    ids['district_id'] = gp['link_district_id']

    return JsonResponse({'parent_ids': ids})


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
        link_ref_organisation_type_id=type_id,
        is_active=True,
    ).order_by('organisation_name_en')

    data = []
    for o in qs:
        data.append({
            'id': o.directory_organisation_id,
            'name_bn': o.organisation_name_bn or '',
            'name_en': o.organisation_name_en or '',
        })

    return JsonResponse({'organisations': data})


def api_wcv_thana_search(request):
    """Search for police stations (থানা) by name.
    Combines upazilas (rural thanas) and metropolitan thanas from the unified
    location search view.  Used for Tom Select on the WCV legal form.
    Returns: { results: [{value, name_bn, name_en, title_bn, title_en, type}] }
    """
    q = request.GET.get('q', '').strip()
    if len(q) < 2:
        return JsonResponse({'results': []})

    qs = UnifiedLocationSearch.objects.filter(
        location_type__in=['upazila', 'metropolitan_thana'],
    ).filter(
        Q(unified_location_search_name_en__icontains=q)
        | Q(unified_location_search_name_bn__icontains=q)
    ).order_by('unified_location_display_title_en')[:20]

    results = []
    for loc in qs:
        name_bn = loc.unified_location_search_name_bn or ''
        name_en = loc.unified_location_search_name_en or ''
        value = name_bn
        if name_en:
            value += ' (' + name_en + ')'
        results.append({
            'value': value,
            'name_bn': name_bn,
            'name_en': name_en,
            'title_bn': loc.unified_location_display_title_bn or value,
            'title_en': loc.unified_location_display_title_en or '',
            'type': loc.location_type or '',
        })

    return JsonResponse({'results': results})


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
        qs = qs.filter(link_ref_organisation_type_id=int(type_id))

    qs = qs.order_by('organisation_name_en')[:15]

    data = []
    for o in qs:
        data.append({
            'id': o.directory_organisation_id,
            'name_bn': o.organisation_name_bn or '',
            'name_en': o.organisation_name_en or '',
            'type_id': o.link_ref_organisation_type_id,
        })

    return JsonResponse({'organisations': data})


def api_article_comment_create(request, pub_article_id):
    """Create a comment on a published article. Login required, 0 points minimum."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'POST only'}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'লগইন প্রয়োজন'}, status=401)

    import json
    from django.utils import timezone
    from .models import EngagementComment, PubArticle

    try:
        published_article = PubArticle.objects.get(
            pub_article_id=pub_article_id, is_published=True
        )
    except PubArticle.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Article not found'}, status=404)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    comment_text = (body.get('comment_text') or '').strip()
    if not comment_text:
        return JsonResponse({'success': False, 'error': 'মন্তব্য খালি রাখা যাবে না'})

    EngagementComment.objects.create(
        link_pub_article_id=published_article.pub_article_id,
        link_user_id=request.user.pk,
        engagement_comment_text=comment_text,
        is_approved=True,
        created_at=timezone.now(),
    )

    return JsonResponse({'success': True})


def api_article_update_publication_status(request, entry_id):
    """Update article publication status. Admin/editor only."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'POST only'}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'লগইন প্রয়োজন'}, status=401)

    import json
    from django.utils import timezone
    from .models import CollNewsEntry

    try:
        entry = CollNewsEntry.objects.get(coll_news_entry_id=entry_id)
    except CollNewsEntry.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Article not found'}, status=404)

    # Permission check — admin, staff, or article owner
    is_owner = False
    if entry.link_contributor_id:
        from .models import Contributor
        from amolnama_news.site_apps.user_account.models import UserProfile
        try:
            contributor = Contributor.objects.get(newshub_contributor_id=entry.link_contributor_id)
            if contributor.link_user_profile_id:
                user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
                if contributor.link_user_profile_id == user_profile.user_profile_id:
                    is_owner = True
        except (Contributor.DoesNotExist, UserProfile.DoesNotExist):
            pass
    if not (request.user.is_staff or request.user.is_superuser or is_owner):
        return JsonResponse({'success': False, 'error': 'অনুমতি নেই'}, status=403)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    new_status_id = body.get('status_id')
    if not new_status_id:
        return JsonResponse({'success': False, 'error': 'Status ID required'})

    # Verify status exists
    from amolnama_news.site_apps.investigation.models import RefStatus
    try:
        new_status = RefStatus.objects.get(
            status_id=new_status_id,
            group_code='article_publication_status',
            is_active=True
        )
    except RefStatus.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Invalid status'})

    # Update
    old_status_id = entry.link_ref_status_article_publication_status_id
    entry.link_ref_status_article_publication_status_id = int(new_status_id)
    entry.updated_at = timezone.now()
    entry.save(update_fields=['link_ref_status_article_publication_status_id', 'updated_at'])

    return JsonResponse({
        'success': True,
        'new_status_code': new_status.status_code,
        'new_status_name_bn': new_status.status_name_bn,
        'new_status_icon': new_status.status_icon or '',
    })


# ============================================================================
# Article Photo Management (cover, edit caption, delete)
# ============================================================================

from django.views.decorators.http import require_http_methods
from django.db import connection

from .models import CollNewsEntry, NewsAsset


def _can_manage_article(request, coll_news_entry_id):
    """Check if user can manage an article's photos.

    Allowed: contributor owner, staff, admin.
    Returns (is_allowed: bool, entry: CollNewsEntry | None).
    """
    if not request.user.is_authenticated:
        return False, None

    try:
        entry = CollNewsEntry.objects.get(coll_news_entry_id=coll_news_entry_id)
    except CollNewsEntry.DoesNotExist:
        return False, None

    if request.user.is_staff or request.user.is_superuser:
        return True, entry

    from amolnama_news.site_apps.user_account.models import UserProfile
    from .models import Contributor
    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
        contributor = Contributor.objects.get(newshub_contributor_id=entry.link_contributor_id)
        if contributor.link_user_profile_id == user_profile.user_profile_id:
            return True, entry
    except (UserProfile.DoesNotExist, Contributor.DoesNotExist):
        pass

    return False, entry


def _get_asset_file_url(asset_id):
    """Get file URL for an asset via raw SQL (file_storage_path is computed column)."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT '/media/' + [media].[asset].file_storage_path "
            "FROM [media].[asset] "
            "WHERE [media].[asset].asset_id = %s",
            [asset_id],
        )
        row = cursor.fetchone()
        return row[0] if row else ''


@require_http_methods(["PATCH"])
def api_article_cover_image_set(request, coll_news_entry_id, asset_id):
    """PATCH — set a photo as the article cover/featured image.

    Toggles is_featured on NewsAsset: clears all, sets the target.
    Only article contributor owner + staff/admin can change.
    """
    is_allowed, entry = _can_manage_article(request, coll_news_entry_id)
    if entry is None:
        return JsonResponse({"success": False, "error": "Article not found"}, status=404)
    if not is_allowed:
        return JsonResponse({"success": False, "error": "লগইন প্রয়োজন বা অনুমতি নেই"}, status=403)

    # Verify the asset belongs to this entry
    if not NewsAsset.objects.filter(
        link_coll_news_entry_id=coll_news_entry_id,
        link_asset_id=asset_id,
    ).exists():
        return JsonResponse({"success": False, "error": "Photo not found"}, status=404)

    # Clear all featured flags for this entry, then set the target
    NewsAsset.objects.filter(
        link_coll_news_entry_id=coll_news_entry_id
    ).update(is_featured=False)

    NewsAsset.objects.filter(
        link_coll_news_entry_id=coll_news_entry_id,
        link_asset_id=asset_id,
    ).update(is_featured=True)

    cover_image_url = _get_asset_file_url(asset_id)
    return JsonResponse({"success": True, "cover_image_url": cover_image_url})


@require_http_methods(["PATCH"])
def api_article_photo_caption_update(request, coll_news_entry_id, asset_id):
    """PATCH — edit an article photo caption.

    Only article contributor owner + staff/admin can edit.
    """
    is_allowed, entry = _can_manage_article(request, coll_news_entry_id)
    if entry is None:
        return JsonResponse({"success": False, "error": "Article not found"}, status=404)
    if not is_allowed:
        return JsonResponse({"success": False, "error": "লগইন প্রয়োজন বা অনুমতি নেই"}, status=403)

    # Verify the asset belongs to this entry
    if not NewsAsset.objects.filter(
        link_coll_news_entry_id=coll_news_entry_id,
        link_asset_id=asset_id,
    ).exists():
        return JsonResponse({"success": False, "error": "Photo not found"}, status=404)

    import json
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    new_caption = (body.get("caption_bn") or "").strip() or None

    NewsAsset.objects.filter(
        link_coll_news_entry_id=coll_news_entry_id,
        link_asset_id=asset_id,
    ).update(news_asset_caption_bn=new_caption)

    return JsonResponse({"success": True, "caption_bn": new_caption or ""})


@require_http_methods(["DELETE"])
def api_article_photo_delete(request, coll_news_entry_id, asset_id):
    """DELETE — remove a photo from an article.

    Deletes the NewsAsset junction record (keeps the Asset file).
    Only article contributor owner + staff/admin can delete.
    """
    is_allowed, entry = _can_manage_article(request, coll_news_entry_id)
    if entry is None:
        return JsonResponse({"success": False, "error": "Article not found"}, status=404)
    if not is_allowed:
        return JsonResponse({"success": False, "error": "লগইন প্রয়োজন বা অনুমতি নেই"}, status=403)

    deleted_count, _ = NewsAsset.objects.filter(
        link_coll_news_entry_id=coll_news_entry_id,
        link_asset_id=asset_id,
    ).delete()

    if not deleted_count:
        return JsonResponse({"success": False, "error": "Photo not found"}, status=404)

    return JsonResponse({"success": True})


# ============================================================================
# Article Photo Engagement (view count, like toggle)
# ============================================================================

from django.views.decorators.http import require_POST


@require_POST
def api_article_photo_view(request, coll_news_entry_id, asset_id):
    """POST — increment photo view count (called when lightbox opens)."""
    from django.db.models import F
    updated_count = NewsAsset.objects.filter(
        link_coll_news_entry_id=coll_news_entry_id,
        link_asset_id=asset_id,
    ).update(view_count=F('view_count') + 1)

    if not updated_count:
        return JsonResponse({"success": False}, status=404)
    return JsonResponse({"success": True})


@require_POST
def api_article_photo_like_toggle(request, coll_news_entry_id, asset_id):
    """POST — toggle like on an article photo.

    Simple increment/decrement on NewsAsset.like_count.
    Uses session to track whether user already liked (no separate like table).
    """
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "লগইন প্রয়োজন"}, status=401)

    # Verify photo exists
    if not NewsAsset.objects.filter(
        link_coll_news_entry_id=coll_news_entry_id,
        link_asset_id=asset_id,
    ).exists():
        return JsonResponse({"success": False, "error": "Photo not found"}, status=404)

    from django.db.models import F

    # Track likes in session (no separate engagement table for now)
    session_like_key = 'article_photo_likes'
    liked_photos = request.session.get(session_like_key, [])
    photo_key = str(coll_news_entry_id) + '_' + str(asset_id)

    if photo_key in liked_photos:
        # Unlike
        liked_photos.remove(photo_key)
        NewsAsset.objects.filter(
            link_coll_news_entry_id=coll_news_entry_id,
            link_asset_id=asset_id,
            like_count__gt=0,
        ).update(like_count=F('like_count') - 1)
        liked = False
    else:
        # Like
        liked_photos.append(photo_key)
        NewsAsset.objects.filter(
            link_coll_news_entry_id=coll_news_entry_id,
            link_asset_id=asset_id,
        ).update(like_count=F('like_count') + 1)
        liked = True

    request.session[session_like_key] = liked_photos

    new_like_count = NewsAsset.objects.filter(
        link_coll_news_entry_id=coll_news_entry_id,
        link_asset_id=asset_id,
    ).values_list('like_count', flat=True).first() or 0

    return JsonResponse({"success": True, "liked": liked, "like_count": new_like_count})


# ========== Article Like ==========

@require_POST
def api_article_like_toggle(request, pub_article_id):
    """Toggle like on an article. Session-based tracking."""
    from django.db.models import F
    from .models import EngagementArticleStat

    # Get or create the stat row
    stat, _created = EngagementArticleStat.objects.get_or_create(
        link_pub_article_id=pub_article_id,
        defaults={'view_count': 0, 'share_count': 0, 'like_count': 0},
    )

    session_like_key = 'article_likes'
    liked_articles = request.session.get(session_like_key, [])
    article_key = str(pub_article_id)

    if article_key in liked_articles:
        # Unlike
        liked_articles.remove(article_key)
        EngagementArticleStat.objects.filter(
            link_pub_article_id=pub_article_id,
            like_count__gt=0,
        ).update(like_count=F('like_count') - 1)
        liked = False
    else:
        # Like
        liked_articles.append(article_key)
        EngagementArticleStat.objects.filter(
            link_pub_article_id=pub_article_id,
        ).update(like_count=F('like_count') + 1)
        liked = True

    request.session[session_like_key] = liked_articles

    new_like_count = EngagementArticleStat.objects.filter(
        link_pub_article_id=pub_article_id,
    ).values_list('like_count', flat=True).first() or 0

    return JsonResponse({"success": True, "liked": liked, "like_count": new_like_count})

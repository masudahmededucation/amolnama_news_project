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


# ========== Combined Cascade Location API Views ==========

def api_subdistricts_by_district(request, district_id):
    """Return upazilas + metropolitan thanas + city corporations + municipalities
    for a district, each tagged with type.
    Used by the combined উপজেলা/থানা/সিটি কর্পোরেশন/পৌরসভা dropdown."""
    data = []

    for u in Upazila.objects.filter(
        link_district_id=district_id, is_active=True,
    ).order_by('upazila_name_bn'):
        data.append({
            'id': u.upazila_id,
            'name_bn': u.upazila_name_bn or '',
            'name_en': u.upazila_name_en or '',
            'type': 'upazila',
            'lat': float(u.upazila_latitude) if u.upazila_latitude else None,
            'lng': float(u.upazila_longitude) if u.upazila_longitude else None,
        })

    for t in MetropolitanThana.objects.filter(
        link_district_id=district_id, is_active=True,
    ).order_by('metropolitan_thana_name_bn'):
        data.append({
            'id': t.metropolitan_thana_id,
            'name_bn': t.metropolitan_thana_name_bn or '',
            'name_en': t.metropolitan_thana_name_en or '',
            'type': 'metropolitan_thana',
            'lat': float(t.metropolitan_thana_latitude) if t.metropolitan_thana_latitude else None,
            'lng': float(t.metropolitan_thana_longitude) if t.metropolitan_thana_longitude else None,
        })

    for cc in CityCorporation.objects.filter(
        link_district_id=district_id, is_active=True,
    ).order_by('city_corporation_name_bn'):
        data.append({
            'id': cc.city_corporation_id,
            'name_bn': cc.city_corporation_name_bn or '',
            'name_en': cc.city_corporation_name_en or '',
            'type': 'city_corporation',
            'lat': float(cc.city_corporation_geo_latitude) if cc.city_corporation_geo_latitude else None,
            'lng': float(cc.city_corporation_geo_longitude) if cc.city_corporation_geo_longitude else None,
        })

    for m in Municipality.objects.filter(
        link_district_id=district_id, is_active=True,
    ).order_by('municipality_name_bn'):
        data.append({
            'id': m.municipality_id,
            'name_bn': m.municipality_name_bn or '',
            'name_en': m.municipality_name_en or '',
            'type': 'municipality',
            'lat': float(m.municipality_geo_latitude) if m.municipality_geo_latitude else None,
            'lng': float(m.municipality_geo_longitude) if m.municipality_geo_longitude else None,
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
        ).order_by('union_parishad_name_bn'):
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
    ).order_by('union_parishad_ward_number')

    data = []
    for w in qs:
        name_bn = w.union_parishad_ward_name_bn or f'ওয়ার্ড {w.union_parishad_ward_number}'
        name_en = w.union_parishad_ward_name_en or f'Ward {w.union_parishad_ward_number}'
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
    ).order_by('municipality_ward_number')

    data = []
    for w in qs:
        name_bn = w.municipality_ward_name_bn or f'ওয়ার্ড {w.municipality_ward_number}'
        name_en = w.municipality_ward_name_en or f'Ward {w.municipality_ward_number}'
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
    ).order_by('city_corporation_ward_number')

    data = []
    for w in qs:
        name_bn = w.city_corporation_ward_name_bn or f'ওয়ার্ড {w.city_corporation_ward_number}'
        name_en = w.city_corporation_ward_name_en or f'Ward {w.city_corporation_ward_number}'
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
    ward_ids = MetropolitanThanaWard.objects.filter(
        metropolitan_thana_id=metropolitan_thana_id,
    ).values_list('city_corporation_ward_id', flat=True)

    qs = CityCorporationWard.objects.filter(
        city_corporation_ward_id__in=list(ward_ids), is_active=True,
    ).order_by('city_corporation_ward_number')

    data = []
    for w in qs:
        name_bn = w.city_corporation_ward_name_bn or f'ওয়ার্ড {w.city_corporation_ward_number}'
        name_en = w.city_corporation_ward_name_en or f'Ward {w.city_corporation_ward_number}'
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
    ).order_by('union_parishad_village_name_bn')

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
        Q(unified_location_search_name_bn__istartswith=q)
        | Q(unified_location_search_name_en__istartswith=q)
    ).order_by('link_location_type_id', 'unified_location_display_title_bn')[:30]

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
                city_corporation_ward_id=entity_id,
                is_primary_thana=True,
            ).values('metropolitan_thana_id').first()
            if not junction:
                junction = MetropolitanThanaWard.objects.filter(
                    city_corporation_ward_id=entity_id,
                ).values('metropolitan_thana_id').first()
            if junction:
                ids['metropolitan_thana_id'] = junction['metropolitan_thana_id']

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

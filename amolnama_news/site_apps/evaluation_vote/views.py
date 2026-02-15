from django.shortcuts import render
from django.http import JsonResponse
from django.db.models.functions import Cast
from django.db.models import IntegerField, Q
from django.views.decorators.http import require_POST
from django.utils import timezone
import json
from amolnama_news.site_apps.locations.models import Division, District, Constituency, Upazila, UnionParishad
from .models import RefEvaluation, RefParty, EvaluationResponse, UserDevice, UserProfile, UserSession
from amolnama_news.site_apps.locations.models import get_or_create_geo_source
from django.db import connection
from amolnama_news.site_apps.multimedia.models import AppAsset
from .models import AppGetEvaluation, AppGetPartyDetails, AppSidebarPastResults




def home(request):
    # Get current active evaluation (view returns only the active one)
    evaluation = AppGetEvaluation.objects.first()

    # Get all active parties with their details
    parties = AppGetPartyDetails.objects.all().order_by('party_name_bn')

    # Get divisions for the dropdown
    divisions = Division.objects.filter(is_active=True).order_by('division_name_en')

    # Get distinct past evaluations for sidebar from the past results view
    past_evaluations = AppSidebarPastResults.objects.values('evaluation_id', 'evaluation_name_bn').distinct().order_by('evaluation_name_bn')

    return render(request, 'evaluation_vote/home.html', {
        'evaluation': evaluation,
        'parties': parties,
        'divisions': divisions,
        'past_evaluations': past_evaluations,
    })


def get_divisions(request):
    """API: Get all divisions"""
    divisions = Division.objects.filter(is_active=True).order_by('division_name_en')

    data = {
        'divisions': [
            {
                'id': d.division_id,
                'name_en': d.division_name_en,
                'name_bn': d.division_name_bn,
            }
            for d in divisions
        ]
    }
    return JsonResponse(data)


def get_districts(request, division_id):
    """API: Get districts by division"""
    districts = District.objects.filter(
        link_division_id=division_id,
        is_active=True
    ).order_by('district_name_en')

    data = {
        'districts': [
            {
                'id': d.district_id,
                'name_en': d.district_name_en,
                'name_bn': d.district_name_bn,
            }
            for d in districts
        ]
    }
    return JsonResponse(data)


def get_constituencies(request, district_id):
    """API: Get constituencies by district"""
    constituencies = Constituency.objects.filter(
        link_district_id=district_id,
        is_active=True
    ).annotate(
        seat_num=Cast('seat_number_en', IntegerField())
    ).order_by('seat_num')
    
    data = {
        'constituencies': [
            {
                'id': c.constituency_id,
                'name_en': c.constituency_name_en,
                'name_bn': c.constituency_name_bn,
                'seat_en': c.seat_number_en,
                'seat_bn': c.seat_number_bn,
                'area_bn': c.constituency_area_list_bn,
            }
            for c in constituencies
        ]
    }
    return JsonResponse(data)


def get_upazilas(request, district_id):
    """API: Get upazilas by district"""
    upazilas = Upazila.objects.filter(
        link_district_id=district_id,
        is_active=True
    ).order_by('upazila_name_en')
    
    data = {
        'upazilas': [
            {
                'id': u.upazila_id,
                'name_en': u.upazila_name_en,
                'name_bn': u.upazila_name_bn,
            }
            for u in upazilas
        ]
    }
    return JsonResponse(data)


def get_union_parishads(request, upazila_id):
    """API: Get union parishads by upazila"""
    unions = UnionParishad.objects.filter(
        link_upazila_id=upazila_id,
        is_active=True
    ).order_by('union_parishad_name_en')

    data = {
        'unions': [
            {
                'id': u.union_parishad_id,
                'name_en': u.union_parishad_name_en,
                'name_bn': u.union_parishad_name_bn,
            }
            for u in unions
        ]
    }
    return JsonResponse(data)


def get_parties(request):
    """API: Get all active parties with their details"""
    parties = AppGetPartyDetails.objects.all().order_by('party_name_bn')

    data = {
        'parties': [
            {
                'id': p.party_id,
                'name_en': p.party_name_en,
                'name_bn': p.party_name_bn,
                'short_name_en': p.party_short_name_en,
                'short_name_bn': p.party_short_name_bn,
                'symbol_name_bn': p.party_symbol_name_bn,
                'file_name': p.file_name or '',
                'file_path': p.file_path or '',
            }
            for p in parties
        ]
    }
    return JsonResponse(data)


def get_evaluation(request):
    """API: Get active evaluation"""
    evaluation = AppGetEvaluation.objects.first()

    if evaluation:
        data = {
            'evaluation': {
                'id': evaluation.evaluation_id,
                'name_en': evaluation.evaluation_name_en,
                'name_bn': evaluation.evaluation_name_bn,
                'description_bn': evaluation.evaluation_description_bn or '',
                'end_date': evaluation.end_date.isoformat() if evaluation.end_date else None,
            }
        }
    else:
        data = {'evaluation': None}

    return JsonResponse(data)



@require_POST
def submit_vote(request):
    """API: Submit vote - INSERT new record and device/session info"""
    try:
        # Get current active evaluation from the DB view
        evaluation = AppGetEvaluation.objects.first()
        if not evaluation:
            return JsonResponse({
                'success': False,
                'error': 'No active evaluation found'
            }, status=400)

        data = json.loads(request.body)
        device_info = data.get('device_info', {})

        # Insert UserDevice
        device = UserDevice.objects.create(
            hash_device_fingerprint=b'',  # or set as needed
            app_instance_id=device_info.get('app_instance_id'),
            app_platform_name=device_info.get('app_platform_name'),
            browser_name=device_info.get('browser_name'),
            first_seen_at=timezone.now(),
            is_blocked=False,
            created_at=timezone.now(),
        )

        # Extract geo info from request
        geo_info = data.get('geo_info', {})
        geo_source_id = get_or_create_geo_source(
            country_name_en=geo_info.get('country_name_en'),
            region_name_en=geo_info.get('region_name_en'),
            city_name_en=geo_info.get('city_name_en'),
            network_isp_name=geo_info.get('network_isp_name'),
            network_type=geo_info.get('network_type'),
            latitude=geo_info.get('latitude'),
            longitude=geo_info.get('longitude')
        )

        # Insert UserProfile
        profile = UserProfile.objects.create(
            otp_attempt_count=0,
            is_blocked=False,
            created_at=timezone.now(),
        )

        # Insert UserSession (now with geo_source_id)
        session = UserSession.objects.create(
            link_evaluation_id=evaluation.evaluation_id,
            link_user_profile_id=profile.user_profile_id,
            link_user_device_id=device.user_device_id,
            link_geo_source_id=geo_source_id,  # <-- add this line
            ip_address=request.META.get('REMOTE_ADDR'),
            is_vpn_suspected=False,
            started_at=timezone.now(),
            total_questions_answered=1,
            risk_score=0,
            is_blocked=False,
            created_at=timezone.now(),
        )

        # Insert EvaluationResponse
        vote = EvaluationResponse.objects.create(
            link_evaluation_id=evaluation.evaluation_id,
            link_constituency_id=data.get('constituency_id'),
            link_party_id=data.get('party_id'),
            link_user_session_id=session.user_session_id,
            is_active=True,
            created_at=timezone.now(),
        )

        return JsonResponse({
            'success': True,
            'vote_id': vote.evaluation_response_id,
            'message': 'Vote submitted successfully'
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)

@require_POST
def update_vote(request):
    """API: Update vote - UPDATE remarks and/or union only"""
    try:
        data = json.loads(request.body)
        vote_id = data.get('vote_id')
        
        if not vote_id:
            return JsonResponse({
                'success': False,
                'error': 'Vote ID required'
            }, status=400)
        
        vote = EvaluationResponse.objects.get(evaluation_response_id=vote_id)
        
        # Update only if provided
        if data.get('remarks_bn'):
            vote.remarks_bn = data.get('remarks_bn')
        
        if data.get('upazila_id'):
            vote.link_upazila_id = data.get('upazila_id')
        
        if data.get('union_parishad_id'):
            vote.link_union_parishad_id = data.get('union_parishad_id')
        
        vote.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Vote updated successfully'
        })
        
    except EvaluationResponse.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Vote not found'
        }, status=404)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)
        
        


def vote_results(request):
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT [party_id], [party_name_bn], [party_short_name_bn], [party_symbol_name_bn],
                [party_vote_count], [total_vote_count], [vote_percentage]
            FROM [news_magazine].[evaluation].[vw_app_vote_cast_current_results]
            ORDER BY [party_id]
        """)
        rows = cursor.fetchall()
        results = [
            {
                "party_id": row[0],
                "party_name_bn": row[1],
                "party_short_name_bn": row[2],
                "party_symbol_name_bn": row[3],
                "party_vote_count": row[4],
                "total_vote_count": row[5],
                "vote_percentage": row[6],
            }
            for row in rows
        ]
    total_votes = results[0]["total_vote_count"] if results else 0
    return render(request, "evaluation_vote/vote_results.html", {"results": results, "total": total_votes})


# In your get_party_results view
def vote_cast_current_results(request):
    """API endpoint for current vote casting results - real-time party vote counts"""
    with connection.cursor() as cursor:
        cursor.execute("""
        SELECT v.[party_id],
               v.[party_name_bn],
               v.[party_short_name_bn],
               v.[party_symbol_name_bn],
               v.[party_vote_count],
               v.[total_vote_count],
               v.[vote_percentage],
               p.[file_path],
               p.[file_name]
        FROM [news_magazine].[evaluation].[vw_app_vote_cast_current_results] v
        LEFT JOIN [news_magazine].[party].[vw_app_get_party_details] p
            ON v.party_id = p.party_id
        ORDER BY v.[party_id]
        """)
        rows = cursor.fetchall()
        results = [
            {
                "party_id": row[0],
                "party_name_bn": row[1],
                "party_short_name_bn": row[2],
                "party_symbol_name_bn": row[3],
                "party_vote_count": row[4],
                "total_vote_count": row[5],
                "vote_percentage": row[6],
                "file_path": row[7] or "",
                "file_name": row[8] or "",
            }
            for row in rows
        ]
    return JsonResponse({"results": results})


def sidebar_past_vote_results(request):
    # Add your logic here, or just render the template
    return render(request, "evaluation_vote/partials/sidebar_past_vote_results.html")


# ---- Reusable helper constants ----
PARTY_FIELDS = ['party_name_symbol', 'party_short_name_bn',
                'party_symbol_name_bn', 'file_path', 'file_name']


# ---- Level-specific data builders ----

def _build_national_results(queryset, evaluation_name, request_path):
    """Level 1: National aggregate results - all parties across all constituencies."""
    from django.db.models import Sum
    from .services import build_party_entry, calculate_party_percentages

    party_results = queryset.values(*PARTY_FIELDS).annotate(
        votes=Sum('party_seat_vote')
    ).order_by('-votes')

    results = [build_party_entry(row) for row in party_results]
    total_votes = calculate_party_percentages(results)

    breadcrumb = [{'name': evaluation_name, 'url': None}]
    return results, 'national', breadcrumb, total_votes


def _build_division_results(queryset, evaluation_name, request_path):
    """Level 2: Division overview - all divisions with all parties."""
    from .services import group_results_by_location

    results = group_results_by_location(
        queryset,
        group_id_field='division_id',
        group_name_field='division_name_bn',
        party_fields=PARTY_FIELDS,
    )

    # Add template-friendly keys
    for r in results:
        r['heading'] = r['division_name_bn']
        r['drilldown_url'] = f"?division_id={r['division_id']}"
        r['drilldown_text'] = f"View Districts in {r['division_name_bn']}"

    breadcrumb = [
        {'name': evaluation_name, 'url': request_path},
        {'name': 'Division Level Results', 'url': None},
    ]
    return results, 'division', breadcrumb


def _build_district_results(queryset, evaluation_name, request_path, division_id):
    """Level 3: District results within a division - all parties per district."""
    from .services import group_results_by_location

    queryset_filtered = queryset.filter(division_id=division_id)

    # Get division name for breadcrumb
    first_row = queryset_filtered.first()
    division_name = first_row.division_name_bn if first_row else "Unknown Division"

    results = group_results_by_location(
        queryset_filtered,
        group_id_field='district_id',
        group_name_field='district_name_bn',
        party_fields=PARTY_FIELDS,
    )

    # Add template-friendly keys
    for r in results:
        r['heading'] = r['district_name_bn']
        r['drilldown_url'] = f"?division_id={division_id}&district_id={r['district_id']}"
        r['drilldown_text'] = f"View Constituencies in {r['district_name_bn']}"

    breadcrumb = [
        {'name': evaluation_name, 'url': request_path},
        {'name': f"Division / বিভাগ: {division_name}", 'url': f"{request_path}?view=divisions"},
    ]
    return results, 'district', breadcrumb


def _build_constituency_results(queryset, evaluation_name, request_path, division_id, district_id):
    """Level 4: Constituency results within a district - all parties per constituency."""
    from .services import group_results_by_location
    from urllib.parse import urlencode

    queryset_filtered = queryset.filter(division_id=division_id, district_id=district_id)

    # Get division and district names for breadcrumb
    first_row = queryset_filtered.first()
    division_name = first_row.division_name_bn if first_row else "Unknown Division"
    district_name = first_row.district_name_bn if first_row else "Unknown District"

    results = group_results_by_location(
        queryset_filtered,
        group_id_field='constituency_name_bn',
        group_name_field='constituency_name_bn',
        party_fields=PARTY_FIELDS,
        extra_fields=['constituency_area_list_bn'],
    )

    # Add template-friendly keys (no drilldown at lowest level)
    for r in results:
        r['heading'] = r['constituency_name_bn']
        r['area_list'] = r.get('constituency_area_list_bn', '')

    breadcrumb = [
        {'name': evaluation_name, 'url': request_path},
        {'name': f"Division / বিভাগ: {division_name}", 'url': f"{request_path}?view=divisions"},
        {'name': f"District / জেলা: {district_name}", 'url': f"{request_path}?{urlencode({'division_id': division_id})}"},
    ]
    return results, 'constituency', breadcrumb


# ---- Shared helpers ----

def _determine_back_url(drill_level, request_path, division_id=None):
    """Calculate the back navigation URL based on current drill level."""
    from urllib.parse import urlencode

    if drill_level == 'division':
        return request_path
    elif drill_level == 'district':
        return f"{request_path}?view=divisions"
    elif drill_level == 'constituency':
        return f"{request_path}?{urlencode({'division_id': division_id})}"
    return None


def _get_sidebar_evaluations():
    """Fetch past evaluations for the sidebar widget."""
    return AppSidebarPastResults.objects.values(
        'evaluation_id', 'evaluation_name_bn'
    ).distinct().order_by('evaluation_name_bn')


# ---- Main dispatcher ----

def past_election_results_drillthrough_location(request, evaluation_id):
    """
    Location-based drill-through report dispatcher.
    Determines drill level from URL parameters and delegates to level-specific builders.
    Hierarchy: National → Division → District → Constituency
    """
    view_level = request.GET.get('view')
    division_id = request.GET.get('division_id')
    district_id = request.GET.get('district_id')

    if division_id:
        division_id = int(division_id)
    if district_id:
        district_id = int(district_id)

    queryset = AppSidebarPastResults.objects.filter(evaluation_id=evaluation_id)
    first_record = queryset.first()
    evaluation_name = first_record.evaluation_name_bn if first_record else f"Evaluation {evaluation_id}"

    total_votes = None

    if view_level == 'divisions':
        results, drill_level, breadcrumb = _build_division_results(
            queryset, evaluation_name, request.path)
    elif division_id and district_id:
        results, drill_level, breadcrumb = _build_constituency_results(
            queryset, evaluation_name, request.path, division_id, district_id)
    elif division_id:
        results, drill_level, breadcrumb = _build_district_results(
            queryset, evaluation_name, request.path, division_id)
    else:
        results, drill_level, breadcrumb, total_votes = _build_national_results(
            queryset, evaluation_name, request.path)

    context = {
        'evaluation_name': evaluation_name,
        'results': results,
        'drill_level': drill_level,
        'breadcrumb': breadcrumb,
        'current_division_id': division_id,
        'current_district_id': district_id,
        'total_votes': total_votes,
        'back_url': _determine_back_url(drill_level, request.path, division_id),
        'past_evaluations': _get_sidebar_evaluations(),
    }

    return render(request, 'evaluation_vote/pages/past_election_results_drillthrough_location.html', context)
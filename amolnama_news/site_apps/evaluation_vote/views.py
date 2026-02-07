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
from amolnama_news.site_apps.core.models import MediaAppAsset
from .models import AppGetEvaluation, AppGetPartyDetails, AppSidebarPastResults




def home(request):
    # Get current active evaluation
    evaluation = AppGetEvaluation.objects.filter(
        evaluation_id=3  # Adjust this based on your active evaluation
    ).first()

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
    evaluation = AppGetEvaluation.objects.filter(
        evaluation_id=3  # Adjust based on your active evaluation
    ).first()

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
            link_evaluation_id=3,
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

        # Insert EvaluationResponse as before
        vote = EvaluationResponse.objects.create(
            link_evaluation_id=3,
            link_constituency_id=data.get('constituency_id'),
            link_party_id=data.get('party_id'),
            link_user_session_id=session.user_session_id,
            is_active=True,
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


def past_election_results_drillthrough_location(request, evaluation_id):
    """
    Location-based drill-through report for past election results using IDs for filtering
    Hierarchy: National → Division → District → Constituency
    Shows ALL parties at each geographic level
    Uses evaluation_id, division_id, district_id for URL parameters and filtering
    Displays Bengali names from database for user interface
    """
    from django.db.models import Sum, Max
    from collections import defaultdict
    from urllib.parse import urlencode

    # Get location filter parameters from URL - use IDs for filtering
    view_level = request.GET.get('view')  # 'divisions' to show all divisions
    division_id = request.GET.get('division_id')  # Division ID for filtering
    district_id = request.GET.get('district_id')  # District ID for filtering

    # Convert to int if provided
    if division_id:
        division_id = int(division_id)
    if district_id:
        district_id = int(district_id)

    # Start with base queryset for this evaluation - filter by ID
    queryset = AppSidebarPastResults.objects.filter(evaluation_id=evaluation_id)

    # Get evaluation name for display
    first_record = queryset.first()
    evaluation_name = first_record.evaluation_name_bn if first_record else f"Evaluation {evaluation_id}"

    # Build breadcrumb - start with just evaluation name, will add links based on level
    breadcrumb = []

    # Determine current drill level based on location parameters
    # Check view_level FIRST before checking division/district parameters
    if view_level == 'divisions':
        # Level 1.5: Division Overview - Show all divisions with ALL parties
        division_data = defaultdict(lambda: {'parties': []})

        for row in queryset.values('division_id', 'division_name_bn', 'party_name_symbol', 'party_short_name_bn',
                                  'party_symbol_name_bn', 'file_path', 'file_name').annotate(
            votes=Sum('party_seat_vote')
        ).order_by('division_name_bn', '-votes'):
            division_name = row['division_name_bn']
            div_id = row['division_id']
            division_data[division_name]['division'] = division_name
            division_data[division_name]['division_id'] = div_id
            division_data[division_name]['parties'].append({
                'party_name': row['party_name_symbol'],
                'party_short_name': row['party_short_name_bn'] or row['party_name_symbol'],
                'party_symbol': row['party_symbol_name_bn'] or '',
                'file_path': row['file_path'] or '',
                'file_name': row['file_name'] or '',
                'votes': row['votes'] or 0,
            })

        # Calculate percentages and store total votes for each division
        for division_name, data in division_data.items():
            total = sum(p['votes'] for p in data['parties'])
            data['total_votes'] = total
            for party in data['parties']:
                party['percentage'] = (party['votes'] / total * 100) if total > 0 else 0

        results = list(division_data.values())
        drill_level = 'division'
        # Breadcrumb: evaluation_name (link to national) / Division Level Results (current)
        breadcrumb = [
            {'name': evaluation_name, 'url': request.path},
            {'name': 'Division Level Results', 'url': None}
        ]

    elif not division_id and not district_id:
        # Level 1: National - Aggregate all seat votes nationally for each party
        party_results = queryset.values(
            'party_name_symbol',
            'party_short_name_bn',
            'party_symbol_name_bn',
            'file_path',
            'file_name'
        ).annotate(
            total_votes=Sum('party_seat_vote')
        ).order_by('-total_votes')

        # Calculate total votes for percentage
        total_votes = sum(r['total_votes'] or 0 for r in party_results)

        # Build results with percentages using fields directly from database view
        results = []
        for result in party_results:
            vote_count = result['total_votes'] or 0
            vote_percentage = (vote_count / total_votes * 100) if total_votes > 0 else 0

            results.append({
                'party_name': result['party_name_symbol'],
                'total_votes': vote_count,
                'vote_percentage': vote_percentage,
                'party_logo_path': result['file_path'] or '',
                'party_logo_file': result['file_name'] or '',
                'party_short_name': result['party_short_name_bn'] or result['party_name_symbol'],
                'party_symbol': result['party_symbol_name_bn'] or '',
            })

        drill_level = 'national'
        # Breadcrumb: evaluation_name (current, no link)
        breadcrumb = [
            {'name': evaluation_name, 'url': None}
        ]

    elif division_id and not district_id:
        # Level 2: District Results - Show all districts in selected division with ALL parties
        queryset_filtered = queryset.filter(division_id=division_id)

        # Get division name for display from first result
        first_row = queryset_filtered.first()
        division_name = first_row.division_name_bn if first_row else "Unknown Division"

        # Group by district and party to show all parties for each district
        district_data = defaultdict(lambda: {'parties': [], 'district_id': None})

        for row in queryset_filtered.values('district_id', 'district_name_bn', 'party_name_symbol', 'party_short_name_bn',
                                           'party_symbol_name_bn', 'file_path', 'file_name').annotate(
            votes=Sum('party_seat_vote')
        ).order_by('district_name_bn', '-votes'):
            district_name = row['district_name_bn']
            dist_id = row['district_id']
            district_data[district_name]['district'] = district_name
            district_data[district_name]['district_id'] = dist_id
            district_data[district_name]['parties'].append({
                'party_name': row['party_name_symbol'],
                'party_short_name': row['party_short_name_bn'] or row['party_name_symbol'],
                'party_symbol': row['party_symbol_name_bn'] or '',
                'file_path': row['file_path'] or '',
                'file_name': row['file_name'] or '',
                'votes': row['votes'] or 0,
            })

        # Calculate percentages and store total votes for each district
        for district_name, data in district_data.items():
            total = sum(p['votes'] for p in data['parties'])
            data['total_votes'] = total
            for party in data['parties']:
                party['percentage'] = (party['votes'] / total * 100) if total > 0 else 0

        results = list(district_data.values())
        drill_level = 'district'
        # Breadcrumb: evaluation_name (link to national) / Division: name (link to division overview)
        division_display = f"Division / বিভাগ: {division_name}"
        division_overview_url = f"{request.path}?view=divisions"
        breadcrumb = [
            {'name': evaluation_name, 'url': request.path},
            {'name': division_display, 'url': division_overview_url}
        ]

    elif division_id and district_id:
        # Level 3: Constituency Results - Show all constituencies in selected district with ALL parties
        queryset_filtered = queryset.filter(division_id=division_id, district_id=district_id)

        # Get division and district names for display from first result
        first_row = queryset_filtered.first()
        division_name = first_row.division_name_bn if first_row else "Unknown Division"
        district_name = first_row.district_name_bn if first_row else "Unknown District"

        # Group by constituency and party
        constituency_data = defaultdict(lambda: {'parties': [], 'area_list': ''})

        for row in queryset_filtered.values('constituency_name_bn', 'constituency_area_list_bn', 'party_name_symbol',
                                           'party_short_name_bn', 'party_symbol_name_bn',
                                           'file_path', 'file_name', 'party_seat_vote',
                                           'seat_total_vote').order_by('constituency_name_bn', '-party_seat_vote'):
            seat_name = row['constituency_name_bn']
            constituency_data[seat_name]['seat_name'] = seat_name
            constituency_data[seat_name]['area_list'] = row['constituency_area_list_bn'] or ''
            constituency_data[seat_name]['parties'].append({
                'party_name': row['party_name_symbol'],
                'party_short_name': row['party_short_name_bn'] or row['party_name_symbol'],
                'party_symbol': row['party_symbol_name_bn'] or '',
                'file_path': row['file_path'] or '',
                'file_name': row['file_name'] or '',
                'votes': row['party_seat_vote'] or 0,
            })

        # Calculate percentages and store total votes for each constituency
        for seat_name, data in constituency_data.items():
            total = sum(p['votes'] for p in data['parties'])
            data['total_votes'] = total
            for party in data['parties']:
                party['percentage'] = (party['votes'] / total * 100) if total > 0 else 0

        results = list(constituency_data.values())
        drill_level = 'constituency'
        # Breadcrumb: evaluation_name / Division: name / District: name
        # Use IDs in URLs, display names for user interface
        division_display = f"Division / বিভাগ: {division_name}"
        district_display = f"District / জেলা: {district_name}"
        # Division links to division overview, district links to district level for that division
        division_overview_url = f"{request.path}?view=divisions"
        district_url = f"{request.path}?{urlencode({'division_id': division_id})}"
        breadcrumb = [
            {'name': evaluation_name, 'url': request.path},
            {'name': division_display, 'url': division_overview_url},
            {'name': district_display, 'url': district_url}
        ]

    else:
        results = []
        drill_level = 'national'
        total_votes = 0
        breadcrumb = [
            {'name': evaluation_name, 'url': None}
        ]

    # Determine back URL based on current drill level
    back_url = None
    if drill_level == 'division':
        # From division overview, go back to national
        back_url = request.path
    elif drill_level == 'district':
        # From district level, go back to division overview
        back_url = f"{request.path}?view=divisions"
    elif drill_level == 'constituency':
        # From constituency level, go back to district level
        back_url = f"{request.path}?{urlencode({'division_id': division_id})}"

    # Get past evaluations for sidebar
    past_evaluations = AppSidebarPastResults.objects.values('evaluation_id', 'evaluation_name_bn').distinct().order_by('evaluation_name_bn')

    context = {
        'evaluation_name': evaluation_name,
        'results': results,
        'drill_level': drill_level,
        'breadcrumb': breadcrumb,
        'current_division_id': division_id,
        'current_district_id': district_id,
        'total_votes': total_votes if drill_level == 'national' else None,
        'back_url': back_url,
        'past_evaluations': past_evaluations,
    }

    return render(request, 'evaluation_vote/pages/past_election_results_drillthrough_location.html', context)
from django.shortcuts import render
from django.http import JsonResponse
from django.db.models.functions import Cast
from django.db.models import IntegerField
from django.views.decorators.http import require_POST
from django.utils import timezone
import json
from amolnama_news.site_apps.locations.models import Division, District, Constituency, Upazila, UnionParishad
from .models import RefEvaluation, RefParty, EvaluationResponse, UserDevice, UserProfile, UserSession
from amolnama_news.site_apps.locations.models import get_or_create_geo_source
from django.db import connection
from django.http import JsonResponse
from amolnama_news.site_apps.core.models import MediaAppAsset
from .models import AppGetEvaluation
from .models import AppGetPartyDetails




def home(request):
    divisions = Division.objects.filter(is_active=True).order_by('division_name_en')
    evaluation = AppGetEvaluation.objects.first()
    parties = AppGetPartyDetails.objects.order_by('party_id')  # if is_active exists, else remove

    division_name = request.GET.get('division_name', '')
    district_name = request.GET.get('district_name', '')
    constituency_name = request.GET.get('constituency_name', '')
    party_name = request.GET.get('party_name', '')

    return render(request, 'evaluation_vote/home.html', {
        'divisions': divisions,
        'evaluation': evaluation,
        'parties': parties,
        'division_name': division_name,
        'district_name': district_name,
        'constituency_name': constituency_name,
        'party_name': party_name,
    })


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
            FROM [news_magazine].[evaluation].[vw_app_vote_results_count]
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
def get_party_results(request):
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
        FROM [news_magazine].[evaluation].[vw_app_vote_results_count] v
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
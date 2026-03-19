import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from amolnama_news.site_apps.user_account.models import UserProfile

from .models import UserSavedOffice


def _get_profile_id(user):
    """Return the user_profile_id for the logged-in user."""
    profile = UserProfile.objects.filter(
        link_user_account_user_id=user.pk
    ).values_list('user_profile_id', flat=True).first()
    return profile


@login_required
@require_http_methods(["GET"])
def api_saved_offices_list(request):
    """Return all saved offices for the current user."""
    profile_id = _get_profile_id(request.user)
    if not profile_id:
        return JsonResponse([], safe=False)

    offices = UserSavedOffice.objects.filter(
        link_user_profile_id=profile_id, is_active=True
    ).order_by('-is_default', '-modified_at').values(
        'user_saved_office_id', 'office_label', 'govt_title',
        'office_name', 'office_address', 'reg_no', 'office_date',
        'is_default',
    )
    result = []
    for o in offices:
        o['office_date'] = o['office_date'].isoformat() if o['office_date'] else ''
        result.append(o)
    return JsonResponse(result, safe=False)


@login_required
@require_http_methods(["POST"])
def api_saved_offices_save(request):
    """Create or update a saved office."""
    profile_id = _get_profile_id(request.user)
    if not profile_id:
        return JsonResponse({'error': 'No profile found'}, status=400)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    office_id = data.get('office_id')
    now = timezone.now()

    fields = {
        'office_label': (data.get('office_label') or '').strip() or None,
        'govt_title': (data.get('govt_title') or '').strip() or None,
        'office_name': (data.get('office_name') or '').strip() or None,
        'office_address': (data.get('office_address') or '').strip() or None,
        'reg_no': (data.get('reg_no') or '').strip() or None,
        'office_date': data.get('office_date') or None,
        'is_default': bool(data.get('is_default')),
        'modified_at': now,
    }

    # If setting as default, clear other defaults first
    if fields['is_default']:
        UserSavedOffice.objects.filter(
            link_user_profile_id=profile_id, is_active=True
        ).update(is_default=False, modified_at=now)

    if office_id:
        # Update existing
        updated = UserSavedOffice.objects.filter(
            user_saved_office_id=office_id,
            link_user_profile_id=profile_id,
            is_active=True,
        ).update(**fields)
        if not updated:
            return JsonResponse({'error': 'Office not found'}, status=404)
    else:
        # Create new
        fields['link_user_profile_id'] = profile_id
        fields['created_at'] = now
        office = UserSavedOffice.objects.create(**fields)
        office_id = office.user_saved_office_id

    return JsonResponse({'ok': True, 'office_id': office_id})


@login_required
@require_http_methods(["POST"])
def api_saved_offices_delete(request):
    """Soft-delete a saved office."""
    profile_id = _get_profile_id(request.user)
    if not profile_id:
        return JsonResponse({'error': 'No profile found'}, status=400)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    office_id = data.get('office_id')
    if not office_id:
        return JsonResponse({'error': 'office_id required'}, status=400)

    updated = UserSavedOffice.objects.filter(
        user_saved_office_id=office_id,
        link_user_profile_id=profile_id,
    ).update(is_active=False, modified_at=timezone.now())

    if not updated:
        return JsonResponse({'error': 'Office not found'}, status=404)

    return JsonResponse({'ok': True})

"""Text Extractor API views — upload file, check status, reprocess."""

import logging
import os
import uuid

from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from amolnama_news.site_apps.newsengine.utils import run_background_task

from .models import CollExtractionJob
from .processor import create_job_from_file, process_extraction_job

logger = logging.getLogger(__name__)


@staff_member_required
@require_POST
def api_extraction_upload(request):
    """Upload a file for text extraction. Processes in background thread."""
    uploaded_file = request.FILES.get('extraction_file')
    if not uploaded_file:
        return JsonResponse({'success': False, 'error': 'No file uploaded'}, status=400)

    # Validate file size (max 50MB)
    if uploaded_file.size > 50 * 1024 * 1024:
        return JsonResponse({'success': False, 'error': 'File too large (max 50MB)'}, status=400)

    # Get user profile if logged in
    user_profile_id = None
    if request.user.is_authenticated:
        from amolnama_news.site_apps.user_account.models import UserProfile
        try:
            user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
            user_profile_id = user_profile.user_profile_id
        except UserProfile.DoesNotExist:
            pass

    # Hide all previous jobs so dashboard only shows new upload(s)
    CollExtractionJob.objects.filter(is_active=True).update(is_active=False)

    # Save uploaded file to media/app_static/admin_tools/textextractor/uploads/
    upload_directory = os.path.join(settings.MEDIA_ROOT, 'app_static', 'admin_tools', 'textextractor', 'uploads')
    os.makedirs(upload_directory, exist_ok=True)

    safe_filename = f'{uuid.uuid4()}_{uploaded_file.name}'
    file_path = os.path.join(upload_directory, safe_filename)

    with open(file_path, 'wb') as destination_file:
        for chunk in uploaded_file.chunks():
            destination_file.write(chunk)

    # Create job record
    job_id = create_job_from_file(file_path, user_profile_id=user_profile_id)

    # Process in background thread (immediate UI response)
    run_background_task(process_extraction_job, job_id)

    return JsonResponse({
        'success': True,
        'job_id': job_id,
        'status': 'processing',
    })


@staff_member_required
def api_extraction_status(request, job_id):
    """GET — check extraction job status (polled by frontend)."""
    try:
        job = CollExtractionJob.objects.get(
            textextractor_coll_extraction_job_id=job_id, is_active=True,
        )
    except CollExtractionJob.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Job not found'}, status=404)

    response_data = {
        'success': True,
        'job_id': job_id,
        'status_code': job.status_code,
        'file_name': job.original_file_name,
    }

    if job.status_code == 'processing':
        response_data['progress_message'] = job.error_message or 'Processing...'
        response_data['page_count'] = job.page_count

    elif job.status_code == 'completed':
        response_data['word_count'] = job.word_count
        response_data['page_count'] = job.page_count
        response_data['confidence_percent'] = round(float(job.confidence_score or 0) * 100, 1)
        response_data['processing_time_milliseconds'] = job.processing_time_milliseconds
        response_data['output_file_path'] = job.output_file_path

    elif job.status_code == 'failed':
        response_data['error_message'] = job.error_message

    return JsonResponse(response_data)


@staff_member_required
def api_dashboard_status(request):
    """GET — returns current job counts for dashboard live update."""
    queued_count = CollExtractionJob.objects.filter(status_code='queued', is_active=True).count()
    processing_count = CollExtractionJob.objects.filter(status_code='processing', is_active=True).count()
    completed_count = CollExtractionJob.objects.filter(status_code='completed', is_active=True).count()
    failed_count = CollExtractionJob.objects.filter(status_code='failed', is_active=True).count()

    return JsonResponse({
        'success': True,
        'queued_count': queued_count,
        'processing_count': processing_count,
        'completed_count': completed_count,
        'failed_count': failed_count,
    })


@staff_member_required
@require_POST
def api_extraction_cancel(request, job_id):
    """Cancel a job — sets is_active=False so it disappears immediately."""
    CollExtractionJob.objects.filter(
        textextractor_coll_extraction_job_id=job_id, is_active=True,
    ).update(is_active=False)

    return JsonResponse({'success': True})


@staff_member_required
@require_POST
def api_extraction_delete(request, job_id):
    """Soft-delete a job — removes from dashboard."""
    try:
        job = CollExtractionJob.objects.get(
            textextractor_coll_extraction_job_id=job_id, is_active=True,
        )
    except CollExtractionJob.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Job not found'}, status=404)

    from django.utils import timezone
    job.is_active = False
    job.updated_at = timezone.now()
    job.save(update_fields=['is_active', 'updated_at'])

    return JsonResponse({'success': True})

"""Text Extractor views — upload, dashboard, job detail."""

import os

from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render
from django.http import Http404
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import CollExtractionJob, ExtractionPage, RefExtractionEngine


def _format_duration_display(processing_time_milliseconds):
    """Format milliseconds as human-readable: 1h 30m 5s."""
    if not processing_time_milliseconds:
        return None
    total_seconds = int(processing_time_milliseconds / 1000)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    parts = []
    if hours > 0:
        parts.append(f'{hours}h')
    if minutes > 0:
        parts.append(f'{minutes}m')
    parts.append(f'{seconds}s')
    return ' '.join(parts)


def _read_output_file(file_path):
    """Read extracted text from .txt output file."""
    if not file_path or not os.path.exists(file_path):
        return None
    with open(file_path, 'r', encoding='utf-8') as output_file:
        return output_file.read()


@staff_member_required
@ensure_csrf_cookie
def home(request):
    """Text Extractor dashboard. Single upload: shows 1 job. Multi upload: shows all from that batch."""
    jobs = CollExtractionJob.objects.filter(
        is_active=True,
    ).order_by('-created_at')[:10]

    engine_map = {
        engine.textextractor_ref_extraction_engine_id: engine
        for engine in RefExtractionEngine.objects.filter(is_active=True)
    }

    job_items = []
    for job in jobs:
        engine = engine_map.get(job.link_extraction_engine_id)
        file_size_display = ''
        if job.original_file_size_bytes:
            if job.original_file_size_bytes > 1024 * 1024:
                file_size_display = f'{job.original_file_size_bytes / (1024 * 1024):.1f} MB'
            elif job.original_file_size_bytes > 1024:
                file_size_display = f'{job.original_file_size_bytes / 1024:.1f} KB'
            else:
                file_size_display = f'{job.original_file_size_bytes} bytes'

        job_items.append({
            'job_id': job.textextractor_coll_extraction_job_id,
            'file_name': job.original_file_name,
            'file_extension': job.original_file_extension_code,
            'file_size_bytes': job.original_file_size_bytes,
            'file_size_display': file_size_display,
            'source_type_code': job.source_type_code,
            'input_file_path': job.input_file_path,
            'output_file_path': job.output_file_path,
            'status_code': job.status_code,
            'engine_name': engine.engine_name_en if engine else '',
            'detected_language_code': job.detected_language_code,
            'word_count': job.word_count,
            'page_count': job.page_count,
            'confidence_score': job.confidence_score,
            'confidence_percent': round(float(job.confidence_score or 0) * 100, 1),
            'processing_time_milliseconds': job.processing_time_milliseconds,
            'processing_time_seconds': round(job.processing_time_milliseconds / 1000, 1) if job.processing_time_milliseconds else None,
            'processing_time_display': _format_duration_display(job.processing_time_milliseconds),
            'created_at': job.created_at,
            'created_at_formatted': job.created_at.strftime('%d %b %Y, %I:%M:%S %p') if job.created_at else '',
            'updated_at_formatted': job.updated_at.strftime('%d %b %Y, %I:%M:%S %p') if job.updated_at else '',
            'completed_at': job.completed_at,
            'completed_at_formatted': job.completed_at.strftime('%d %b %Y, %I:%M:%S %p') if job.completed_at else '',
            'error_message': job.error_message,
        })

    return render(request, 'textextractor/pages/textextractor-dashboard.html', {
        'job_items': job_items,
        'seo': {
            'title': 'Text Extractor — OCR, Audio Transcription | আমলনামা নিউজ',
            'description': 'Extract text from images, PDFs, audio, and video. Bengali + English OCR.',
        },
    })


@staff_member_required
@ensure_csrf_cookie
def upload(request):
    """Text Extractor upload page."""
    return render(request, 'textextractor/pages/textextractor-upload.html', {
        'seo': {
            'title': 'Upload — Text Extractor | আমলনামা নিউজ',
        },
    })


@staff_member_required
def job_detail(request, job_id):
    """Text Extractor job detail — shows extracted text, confidence, pages."""
    try:
        job = CollExtractionJob.objects.get(
            textextractor_coll_extraction_job_id=job_id, is_active=True,
        )
    except CollExtractionJob.DoesNotExist:
        raise Http404

    pages = list(ExtractionPage.objects.filter(
        link_extraction_job_id=job_id, is_active=True,
    ).order_by('page_number'))

    engine = RefExtractionEngine.objects.filter(
        textextractor_ref_extraction_engine_id=job.link_extraction_engine_id
    ).first() if job.link_extraction_engine_id else None

    job_item = {
        'job_id': job.textextractor_coll_extraction_job_id,
        'file_name': job.original_file_name,
        'file_extension': job.original_file_extension_code,
        'file_size_bytes': job.original_file_size_bytes,
        'status_code': job.status_code,
        'engine_name': engine.engine_name_en if engine else '',
        'extracted_text_plain': _read_output_file(job.output_file_path),
        'word_count': job.word_count,
        'page_count': job.page_count,
        'confidence_score': job.confidence_score,
        'confidence_percent': round(float(job.confidence_score or 0) * 100, 1),
        'processing_time_milliseconds': job.processing_time_milliseconds,
        'processing_time_seconds': round(job.processing_time_milliseconds / 1000, 1) if job.processing_time_milliseconds else None,
        'detected_language_code': job.detected_language_code,
        'error_message': job.error_message,
        'created_at': job.created_at,
        'completed_at': job.completed_at,
        'pages': pages,
    }

    return render(request, 'textextractor/pages/textextractor-detail.html', {
        'job': job_item,
        'seo': {
            'title': f'{job.original_file_name} — Text Extractor | আমলনামা নিউজ',
        },
    })

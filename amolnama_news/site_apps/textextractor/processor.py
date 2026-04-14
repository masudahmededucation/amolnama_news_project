"""Text Extractor job processor — shared logic for web upload and folder watcher.
Writes output incrementally (per page) so partial results survive crashes."""

import logging
import os
import time
import uuid

from django.db import connection
from django.utils import timezone

from .engines import extract_text, get_engine_code_for_extension

logger = logging.getLogger(__name__)

# Jobs stuck in 'processing' longer than this are considered crashed
STUCK_JOB_TIMEOUT_SECONDS = 1800  # 30 minutes


def _raw_execute(sql, params):
    """Execute raw SQL via Django cursor. Uses ? placeholders → converted to %s.
    Returns open cursor. Closes on execute failure to prevent leak."""
    django_sql = sql.replace('?', '%s')
    cursor = connection.cursor()
    try:
        cursor.execute(django_sql, params)
    except Exception:
        cursor.close()
        raise
    return cursor


def _format_duration(total_seconds):
    """Format seconds as human-readable duration: 1h 30m 5s."""
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


def _mark_job_failed(job, error_message, start_time):
    """Mark a job as failed with error message and processing time."""
    processing_time = int((time.time() - start_time) * 1000)
    truncated_error = (error_message[:2000] if error_message else 'Unknown error')
    now = timezone.now()
    _raw_execute("""
        UPDATE [textextractor].[coll_extraction_job]
        SET [status_code] = ?, [error_message] = ?, [processing_time_milliseconds] = ?,
            [updated_at] = ?, [completed_at] = ?
        WHERE [textextractor_coll_extraction_job_id] = ?
    """, ['failed', truncated_error, processing_time, now, now,
          job.textextractor_coll_extraction_job_id])
    logger.error('Job %s failed: %s', job.textextractor_coll_extraction_job_id, error_message)


def _append_page_to_output_file(output_file_path, page_number, page_text):
    """Append one page's text to the output file immediately. Survives crashes."""
    if not output_file_path or not page_text:
        return
    os.makedirs(os.path.dirname(output_file_path), exist_ok=True)
    with open(output_file_path, 'a', encoding='utf-8') as output_file:
        if page_number > 1:
            output_file.write('\n\n')
        output_file.write(f'--- Page {page_number} ---\n')
        output_file.write(page_text)
        output_file.flush()
        os.fsync(output_file.fileno())


def _clear_output_file(output_file_path):
    """Clear/create empty output file at start of extraction."""
    if not output_file_path:
        return
    os.makedirs(os.path.dirname(output_file_path), exist_ok=True)
    with open(output_file_path, 'w', encoding='utf-8') as output_file:
        output_file.write('')


def recover_stuck_jobs():
    """Find jobs stuck in 'processing' for too long and mark them as failed.
    Call this on server startup to clean up after crashes."""
    from .models import CollExtractionJob

    cutoff_time = timezone.now() - timezone.timedelta(seconds=STUCK_JOB_TIMEOUT_SECONDS)
    stuck_jobs = CollExtractionJob.objects.filter(
        status_code='processing',
        updated_at__lt=cutoff_time,
        is_active=True,
    )

    stuck_count = 0
    for job in stuck_jobs:
        _raw_execute("""
            UPDATE [textextractor].[coll_extraction_job]
            SET [status_code] = ?, [error_message] = ?, [updated_at] = ?, [completed_at] = ?
            WHERE [textextractor_coll_extraction_job_id] = ?
        """, [
            'failed',
            'Server crashed or restarted during processing. Partial output may be available in the output file.',
            timezone.now(), timezone.now(),
            job.textextractor_coll_extraction_job_id,
        ])
        stuck_count += 1
        logger.warning('Recovered stuck job %s — marked as failed', job.textextractor_coll_extraction_job_id)

    if stuck_count:
        logger.info('Recovered %d stuck extraction jobs', stuck_count)

    return stuck_count


def process_extraction_job(job_id):
    """Process a single extraction job. Called from background thread or management command."""
    from .models import CollExtractionJob, ExtractionPage, RefExtractionEngine

    try:
        job = CollExtractionJob.objects.get(textextractor_coll_extraction_job_id=job_id)
    except CollExtractionJob.DoesNotExist:
        logger.error('Extraction job %s not found', job_id)
        return

    # Mark as processing
    _raw_execute("""
        UPDATE [textextractor].[coll_extraction_job]
        SET [status_code] = ?, [updated_at] = ?
        WHERE [textextractor_coll_extraction_job_id] = ?
    """, ['processing', timezone.now(), job_id])

    start_time = time.time()

    try:
        _process_extraction_job_inner(job, job_id, start_time)
    except Exception as unexpected_error:
        logger.exception('Unexpected error processing job %s', job_id)
        _mark_job_failed(job, f'Unexpected error: {str(unexpected_error)}', start_time)


def _process_extraction_job_inner(job, job_id, start_time):
    """Inner processing logic — wrapped by try/except in process_extraction_job."""
    from .models import ExtractionPage, RefExtractionEngine

    file_path = job.input_file_path

    if not file_path or not os.path.exists(file_path):
        _mark_job_failed(job, 'Input file not found', start_time)
        return

    # Determine engine
    engine_code = get_engine_code_for_extension(job.original_file_extension_code)
    if not engine_code:
        _mark_job_failed(job, f'Unsupported file type: {job.original_file_extension_code}', start_time)
        return

    # Resolve engine ID
    engine = RefExtractionEngine.objects.filter(engine_code=engine_code, is_active=True).first()
    if engine:
        job.link_extraction_engine_id = engine.textextractor_ref_extraction_engine_id

    # Clear output file — start fresh, write incrementally per page
    _clear_output_file(job.output_file_path)

    # Track total words across pages (incremental)
    incremental_word_count = [0]

    # Accumulate per-page log lines for live display
    progress_log_lines = []

    def on_extraction_progress(current_page, total_pages, log_line=None):
        elapsed_seconds = int(time.time() - start_time)
        elapsed_display = _format_duration(elapsed_seconds)

        if log_line:
            progress_log_lines.append(log_line)

        # Build progress message: latest log lines + elapsed time
        recent_lines = progress_log_lines[-10:]
        progress_text = '\n'.join(recent_lines)
        progress_text += f'\n\n⏱️ Elapsed: {elapsed_display} | {current_page}/{total_pages} pages'

        _raw_execute("""
            UPDATE [textextractor].[coll_extraction_job]
            SET [page_count] = ?, [word_count] = ?, [error_message] = ?, [updated_at] = ?
            WHERE [textextractor_coll_extraction_job_id] = ?
        """, [total_pages, incremental_word_count[0], progress_text, timezone.now(), job_id])

    # Update progress before extraction starts
    _raw_execute("""
        UPDATE [textextractor].[coll_extraction_job]
        SET [error_message] = ?, [link_extraction_engine_id] = ?, [updated_at] = ?
        WHERE [textextractor_coll_extraction_job_id] = ?
    """, ['Starting extraction...',
          engine.textextractor_ref_extraction_engine_id if engine else None,
          timezone.now(), job_id])

    # Run extraction
    result = extract_text(file_path, engine_code, on_progress=on_extraction_progress)

    if not result.get('success'):
        _mark_job_failed(job, result.get('error', 'Unknown extraction error'), start_time)
        return

    # Write output file incrementally — page by page
    pages = result.get('pages', [])
    for page_data in pages:
        page_text = page_data.get('text', '')
        page_number = page_data.get('page_number', 1)

        # Normalize OCR output — replace ASCII pipe with Bengali dari (full stop)
        # OCR engines often output | (U+007C) instead of । (U+0964)
        page_text = page_text.replace('|', '।')
        page_word_count = page_data.get('word_count', 0)

        _append_page_to_output_file(job.output_file_path, page_number, page_text)
        incremental_word_count[0] += page_word_count

    # Save final metadata
    processing_time = int((time.time() - start_time) * 1000)
    total_word_count = incremental_word_count[0]
    total_page_count = result.get('page_count', len(pages) if pages else 1)
    confidence_score = result.get('confidence')
    detected_language_code = result.get('detected_language') or None

    now = timezone.now()
    _raw_execute("""
        UPDATE [textextractor].[coll_extraction_job]
        SET [status_code] = ?, [word_count] = ?, [page_count] = ?,
            [confidence_score] = ?, [processing_time_milliseconds] = ?,
            [completed_at] = ?, [updated_at] = ?,
            [link_extraction_engine_id] = ?, [detected_language_code] = ?,
            [error_message] = NULL
        WHERE [textextractor_coll_extraction_job_id] = ?
    """, [
        'completed', total_word_count, total_page_count,
        float(confidence_score) if confidence_score else None,
        processing_time, now, now,
        job.link_extraction_engine_id, detected_language_code,
        job_id,
    ])

    logger.info('Job %s completed: %s words, %.1f%% confidence, %dms',
                job_id, total_word_count,
                float(confidence_score or 0) * 100,
                processing_time)


def create_job_from_file(file_path, user_profile_id=None, folder_watcher_id=None):
    """Create a new extraction job from a file path. Returns job_id."""
    file_name = os.path.basename(file_path)
    file_extension = os.path.splitext(file_name)[1].lower()
    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    source_type = 'folder_watcher' if folder_watcher_id else 'web_upload'

    # Determine output path — always use media/app_static/admin_tools/textextractor/output/
    from django.conf import settings
    output_directory = os.path.join(settings.MEDIA_ROOT, 'app_static', 'admin_tools', 'textextractor', 'output')
    os.makedirs(output_directory, exist_ok=True)
    output_file_path = os.path.join(output_directory, f'EXTRACTED_{file_name}.txt')

    job_guid = str(uuid.uuid4())
    raw_cursor = _raw_execute("""
        INSERT INTO [textextractor].[coll_extraction_job]
            ([job_guid], [link_user_profile_id], [link_folder_watcher_id],
             [source_type_code], [original_file_name], [original_file_extension_code],
             [original_file_size_bytes], [input_file_path], [output_file_path],
             [status_code], [is_active])
        OUTPUT INSERTED.textextractor_coll_extraction_job_id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        job_guid, user_profile_id, folder_watcher_id,
        source_type, file_name, file_extension,
        file_size, file_path, output_file_path,
        'queued', 1,
    ])
    job_id = raw_cursor.fetchone()[0]

    return job_id


def wait_for_file_copy(file_path, poll_interval_seconds=0.5, max_wait_seconds=30):
    """Wait until file size stabilises (copy complete). Prevents reading incomplete files."""
    previous_size = -1
    elapsed_seconds = 0
    while elapsed_seconds < max_wait_seconds:
        current_size = os.path.getsize(file_path)
        if current_size == previous_size and current_size > 0:
            return True
        previous_size = current_size
        time.sleep(poll_interval_seconds)
        elapsed_seconds += poll_interval_seconds
    return False

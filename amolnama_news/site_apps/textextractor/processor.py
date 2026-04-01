"""Text Extractor job processor — shared logic for web upload and folder watcher."""

import logging
import os
import time
import uuid

from django.db import connection
from django.utils import timezone

from .engines import extract_text, get_engine_code_for_extension

logger = logging.getLogger(__name__)


def _raw_execute(sql, params):
    """Execute raw SQL via Django cursor (which uses our custom db_backend with ntext fix).
    Uses ? placeholders (pyodbc native). Returns cursor for fetchone() if needed."""
    # Convert ? placeholders to %s for Django cursor
    django_sql = sql.replace('?', '%s')
    cursor = connection.cursor()
    cursor.execute(django_sql, params)
    return cursor


def _mark_job_failed(job, error_message, start_time):
    """Mark a job as failed with error message and processing time. Uses raw SQL to avoid ODBC precision bug."""
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


def process_extraction_job(job_id):
    """Process a single extraction job. Called from background thread or management command."""
    from .models import CollExtractionJob, CollExtractionPage, RefExtractionEngine

    try:
        job = CollExtractionJob.objects.get(textextractor_coll_extraction_job_id=job_id)
    except CollExtractionJob.DoesNotExist:
        logger.error('Extraction job %s not found', job_id)
        return

    # Mark as processing — use raw execute for consistency
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
    from .models import CollExtractionPage, RefExtractionEngine

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

    # Progress callback — updates DB so frontend can see page progress
    def on_extraction_progress(current_page, total_pages):
        percent = int((current_page / total_pages) * 100) if total_pages > 0 else 0
        progress_message = f'Processing page {current_page} of {total_pages} ({percent}%)'
        _raw_execute("""
            UPDATE [textextractor].[coll_extraction_job]
            SET [page_count] = ?, [error_message] = ?, [updated_at] = ?
            WHERE [textextractor_coll_extraction_job_id] = ?
        """, [total_pages, progress_message, timezone.now(), job_id])

    # Update progress before extraction starts
    _raw_execute("""
        UPDATE [textextractor].[coll_extraction_job]
        SET [error_message] = ?, [link_extraction_engine_id] = ?, [updated_at] = ?
        WHERE [textextractor_coll_extraction_job_id] = ?
    """, ['Extracting text...',
          engine.textextractor_ref_extraction_engine_id if engine else None,
          timezone.now(), job_id])

    # Run extraction
    result = extract_text(file_path, engine_code, on_progress=on_extraction_progress)

    if not result.get('success'):
        _mark_job_failed(job, result.get('error', 'Unknown extraction error'), start_time)
        return

    # Update progress: saving results
    _raw_execute("""
        UPDATE [textextractor].[coll_extraction_job]
        SET [error_message] = ?, [updated_at] = ?
        WHERE [textextractor_coll_extraction_job_id] = ?
    """, ['Saving results...', timezone.now(), job_id])

    # Save results
    processing_time = int((time.time() - start_time) * 1000)
    extracted_text = result.get('text', '')
    pages = result.get('pages', [])

    job.word_count = result.get('word_count', 0)
    job.page_count = result.get('page_count', len(pages) if pages else 1)
    job.confidence_score = result.get('confidence')
    job.detected_language_code = result.get('detected_language') or None

    # Save metadata only — extracted text goes to .txt file, not DB
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
        'completed', job.word_count, job.page_count,
        float(job.confidence_score) if job.confidence_score else None,
        processing_time, now, now,
        job.link_extraction_engine_id, job.detected_language_code,
        job_id,
    ])

    # Write output file
    if job.output_file_path and extracted_text:
        os.makedirs(os.path.dirname(job.output_file_path), exist_ok=True)
        with open(job.output_file_path, 'w', encoding='utf-8') as output_file:
            output_file.write(extracted_text)

    logger.info('Job %s completed: %s words, %.1f%% confidence, %dms',
                job_id, job.word_count,
                float(job.confidence_score or 0) * 100,
                processing_time)


def create_job_from_file(file_path, user_profile_id=None, folder_watcher_id=None):
    """Create a new extraction job from a file path. Returns job_id."""
    file_name = os.path.basename(file_path)
    file_extension = os.path.splitext(file_name)[1].lower()
    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    source_type = 'folder_watcher' if folder_watcher_id else 'web_upload'

    # Determine output path — always use media/textextractor/output/
    from django.conf import settings
    output_directory = os.path.join(settings.MEDIA_ROOT, 'textextractor', 'output')
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

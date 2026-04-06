"""Video transcoder — FFmpeg HLS adaptive bitrate conversion.

On video upload, queues a background transcode job that converts raw video to:
- 360p quality variant
- 720p quality variant
- HLS manifest (.m3u8) for adaptive streaming

Uses FFmpeg binary (must be installed: winget install ffmpeg).
Job status tracked in [media].[fact_video_transcode_job].

Usage:
    from post.video_transcoder import queue_video_transcode

    # After saving video asset to disk:
    queue_video_transcode(asset_id, source_file_path)
"""

import os
import logging
import shutil
import subprocess
import threading

from django.conf import settings
from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)


def _ffmpeg_available():
    """Check if FFmpeg binary is accessible."""
    return shutil.which('ffmpeg') is not None


def queue_video_transcode(asset_id, source_file_path):
    """Insert a transcode job and start processing in background thread.

    Args:
        asset_id: The [media].[asset] PK.
        source_file_path: Relative path from MEDIA_ROOT (e.g., 'upload/post/abc.mp4').
    """
    full_source_path = os.path.join(settings.MEDIA_ROOT, source_file_path)
    if not os.path.exists(full_source_path):
        logger.error('video_transcoder: source file not found — %s', full_source_path)
        return

    if not _ffmpeg_available():
        logger.warning(
            'video_transcoder: FFmpeg not installed. '
            'Install with: winget install ffmpeg (Windows) or apt install ffmpeg (Linux). '
            'Skipping transcode for asset %s.', asset_id
        )
        return

    # Create output directory alongside the source file
    source_directory = os.path.dirname(full_source_path)
    source_name_without_extension = os.path.splitext(os.path.basename(source_file_path))[0]
    output_directory = os.path.join(source_directory, source_name_without_extension + '_hls')
    output_directory_relative = os.path.relpath(output_directory, settings.MEDIA_ROOT)

    # Insert job record
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [media].[fact_video_transcode_job]
                    (link_asset_id, transcode_source_path, transcode_output_directory,
                     transcode_status_code, is_active, created_at, modified_at)
                OUTPUT INSERTED.fact_video_transcode_job_id
                VALUES (%s, %s, %s, 'pending', 1, GETDATE(), GETDATE())
            """, [asset_id, source_file_path, output_directory_relative])
            job_row = cursor.fetchone()
            job_id = job_row[0] if job_row else None
    except Exception as insert_error:
        logger.error('video_transcoder: failed to create job — %s', insert_error)
        return

    if not job_id:
        return

    # Start transcode in background thread
    thread = threading.Thread(
        target=_run_transcode,
        args=(job_id, asset_id, full_source_path, output_directory, output_directory_relative),
        daemon=True,
    )
    thread.start()
    logger.info('video_transcoder: queued job %s for asset %s', job_id, asset_id)


def _run_transcode(job_id, asset_id, full_source_path, output_directory, output_directory_relative):
    """Run FFmpeg transcoding. Called in background thread."""
    _update_job_status(job_id, 'processing')

    try:
        os.makedirs(output_directory, exist_ok=True)

        # Get video duration
        duration_seconds = _get_video_duration(full_source_path)

        # Transcode to 360p
        path_360p_relative = _transcode_variant(
            full_source_path, output_directory, output_directory_relative,
            width=640, height=360, bitrate='800k', label='360p',
        )

        # Transcode to 720p
        path_720p_relative = _transcode_variant(
            full_source_path, output_directory, output_directory_relative,
            width=1280, height=720, bitrate='2500k', label='720p',
        )

        # Generate HLS master manifest
        hls_manifest_relative = _generate_hls_manifest(
            output_directory, output_directory_relative,
            path_360p_relative, path_720p_relative,
        )

        # Update job as completed
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE [media].[fact_video_transcode_job]
                    SET transcode_status_code = 'completed',
                        transcode_quality_360p_path = %s,
                        transcode_quality_720p_path = %s,
                        transcode_hls_manifest_path = %s,
                        transcode_duration_seconds = %s,
                        transcode_completed_at = GETDATE(),
                        modified_at = GETDATE()
                    WHERE fact_video_transcode_job_id = %s
                """, [
                    path_360p_relative, path_720p_relative,
                    hls_manifest_relative, duration_seconds, job_id,
                ])
        except Exception as update_error:
            logger.error('video_transcoder: failed to update job %s — %s', job_id, update_error)

        logger.info('video_transcoder: completed job %s for asset %s', job_id, asset_id)

    except Exception as transcode_error:
        error_message = str(transcode_error)[:1000]
        logger.error('video_transcoder: job %s failed — %s', job_id, error_message)
        _update_job_status(job_id, 'failed', error_message)


def _transcode_variant(full_source_path, output_directory, output_directory_relative,
                       width, height, bitrate, label):
    """Transcode a single quality variant. Returns relative path to HLS playlist."""
    variant_directory = os.path.join(output_directory, label)
    os.makedirs(variant_directory, exist_ok=True)

    playlist_filename = 'playlist.m3u8'
    segment_filename = 'segment_%03d.ts'
    playlist_full_path = os.path.join(variant_directory, playlist_filename)

    command = [
        'ffmpeg', '-i', full_source_path,
        '-vf', f'scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2',
        '-c:v', 'libx264', '-preset', 'fast', '-b:v', bitrate,
        '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
        '-hls_time', '10',
        '-hls_list_size', '0',
        '-hls_segment_filename', os.path.join(variant_directory, segment_filename),
        '-f', 'hls',
        '-y',  # Overwrite
        playlist_full_path,
    ]

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=600,  # 10 minute timeout
    )

    if result.returncode != 0:
        raise RuntimeError(f'FFmpeg {label} failed: {result.stderr[:500]}')

    return os.path.join(output_directory_relative, label, playlist_filename).replace('\\', '/')


def _generate_hls_manifest(output_directory, output_directory_relative,
                           path_360p_relative, path_720p_relative):
    """Generate HLS master manifest pointing to quality variants."""
    manifest_filename = 'master.m3u8'
    manifest_full_path = os.path.join(output_directory, manifest_filename)

    # Relative paths from manifest location
    path_360p_from_manifest = '360p/playlist.m3u8'
    path_720p_from_manifest = '720p/playlist.m3u8'

    manifest_content = '#EXTM3U\n'
    manifest_content += '#EXT-X-VERSION:3\n'

    if path_360p_relative:
        manifest_content += '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\n'
        manifest_content += path_360p_from_manifest + '\n'

    if path_720p_relative:
        manifest_content += '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720\n'
        manifest_content += path_720p_from_manifest + '\n'

    with open(manifest_full_path, 'w', encoding='utf-8') as manifest_file:
        manifest_file.write(manifest_content)

    return os.path.join(output_directory_relative, manifest_filename).replace('\\', '/')


def _get_video_duration(full_source_path):
    """Get video duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', full_source_path],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0 and result.stdout.strip():
            return int(float(result.stdout.strip()))
    except Exception as duration_error:
        logger.warning('video_transcoder: ffprobe duration failed — %s', duration_error)
    return None


def _update_job_status(job_id, status_code, error_message=None):
    """Update transcode job status."""
    try:
        with connection.cursor() as cursor:
            if error_message:
                cursor.execute("""
                    UPDATE [media].[fact_video_transcode_job]
                    SET transcode_status_code = %s,
                        transcode_error_message = %s,
                        modified_at = GETDATE()
                    WHERE fact_video_transcode_job_id = %s
                """, [status_code, error_message, job_id])
            else:
                cursor.execute("""
                    UPDATE [media].[fact_video_transcode_job]
                    SET transcode_status_code = %s,
                        transcode_started_at = GETDATE(),
                        modified_at = GETDATE()
                    WHERE fact_video_transcode_job_id = %s
                """, [status_code, job_id])
    except Exception as update_error:
        logger.error('video_transcoder: status update failed for job %s — %s', job_id, update_error)


def get_hls_manifest_url(asset_id):
    """Get the HLS manifest URL for a transcoded video. Returns None if not ready."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT transcode_hls_manifest_path
                FROM [media].[fact_video_transcode_job]
                WHERE link_asset_id = %s
                  AND transcode_status_code = 'completed'
                  AND is_active = 1
                ORDER BY fact_video_transcode_job_id DESC
            """, [asset_id])
            row = cursor.fetchone()
            if row and row[0]:
                return '/media/' + row[0]
    except Exception as manifest_error:
        logger.warning('video_transcoder: get_hls_manifest_url failed for asset %s — %s', asset_id, manifest_error)
    return None

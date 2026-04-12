"""Faster-Whisper engine — audio/video transcription. Bengali + English.
Video: splits audio first (16kHz mono WAV) for speed, then transcribes.
Uses VAD filter to skip silence and background noise."""

import logging
import os
import subprocess

logger = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {'.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv'}

# Initialize model once globally
_model = None


def _get_model():
    """Lazy-load faster-whisper model (done once)."""
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
            _model = WhisperModel('base', device='cpu', compute_type='int8')
        except ImportError:
            raise ImportError('faster-whisper not installed. Run: pip install faster-whisper')
    return _model


def _extract_audio_from_video(video_path):
    """Extract audio from video: 16kHz mono WAV optimised for Whisper."""
    audio_path = video_path + '.extracted_audio.wav'
    try:
        result = subprocess.run(
            ['ffmpeg', '-i', video_path, '-vn', '-acodec', 'pcm_s16le',
             '-ar', '16000', '-ac', '1', '-y', audio_path],
            capture_output=True, timeout=300,
        )
        if result.returncode == 0 and os.path.exists(audio_path) and os.path.getsize(audio_path) > 0:
            return audio_path
        return None
    except FileNotFoundError:
        logger.warning('ffmpeg not found — processing video directly (slower)')
        return None
    except subprocess.TimeoutExpired:
        logger.warning('Audio extraction timed out for %s', video_path)
        return None
    except Exception as audio_extract_error:
        logger.warning('Audio extraction failed for %s — %s', video_path, audio_extract_error)
        return None


def extract(file_path):
    """Transcribe audio/video using faster-whisper. Splits audio from video first."""
    if not os.path.exists(file_path):
        return {'success': False, 'error': 'File not found'}

    if os.path.getsize(file_path) == 0:
        return {'success': False, 'error': 'File is empty'}

    try:
        model = _get_model()
    except ImportError as import_error:
        return {'success': False, 'error': str(import_error)}

    # Split audio from video files
    file_extension = os.path.splitext(file_path)[1].lower()
    processed_path = file_path
    extracted_audio_path = None

    if file_extension in VIDEO_EXTENSIONS:
        extracted_audio_path = _extract_audio_from_video(file_path)
        if extracted_audio_path:
            processed_path = extracted_audio_path

    try:
        # beam_size=5 balances speed and accuracy, vad_filter skips silence
        segments, info = model.transcribe(processed_path, beam_size=5, vad_filter=True)
        segments_list = list(segments)
    except Exception as transcribe_error:
        return {'success': False, 'error': f'Transcription failed: {str(transcribe_error)}'}
    finally:
        if extracted_audio_path and os.path.exists(extracted_audio_path):
            try:
                os.remove(extracted_audio_path)
            except OSError:
                logger.debug('temp audio cleanup failed for %s', extracted_audio_path, exc_info=True)

    if not segments_list:
        return {'success': True, 'text': '', 'word_count': 0, 'confidence': 0.0,
                'detected_language': info.language if info else '', 'pages': []}

    # Build timestamped transcript
    text_parts = []
    structured_blocks = []
    total_confidence = 0.0

    for segment in segments_list:
        segment_text = segment.text.strip()
        if not segment_text:
            continue
        timestamp = f'[{int(segment.start // 60):02d}:{int(segment.start % 60):02d}]'
        text_parts.append(f'{timestamp} {segment_text}')
        confidence = round(1.0 - segment.no_speech_prob, 4)
        total_confidence += confidence
        structured_blocks.append({
            'text': segment_text,
            'start_seconds': round(segment.start, 2),
            'end_seconds': round(segment.end, 2),
            'confidence': confidence,
        })

    combined_text = '\n'.join(text_parts)
    detected_language = info.language if info else ''
    average_confidence = total_confidence / len(structured_blocks) if structured_blocks else 0.0
    word_count = len(combined_text.split()) if combined_text else 0

    return {
        'success': True,
        'text': combined_text,
        'word_count': word_count,
        'confidence': round(average_confidence, 4),
        'detected_language': detected_language,
        'pages': [{
            'page_number': 1,
            'text': combined_text,
            'word_count': word_count,
            'structured_blocks': structured_blocks,
        }],
    }

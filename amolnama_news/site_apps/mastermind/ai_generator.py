"""Mastermind AI generator — PDF → chunks → Ollama → questions."""

import json
import logging
import re
import time
import unicodedata
from decimal import Decimal

import requests
from django.utils import timezone

from .models import (
    CollBookChunk,
    CollGenerationJob,
    CollQuestion,
    CollQuestionOption,
    CollBook,
    CollBookChapter,
    RefQuizDifficultyLevel,
    RefQuizQuestionType,
)

logger = logging.getLogger(__name__)

OLLAMA_API_URL = 'http://localhost:11434/api/generate'
DEFAULT_MODEL = 'llama3.2:3b'


# ================================================================
# 1. BOOK INGESTION — PDF → chunks
# ================================================================

def ingest_book_from_pdf(book_id, file_path, chunk_max_words=500):
    """Extract text from PDF and store as chunks in DB.

    Uses textextractor's PyMuPDF engine (already handles Bengali OCR).
    Splits per-page text into chunks of ~chunk_max_words words.

    Returns dict with chunk_count, page_count.
    """
    try:
        book = CollBook.objects.get(mastermind_coll_book_id=book_id, is_active=True)
    except CollBook.DoesNotExist:
        return {'error': 'Book not found.'}

    # Use textextractor's proven PDF engine
    from amolnama_news.site_apps.textextractor.engines import extract_text

    result = extract_text(file_path, engine_code='pymupdf')
    if not result.get('success'):
        return {'error': 'PDF extraction failed.'}

    # Update book metadata
    CollBook.objects.filter(mastermind_coll_book_id=book_id).update(
        book_file_path=file_path,
        book_total_pages=result.get('page_count', 0),
        updated_at=timezone.now(),
    )

    # Clear existing chunks for this book (re-ingest)
    CollBookChunk.objects.filter(link_mastermind_coll_book_id=book_id).delete()


    # Get chapters for page-to-chapter mapping
    chapters = list(
        CollBookChapter.objects.filter(
            link_mastermind_coll_book_id=book_id,
            is_active=True,
        ).order_by('chapter_page_start').values(
            'mastermind_coll_book_chapter_id',
            'chapter_page_start',
            'chapter_page_end',
        )
    )

    chunk_count = 0
    sequence_order = 0

    for page_data in result.get('pages', []):
        page_number = page_data.get('page_number', 0)
        page_text = page_data.get('text', '').strip()

        if not page_text or len(page_text) < 20:
            continue

        # Find which chapter this page belongs to
        chapter_id = _find_chapter_for_page(chapters, page_number)

        # Split page text into chunks
        paragraphs = _split_into_chunks(page_text, chunk_max_words)

        for paragraph_index, chunk_text in enumerate(paragraphs):
            chunk_text = chunk_text.strip()
            if not chunk_text or len(chunk_text) < 10:
                continue

            word_count = len(chunk_text.split())
            sequence_order += 1

            # Raw pyodbc INSERT to prevent ntext promotion on long Bengali text.
            # Django's cursor wrapper doesn't support per-parameter setinputsizes.
            # We bypass it and use the raw pyodbc connection + cursor directly.
            # See troubleshooting §5b for full explanation.
            import pyodbc
            from django.db import connection as django_db_connection
            django_db_connection.ensure_connection()
            raw_pyodbc_cursor = django_db_connection.connection.cursor()
            raw_pyodbc_cursor.setinputsizes([
                None, None, None, None,
                (pyodbc.SQL_WVARCHAR, 0, 0),
                None, None, None,
            ])
            raw_pyodbc_cursor.execute(
                """INSERT INTO [mastermind].[coll_book_chunk]
                   (link_mastermind_coll_book_id,
                    link_mastermind_coll_book_chapter_id,
                    chunk_page_number, chunk_paragraph_index,
                    chunk_text, chunk_word_count,
                    chunk_sequence_order, created_at, is_active)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)""",
                [book_id, chapter_id, page_number, paragraph_index,
                 chunk_text, word_count, sequence_order, timezone.now()],
            )
            django_db_connection.connection.commit()
            raw_pyodbc_cursor.close()
            chunk_count += 1

    return {
        'success': True,
        'chunk_count': chunk_count,
        'page_count': result.get('page_count', 0),
        'total_words': sum(
            len(page.get('text', '').split()) for page in result.get('pages', [])
        ),
    }


def _find_chapter_for_page(chapters, page_number):
    """Find chapter ID for a given page number."""
    for chapter in chapters:
        page_start = chapter.get('chapter_page_start')
        page_end = chapter.get('chapter_page_end')
        if page_start and page_end:
            if page_start <= page_number <= page_end:
                return chapter['mastermind_coll_book_chapter_id']
        elif page_start:
            if page_number >= page_start:
                return chapter['mastermind_coll_book_chapter_id']
    return None


def _split_into_chunks(text, max_words=500):
    """Split text into chunks of approximately max_words words.

    Splits on paragraph breaks (\n\n) first, then sentence boundaries.
    Never splits mid-sentence.
    """
    paragraphs = re.split(r'\n\s*\n', text)

    chunks = []
    current_chunk = []
    current_word_count = 0

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        paragraph_word_count = len(paragraph.split())

        if current_word_count + paragraph_word_count <= max_words:
            current_chunk.append(paragraph)
            current_word_count += paragraph_word_count
        else:
            # Save current chunk
            if current_chunk:
                chunks.append('\n'.join(current_chunk))

            # If single paragraph is too long, split by sentences
            if paragraph_word_count > max_words:
                sentence_chunks = _split_long_paragraph(paragraph, max_words)
                chunks.extend(sentence_chunks)
                current_chunk = []
                current_word_count = 0
            else:
                current_chunk = [paragraph]
                current_word_count = paragraph_word_count

    if current_chunk:
        chunks.append('\n'.join(current_chunk))

    return chunks


def _split_long_paragraph(paragraph, max_words):
    """Split a long paragraph by sentence boundaries."""
    # Bengali and English sentence endings
    sentences = re.split(r'(?<=[।.!?])\s+', paragraph)

    chunks = []
    current_chunk = []
    current_word_count = 0

    for sentence in sentences:
        sentence_word_count = len(sentence.split())
        if current_word_count + sentence_word_count <= max_words:
            current_chunk.append(sentence)
            current_word_count += sentence_word_count
        else:
            if current_chunk:
                chunks.append(' '.join(current_chunk))
            current_chunk = [sentence]
            current_word_count = sentence_word_count

    if current_chunk:
        chunks.append(' '.join(current_chunk))

    return chunks


# ================================================================
# 2. QUESTION GENERATION — chunk → Ollama → questions
# ================================================================

# Prompt templates for different question types
GENERATION_PROMPTS = {
    'mcq_single': """You are a strict exam question writer. Read this text carefully and generate {count} multiple choice questions in Bengali.

TEXT:
{chunk_text}

RULES:
- Each question must have exactly 4 options (ক, খ, গ, ঘ)
- Exactly ONE option must be correct
- The correct answer MUST be directly stated in the text above
- Include negative questions (যেটি সঠিক নয়, কোনটি ভুল) for variety
- Include the page number reference

Return ONLY valid JSON array. No explanations. Format:
[
  {{
    "question": "Bengali question text",
    "options": [
      {{"label": "ক", "text": "option text", "is_correct": false}},
      {{"label": "খ", "text": "option text", "is_correct": true}},
      {{"label": "গ", "text": "option text", "is_correct": false}},
      {{"label": "ঘ", "text": "option text", "is_correct": false}}
    ],
    "explanation": "Why the correct answer is correct",
    "difficulty": "easy|medium|hard"
  }}
]""",

    'true_false': """You are a strict exam question writer. Read this text carefully and generate {count} true/false questions in Bengali.

TEXT:
{chunk_text}

RULES:
- Each question must be a clear statement that is either TRUE or FALSE
- The answer MUST be verifiable from the text above
- Mix true and false answers roughly equally

Return ONLY valid JSON array. No explanations. Format:
[
  {{
    "question": "Bengali statement",
    "is_true": true,
    "explanation": "Why this is true/false",
    "difficulty": "easy|medium|hard"
  }}
]""",

    'fill_blank': """You are a strict exam question writer. Read this text carefully and generate {count} fill-in-the-blank questions in Bengali.

TEXT:
{chunk_text}

RULES:
- Replace a key term with _____ (blank)
- The answer MUST be directly from the text
- The blank should test an important fact, not a trivial word

Return ONLY valid JSON array. No explanations. Format:
[
  {{
    "question": "Bengali sentence with _____ for blank",
    "answer": "the correct word/phrase",
    "explanation": "Context from the text",
    "difficulty": "easy|medium|hard"
  }}
]""",

    'mixed': """You are a strict exam question writer. Read this text carefully and generate {count} questions in Bengali. Mix question types for variety.

TEXT:
{chunk_text}

RULES:
- Generate a mix of: MCQ (4 options), True/False, and Fill-in-the-blank
- All answers MUST be directly verifiable from the text above
- Include negative questions for MCQs
- Mark difficulty level for each

Return ONLY valid JSON array. No explanations. Format:
[
  {{
    "type": "mcq|true_false|fill_blank",
    "question": "Bengali question text",
    "options": [{{"label": "ক", "text": "...", "is_correct": false}}, ...],
    "answer": "for fill_blank type",
    "is_true": true,
    "explanation": "Why the answer is correct",
    "difficulty": "easy|medium|hard"
  }}
]""",
}


def generate_questions_from_chunk(chunk_id, topic_id, question_count=5,
                                  prompt_template_code='mcq_single',
                                  model_name=None, user_profile_id=None):
    """Generate questions from a single book chunk using Ollama.

    Returns dict with generated questions, or error.
    """
    model = model_name or DEFAULT_MODEL

    try:
        chunk = CollBookChunk.objects.get(
            mastermind_coll_book_chunk_id=chunk_id, is_active=True
        )
    except CollBookChunk.DoesNotExist:
        return {'error': 'Chunk not found.'}

    if chunk.chunk_word_count < 30:
        return {'error': 'Chunk too short for question generation.'}

    # Quality gate — skip garbled OCR chunks
    quality_score = _assess_chunk_quality(chunk.chunk_text)
    if quality_score < 0.4:
        return {
            'error': 'Chunk quality too low (likely garbled OCR).',
            'quality_score': quality_score,
        }

    # Build prompt
    prompt_template = GENERATION_PROMPTS.get(prompt_template_code)
    if not prompt_template:
        prompt_template = GENERATION_PROMPTS['mcq_single']

    prompt = prompt_template.format(
        count=question_count,
        chunk_text=chunk.chunk_text,
    )

    # Call Ollama
    start_time = time.time()
    try:
        response_text = _call_ollama(prompt, model)
    except Exception as exception:
        logger.error("Ollama call failed: %s", exception)
        return {'error': f'LLM call failed: {str(exception)}'}
    generation_time = int(time.time() - start_time)

    # Parse response
    parsed_questions = _parse_llm_response(response_text, prompt_template_code)
    if not parsed_questions:
        return {
            'error': 'Failed to parse LLM response.',
            'raw_response': response_text[:500],
            'generation_time_seconds': generation_time,
        }

    # Validate and store questions
    stored_questions = _store_generated_questions(
        parsed_questions=parsed_questions,
        prompt_template_code=prompt_template_code,
        chunk=chunk,
        topic_id=topic_id,
        user_profile_id=user_profile_id,
    )

    return {
        'success': True,
        'questions_generated': len(parsed_questions),
        'questions_stored': len(stored_questions),
        'questions_rejected': len(parsed_questions) - len(stored_questions),
        'question_ids': stored_questions,
        'generation_time_seconds': generation_time,
        'model': model,
    }


def _call_ollama(prompt, model=None):
    """Call Ollama HTTP API and return the response text."""
    model = model or DEFAULT_MODEL

    response = requests.post(
        OLLAMA_API_URL,
        json={
            'model': model,
            'prompt': prompt,
            'stream': False,
            'options': {
                'temperature': 0.3,
                'num_predict': 1500,  # Hard cap — prevents runaway generation that caused 300s timeouts.
            },
        },
        timeout=600,  # 10-minute ceiling; num_predict should finish well under this.
    )
    response.raise_for_status()
    return response.json().get('response', '')


def _parse_llm_response(response_text, prompt_template_code):
    """Extract JSON array from LLM response (handles markdown code blocks)."""
    logger.debug("LLM raw response: %s", response_text[:2000])
    # Strip markdown code blocks if present
    cleaned = response_text.strip()
    cleaned = re.sub(r'^```json\s*', '', cleaned)
    cleaned = re.sub(r'^```\s*', '', cleaned)
    cleaned = re.sub(r'\s*```$', '', cleaned)

    # Find JSON array
    json_match = re.search(r'\[[\s\S]*\]', cleaned)
    if not json_match:
        logger.error("No JSON array found in LLM response")
        return None

    try:
        parsed = json.loads(json_match.group())
        if not isinstance(parsed, list):
            return None
        return parsed
    except json.JSONDecodeError as json_error:
        logger.error("JSON parse error: %s", json_error)
        # Try to fix common JSON issues
        try:
            fixed = json_match.group()
            fixed = re.sub(r',\s*]', ']', fixed)  # trailing comma
            fixed = re.sub(r',\s*}', '}', fixed)  # trailing comma in objects
            return json.loads(fixed)
        except json.JSONDecodeError:
            return None


def _store_generated_questions(parsed_questions, prompt_template_code, chunk,
                               topic_id, user_profile_id):
    """Validate and store parsed questions in DB. Returns list of created question IDs."""
    # Cache ref lookups
    question_type_map = {
        question_type.question_type_code: question_type.mastermind_ref_quiz_question_type_id
        for question_type in RefQuizQuestionType.objects.filter(is_active=True)
    }
    difficulty_map = {
        difficulty.difficulty_code: difficulty.mastermind_ref_quiz_difficulty_level_id
        for difficulty in RefQuizDifficultyLevel.objects.filter(is_active=True)
    }

    stored_question_ids = []

    for parsed_question in parsed_questions:
        # Determine question type
        if prompt_template_code == 'mixed':
            question_type_code = parsed_question.get('type', 'mcq_single')
            if question_type_code == 'mcq':
                question_type_code = 'mcq_single'
        elif prompt_template_code == 'true_false':
            question_type_code = 'true_false'
        elif prompt_template_code == 'fill_blank':
            question_type_code = 'fill_blank'
        else:
            question_type_code = 'mcq_single'

        question_type_id = question_type_map.get(question_type_code)
        if not question_type_id:
            continue

        # Get question text
        question_text = (parsed_question.get('question') or '').strip()
        if not question_text:
            continue

        # Validate: answer must be grounded in source chunk (anti-hallucination)
        verification = _verify_answer_in_chunk(
            parsed_question, chunk.chunk_text, question_type_code,
        )
        if not verification['verdict']:
            logger.warning(
                "Question rejected — %s (sim=%s, entail=%s, contra=%s)",
                verification['verdict_code'],
                verification['similarity'],
                verification['entailment'],
                verification['contradiction'],
            )
            continue

        # Deduplication: reject if near-duplicate of existing question
        from .embeddings import is_duplicate_question
        is_duplicate, existing_match = is_duplicate_question(
            question_text, topic_id=topic_id, threshold=0.90
        )
        if is_duplicate:
            logger.warning(
                "Question rejected — duplicate of Q%s (similarity=%.3f)",
                existing_match['question_id'], existing_match['similarity'],
            )
            continue

        # Difficulty
        difficulty_code = (parsed_question.get('difficulty') or 'medium').lower()
        difficulty_id = difficulty_map.get(difficulty_code, difficulty_map.get('medium'))

        # Explanation
        explanation = (parsed_question.get('explanation') or '').strip() or None

        # Create question with NLI confidence metadata
        question = CollQuestion.objects.create(
            link_mastermind_ref_quiz_question_type_id=question_type_id,
            link_mastermind_ref_quiz_difficulty_level_id=difficulty_id,
            link_mastermind_coll_quiz_topic_id=topic_id,
            question_text_bn=question_text,
            question_explanation_bn=explanation,
            question_points=1,
            link_mastermind_coll_book_id=chunk.link_mastermind_coll_book_id,
            link_mastermind_coll_book_chapter_id=chunk.link_mastermind_coll_book_chapter_id,
            source_page_number=chunk.chunk_page_number,
            source_snippet_text=chunk.chunk_text[:500],
            link_created_by_user_profile_id=user_profile_id,
            question_generation_source_code='ai_generated',
            question_status_code='review',  # AI questions always go to review queue
            nli_similarity_score=_to_decimal(verification['similarity']),
            nli_entailment_score=_to_decimal(verification['entailment']),
            nli_contradiction_score=_to_decimal(verification['contradiction']),
            nli_verdict_code=verification['verdict_code'],
            nli_confidence_level_code=verification['confidence_level'],
            created_at=timezone.now(),
        )

        # Create options based on type
        # option_label is a STRUCTURAL identifier (ক/খ/গ/ঘ) — derived from
        # index position, NEVER trusted from LLM output. The LLM's "label"
        # field sometimes contains the full answer text, which would crash
        # NVARCHAR(5). See app-mastermind.txt "structural IDs vs content".
        if question_type_code in ('mcq_single', 'mcq_multi'):
            options = parsed_question.get('options', [])
            for option_index, option_data in enumerate(options):
                option_text = (option_data.get('text') or '').strip()
                if not option_text:
                    continue
                option_label = (
                    BENGALI_OPTION_LABELS[option_index]
                    if option_index < len(BENGALI_OPTION_LABELS)
                    else str(option_index + 1)
                )
                CollQuestionOption.objects.create(
                    link_mastermind_coll_question_id=question.mastermind_coll_question_id,
                    option_label=option_label,
                    option_text_bn=option_text,
                    is_correct=option_data.get('is_correct', False),
                    sort_order=option_index,
                    created_at=timezone.now(),
                )

        elif question_type_code == 'true_false':
            is_true = parsed_question.get('is_true', True)
            for label, text, correct in [
                ('ক', 'সত্য', is_true),
                ('খ', 'মিথ্যা', not is_true),
            ]:
                CollQuestionOption.objects.create(
                    link_mastermind_coll_question_id=question.mastermind_coll_question_id,
                    option_label=label,
                    option_text_bn=text,
                    is_correct=correct,
                    sort_order=0 if label == 'ক' else 1,
                    created_at=timezone.now(),
                )

        elif question_type_code == 'fill_blank':
            answer_text = (parsed_question.get('answer') or '').strip()
            if answer_text:
                CollQuestionOption.objects.create(
                    link_mastermind_coll_question_id=question.mastermind_coll_question_id,
                    option_label='a',
                    option_text_bn=answer_text,
                    is_correct=True,
                    sort_order=0,
                    created_at=timezone.now(),
                )

        # Generate embedding for the new question (enables future deduplication)
        from .embeddings import embed_question
        try:
            embed_question(question.mastermind_coll_question_id, question_text)
        except Exception as embed_error:
            logger.warning(
                "Failed to embed question %s: %s",
                question.mastermind_coll_question_id, embed_error,
            )

        stored_question_ids.append(question.mastermind_coll_question_id)

    return stored_question_ids


# ================================================================
# 3. ANTI-HALLUCINATION — semantic verification + fallback word match
# ================================================================

def _verify_answer_in_chunk(parsed_question, chunk_text, question_type_code):
    """Verify that the correct answer is grounded in the source chunk.

    Tiered write-barrier gate:
    1. Word-match pre-filter (instant — catches exact/near-exact quotes)
    2. Similarity filter (fast — rejects obviously unrelated)
    3. NLI entailment (accurate — judges grey-zone faithfulness)

    Returns dict with:
        verdict: bool (True = pass, False = reject)
        similarity: float (Tier 1 score, may be None)
        entailment: float (Tier 2 score, may be None)
        contradiction: float (Tier 2 score, may be None)
        verdict_code: 'pass_exact_substring' | 'pass_word_match' | 'pass_similarity' |
                      'pass_nli' | 'reject_empty_answer' | 'reject_similarity' |
                      'reject_nli' | 'pass_fallback' | 'reject_fallback'
        confidence_level: 'high' | 'medium' | 'low' | None
    """
    blank = {
        'verdict': True,
        'similarity': None,
        'entailment': None,
        'contradiction': None,
        'verdict_code': None,
        'confidence_level': None,
    }

    # Build the "answer string" to verify based on question type
    if question_type_code in ('mcq_single', 'mcq_multi'):
        options = parsed_question.get('options', [])
        correct_options = [
            option for option in options if option.get('is_correct')
        ]
        if not correct_options:
            return {**blank, 'verdict': False, 'verdict_code': 'reject_no_correct_option'}
        answer_text = ' '.join(
            (correct_option.get('text') or '') for correct_option in correct_options
        )

    elif question_type_code == 'true_false':
        answer_text = parsed_question.get('question') or ''

    elif question_type_code == 'fill_blank':
        answer_text = parsed_question.get('answer') or ''
        normalized_answer = unicodedata.normalize('NFC', answer_text.strip().lower())
        normalized_chunk = unicodedata.normalize('NFC', chunk_text.lower())
        if normalized_answer and normalized_answer in normalized_chunk:
            return {**blank, 'verdict_code': 'pass_exact_substring', 'confidence_level': 'high'}

    else:
        return {**blank, 'verdict_code': 'pass_unknown_type'}

    if not answer_text.strip():
        return {**blank, 'verdict': False, 'verdict_code': 'reject_empty_answer'}

    # Stage 1: fast word-match pre-filter
    if _word_match_passes(answer_text, chunk_text, threshold=0.5):
        logger.info("Question accepted: word-match pre-filter (>=50%% words present)")
        return {**blank, 'verdict_code': 'pass_word_match', 'confidence_level': 'high'}

    # Stage 2 + 3: tiered semantic + NLI verification
    from .embeddings import verify_faithfulness
    result = verify_faithfulness(chunk_text, answer_text)
    logger.info(
        "Faithfulness verdict=%s | %s",
        result['verdict'], result['reason'],
    )

    similarity = result.get('similarity')
    nli_scores = result.get('nli_scores') or {}
    entailment = nli_scores.get('entailment')
    contradiction = nli_scores.get('contradiction')
    reason = result.get('reason') or ''

    # Determine verdict_code from reason
    if result['verdict'] == 'pass':
        if 'near-exact' in reason:
            verdict_code = 'pass_similarity'
            confidence_level = 'high'
        elif 'NLI entailment' in reason:
            verdict_code = 'pass_nli'
            confidence_level = 'high' if (entailment or 0) >= 0.90 else 'medium'
        elif 'similarity fallback' in reason:
            verdict_code = 'pass_fallback'
            confidence_level = 'low'
        else:
            verdict_code = 'pass_unknown'
            confidence_level = 'medium'
    else:
        if 'too unrelated' in reason:
            verdict_code = 'reject_similarity'
        elif 'NLI contradiction' in reason:
            verdict_code = 'reject_nli'
        elif 'similarity fallback' in reason:
            verdict_code = 'reject_fallback'
        else:
            verdict_code = 'reject_unknown'
        confidence_level = None

    return {
        'verdict': result['verdict'] == 'pass',
        'similarity': similarity,
        'entailment': entailment,
        'contradiction': contradiction,
        'verdict_code': verdict_code,
        'confidence_level': confidence_level,
    }


def _to_decimal(value):
    """Convert float (or None) to Decimal for SQL Server DECIMAL storage."""
    if value is None:
        return None
    return Decimal(str(round(float(value), 4)))


def _word_match_passes(answer_text, chunk_text, threshold=0.4):
    """Fast pre-filter: check if answer words appear in chunk text."""
    normalized_answer = unicodedata.normalize('NFC', answer_text.lower())
    normalized_chunk = unicodedata.normalize('NFC', chunk_text.lower())

    answer_words = [word for word in normalized_answer.split() if len(word) > 2]
    if not answer_words:
        return False

    match_count = sum(1 for word in answer_words if word in normalized_chunk)
    return (match_count / len(answer_words)) >= threshold


def _assess_chunk_quality(chunk_text):
    """Estimate OCR quality of a chunk. Returns score 0-1.

    Low-quality chunks (garbled OCR) should not be sent to LLM.
    """
    if not chunk_text or len(chunk_text) < 20:
        return 0.0

    normalized = unicodedata.normalize('NFC', chunk_text)

    # 1. Bengali character ratio (most of our content is Bengali)
    bengali_chars = sum(1 for character in normalized if 0x0980 <= ord(character) <= 0x09FF)
    ascii_letters = sum(1 for character in normalized if character.isalpha() and ord(character) < 128)
    total_letters = bengali_chars + ascii_letters

    if total_letters == 0:
        return 0.0

    # Chunks should be mostly Bengali OR mostly English — not random mix
    bengali_ratio = bengali_chars / total_letters
    language_purity = max(bengali_ratio, 1 - bengali_ratio)

    # 2. Word length sanity — OCR garbage tends to have very long or very short words
    words = normalized.split()
    if not words:
        return 0.0

    avg_word_length = sum(len(word) for word in words) / len(words)
    length_sanity = 1.0 if 3 <= avg_word_length <= 15 else 0.5

    # 3. Punctuation presence — real text has sentence breaks
    has_sentence_breaks = any(character in normalized for character in '।.!?')
    punctuation_score = 1.0 if has_sentence_breaks else 0.6

    # 4. Non-alphanumeric ratio — too many symbols = garbled
    non_alnum = sum(
        1 for character in normalized
        if not character.isalnum() and not character.isspace()
        and character not in '।.,!?;:\'"()-'
    )
    alnum_ratio = 1.0 - min(1.0, non_alnum / max(1, len(normalized)))

    # Weighted combination
    quality_score = (
        language_purity * 0.35
        + length_sanity * 0.25
        + punctuation_score * 0.20
        + alnum_ratio * 0.20
    )

    return round(quality_score, 3)


# ================================================================
# 4. BATCH GENERATION JOB — process entire book/chapter
# ================================================================

def start_generation_job(book_id, topic_id, chapter_id=None,
                         questions_per_chunk=3, prompt_template_code='mixed',
                         model_name=None, user_profile_id=None):
    """Start a batch generation job for a book or chapter.

    Creates a job record, then processes chunks sequentially.
    Returns job result summary.
    """
    model = model_name or DEFAULT_MODEL

    # Validate
    try:
        book = CollBook.objects.get(mastermind_coll_book_id=book_id, is_active=True)
    except CollBook.DoesNotExist:
        return {'error': 'Book not found.'}

    # Check chunks exist
    chunk_filter = {
        'link_mastermind_coll_book_id': book_id,
        'is_active': True,
    }
    if chapter_id:
        chunk_filter['link_mastermind_coll_book_chapter_id'] = chapter_id

    chunks = list(
        CollBookChunk.objects.filter(**chunk_filter).order_by(
            'chunk_sequence_order'
        ).values_list('mastermind_coll_book_chunk_id', flat=True)
    )

    if not chunks:
        return {'error': 'No chunks found. Ingest the book PDF first.'}

    # Create job record
    job = CollGenerationJob.objects.create(
        link_mastermind_coll_book_id=book_id,
        link_mastermind_coll_book_chapter_id=chapter_id,
        link_mastermind_coll_quiz_topic_id=topic_id,
        link_started_by_user_profile_id=user_profile_id,
        generation_model_name=model,
        generation_prompt_template_code=prompt_template_code,
        generation_questions_requested=len(chunks) * questions_per_chunk,
        generation_status_code='processing',
        created_at=timezone.now(),
    )

    # Process chunks
    start_time = time.time()
    total_created = 0
    total_rejected = 0

    for chunk_id in chunks:
        result = generate_questions_from_chunk(
            chunk_id=chunk_id,
            topic_id=topic_id,
            question_count=questions_per_chunk,
            prompt_template_code=prompt_template_code,
            model_name=model,
            user_profile_id=user_profile_id,
        )

        if 'error' not in result:
            total_created += result.get('questions_stored', 0)
            total_rejected += result.get('questions_rejected', 0)

    processing_time = int(time.time() - start_time)

    # Update job
    job.generation_questions_created = total_created
    job.generation_questions_rejected = total_rejected
    job.generation_status_code = 'completed'
    job.generation_processing_time_seconds = processing_time
    job.completed_at = timezone.now()
    job.save()

    return {
        'success': True,
        'job_id': job.mastermind_coll_generation_job_id,
        'chunks_processed': len(chunks),
        'questions_created': total_created,
        'questions_rejected': total_rejected,
        'processing_time_seconds': processing_time,
        'status': 'review',  # All AI questions go to review queue
    }


# ================================================================
# 5. REVIEW QUEUE — approve/reject AI-generated questions
# ================================================================

def get_review_queue(topic_id=None, limit=50):
    """Get AI-generated questions pending review."""
    review_filter = {
        'question_status_code': 'review',
        'question_generation_source_code': 'ai_generated',
        'is_active': True,
    }
    if topic_id:
        review_filter['link_mastermind_coll_quiz_topic_id'] = topic_id

    questions = list(
        CollQuestion.objects.filter(**review_filter).order_by(
            'created_at'
        )[:limit].values(
            'mastermind_coll_question_id',
            'question_text_bn',
            'question_explanation_bn',
            'source_page_number',
            'source_snippet_text',
            'link_mastermind_coll_quiz_topic_id',
            'nli_similarity_score',
            'nli_entailment_score',
            'nli_contradiction_score',
            'nli_verdict_code',
            'nli_confidence_level_code',
            'created_at',
        )
    )

    # Decimal is not JSON-serializable — convert to float for API consumers
    for question in questions:
        for score_key in (
            'nli_similarity_score', 'nli_entailment_score', 'nli_contradiction_score',
        ):
            if question.get(score_key) is not None:
                question[score_key] = float(question[score_key])

    # Load options for each question
    question_ids = [question['mastermind_coll_question_id'] for question in questions]
    all_options = list(
        CollQuestionOption.objects.filter(
            link_mastermind_coll_question_id__in=question_ids,
            is_active=True,
        ).values(
            'link_mastermind_coll_question_id',
            'option_label',
            'option_text_bn',
            'is_correct',
        )
    )
    options_by_question = {}
    for option in all_options:
        options_by_question.setdefault(
            option['link_mastermind_coll_question_id'], []
        ).append(option)

    for question in questions:
        question['options'] = options_by_question.get(
            question['mastermind_coll_question_id'], []
        )

    return {
        'pending_count': CollQuestion.objects.filter(**review_filter).count(),
        'questions': questions,
    }


def approve_question(question_id, reviewer_user_profile_id=None):
    """Approve an AI-generated question — moves to published."""
    updated = CollQuestion.objects.filter(
        mastermind_coll_question_id=question_id,
        question_status_code='review',
    ).update(
        question_status_code='published',
        question_generation_source_code='ai_reviewed',
        updated_at=timezone.now(),
    )
    if updated == 0:
        return {'error': 'Question not found or not in review.'}
    return {'success': True, 'question_id': question_id, 'status': 'published'}


def reject_question(question_id, reviewer_user_profile_id=None):
    """Reject an AI-generated question — moves to archived."""
    updated = CollQuestion.objects.filter(
        mastermind_coll_question_id=question_id,
        question_status_code='review',
    ).update(
        question_status_code='archived',
        is_active=False,
        updated_at=timezone.now(),
    )
    if updated == 0:
        return {'error': 'Question not found or not in review.'}
    return {'success': True, 'question_id': question_id, 'status': 'archived'}


def bulk_approve_questions(question_ids):
    """Approve multiple questions at once."""
    updated = CollQuestion.objects.filter(
        mastermind_coll_question_id__in=question_ids,
        question_status_code='review',
    ).update(
        question_status_code='published',
        question_generation_source_code='ai_reviewed',
        updated_at=timezone.now(),
    )
    return {'approved': updated, 'total_requested': len(question_ids)}


# ================================================================
# 6. MANUAL CRUD — create/update questions from the Quiz Panel UI
# ================================================================

BENGALI_OPTION_LABELS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ']


def _derive_option_label(option_index):
    if option_index < len(BENGALI_OPTION_LABELS):
        return BENGALI_OPTION_LABELS[option_index]
    return str(option_index + 1)


def create_question_manual(payload, user_profile_id=None):
    """Create a question and its options from a staff-submitted payload.

    Expected payload keys (all strings/ints/bools, validated by caller):
        question_type_id, difficulty_id, topic_id              (required)
        question_text_bn                                       (required)
        question_text_en, question_explanation_bn, question_explanation_en,
        question_hint_bn, question_hint_en                     (optional)
        book_id, chapter_id, source_page_number,
        source_snippet_text                                    (optional)
        question_points (default 1), question_time_limit_seconds,
        question_negative_marking_points (default 0)           (optional)
        question_status_code (default 'draft')                 (optional)
        options: list of {text_bn, text_en?, is_correct, explanation_bn?}
                 — required for MCQ; ignored for other types.
        answer_text: for fill_blank / short_answer.
    """
    from django.db import transaction

    question_text_bn = (payload.get('question_text_bn') or '').strip()
    if not question_text_bn:
        return {'error': 'question_text_bn is required.'}
    question_type_id = payload.get('question_type_id')
    difficulty_id = payload.get('difficulty_id')
    topic_id = payload.get('topic_id')
    if not (question_type_id and difficulty_id and topic_id):
        return {'error': 'question_type_id, difficulty_id, topic_id are required.'}

    question_type_code = (
        RefQuizQuestionType.objects
        .filter(mastermind_ref_quiz_question_type_id=question_type_id)
        .values_list('question_type_code', flat=True)
        .first()
    )
    if not question_type_code:
        return {'error': 'Unknown question_type_id.'}

    with transaction.atomic():
        question = CollQuestion.objects.create(
            link_mastermind_ref_quiz_question_type_id=question_type_id,
            link_mastermind_ref_quiz_difficulty_level_id=difficulty_id,
            link_mastermind_coll_quiz_topic_id=topic_id,
            question_text_bn=question_text_bn,
            question_text_en=(payload.get('question_text_en') or None) or None,
            question_explanation_bn=(payload.get('question_explanation_bn') or None) or None,
            question_explanation_en=(payload.get('question_explanation_en') or None) or None,
            question_hint_bn=(payload.get('question_hint_bn') or None) or None,
            question_hint_en=(payload.get('question_hint_en') or None) or None,
            question_points=int(payload.get('question_points') or 1),
            question_time_limit_seconds=(
                int(payload['question_time_limit_seconds'])
                if payload.get('question_time_limit_seconds') else None
            ),
            question_negative_marking_points=payload.get('question_negative_marking_points') or 0,
            link_mastermind_coll_book_id=payload.get('book_id') or None,
            link_mastermind_coll_book_chapter_id=payload.get('chapter_id') or None,
            source_page_number=payload.get('source_page_number') or None,
            source_snippet_text=(payload.get('source_snippet_text') or None) or None,
            link_created_by_user_profile_id=user_profile_id,
            question_generation_source_code='manual',
            question_status_code=payload.get('question_status_code') or 'draft',
            created_at=timezone.now(),
        )
        _apply_options_to_question(question, question_type_code, payload)

    return {
        'success': True,
        'question_id': question.mastermind_coll_question_id,
        'status': question.question_status_code,
    }


def _create_question_version_snapshot(question, user_profile_id):
    """Snapshot current question state before an edit overwrites it."""
    import json
    from .models import CollQuestionVersion, CollQuestionOption

    current_version_number = (
        CollQuestionVersion.objects
        .filter(link_mastermind_coll_question_id=question.mastermind_coll_question_id)
        .order_by('-version_number')
        .values_list('version_number', flat=True)
        .first()
    ) or 0

    options = list(
        CollQuestionOption.objects
        .filter(
            link_mastermind_coll_question_id=question.mastermind_coll_question_id,
            is_active=True,
        )
        .values('option_label', 'option_text_bn', 'is_correct', 'sort_order')
    )

    CollQuestionVersion.objects.filter(
        link_mastermind_coll_question_id=question.mastermind_coll_question_id,
        is_current=True,
    ).update(is_current=False)

    CollQuestionVersion.objects.create(
        link_mastermind_coll_question_id=question.mastermind_coll_question_id,
        version_number=current_version_number + 1,
        question_text_bn=question.question_text_bn,
        question_text_en=question.question_text_en,
        question_explanation_bn=question.question_explanation_bn,
        question_explanation_en=getattr(question, 'question_explanation_en', None),
        question_metadata_json=json.dumps(options, ensure_ascii=False, default=str) if options else None,
        link_modified_by_user_profile_id=user_profile_id,
        is_current=True,
    )


def update_question_manual(question_id, payload, user_profile_id=None):
    """Update an existing question + its options."""
    from django.db import transaction

    existing = (
        CollQuestion.objects
        .filter(mastermind_coll_question_id=question_id, is_active=True)
        .first()
    )
    if not existing:
        return {'error': 'Question not found.'}

    question_text_bn = (payload.get('question_text_bn') or '').strip()
    if not question_text_bn:
        return {'error': 'question_text_bn is required.'}

    question_type_id = payload.get('question_type_id') or existing.link_mastermind_ref_quiz_question_type_id
    question_type_code = (
        RefQuizQuestionType.objects
        .filter(mastermind_ref_quiz_question_type_id=question_type_id)
        .values_list('question_type_code', flat=True)
        .first()
    )

    with transaction.atomic():
        _create_question_version_snapshot(existing, user_profile_id)
        CollQuestion.objects.filter(mastermind_coll_question_id=question_id).update(
            link_mastermind_ref_quiz_question_type_id=question_type_id,
            link_mastermind_ref_quiz_difficulty_level_id=
                payload.get('difficulty_id') or existing.link_mastermind_ref_quiz_difficulty_level_id,
            link_mastermind_coll_quiz_topic_id=
                payload.get('topic_id') or existing.link_mastermind_coll_quiz_topic_id,
            question_text_bn=question_text_bn,
            question_text_en=(payload.get('question_text_en') or None) or None,
            question_explanation_bn=(payload.get('question_explanation_bn') or None) or None,
            question_explanation_en=(payload.get('question_explanation_en') or None) or None,
            question_hint_bn=(payload.get('question_hint_bn') or None) or None,
            question_hint_en=(payload.get('question_hint_en') or None) or None,
            question_points=int(payload.get('question_points') or existing.question_points),
            question_time_limit_seconds=(
                int(payload['question_time_limit_seconds'])
                if payload.get('question_time_limit_seconds') else None
            ),
            question_negative_marking_points=
                payload.get('question_negative_marking_points') or existing.question_negative_marking_points,
            link_mastermind_coll_book_id=payload.get('book_id') or None,
            link_mastermind_coll_book_chapter_id=payload.get('chapter_id') or None,
            source_page_number=payload.get('source_page_number') or None,
            source_snippet_text=(payload.get('source_snippet_text') or None) or None,
            question_status_code=payload.get('question_status_code') or existing.question_status_code,
            updated_at=timezone.now(),
        )
        # Replace options wholesale — simpler than diffing, matches UX
        # (the form is a single submit; reviewer sees and confirms entire set).
        CollQuestionOption.objects.filter(
            link_mastermind_coll_question_id=question_id, is_active=True,
        ).delete()
        _apply_options_to_question(existing, question_type_code, payload)

    return {'success': True, 'question_id': question_id}


def _apply_options_to_question(question, question_type_code, payload):
    """Create the option rows for a question based on its type."""
    if question_type_code in ('mcq_single', 'mcq_multi'):
        for option_index, option_data in enumerate(payload.get('options') or []):
            text_bn = (option_data.get('text_bn') or '').strip()
            if not text_bn:
                continue
            CollQuestionOption.objects.create(
                link_mastermind_coll_question_id=question.mastermind_coll_question_id,
                option_label=_derive_option_label(option_index),
                option_text_bn=text_bn,
                option_text_en=(option_data.get('text_en') or None) or None,
                option_explanation_bn=(option_data.get('explanation_bn') or None) or None,
                is_correct=bool(option_data.get('is_correct')),
                sort_order=option_index,
                created_at=timezone.now(),
            )
    elif question_type_code == 'true_false':
        is_true = bool(payload.get('is_true', True))
        for option_index, (label, text, correct) in enumerate([
            ('ক', 'সত্য', is_true),
            ('খ', 'মিথ্যা', not is_true),
        ]):
            CollQuestionOption.objects.create(
                link_mastermind_coll_question_id=question.mastermind_coll_question_id,
                option_label=label,
                option_text_bn=text,
                is_correct=correct,
                sort_order=option_index,
                created_at=timezone.now(),
            )
    elif question_type_code in ('fill_blank', 'short_answer'):
        answer_text = (payload.get('answer_text') or '').strip()
        if answer_text:
            CollQuestionOption.objects.create(
                link_mastermind_coll_question_id=question.mastermind_coll_question_id,
                option_label=_derive_option_label(0),
                option_text_bn=answer_text,
                is_correct=True,
                sort_order=0,
                created_at=timezone.now(),
            )

"""Mastermind book editor — paste-as-book + user-authored books + chapter text edit.

This module is the engine layer for three book-handling features that share
the same data model (CollBook + CollBookChapter + CollBookChunk):

  1. Edit imported (OCR'd) book text — staff fix OCR errors in chunks
  2. Paste plain text as a book — skip OCR pipeline entirely
  3. Author original books on the platform — content flywheel

It is NOT the question-generation engine (that's ai_generator.py) and does
NOT touch any unrelated code paths. The AI gen pipeline still reads
CollBookChunk.chunk_text — when text is edited or pasted here, we replace
chunks for the affected chapter so the next AI gen run sees the fresh text.

Key public functions
--------------------
  chunk_pasted_text(plain_text, chunk_max_words=500)
      Pure function — splits a long text into chunks (paragraph + sentence
      aware) using the SAME splitter as the PDF ingest path so behaviour
      stays consistent across imported/pasted/authored books.

  create_book_from_paste(...)         — full pipeline for paste-as-book
  create_blank_authored_book(...)     — empty shell for "write a book" flow
  replace_chapter_chunks(chapter_id, plain_text, page_number)
      DELETE old chunks for ONE chapter + INSERT new chunks. Other chapters
      untouched. Used after every chapter-text save in the editor.

  publish_book(book_id, owner_user_profile_id)
      status → 'published', set published_at, mint book_slug.

  list_books_for_owner(user_profile_id, status=None, include_staff_view=False)
      Author dashboard data source. include_staff_view=True bypasses the
      owner filter so staff can see every book.

  get_chapter_with_text(chapter_id)
      Returns chapter metadata + concatenated text from all its chunks.
      Editor uses this on chapter-switch.
"""
import logging
import re

from django.db import connection as django_db_connection
from django.utils import timezone

from .models import (
    CollBook,
    CollBookChapter,
    CollBookChunk,
)

logger = logging.getLogger(__name__)


# ================================================================
# Chunker — shared with ai_generator.py's _split_into_chunks pattern
# ================================================================

def chunk_pasted_text(plain_text, chunk_max_words=500):
    """Split a long string into chunks of approximately chunk_max_words words.

    Splits on paragraph breaks (\n\n) first, then sentence boundaries.
    Never splits mid-sentence. Returns a list of stripped chunk strings.

    This is the SAME algorithm ai_generator.py uses for PDF text — keep them
    aligned so behaviour is consistent across imported/pasted/authored books.
    """
    if not plain_text or not plain_text.strip():
        return []

    paragraphs = re.split(r'\n\s*\n', plain_text)
    chunks = []
    current_chunk_lines = []
    current_word_count = 0

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        paragraph_words = len(paragraph.split())

        if current_word_count + paragraph_words <= chunk_max_words:
            current_chunk_lines.append(paragraph)
            current_word_count += paragraph_words
        else:
            if current_chunk_lines:
                chunks.append('\n\n'.join(current_chunk_lines))
            # Single huge paragraph → split on sentence boundaries
            if paragraph_words > chunk_max_words:
                sentences = re.split(r'(?<=[.।!?])\s+', paragraph)
                sentence_buffer = []
                sentence_buffer_words = 0
                for sentence in sentences:
                    sentence_word_count = len(sentence.split())
                    if sentence_buffer_words + sentence_word_count <= chunk_max_words:
                        sentence_buffer.append(sentence)
                        sentence_buffer_words += sentence_word_count
                    else:
                        if sentence_buffer:
                            chunks.append(' '.join(sentence_buffer))
                        sentence_buffer = [sentence]
                        sentence_buffer_words = sentence_word_count
                if sentence_buffer:
                    chunks.append(' '.join(sentence_buffer))
                current_chunk_lines = []
                current_word_count = 0
            else:
                current_chunk_lines = [paragraph]
                current_word_count = paragraph_words

    if current_chunk_lines:
        chunks.append('\n\n'.join(current_chunk_lines))

    return [chunk for chunk in chunks if chunk.strip()]


# ================================================================
# Chapter chunk persistence — uses raw pyodbc to dodge ntext promotion
# on long Bengali text. See troubleshooting §5b for the full reason.
# ================================================================

def replace_chapter_chunks(chapter_id, plain_text, page_number=None, chunk_max_words=500):
    """Replace ALL chunks for one chapter with chunks built from plain_text.

    Other chapters' chunks are untouched. Used by the editor on every
    chapter-text save AND by create_book_from_paste() during initial ingest.

    Returns dict {success, chunk_count} or {error}.
    """
    chapter = CollBookChapter.objects.filter(
        mastermind_coll_book_chapter_id=chapter_id, is_active=True,
    ).first()
    if not chapter:
        return {'error': 'Chapter not found.'}

    book_id = chapter.link_mastermind_coll_book_id

    # Wipe existing chunks for THIS chapter only
    CollBookChunk.objects.filter(
        link_mastermind_coll_book_chapter_id=chapter_id,
    ).delete()

    new_chunks = chunk_pasted_text(plain_text, chunk_max_words=chunk_max_words)
    if not new_chunks:
        return {'success': True, 'chunk_count': 0}

    # Find max sequence_order across the book so chunks stay globally ordered
    last_sequence_order_in_book = CollBookChunk.objects.filter(
        link_mastermind_coll_book_id=book_id,
    ).order_by('-chunk_sequence_order').values_list(
        'chunk_sequence_order', flat=True,
    ).first() or 0

    inserted_count = 0
    sequence_order = last_sequence_order_in_book

    for paragraph_index, chunk_text in enumerate(new_chunks):
        chunk_text = chunk_text.strip()
        if not chunk_text:
            continue
        word_count = len(chunk_text.split())
        sequence_order += 1
        try:
            _raw_insert_book_chunk(
                book_id=book_id,
                chapter_id=chapter_id,
                page_number=page_number,
                paragraph_index=paragraph_index,
                chunk_text=chunk_text,
                word_count=word_count,
                sequence_order=sequence_order,
            )
            inserted_count += 1
        except Exception:
            logger.exception(
                'Chunk insert failed (book_id=%s chapter_id=%s para_idx=%s)',
                book_id, chapter_id, paragraph_index,
            )

    CollBook.objects.filter(mastermind_coll_book_id=book_id).update(
        updated_at=timezone.now(),
    )
    return {'success': True, 'chunk_count': inserted_count}


def _raw_insert_book_chunk(book_id, chapter_id, page_number, paragraph_index,
                           chunk_text, word_count, sequence_order):
    """Raw pyodbc insert with SQL_WVARCHAR binding to avoid ntext promotion.

    Mirrors the pattern in ai_generator.ingest_book_from_pdf — the Django
    cursor wrapper can't set per-parameter setinputsizes, so we drop to the
    raw pyodbc connection. Long Bengali text would otherwise fail with
    'Cannot convert to text/ntext or collate to Latin1_General_100_CI_AS_SC_UTF8'.
    See troubleshooting §5b.
    """
    import pyodbc
    django_db_connection.ensure_connection()
    raw_pyodbc_cursor = django_db_connection.connection.cursor()
    try:
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
    finally:
        raw_pyodbc_cursor.close()


# ================================================================
# Book creation — origin-aware
# ================================================================

def create_book_from_paste(title_bn, owner_user_profile_id, paste_text,
                           title_en=None, language_code='bn', description=None,
                           cover_image_url=None,
                           chapter_title_bn='অধ্যায় ১', chapter_title_en='Chapter 1',
                           chunk_max_words=500):
    """Create a CollBook + first CollBookChapter + chunks from a single paste.

    The author can split into more chapters later in the editor by adding new
    chapter rows and moving text between them. v1 just creates one chapter
    holding the full paste — the editor handles chapter splitting via the UI.

    Returns dict {success, book_id, chapter_id, chunk_count} or {error}.
    """
    if not title_bn or not title_bn.strip():
        return {'error': 'title_bn is required.'}
    if not owner_user_profile_id:
        return {'error': 'owner_user_profile_id is required.'}
    if not paste_text or not paste_text.strip():
        return {'error': 'paste_text is required.'}

    book = CollBook.objects.create(
        book_title_bn=title_bn.strip(),
        book_title_en=(title_en or '').strip() or None,
        book_language_code=language_code or 'bn',
        book_description=(description or '').strip() or None,
        book_cover_image_url=(cover_image_url or '').strip() or None,
        link_created_by_user_profile_id=owner_user_profile_id,
        book_origin_code='pasted_text',
        book_status_code='draft',
        created_at=timezone.now(),
    )

    chapter = CollBookChapter.objects.create(
        link_mastermind_coll_book_id=book.mastermind_coll_book_id,
        chapter_number=1,
        chapter_title_bn=chapter_title_bn,
        chapter_title_en=chapter_title_en,
        sort_order=1,
        created_at=timezone.now(),
    )

    chunk_result = replace_chapter_chunks(
        chapter.mastermind_coll_book_chapter_id,
        paste_text,
        page_number=None,
        chunk_max_words=chunk_max_words,
    )
    if 'error' in chunk_result:
        return chunk_result

    return {
        'success': True,
        'book_id': book.mastermind_coll_book_id,
        'chapter_id': chapter.mastermind_coll_book_chapter_id,
        'chunk_count': chunk_result.get('chunk_count', 0),
    }


def create_blank_authored_book(title_bn, owner_user_profile_id,
                               title_en=None, language_code='bn', description=None,
                               cover_image_url=None):
    """Create an empty user-authored book — no chapters yet.

    Author goes to /quizadmin/book/<id>/edit/ and adds chapters one by one.
    """
    if not title_bn or not title_bn.strip():
        return {'error': 'title_bn is required.'}
    if not owner_user_profile_id:
        return {'error': 'owner_user_profile_id is required.'}
    book = CollBook.objects.create(
        book_title_bn=title_bn.strip(),
        book_title_en=(title_en or '').strip() or None,
        book_language_code=language_code or 'bn',
        book_description=(description or '').strip() or None,
        book_cover_image_url=(cover_image_url or '').strip() or None,
        link_created_by_user_profile_id=owner_user_profile_id,
        book_origin_code='user_authored',
        book_status_code='draft',
        created_at=timezone.now(),
    )
    return {'success': True, 'book_id': book.mastermind_coll_book_id}


def add_chapter_to_book(book_id, owner_user_profile_id, chapter_title_bn,
                        chapter_title_en=None, is_staff_user=False):
    """Append a new (empty) chapter at the end of a book.

    is_staff_user must be passed explicitly by the caller — defaults to False
    so direct shell calls without a request context fail safely.
    """
    book = CollBook.objects.filter(
        mastermind_coll_book_id=book_id, is_active=True,
    ).first()
    if not book:
        return {'error': 'Book not found.'}
    if not _user_can_edit_book(book, owner_user_profile_id, is_staff_user=is_staff_user):
        return {'error': 'Permission denied.'}

    last_chapter_number = CollBookChapter.objects.filter(
        link_mastermind_coll_book_id=book_id,
    ).order_by('-chapter_number').values_list(
        'chapter_number', flat=True,
    ).first() or 0

    chapter = CollBookChapter.objects.create(
        link_mastermind_coll_book_id=book_id,
        chapter_number=last_chapter_number + 1,
        chapter_title_bn=(chapter_title_bn or '').strip() or f'অধ্যায় {last_chapter_number + 1}',
        chapter_title_en=(chapter_title_en or '').strip() or None,
        sort_order=last_chapter_number + 1,
        created_at=timezone.now(),
    )
    return {
        'success': True,
        'chapter_id': chapter.mastermind_coll_book_chapter_id,
        'chapter_number': chapter.chapter_number,
    }


def update_chapter_metadata(chapter_id, owner_user_profile_id, is_staff_user,
                            chapter_title_bn=None, chapter_title_en=None,
                            chapter_number=None):
    """Update chapter title or chapter_number. Permission-checked."""
    chapter = CollBookChapter.objects.filter(
        mastermind_coll_book_chapter_id=chapter_id, is_active=True,
    ).first()
    if not chapter:
        return {'error': 'Chapter not found.'}
    book = CollBook.objects.filter(
        mastermind_coll_book_id=chapter.link_mastermind_coll_book_id,
    ).first()
    if not book or not _user_can_edit_book(book, owner_user_profile_id, is_staff_user):
        return {'error': 'Permission denied.'}

    update_fields = {}
    if chapter_title_bn is not None:
        update_fields['chapter_title_bn'] = chapter_title_bn.strip()
    if chapter_title_en is not None:
        update_fields['chapter_title_en'] = chapter_title_en.strip() or None
    if chapter_number is not None and isinstance(chapter_number, int) and chapter_number > 0:
        update_fields['chapter_number'] = chapter_number
        update_fields['sort_order'] = chapter_number

    if update_fields:
        CollBookChapter.objects.filter(
            mastermind_coll_book_chapter_id=chapter_id,
        ).update(**update_fields)
    return {'success': True, 'chapter_id': chapter_id}


# ================================================================
# Read API — for the editor + reader
# ================================================================

def get_chapter_with_text(chapter_id):
    """Return chapter metadata + concatenated text from its chunks.

    Editor calls this on chapter-switch. The chunks are joined with \n\n so
    the editor displays text that round-trips through the chunker cleanly.
    """
    chapter = CollBookChapter.objects.filter(
        mastermind_coll_book_chapter_id=chapter_id, is_active=True,
    ).first()
    if not chapter:
        return {'error': 'Chapter not found.'}

    chunks = list(
        CollBookChunk.objects.filter(
            link_mastermind_coll_book_chapter_id=chapter_id,
            is_active=True,
        ).order_by('chunk_sequence_order', 'mastermind_coll_book_chunk_id').values(
            'mastermind_coll_book_chunk_id', 'chunk_text',
            'chunk_page_number', 'chunk_word_count',
        )
    )
    full_text = '\n\n'.join(chunk['chunk_text'] for chunk in chunks)
    total_word_count = sum(chunk['chunk_word_count'] for chunk in chunks)

    return {
        'success': True,
        'chapter_id': chapter_id,
        'book_id': chapter.link_mastermind_coll_book_id,
        'chapter_number': chapter.chapter_number,
        'chapter_title_bn': chapter.chapter_title_bn,
        'chapter_title_en': chapter.chapter_title_en,
        'chapter_text': full_text,
        'chunk_count': len(chunks),
        'word_count': total_word_count,
    }


def list_chapters_for_book(book_id):
    """Return ordered list of chapters with light metadata for the sidebar."""
    return list(
        CollBookChapter.objects.filter(
            link_mastermind_coll_book_id=book_id, is_active=True,
        ).order_by('sort_order', 'chapter_number').values(
            'mastermind_coll_book_chapter_id',
            'chapter_number', 'chapter_title_bn', 'chapter_title_en',
            'chapter_page_start', 'chapter_page_end',
        )
    )


def ensure_default_chapter_for_orphan_chunks(book_id):
    """Idempotent migration that links orphan CollBookChunk rows to a chapter.

    A chunk is "orphan" if its link_mastermind_coll_book_chapter_id is NULL
    OR points at a chapter that doesn't exist / is inactive. The editor only
    shows text via chapters, so orphan chunks are invisible.

    Logic (handles BOTH the imported-PDF case AND the user-added-empty-chapter-
    first case the user hit on book #21):
      1. If there are no orphan chunks → no-op, return False.
      2. Otherwise pick a target chapter:
         - first existing active chapter (so manually-added chapter wins, the
           OCR text loads INTO IT instead of into a separately-created one).
         - if zero chapters exist, create one with the book title.
      3. Bulk-update every orphan chunk to point at the target chapter.

    Returns True if any orphan chunks were linked, False if there was nothing
    to do.
    """
    from django.db.models import Q

    # Find orphan chunks: NULL chapter id OR pointing at a non-active chapter
    active_chapter_ids = list(
        CollBookChapter.objects.filter(
            link_mastermind_coll_book_id=book_id, is_active=True,
        ).values_list('mastermind_coll_book_chapter_id', flat=True)
    )
    orphan_chunks_query = CollBookChunk.objects.filter(
        link_mastermind_coll_book_id=book_id,
        is_active=True,
    ).filter(
        Q(link_mastermind_coll_book_chapter_id__isnull=True)
        | ~Q(link_mastermind_coll_book_chapter_id__in=active_chapter_ids)
    )
    if not orphan_chunks_query.exists():
        return False

    # Pick or create the target chapter
    target_chapter = CollBookChapter.objects.filter(
        link_mastermind_coll_book_id=book_id, is_active=True,
    ).order_by('sort_order', 'mastermind_coll_book_chapter_id').first()

    if not target_chapter:
        book = CollBook.objects.filter(mastermind_coll_book_id=book_id).first()
        default_title_bn = (
            book.book_title_bn if book and book.book_title_bn else 'অধ্যায় ১'
        )
        target_chapter = CollBookChapter.objects.create(
            link_mastermind_coll_book_id=book_id,
            chapter_number=1,
            chapter_title_bn=default_title_bn,
            chapter_title_en=(book.book_title_en if book else None),
            sort_order=1,
            created_at=timezone.now(),
        )
        logger.info(
            'Auto-created default chapter %s for legacy book %s.',
            target_chapter.mastermind_coll_book_chapter_id, book_id,
        )

    # Bulk-link orphans to the target chapter
    linked_count = orphan_chunks_query.update(
        link_mastermind_coll_book_chapter_id=target_chapter.mastermind_coll_book_chapter_id,
    )
    logger.info(
        'Linked %d orphan chunks in book %s to chapter %s.',
        linked_count, book_id, target_chapter.mastermind_coll_book_chapter_id,
    )
    return True


def list_books_for_owner(user_profile_id, status_code=None, include_staff_view=False, limit=200):
    """Author dashboard data source.

    include_staff_view=True bypasses the owner filter so staff sees every book.
    Skip status_code to include all (draft + review + published + archived).
    """
    queryset = CollBook.objects.filter(is_active=True)
    if not include_staff_view and user_profile_id:
        queryset = queryset.filter(link_created_by_user_profile_id=user_profile_id)
    if status_code:
        queryset = queryset.filter(book_status_code=status_code)
    return list(queryset.order_by('-updated_at', '-created_at').values(
        'mastermind_coll_book_id', 'book_title_bn', 'book_title_en',
        'book_origin_code', 'book_status_code',
        'book_language_code', 'book_total_pages',
        'book_published_at', 'book_slug',
        'link_created_by_user_profile_id',
        'created_at', 'updated_at',
    )[:limit])


# ================================================================
# Lifecycle — publish / archive
# ================================================================

def publish_book(book_id, owner_user_profile_id, is_staff_user=False):
    """Mark a book as published — visible at /mastermind/book/<id>/<slug>/."""
    from amolnama_news.site_apps.core.utils import english_slug_from_text

    book = CollBook.objects.filter(
        mastermind_coll_book_id=book_id, is_active=True,
    ).first()
    if not book:
        return {'error': 'Book not found.'}
    if not _user_can_edit_book(book, owner_user_profile_id, is_staff_user):
        return {'error': 'Permission denied.'}

    book_slug = book.book_slug
    if not book_slug:
        candidate_slug = english_slug_from_text(text_bn=book.book_title_bn)
        # Resolve collisions by appending the book id (always unique)
        if CollBook.objects.filter(book_slug=candidate_slug).exclude(
            mastermind_coll_book_id=book_id,
        ).exists():
            candidate_slug = f'{candidate_slug}-{book_id}'
        book_slug = candidate_slug

    update_fields = {
        'book_status_code': 'published',
        'book_slug': book_slug,
        'updated_at': timezone.now(),
    }
    if not book.book_published_at:
        update_fields['book_published_at'] = timezone.now()

    CollBook.objects.filter(mastermind_coll_book_id=book_id).update(**update_fields)
    return {
        'success': True,
        'book_id': book_id,
        'book_slug': book_slug,
        'public_url': f'/mastermind/book/{book_id}/{book_slug}/',
    }


def archive_book(book_id, owner_user_profile_id, is_staff_user=False):
    """Soft-archive — hides from public reader but recoverable."""
    book = CollBook.objects.filter(
        mastermind_coll_book_id=book_id, is_active=True,
    ).first()
    if not book:
        return {'error': 'Book not found.'}
    if not _user_can_edit_book(book, owner_user_profile_id, is_staff_user):
        return {'error': 'Permission denied.'}
    CollBook.objects.filter(mastermind_coll_book_id=book_id).update(
        book_status_code='archived',
        updated_at=timezone.now(),
    )
    return {'success': True, 'book_id': book_id}


# ================================================================
# Permission helper
# ================================================================

def _user_can_edit_book(book, user_profile_id, is_staff_user):
    """Staff edits any book; author edits only own. Anyone else: no."""
    if is_staff_user:
        return True
    if not user_profile_id or not book.link_created_by_user_profile_id:
        return False
    return book.link_created_by_user_profile_id == user_profile_id


# ================================================================
# v2 — Book metadata edit (cover, author, publisher, ISBN, …)
# ================================================================

# Whitelist of CollBook columns the metadata panel is allowed to update.
# Status code is included so the editor can drop a book back to draft from
# the metadata panel; book_status_code='published' is gated to publish_book().
_BOOK_METADATA_WRITABLE_FIELDS = (
    'book_title_bn', 'book_title_en',
    'book_author_bn', 'book_author_en',
    'book_publisher_bn', 'book_publisher_en',
    'book_edition', 'book_isbn',
    'book_cover_image_url',
    'book_description',
    'book_language_code',
    'book_total_pages',
)


def update_book_metadata(book_id, owner_user_profile_id, is_staff_user, metadata):
    """Update any subset of CollBook metadata fields. Permission-checked.

    metadata is a dict — only keys in _BOOK_METADATA_WRITABLE_FIELDS are
    applied; everything else is silently ignored. Empty strings on optional
    text fields convert to NULL (per project convention).
    """
    book = CollBook.objects.filter(
        mastermind_coll_book_id=book_id, is_active=True,
    ).first()
    if not book:
        return {'error': 'Book not found.'}
    if not _user_can_edit_book(book, owner_user_profile_id, is_staff_user):
        return {'error': 'Permission denied.'}

    update_fields = {}
    for field_name in _BOOK_METADATA_WRITABLE_FIELDS:
        if field_name not in metadata:
            continue
        raw_value = metadata.get(field_name)
        if field_name == 'book_total_pages':
            try:
                update_fields[field_name] = int(raw_value) if raw_value not in (None, '') else None
            except (TypeError, ValueError):
                continue
            continue
        if isinstance(raw_value, str):
            stripped_value = raw_value.strip()
            if field_name in ('book_title_bn',):
                # Required field — never set to empty
                if stripped_value:
                    update_fields[field_name] = stripped_value
            else:
                update_fields[field_name] = stripped_value or None

    if not update_fields:
        return {'success': True, 'book_id': book_id, 'updated_fields': 0}

    update_fields['updated_at'] = timezone.now()
    CollBook.objects.filter(mastermind_coll_book_id=book_id).update(**update_fields)
    return {
        'success': True,
        'book_id': book_id,
        'updated_fields': len(update_fields) - 1,
    }


# ================================================================
# v2 — Chapter delete + reorder
# ================================================================

def delete_chapter(chapter_id, owner_user_profile_id, is_staff_user):
    """Soft-delete a chapter (is_active=False). Chunks for that chapter
    stay in the DB but stop appearing in the editor.

    Permission: only staff or the book owner can delete a chapter.
    """
    chapter = CollBookChapter.objects.filter(
        mastermind_coll_book_chapter_id=chapter_id, is_active=True,
    ).first()
    if not chapter:
        return {'error': 'Chapter not found.'}
    book = CollBook.objects.filter(
        mastermind_coll_book_id=chapter.link_mastermind_coll_book_id,
    ).first()
    if not book or not _user_can_edit_book(book, owner_user_profile_id, is_staff_user):
        return {'error': 'Permission denied.'}

    CollBookChapter.objects.filter(
        mastermind_coll_book_chapter_id=chapter_id,
    ).update(is_active=False)
    # Also soft-deactivate orphaned chunks so they stop showing up in
    # word-count totals and AI gen runs.
    CollBookChunk.objects.filter(
        link_mastermind_coll_book_chapter_id=chapter_id,
    ).update(is_active=False)
    return {'success': True, 'chapter_id': chapter_id}


def reorder_chapter(chapter_id, owner_user_profile_id, is_staff_user, direction):
    """Swap a chapter's sort_order with its neighbour above ('up') or below ('down').

    O(1) swap — only two chapters touched. Idempotent at the boundary
    (already-first chapter moving 'up' returns success but does nothing).
    """
    if direction not in ('up', 'down'):
        return {'error': "direction must be 'up' or 'down'."}

    chapter = CollBookChapter.objects.filter(
        mastermind_coll_book_chapter_id=chapter_id, is_active=True,
    ).first()
    if not chapter:
        return {'error': 'Chapter not found.'}
    book = CollBook.objects.filter(
        mastermind_coll_book_id=chapter.link_mastermind_coll_book_id,
    ).first()
    if not book or not _user_can_edit_book(book, owner_user_profile_id, is_staff_user):
        return {'error': 'Permission denied.'}

    siblings_queryset = CollBookChapter.objects.filter(
        link_mastermind_coll_book_id=chapter.link_mastermind_coll_book_id,
        is_active=True,
    )
    if direction == 'up':
        neighbour = siblings_queryset.filter(
            sort_order__lt=chapter.sort_order,
        ).order_by('-sort_order', '-mastermind_coll_book_chapter_id').first()
    else:
        neighbour = siblings_queryset.filter(
            sort_order__gt=chapter.sort_order,
        ).order_by('sort_order', 'mastermind_coll_book_chapter_id').first()

    if not neighbour:
        # Already at the boundary — no-op
        return {
            'success': True,
            'chapter_id': chapter_id,
            'moved': False,
            'reason': 'already_at_boundary',
        }

    chapter_sort_order_before = chapter.sort_order
    neighbour_sort_order_before = neighbour.sort_order

    CollBookChapter.objects.filter(
        mastermind_coll_book_chapter_id=chapter_id,
    ).update(sort_order=neighbour_sort_order_before, chapter_number=neighbour.chapter_number)
    CollBookChapter.objects.filter(
        mastermind_coll_book_chapter_id=neighbour.mastermind_coll_book_chapter_id,
    ).update(sort_order=chapter_sort_order_before, chapter_number=chapter.chapter_number)

    return {
        'success': True,
        'chapter_id': chapter_id,
        'moved': True,
        'swapped_with_chapter_id': neighbour.mastermind_coll_book_chapter_id,
    }


# ================================================================
# v2 — Word counts + reading-time estimates
# ================================================================

def chapter_word_count(chapter_id):
    """Sum chunk_word_count across all active chunks for a chapter."""
    from django.db.models import Sum
    aggregate_result = CollBookChunk.objects.filter(
        link_mastermind_coll_book_chapter_id=chapter_id, is_active=True,
    ).aggregate(total_words=Sum('chunk_word_count'))
    return int(aggregate_result['total_words'] or 0)


def book_word_count(book_id):
    """Sum chunk_word_count across all active chunks in a book."""
    from django.db.models import Sum
    aggregate_result = CollBookChunk.objects.filter(
        link_mastermind_coll_book_id=book_id, is_active=True,
    ).aggregate(total_words=Sum('chunk_word_count'))
    return int(aggregate_result['total_words'] or 0)


def estimate_reading_minutes(word_count, words_per_minute=200):
    """Rough reading-time estimate. 200 wpm is the conservative default for
    Bengali + English mixed prose; speed readers go 300+, slower readers 150."""
    if not word_count or word_count <= 0:
        return 0
    return max(1, int(round(word_count / max(1, int(words_per_minute)))))

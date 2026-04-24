"""Shared PDF export utilities — HTML → PDF via headless Edge browser.

Single source of truth for project-wide HTML-to-PDF generation. Used by:
  - debate.views.topic_download_pdf       (debate arena export)
  - bookwriter.views_api_book_pdf_export  (book-as-PDF export)
  - any future app that needs HTML → PDF

Design rationale (over alternatives considered):
  - Edge / Chrome headless `--print-to-pdf` is already proven in
    debate; uses the user's installed browser; no heavy Python
    dependency (no WeasyPrint, no Playwright, no wkhtmltopdf).
  - Trade-off: Edge headless does NOT emit PDF outlines from HTML.
    For chapter bookmarks, post-process with pikepdf (separate
    helper, currently a no-op stub until the dependency is added).

Public API — pick the helper that matches your intent:

  EDGE-HEADLESS RENDERER ("screenshot of a webpage" path):
    render_html_string_to_pdf_bytes(html_content, *, timeout_seconds=60)
        → bytes: convert an HTML string to PDF bytes.
    render_django_template_to_pdf_response(template_name, context, *,
                                           download_filename,
                                           request=None,
                                           timeout_seconds=60)
        → HttpResponse: one-call helper for single-page exports
          (debate arena uses this).

  WEASYPRINT RENDERER (book / report path with native bookmarks):
    render_html_to_pdf_bytes_via_weasyprint(html_content, *, base_url=None)
        → bytes: requires GTK3 runtime on Windows. Raises ImportError
          if WeasyPrint isn't loadable.
    render_django_template_to_book_pdf_response(template_name, context, *,
                                                 download_filename, request,
                                                 chapter_titles_for_pdf_outline_fallback=None,
                                                 edge_fallback_timeout_seconds=120)
        → HttpResponse: one-call helper for book / multi-chapter
          documents. Tries WeasyPrint first, falls back to Edge-
          headless on ImportError so the export always succeeds
          (bookmarks downgrade from CSS-native to pypdf-text-search).
          Bookwriter book export uses this; future report apps
          (mastermind / historybd / constitutionbd PDFs) should too.

  SHARED HELPERS:
    sanitize_string_to_safe_pdf_filename(raw_title_text, *,
                                         max_words=5, max_chars=50)
        → str: strip unsafe chars + truncate + append .pdf.

    add_outline_bookmarks_to_pdf_bytes(pdf_bytes, ordered_section_titles)
        → bytes: pypdf-based post-processing — scans each page's
          text and adds an outline entry for the first page that
          contains each title (in order). Used by the Edge-headless
          fallback path inside render_django_template_to_book_pdf_response;
          callable directly if you have pre-rendered Edge bytes.
"""

import logging
import os
import re
import subprocess
import tempfile

from django.conf import settings
from django.http import HttpResponse
from django.template.loader import render_to_string


logger = logging.getLogger(__name__)


# ----------------------------------------------------------------
# Constants
# ----------------------------------------------------------------

DEFAULT_PDF_RENDER_TIMEOUT_SECONDS = 60

# Default Edge executable path on Windows (matches the debate app's
# original hardcoded path). Production / Linux / Mac environments
# should override via settings.EDGE_EXECUTABLE_PATH_FOR_PDF_EXPORT.
DEFAULT_WINDOWS_EDGE_EXECUTABLE_PATH = (
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
)

# Headless Edge / Chrome flags for print-to-pdf.
#   --headless=new           : modern headless mode on recent Edge versions.
#   --disable-gpu, --no-sandbox : required on Windows servers without
#                                  a display / running as the SYSTEM account.
#   --allow-file-access-from-files : CRITICAL for embedded images.
#                                  By default Chrome/Edge blocks file://
#                                  HTML from loading file:// images
#                                  (Same-Origin Policy). Without this
#                                  flag, <img src="file:///D:/...">
#                                  silently fails to load and the PDF
#                                  shows the alt text / nothing.
#   --disable-web-security    : extra belt-and-braces for cross-origin
#                                  fetches inside the temp HTML; harmless
#                                  in a one-shot subprocess.
EDGE_HEADLESS_PRINT_TO_PDF_FLAGS = (
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--disable-web-security',
)

# Filename sanitization — chars that break OS file paths or HTTP
# Content-Disposition headers across browsers.
UNSAFE_FILENAME_CHARACTERS_REGEX = re.compile(r'[?!।:;\'"\/\\<>|*\n\r\t]')

PDF_FILE_EXTENSION = '.pdf'

PDF_HTTP_CONTENT_TYPE = 'application/pdf'


# ----------------------------------------------------------------
# Edge executable path resolution
# ----------------------------------------------------------------

def _get_edge_executable_path_from_settings_or_default():
    """Resolve the headless Edge binary path.

    Priority: settings.EDGE_EXECUTABLE_PATH_FOR_PDF_EXPORT > default.
    Falls back to the Windows install path if the setting is not
    defined, preserving the prior hardcoded behaviour from debate.
    """
    return getattr(
        settings,
        'EDGE_EXECUTABLE_PATH_FOR_PDF_EXPORT',
        DEFAULT_WINDOWS_EDGE_EXECUTABLE_PATH,
    )


# ----------------------------------------------------------------
# Public API
# ----------------------------------------------------------------

def sanitize_string_to_safe_pdf_filename(raw_title_text, *, max_words=5, max_chars=50):
    """Clean a raw title string into a safe PDF filename.

    Strips characters that break OS file paths or HTTP
    Content-Disposition headers, truncates to `max_words` words and
    `max_chars` characters, and appends `.pdf`. Bengali characters
    are preserved (the regex only strips a small set of unsafe
    chars, NOT Unicode letters).

    Empty / whitespace-only input becomes 'document.pdf'.
    """
    if not raw_title_text:
        return 'document' + PDF_FILE_EXTENSION
    cleaned_text = UNSAFE_FILENAME_CHARACTERS_REGEX.sub('', str(raw_title_text)).strip()
    if not cleaned_text:
        return 'document' + PDF_FILE_EXTENSION
    words_truncated = cleaned_text.split()[:max_words]
    candidate_filename = ' '.join(words_truncated)
    if len(candidate_filename) > max_chars:
        candidate_filename = candidate_filename[:max_chars].strip()
    return (candidate_filename or 'document') + PDF_FILE_EXTENSION


def render_html_string_to_pdf_bytes(html_content, *,
                                    timeout_seconds=DEFAULT_PDF_RENDER_TIMEOUT_SECONDS):
    """Convert an HTML string to PDF bytes via headless Edge.

    Writes the HTML to a uniquely-named temp file (NamedTemporaryFile
    avoids the per-id collision the original debate code had when
    two users export the same topic simultaneously), invokes Edge
    headless with --print-to-pdf, reads the resulting PDF back, and
    cleans up both temp files in a `finally` block so failures don't
    leak files into the OS temp dir.

    Raises subprocess.TimeoutExpired if Edge exceeds `timeout_seconds`.
    Raises RuntimeError if Edge produces no output PDF (e.g. the
    binary path is wrong or the HTML is malformed).
    """
    edge_executable_path = _get_edge_executable_path_from_settings_or_default()

    # Use NamedTemporaryFile with delete=False so we can reference
    # the path by name across the subprocess boundary. We delete
    # explicitly in `finally`. suffix= so Edge recognises the input
    # by extension.
    html_temp_handle = tempfile.NamedTemporaryFile(
        mode='w', encoding='utf-8', suffix='.html', delete=False,
    )
    pdf_temp_handle = tempfile.NamedTemporaryFile(
        mode='wb', suffix=PDF_FILE_EXTENSION, delete=False,
    )

    html_temp_path = html_temp_handle.name
    pdf_temp_path = pdf_temp_handle.name

    pdf_bytes_result = None

    try:
        # Write the HTML and close the handle so Edge can read it.
        html_temp_handle.write(html_content)
        html_temp_handle.close()
        # Close the empty PDF handle — Edge will overwrite the file.
        pdf_temp_handle.close()
        # Pre-delete the empty PDF so we can detect Edge actually
        # produced output (not just an inherited empty file).
        if os.path.exists(pdf_temp_path):
            os.remove(pdf_temp_path)

        edge_subprocess_command = [
            edge_executable_path,
            *EDGE_HEADLESS_PRINT_TO_PDF_FLAGS,
            f'--print-to-pdf={pdf_temp_path}',
            html_temp_path,
        ]

        subprocess.run(
            edge_subprocess_command,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )

        if not os.path.exists(pdf_temp_path):
            raise RuntimeError(
                'Edge headless produced no PDF output. Check that '
                + edge_executable_path
                + ' exists and has read access to the temp HTML file.'
            )

        with open(pdf_temp_path, 'rb') as pdf_file_reader:
            pdf_bytes_result = pdf_file_reader.read()

    finally:
        for temp_path_to_clean_up in (html_temp_path, pdf_temp_path):
            try:
                if os.path.exists(temp_path_to_clean_up):
                    os.remove(temp_path_to_clean_up)
            except OSError:
                logger.debug(
                    'Temp file cleanup failed for %s',
                    temp_path_to_clean_up,
                    exc_info=True,
                )

    return pdf_bytes_result


def render_django_template_to_pdf_response(template_name, context, *,
                                           download_filename,
                                           request=None,
                                           timeout_seconds=DEFAULT_PDF_RENDER_TIMEOUT_SECONDS):
    """One-call helper: render template → PDF → HttpResponse.

    Renders the named Django template with the given context, pipes
    the resulting HTML through render_html_string_to_pdf_bytes, and
    wraps the PDF bytes in an HttpResponse with attachment headers
    using the supplied download_filename.

    `request` is forwarded to render_to_string (lets the template
    access {{ request }} / context processors / CSRF if needed).
    """
    rendered_html_string = render_to_string(template_name, context, request=request)
    pdf_bytes_result = render_html_string_to_pdf_bytes(
        rendered_html_string, timeout_seconds=timeout_seconds,
    )
    pdf_http_response = HttpResponse(pdf_bytes_result, content_type=PDF_HTTP_CONTENT_TYPE)
    pdf_http_response['Content-Disposition'] = (
        'attachment; filename="' + download_filename + '"'
    )
    return pdf_http_response


def render_html_to_pdf_bytes_via_weasyprint(html_content, *, base_url=None):
    """Convert an HTML string to PDF bytes via WeasyPrint.

    WeasyPrint is the right tool when the consumer needs:
      - Native PDF outline (chapter bookmarks via CSS
        `bookmark-level: 1; bookmark-label: content();`)
      - Native page numbers / running headers via @page CSS
      - Embedded fonts (no subprocess, no system browser)
      - Real searchable text with proper Unicode shaping (Bengali
        conjuncts render correctly via Pango)

    Edge-headless (render_html_string_to_pdf_bytes) remains the
    fallback for consumers that prefer it (debate uses it). This
    function is the higher-quality option for book / report
    exports where the PDF outline matters.

    `base_url` is used to resolve relative URLs (`<img src="/media/...">`,
    `<link href="/static/...">`) against the running server. Pass
    `request.build_absolute_uri()` from a view OR pass
    `Path(MEDIA_ROOT).parent.as_uri()` for offline rendering.

    Raises ImportError if WeasyPrint isn't importable (e.g. GTK3
    runtime not installed on Windows). Caller can fall back to
    Edge-headless on ImportError.
    """
    # Lazy import — keeps the module importable even if WeasyPrint
    # is missing / broken. Callers that don't use this function pay
    # zero cost.
    import weasyprint  # noqa: PLC0415
    weasyprint_html_document = weasyprint.HTML(string=html_content, base_url=base_url)
    return weasyprint_html_document.write_pdf()


def render_django_template_to_book_pdf_response(template_name, template_context, *,
                                                 download_filename,
                                                 request,
                                                 chapter_titles_for_pdf_outline_fallback=None,
                                                 edge_fallback_timeout_seconds=120):
    """One-call helper: book-quality template → PDF → HttpResponse.

    The "book / report" sibling of render_django_template_to_pdf_response.
    Use this when the consumer wants a polished multi-chapter document:
      - WeasyPrint primary path: native PDF outline via CSS
        bookmark-level, native @page rules (page numbers, running
        headers), real Bengali Unicode shaping via Pango, automatic
        /media/ + /static/ URL resolution against base_url.
      - Edge-headless fallback: kicks in only on ImportError (e.g. a
        Windows dev box without GTK3 runtime). Bookmarks degrade to
        pypdf text-search post-processing using the supplied
        chapter_titles_for_pdf_outline_fallback.

    Returns an HttpResponse ready to return from a Django view.
    Raises any non-ImportError exception so the view can log it.

    Why this lives here (not in each consumer): the orchestration
    (try WeasyPrint → fallback Edge → conditional outline injection
    → HttpResponse wrapping with attachment Content-Disposition) is
    identical across every "book / report" consumer (bookwriter
    today, mastermind / historybd / constitutionbd reports tomorrow).
    Single source of truth.
    """
    rendered_html_string = render_to_string(template_name, template_context, request=request)
    try:
        raw_pdf_bytes = render_html_to_pdf_bytes_via_weasyprint(
            rendered_html_string,
            base_url=request.build_absolute_uri('/'),
        )
        # WeasyPrint already emits chapter bookmarks via CSS
        # bookmark-level — no post-processing needed.
        final_pdf_bytes = raw_pdf_bytes
    except ImportError:
        logger.warning(
            'WeasyPrint not importable — falling back to Edge-headless. '
            'PDF outline will be reconstructed via pypdf text-search '
            'instead of native CSS bookmark-level.'
        )
        raw_pdf_bytes = render_html_string_to_pdf_bytes(
            rendered_html_string, timeout_seconds=edge_fallback_timeout_seconds,
        )
        final_pdf_bytes = add_outline_bookmarks_to_pdf_bytes(
            raw_pdf_bytes, chapter_titles_for_pdf_outline_fallback or [],
        )
    pdf_http_response = HttpResponse(final_pdf_bytes, content_type=PDF_HTTP_CONTENT_TYPE)
    pdf_http_response['Content-Disposition'] = (
        'attachment; filename="' + download_filename + '"'
    )
    return pdf_http_response


def add_outline_bookmarks_to_pdf_bytes(pdf_bytes, ordered_section_titles):
    """Post-process PDF bytes to add an outline (sidebar bookmarks).

    Edge headless does not emit a PDF outline from HTML, so this
    helper post-processes the rendered PDF using pypdf:
      - opens the PDF
      - scans every page's extracted text for each section title
      - adds an outline entry pointing to the first page that
        contains each title (in the original section order)

    Returns the modified PDF bytes (a fresh PDF with the outline
    written into its catalog). On any failure (pypdf parse error,
    text-extraction quirk, write error) returns the ORIGINAL bytes
    unchanged so a bookmark glitch never breaks the download.

    Empty / falsy ordered_section_titles → passthrough.
    """
    if not ordered_section_titles:
        return pdf_bytes
    try:
        # Lazy-import pypdf so projects/installs that don't use the
        # bookmark feature don't pay the import cost. Also keeps the
        # module importable even if pypdf is ever removed from the venv.
        import pypdf
        from io import BytesIO
        pdf_reader = pypdf.PdfReader(BytesIO(pdf_bytes))
        pdf_writer = pypdf.PdfWriter(clone_from=pdf_reader)
        # Build a map of page_index → extracted_text once so we don't
        # re-extract for every chapter title (O(N+M) instead of O(N*M)).
        per_page_extracted_text = []
        for page_index_for_text_extraction, current_page in enumerate(pdf_reader.pages):
            try:
                per_page_extracted_text.append(current_page.extract_text() or '')
            except Exception as page_text_extraction_error:
                # Per-page extraction can fail on weird font dictionaries or
                # malformed content streams. Treat as no-text so other pages
                # still get bookmarked, but log so we can see WHY a missed
                # bookmark happened instead of debugging from silence.
                logger.debug(
                    'pypdf text extraction failed for page %d: %s',
                    page_index_for_text_extraction, page_text_extraction_error,
                    exc_info=True,
                )
                per_page_extracted_text.append('')
        for section_title_text in ordered_section_titles:
            for page_index_in_pdf, page_text_content in enumerate(per_page_extracted_text):
                if section_title_text in page_text_content:
                    pdf_writer.add_outline_item(section_title_text, page_index_in_pdf)
                    break
        output_pdf_buffer = BytesIO()
        pdf_writer.write(output_pdf_buffer)
        return output_pdf_buffer.getvalue()
    except Exception as outline_injection_error:
        logger.warning(
            'PDF outline injection failed for %d sections: %s. '
            'Returning original PDF without bookmarks.',
            len(ordered_section_titles), outline_injection_error,
        )
        return pdf_bytes

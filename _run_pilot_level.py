"""Parameterized pilot runner for L2-L5 levels.

Usage:
    python _run_pilot_level.py --level L2 --pages 3 --questions-per-chunk 1
    python _run_pilot_level.py --level L3 --pages 10 --questions-per-chunk 3
    python _run_pilot_level.py --level L4 --pages 30 --questions-per-chunk 3
    python _run_pilot_level.py --level L5 --pages 66 --questions-per-chunk 3

Source: gov PDF (Book 1). Clean, authoritative BD Constitution.
Resource discipline: auto-start/kill Ollama, same as L1 smoke.
"""
import sys, io, django, os, time, atexit, subprocess, argparse
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'amolnama_news.settings.local')
django.setup()


OLLAMA_EXECUTABLE = r"C:\Users\mehfil\AppData\Local\Programs\Ollama\ollama.exe"
GOV_PDF_SOURCE = r"d:\GoogleDrive\personal folder\Apps\amolnama_news\amolnama_news_project\amolnama_news\media\app_static\mastermind\books\bangladesh constitution law.pdf"
PILOT_OUTPUT_DIR = r"d:\GoogleDrive\personal folder\Apps\amolnama_news\amolnama_news_project\amolnama_news\media\app_static\admin_tools\textextractor\input"


def _ollama_is_running():
    result = subprocess.run(
        ['tasklist', '/FI', 'IMAGENAME eq ollama.exe', '/FO', 'CSV'],
        capture_output=True, text=True,
    )
    return 'ollama.exe' in result.stdout


def _start_ollama_if_needed():
    if _ollama_is_running():
        print("[OLLAMA] Already running — will NOT be killed on exit.")
        return False
    print("[OLLAMA] Starting fresh server.")
    subprocess.Popen(
        [OLLAMA_EXECUTABLE, 'serve'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0,
    )
    for _ in range(20):
        time.sleep(0.5)
        if _ollama_is_running():
            time.sleep(2)
            return True
    raise RuntimeError("Ollama failed to start within 10 seconds.")


def _kill_ollama_on_exit(we_started_it):
    if not we_started_it:
        return
    print("[OLLAMA] Releasing server.")
    subprocess.run(['taskkill', '/F', '/IM', 'ollama.exe'], capture_output=True)
    subprocess.run(['taskkill', '/F', '/IM', 'ollama app.exe'], capture_output=True)


def _extract_pages(source_pdf, output_pdf, page_count):
    """Extract first `page_count` pages from source PDF."""
    import fitz
    doc = fitz.open(source_pdf)
    new_pdf = fitz.open()
    new_pdf.insert_pdf(doc, from_page=0, to_page=min(page_count - 1, doc.page_count - 1))
    new_pdf.save(output_pdf)
    new_pdf.close()
    doc.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--level', required=True, help='L2/L3/L4/L5')
    parser.add_argument('--pages', type=int, required=True)
    parser.add_argument('--questions-per-chunk', type=int, required=True)
    args = parser.parse_args()

    level_tag = f'[{args.level}]'
    level_pdf = os.path.join(PILOT_OUTPUT_DIR, f'pilot-gov-{args.pages}pg-{args.level}.pdf')

    we_started_ollama = _start_ollama_if_needed()
    atexit.register(_kill_ollama_on_exit, we_started_ollama)

    # Extract page subset
    if not os.path.exists(level_pdf):
        print(f"\n[PREP] Extracting {args.pages} pages from gov PDF -> {level_pdf}")
        _extract_pages(GOV_PDF_SOURCE, level_pdf, args.pages)

    # Imports after Django setup
    from django.utils import timezone
    from amolnama_news.site_apps.mastermind.models import (
        CollBook, CollQuizTopic, CollBookChunk, CollQuestion, CollQuestionOption,
        CollGenerationJob, CollQuizSourceRegistry, EngQuizSemanticEmbedding,
    )
    from amolnama_news.site_apps.mastermind.ai_generator import (
        ingest_book_from_pdf, start_generation_job,
    )

    print("=" * 72)
    print(f"{args.level} — {args.pages} pages, {args.questions_per_chunk} Q/chunk")
    print("=" * 72)

    # Cleanup ALL pilot namespace books (any title starting with '[') so dedup
    # doesn't falsely flag new questions as duplicates of prior pilot runs.
    # Pilot tags: [L1-SMOKE], [L2], [L3], ..., [PILOT]
    print(f"\n[0] Cleaning ALL pilot namespace data (any book starting with '[')...")
    stale_books = list(CollBook.objects.filter(book_title_bn__startswith='['))
    for stale_book in stale_books:
        stale_book_id = stale_book.mastermind_coll_book_id
        stale_question_ids = list(CollQuestion.objects.filter(
            link_mastermind_coll_book_id=stale_book_id
        ).values_list('mastermind_coll_question_id', flat=True))
        CollQuestionOption.objects.filter(
            link_mastermind_coll_question_id__in=stale_question_ids).delete()
        EngQuizSemanticEmbedding.objects.filter(
            embedding_target_type_code='question',
            embedding_target_id__in=stale_question_ids).delete()
        CollQuestion.objects.filter(
            mastermind_coll_question_id__in=stale_question_ids).delete()
        stale_chunk_ids = list(CollBookChunk.objects.filter(
            link_mastermind_coll_book_id=stale_book_id
        ).values_list('mastermind_coll_book_chunk_id', flat=True))
        EngQuizSemanticEmbedding.objects.filter(
            embedding_target_type_code='chunk',
            embedding_target_id__in=stale_chunk_ids).delete()
        CollBookChunk.objects.filter(
            link_mastermind_coll_book_id=stale_book_id).delete()
        CollGenerationJob.objects.filter(
            link_mastermind_coll_book_id=stale_book_id).delete()
        CollQuizSourceRegistry.objects.filter(
            link_mastermind_coll_book_id=stale_book_id).delete()
        stale_book.delete()
    print(f"   Cleaned {len(stale_books)} previous {args.level} book(s).")

    topic = CollQuizTopic.objects.get(topic_code='bd_constitution')

    print(f"\n[1] Creating book record...")
    book = CollBook.objects.create(
        book_title_bn=f'{level_tag} বাংলাদেশ সংবিধান ({args.pages} পাতা)',
        book_title_en=f'{level_tag} Bangladesh Constitution ({args.pages} pages)',
        created_at=timezone.now(),
    )
    print(f"   Book id={book.mastermind_coll_book_id}")

    print(f"\n[2] Ingesting {args.pages}-page PDF...")
    start = time.time()
    ingest_result = ingest_book_from_pdf(
        book_id=book.mastermind_coll_book_id,
        file_path=level_pdf,
        chunk_max_words=300,
    )
    ingest_seconds = int(time.time() - start)
    if 'error' in ingest_result:
        print(f"   INGEST FAILED: {ingest_result['error']}")
        raise SystemExit(1)
    print(f"   Chunks: {ingest_result['chunk_count']}  Pages: {ingest_result['page_count']}  "
          f"Words: {ingest_result.get('total_words', 'n/a')}  Time: {ingest_seconds}s")

    print(f"\n[3] Generating {args.questions_per_chunk} Q/chunk via Ollama + NLI gate...")
    gen_start = time.time()
    generation_result = start_generation_job(
        book_id=book.mastermind_coll_book_id,
        topic_id=topic.mastermind_coll_quiz_topic_id,
        questions_per_chunk=args.questions_per_chunk,
        prompt_template_code='mcq_single',
    )
    gen_seconds = int(time.time() - gen_start)
    if 'error' in generation_result:
        print(f"   GENERATION FAILED: {generation_result['error']}")
    else:
        print(f"   Chunks: {generation_result['chunks_processed']}  "
              f"Created: {generation_result['questions_created']}  "
              f"Rejected: {generation_result['questions_rejected']}  "
              f"Time: {gen_seconds}s")

    print(f"\n[4] Analyzing results...")
    stored = list(CollQuestion.objects.filter(
        link_mastermind_coll_book_id=book.mastermind_coll_book_id,
    ).values('question_text_bn', 'nli_verdict_code',
             'nli_confidence_level_code', 'nli_similarity_score',
             'nli_entailment_score'))
    print(f"   Total stored: {len(stored)}")
    verdict_counts = {}
    confidence_counts = {}
    for question in stored:
        verdict = question['nli_verdict_code'] or 'none'
        confidence = question['nli_confidence_level_code'] or 'none'
        verdict_counts[verdict] = verdict_counts.get(verdict, 0) + 1
        confidence_counts[confidence] = confidence_counts.get(confidence, 0) + 1
    print("\n   Verdict distribution:")
    for verdict, count in sorted(verdict_counts.items(), key=lambda pair: -pair[1]):
        print(f"     {verdict:30s}  {count}")
    print("\n   Confidence distribution:")
    for confidence, count in sorted(confidence_counts.items(), key=lambda pair: -pair[1]):
        print(f"     {confidence:10s}  {count}")

    print("\n" + "=" * 72)
    print(f"{args.level} COMPLETE — total {ingest_seconds + gen_seconds}s "
          f"(OCR {ingest_seconds}s + Gen {gen_seconds}s)")
    print(f"  Stored: {len(stored)} questions (status=review)")
    print(f"  Book id: {book.mastermind_coll_book_id}")
    print("=" * 72)


if __name__ == '__main__':
    main()

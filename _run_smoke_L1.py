"""L1 Smoke test — 1 page, 1 chunk, 1 question from gov PDF.

Goal: confirm the full pipeline (ingest → Ollama → NLI gate → DB persist) runs
end-to-end without crashing. Minimal scope = fastest feedback.

Resource discipline (CLAUDE.md Gate 0):
- Starts Ollama only if not already running.
- Kills Ollama on exit ONLY if this script started it.
"""
import sys, io, django, os, time, atexit, subprocess
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'amolnama_news.settings.local')
django.setup()


OLLAMA_EXECUTABLE = r"C:\Users\mehfil\AppData\Local\Programs\Ollama\ollama.exe"


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
    print("[OLLAMA] Releasing server (we started it).")
    subprocess.run(['taskkill', '/F', '/IM', 'ollama.exe'], capture_output=True)
    subprocess.run(['taskkill', '/F', '/IM', 'ollama app.exe'], capture_output=True)


_we_started_ollama = _start_ollama_if_needed()
atexit.register(_kill_ollama_on_exit, _we_started_ollama)


from django.utils import timezone
from amolnama_news.site_apps.mastermind.models import (
    CollBook, CollQuizTopic, CollBookChunk, CollQuestion, CollQuestionOption,
    CollGenerationJob, CollQuizSourceRegistry, EngQuizSemanticEmbedding,
)
from amolnama_news.site_apps.mastermind.ai_generator import (
    ingest_book_from_pdf, start_generation_job,
)


SMOKE_PDF = r"d:\GoogleDrive\personal folder\Apps\amolnama_news\amolnama_news_project\amolnama_news\media\app_static\admin_tools\textextractor\input\pilot-gov-1pg-smoke.pdf"
BOOK_TITLE_TAG = '[L1-SMOKE]'


print("=" * 72)
print("L1 SMOKE TEST — 1 page, 1 chunk, 1 question")
print("=" * 72)


# Cleanup previous L1 runs
print("\n[0] Cleaning previous L1 smoke data...")
stale_books = list(CollBook.objects.filter(book_title_bn__startswith=BOOK_TITLE_TAG))
for stale_book in stale_books:
    stale_book_id = stale_book.mastermind_coll_book_id
    stale_question_ids = list(
        CollQuestion.objects.filter(link_mastermind_coll_book_id=stale_book_id)
        .values_list('mastermind_coll_question_id', flat=True)
    )
    CollQuestionOption.objects.filter(
        link_mastermind_coll_question_id__in=stale_question_ids).delete()
    EngQuizSemanticEmbedding.objects.filter(
        embedding_target_type_code='question',
        embedding_target_id__in=stale_question_ids).delete()
    CollQuestion.objects.filter(
        mastermind_coll_question_id__in=stale_question_ids).delete()

    stale_chunk_ids = list(
        CollBookChunk.objects.filter(link_mastermind_coll_book_id=stale_book_id)
        .values_list('mastermind_coll_book_chunk_id', flat=True)
    )
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
print(f"   Cleaned {len(stale_books)} previous L1 book(s).")


# Setup
topic = CollQuizTopic.objects.get(topic_code='bd_constitution')


# Create book
print("\n[1] Creating book record...")
book = CollBook.objects.create(
    book_title_bn=f'{BOOK_TITLE_TAG} বাংলাদেশ সংবিধান (স্মোক টেস্ট)',
    book_title_en=f'{BOOK_TITLE_TAG} Bangladesh Constitution (smoke)',
    created_at=timezone.now(),
)
print(f"   Book id={book.mastermind_coll_book_id}")


# Ingest
print("\n[2] Ingesting 1-page PDF...")
start = time.time()
ingest_result = ingest_book_from_pdf(
    book_id=book.mastermind_coll_book_id,
    file_path=SMOKE_PDF,
    chunk_max_words=300,
)
ingest_seconds = int(time.time() - start)

if 'error' in ingest_result:
    print(f"   INGEST FAILED: {ingest_result['error']}")
    raise SystemExit(1)

print(f"   Chunks: {ingest_result['chunk_count']}  Pages: {ingest_result['page_count']}  "
      f"Words: {ingest_result.get('total_words', 'n/a')}  Time: {ingest_seconds}s")


# Generate 1 question only
print("\n[3] Generating 1 question via Ollama + NLI gate...")
gen_start = time.time()
generation_result = start_generation_job(
    book_id=book.mastermind_coll_book_id,
    topic_id=topic.mastermind_coll_quiz_topic_id,
    questions_per_chunk=1,
    prompt_template_code='mcq_single',
)
gen_seconds = int(time.time() - gen_start)

if 'error' in generation_result:
    print(f"   GENERATION FAILED: {generation_result['error']}")
else:
    print(f"   Chunks processed: {generation_result['chunks_processed']}  "
          f"Created: {generation_result['questions_created']}  "
          f"Rejected: {generation_result['questions_rejected']}  "
          f"Time: {gen_seconds}s")


# Report
print("\n[4] DB check...")
stored_questions = list(
    CollQuestion.objects.filter(link_mastermind_coll_book_id=book.mastermind_coll_book_id)
    .values('question_text_bn', 'nli_verdict_code', 'nli_similarity_score',
            'nli_entailment_score', 'nli_contradiction_score',
            'nli_confidence_level_code')
)
print(f"   Total stored: {len(stored_questions)}")
for question in stored_questions:
    preview = (question['question_text_bn'] or '')[:100]
    print(f"   [{question['nli_confidence_level_code'] or '-'}] {preview}")
    print(f"      verdict={question['nli_verdict_code']}  "
          f"sim={question['nli_similarity_score']}  "
          f"entail={question['nli_entailment_score']}")


print("\n" + "=" * 72)
print(f"L1 SMOKE COMPLETE — OCR {ingest_seconds}s + Gen {gen_seconds}s = "
      f"{ingest_seconds + gen_seconds}s total")
print(f"  Verdict: {'PASS' if stored_questions else 'INCONCLUSIVE (0 stored)'}")
print("=" * 72)

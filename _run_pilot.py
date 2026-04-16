"""10-page Constitution pilot — full pipeline: ingest PDF -> chunks -> Ollama -> NLI -> DB.

Resource discipline (CLAUDE.md Gate 0):
- Starts Ollama only if not already running.
- Kills Ollama on exit ONLY if this script started it.
- Always exits — no hung background processes, no lingering RAM.
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
    print("[OLLAMA] Not running — starting fresh server.")
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
    print("[OLLAMA] Releasing server (this script started it).")
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

PILOT_PDF = r"d:\GoogleDrive\personal folder\Apps\amolnama_news\amolnama_news_project\amolnama_news\media\app_static\admin_tools\textextractor\input\pilot-constitution-10pg.pdf"

print("=" * 72)
print("10-PAGE CONSTITUTION PILOT")
print("=" * 72)

# Clean slate — remove any previous pilot runs
print("\n[0] Cleaning previous pilot data...")
stale_books = CollBook.objects.filter(book_title_bn__startswith='[PILOT]')
for stale_book in stale_books:
    stale_book_id = stale_book.mastermind_coll_book_id
    stale_question_ids = list(
        CollQuestion.objects.filter(
            link_mastermind_coll_book_id=stale_book_id
        ).values_list('mastermind_coll_question_id', flat=True)
    )
    CollQuestionOption.objects.filter(
        link_mastermind_coll_question_id__in=stale_question_ids
    ).delete()
    EngQuizSemanticEmbedding.objects.filter(
        embedding_target_type_code='question',
        embedding_target_id__in=stale_question_ids,
    ).delete()
    CollQuestion.objects.filter(
        mastermind_coll_question_id__in=stale_question_ids
    ).delete()

    stale_chunk_ids = list(
        CollBookChunk.objects.filter(
            link_mastermind_coll_book_id=stale_book_id
        ).values_list('mastermind_coll_book_chunk_id', flat=True)
    )
    EngQuizSemanticEmbedding.objects.filter(
        embedding_target_type_code='chunk',
        embedding_target_id__in=stale_chunk_ids,
    ).delete()
    CollBookChunk.objects.filter(
        link_mastermind_coll_book_id=stale_book_id
    ).delete()
    CollGenerationJob.objects.filter(
        link_mastermind_coll_book_id=stale_book_id
    ).delete()
    CollQuizSourceRegistry.objects.filter(
        link_mastermind_coll_book_id=stale_book_id
    ).delete()
    stale_book.delete()
print(f"   Cleaned {stale_books.count()} previous pilot book(s).")

# Setup
topic = CollQuizTopic.objects.get(topic_code='bd_constitution')

# -- Create book record --
print("\n[1] Creating book record...")
book = CollBook.objects.create(
    book_title_bn='[PILOT] বাংলাদেশ সংবিধান (10 পাতা)',
    book_title_en='[PILOT] Bangladesh Constitution (10 pages)',
    created_at=timezone.now(),
)
print(f"   Book id={book.mastermind_coll_book_id}")

# -- Ingest PDF -> chunks --
print("\n[2] Ingesting PDF (OCR may take 3-10 minutes)...")
start = time.time()
ingest_result = ingest_book_from_pdf(
    book_id=book.mastermind_coll_book_id,
    file_path=PILOT_PDF,
    chunk_max_words=300,
)
ingest_seconds = int(time.time() - start)

if 'error' in ingest_result:
    print(f"   INGEST FAILED: {ingest_result['error']}")
    raise SystemExit(1)

print(f"   Chunks: {ingest_result['chunk_count']}")
print(f"   Pages:  {ingest_result['page_count']}")
print(f"   Words:  {ingest_result.get('total_words', 'n/a')}")
print(f"   Time:   {ingest_seconds}s")

# -- Generate questions from each chunk --
print("\n[3] Generating questions via Ollama + NLI gate...")
gen_start = time.time()
generation_result = start_generation_job(
    book_id=book.mastermind_coll_book_id,
    topic_id=topic.mastermind_coll_quiz_topic_id,
    questions_per_chunk=3,
    prompt_template_code='mcq_single',
)
gen_seconds = int(time.time() - gen_start)

if 'error' in generation_result:
    print(f"   GENERATION FAILED: {generation_result['error']}")
else:
    print(f"   Chunks processed:    {generation_result['chunks_processed']}")
    print(f"   Questions created:   {generation_result['questions_created']}")
    print(f"   Questions rejected:  {generation_result['questions_rejected']}")
    print(f"   Generation time:     {gen_seconds}s")

# -- Analyze results --
print("\n[4] Analyzing results in DB...")
all_questions = list(
    CollQuestion.objects.filter(
        link_mastermind_coll_book_id=book.mastermind_coll_book_id,
    ).values(
        'mastermind_coll_question_id',
        'question_text_bn',
        'nli_verdict_code',
        'nli_confidence_level_code',
        'nli_similarity_score',
        'nli_entailment_score',
        'nli_contradiction_score',
    )
)

print(f"   Total questions stored: {len(all_questions)}")

# Verdict distribution
verdict_counts = {}
confidence_counts = {}
for question in all_questions:
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

# Show sample questions
print("\n   Sample questions (first 5):")
for question in all_questions[:5]:
    q_text = (question['question_text_bn'] or '')[:80]
    sim = question['nli_similarity_score']
    ent = question['nli_entailment_score']
    print(f"     [{question['nli_confidence_level_code'] or '-'}] "
          f"{q_text}...")
    print(f"         verdict={question['nli_verdict_code']}  "
          f"sim={sim}  entail={ent}")

# Total time
print("\n" + "=" * 72)
print(f"PILOT COMPLETE — total {ingest_seconds + gen_seconds}s")
print(f"  OCR:         {ingest_seconds}s")
print(f"  Generation:  {gen_seconds}s")
print(f"  Stored:      {len(all_questions)} questions (status=review)")
print(f"  Admin URL:   /admin/mastermind/collquestion/?link_mastermind_coll_book_id__exact={book.mastermind_coll_book_id}")
print("=" * 72)

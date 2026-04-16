"""L8 Adversarial — feed intentionally broken chunks through verify_faithfulness
and record how the gate responds.

Goal: prove graceful degradation. The gate must NOT crash and must produce
a sensible verdict (usually 'reject') on garbage inputs.

Fast tier: no DB writes, no Ollama. Loads NLI + embedding models.
"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'amolnama_news.settings.local')
import django
django.setup()

from amolnama_news.site_apps.mastermind.embeddings import verify_faithfulness


ADVERSARIAL_CASES = [
    # (label, chunk_text, answer_text, expected_verdict_category)
    ('empty_chunk',
     '', 'ঢাকা', 'reject'),
    ('empty_answer',
     'বাংলাদেশের রাজধানী ঢাকা।', '', 'reject'),
    ('both_empty',
     '', '', 'reject'),
    ('whitespace_chunk',
     '   \n\t   ', 'ঢাকা', 'reject'),
    ('ocr_garbage_bengali',
     'xxx ৈৈৈ ��� ড়়়়় xxx', 'ঢাকা', 'reject'),
    ('mixed_language_chunk',
     'The capital of Bangladesh is Dhaka. বাংলাদেশের রাজধানী ঢাকা।',
     'ঢাকা', 'pass'),
    ('english_only_chunk',
     'The capital of Bangladesh is Dhaka.',
     'Dhaka', 'pass'),
    ('very_long_chunk',
     ('বাংলাদেশের রাজধানী ঢাকা। ' * 500),  # ~10K chars
     'ঢাকা', 'pass'),
    ('very_long_answer',
     'বাংলাদেশের রাজধানী ঢাকা।',
     ('ঢাকা ' * 500),
     'pass_or_reject'),  # either verdict acceptable; must not crash
    ('numeric_only_chunk',
     '১২৩৪৫ ৬৭৮৯০',
     'ঢাকা', 'reject'),
    ('answer_is_chunk',
     'বাংলাদেশের রাজধানী ঢাকা।',
     'বাংলাদেশের রাজধানী ঢাকা।',
     'pass'),
    ('unicode_emoji',
     '🎉🔥⭐ বাংলাদেশের রাজধানী ঢাকা। 🎉🔥⭐',
     'ঢাকা', 'pass'),
    ('null_bytes',
     'বাংলাদেশের\x00রাজধানী\x00ঢাকা',
     'ঢাকা', 'pass_or_reject'),
    ('html_injection',
     '<script>alert(1)</script>বাংলাদেশের রাজধানী ঢাকা।',
     'ঢাকা', 'pass'),
]


def main():
    print('=' * 72)
    print('L8 ADVERSARIAL — graceful degradation on broken inputs')
    print('=' * 72)
    passed = 0
    crashed = 0
    unexpected = 0

    for label, chunk, answer, expected in ADVERSARIAL_CASES:
        try:
            result = verify_faithfulness(chunk_text=chunk, answer_text=answer)
            verdict = result.get('verdict')
            reason = result.get('reason', '')
            ok = (expected == 'pass_or_reject') or (verdict == expected)
            mark = '✓' if ok else '✗'
            print(f'  [{mark}] {label:25s} verdict={verdict:10s} (expected={expected}) — {reason[:60]}')
            if ok:
                passed += 1
            else:
                unexpected += 1
        except Exception as exception:
            crashed += 1
            print(f'  [CRASH] {label:25s} {type(exception).__name__}: {exception}')

    print('\n' + '=' * 72)
    print(f'L8 ADVERSARIAL COMPLETE')
    print(f'  Passed as expected:  {passed}/{len(ADVERSARIAL_CASES)}')
    print(f'  Unexpected verdict:  {unexpected}')
    print(f'  CRASHED:             {crashed}')
    print('=' * 72)


if __name__ == '__main__':
    main()

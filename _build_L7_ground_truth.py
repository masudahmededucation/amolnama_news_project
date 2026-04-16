"""L7 prep — extract the Q&A section from v03 PDF pages 173-192 as ground truth.

Output: _L7_ground_truth_qa.json with list of {question, answer, page_number}.
This is the HUMAN-written Q&A we compare our AI gate against.

Single-pass OCR. Does NOT call Ollama. Does NOT need NLI model.
Safe to run standalone, exits cleanly.
"""
import sys, io, os, json, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import fitz
from PIL import Image
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'


V03_PDF = r"d:\GoogleDrive\personal folder\Apps\amolnama_news\amolnama_news_project\amolnama_news\media\app_static\admin_tools\textextractor\input\bangladesh constitution law-v03.pdf"
OUTPUT_JSON = r"d:\GoogleDrive\personal folder\Apps\amolnama_news\amolnama_news_project\_L7_ground_truth_qa.json"
OUTPUT_RAW_TXT = r"d:\GoogleDrive\personal folder\Apps\amolnama_news\amolnama_news_project\_L7_ground_truth_raw.txt"

PAGE_START = 173
PAGE_END = 192


def ocr_page(doc, page_index, dpi=200):
    page = doc[page_index]
    pixmap = page.get_pixmap(dpi=dpi)
    image = Image.frombytes('RGB', [pixmap.width, pixmap.height], pixmap.samples)
    return pytesseract.image_to_string(image, lang='ben+eng')


def parse_qa_pairs(raw_text, page_number):
    """Heuristic parser for Bengali Q&A format.

    Typical patterns seen in constitutional Q&A books:
      প্রশ্ন: ... উত্তর: ...
      প্রশ্ন ১: ... উত্তর: ...
      ১। ... উত্তর: ...
    Fall back to splitting on numbered markers and using heuristics.
    """
    pairs = []
    # Primary: explicit প্রশ্ন / উত্তর markers
    pattern = re.compile(
        r'প্রশ্ন[^\S\n]*[:\-\u0964]?\s*(.+?)উত্তর[^\S\n]*[:\-\u0964]?\s*(.+?)(?=প্রশ্ন|$)',
        re.DOTALL,
    )
    for match in pattern.finditer(raw_text):
        question = re.sub(r'\s+', ' ', match.group(1)).strip()
        answer = re.sub(r'\s+', ' ', match.group(2)).strip()
        if 5 <= len(question) <= 500 and 3 <= len(answer) <= 1000:
            pairs.append({
                'question': question,
                'answer': answer,
                'page_number': page_number,
            })
    return pairs


def main():
    doc = fitz.open(V03_PDF)
    print(f'V03 PDF: {doc.page_count} pages total')
    print(f'Extracting pages {PAGE_START}-{PAGE_END}...')

    all_pairs = []
    raw_text_accumulator = []
    for page_number in range(PAGE_START, PAGE_END + 1):
        if page_number - 1 >= doc.page_count:
            print(f'  page {page_number}: beyond PDF end, skipping')
            continue
        text = ocr_page(doc, page_number - 1)
        raw_text_accumulator.append(f'=== PAGE {page_number} ===\n{text}\n')
        pairs = parse_qa_pairs(text, page_number)
        print(f'  page {page_number}: {len(text.strip())} chars, {len(pairs)} Q/A pairs')
        all_pairs.extend(pairs)
    doc.close()

    with open(OUTPUT_RAW_TXT, 'w', encoding='utf-8') as fh:
        fh.write('\n\n'.join(raw_text_accumulator))
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as fh:
        json.dump(all_pairs, fh, ensure_ascii=False, indent=2)

    print(f'\nTotal Q/A pairs extracted: {len(all_pairs)}')
    print(f'JSON written to: {OUTPUT_JSON}')
    print(f'Raw OCR written to: {OUTPUT_RAW_TXT} (for manual inspection)')

    if all_pairs:
        print('\n--- Sample (first 3) ---')
        for pair in all_pairs[:3]:
            print(f'[p{pair["page_number"]}] Q: {pair["question"][:80]}...')
            print(f'         A: {pair["answer"][:80]}...')
            print()


if __name__ == '__main__':
    main()

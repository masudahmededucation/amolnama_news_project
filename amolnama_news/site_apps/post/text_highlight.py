"""
post/text_highlight.py — Bengali Named Entity Recognition + keyword highlighting.

Detects: person names, locations, dates, book references, religious terms, theme keywords.
Pure Python (regex + dictionaries) — no ML dependency, fast execution.
Returns HTML with <mark> tags for inline display.
"""

import re
from django.utils.html import escape

# ============================================================================
# FLAG EMOJI → TWEMOJI SVG (Windows can't render flag emojis)
# ============================================================================

_FLAG_EMOJI_PATTERN = re.compile(r'([\U0001F1E6-\U0001F1FF]{2})')
_TWEMOJI_CDN = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg'


def _replace_flag_emoji_with_twemoji(text):
    """Replace flag emoji Unicode pairs with Twemoji SVG <img> tags."""
    def _replace_flag(match):
        flag = match.group(1)
        codepoints = '-'.join(f'{ord(c):x}' for c in flag)
        return (
            f'<img src="{_TWEMOJI_CDN}/{codepoints}.svg" '
            f'alt="{flag}" class="post-twemoji-flag" '
            f'width="20" height="20" loading="lazy" decoding="async" '
            f'crossorigin="anonymous">'
        )
    return _FLAG_EMOJI_PATTERN.sub(_replace_flag, text)


# ============================================================================
# ENTITY DICTIONARIES
# ============================================================================

# Common Bengali person name prefixes/titles (indicates a name follows)
PERSON_NAME_TITLES = {
    'সাইয়িদ', 'শাইখ', 'মাওলানা', 'ইমাম', 'হাফেজ', 'ড.',
    'প্রফেসর', 'অধ্যাপক', 'বিচারপতি', 'ব্যারিস্টার',
    'মুফতি', 'আল্লামা', 'হুজুর', 'উস্তাদ', 'পণ্ডিত',
}

# Common Bengali first name parts (high confidence)
PERSON_NAME_PARTS = {
    'মুহাম্মাদ', 'মোহাম্মদ', 'আহমদ', 'আহমেদ', 'রহমান', 'করিম', 'রহিম',
    'হাসান', 'হুসাইন', 'আলী', 'উমর', 'আবু', 'ইবনে', 'ইবন',
    'রবীন্দ্রনাথ', 'নজরুল', 'জীবনানন্দ', 'সুনীল', 'নির্মলেন্দু',
    'ঠাকুর', 'দাশ', 'গঙ্গোপাধ্যায়', 'চট্টোপাধ্যায়', 'বন্দ্যোপাধ্যায়',
    'খান', 'চৌধুরী', 'সরকার', 'মজুমদার', 'বিশ্বাস', 'দত্ত',
    'নাকিব', 'আত্তাস', 'গুণ', 'কবির', 'কায়েস', 'ইমরান',
    'শেখ', 'মুজিবুর', 'জিয়াউর', 'খালেদা', 'হাসিনা',
}

# Location indicators (words/suffixes that mark locations)
LOCATION_INDICATORS = {
    'জেলা', 'উপজেলা', 'বিভাগ', 'থানা', 'পৌরসভা', 'নগর', 'মহানগর',
    'গ্রাম', 'ইউনিয়ন', 'সিটি', 'জংশন', 'বন্দর', 'ঘাট', 'সড়ক',
    'মসজিদ', 'মন্দির', 'গির্জা', 'বিশ্ববিদ্যালয়', 'স্কুল', 'কলেজ',
    'হাসপাতাল', 'স্টেশন', 'বাজার', 'হাট', 'সেতু', 'নদী', 'সাগর',
}

# Well-known Bangladesh locations
KNOWN_LOCATIONS = {
    # Bangladesh divisions & major cities
    'ঢাকা', 'চট্টগ্রাম', 'রাজশাহী', 'খুলনা', 'বরিশাল', 'সিলেট',
    'রংপুর', 'ময়মনসিংহ', 'কুমিল্লা', 'গাজীপুর', 'নারায়ণগঞ্জ',
    'সাভার', 'টঙ্গী', 'কক্সবাজার', 'বগুড়া', 'দিনাজপুর', 'যশোর',
    'নোয়াখালী', 'ফেনী', 'লক্ষ্মীপুর', 'পটুয়াখালী', 'ভোলা',
    'মাদারীপুর', 'শরীয়তপুর', 'মুন্সীগঞ্জ', 'নরসিংদী', 'কিশোরগঞ্জ',
    'জামালপুর', 'শেরপুর', 'নেত্রকোনা', 'হবিগঞ্জ', 'মৌলভীবাজার',
    'সুনামগঞ্জ', 'ব্রাহ্মণবাড়িয়া', 'চাঁদপুর', 'পাবনা', 'সিরাজগঞ্জ',
    'নাটোর', 'নওগাঁ', 'চাঁপাইনবাবগঞ্জ', 'জয়পুরহাট', 'রংপুর',
    'গাইবান্ধা', 'কুড়িগ্রাম', 'লালমনিরহাট', 'নীলফামারী', 'ঠাকুরগাঁও',
    'পঞ্চগড়', 'সাতক্ষীরা', 'ঝিনাইদহ', 'মাগুরা', 'নড়াইল', 'মেহেরপুর',
    'কুষ্টিয়া', 'চুয়াডাঙ্গা', 'ঝালকাঠি', 'পিরোজপুর', 'বরগুনা',
    'বান্দরবান', 'রাঙ্গামাটি', 'খাগড়াছড়ি',
    # Countries — South Asia
    'বাংলাদেশ', 'ভারত', 'পাকিস্তান', 'নেপাল', 'শ্রীলঙ্কা', 'ভুটান',
    'মায়ানমার', 'আফগানিস্তান', 'মালদ্বীপ',
    # Countries — Middle East
    'সৌদি আরব', 'সংযুক্ত আরব আমিরাত', 'কাতার', 'কুয়েত', 'বাহরাইন',
    'ওমান', 'ইরান', 'ইরাক', 'তুরস্ক', 'সিরিয়া', 'লেবানন',
    'জর্ডান', 'ফিলিস্তিন', 'ইসরায়েল', 'ইয়েমেন', 'মিশর',
    # Countries — Major world
    'যুক্তরাষ্ট্র', 'যুক্তরাজ্য', 'কানাডা', 'অস্ট্রেলিয়া', 'জাপান',
    'চীন', 'রাশিয়া', 'জার্মানি', 'ফ্রান্স', 'ইতালি', 'স্পেন',
    'মালয়েশিয়া', 'সিঙ্গাপুর', 'ইন্দোনেশিয়া', 'থাইল্যান্ড',
    'দক্ষিণ কোরিয়া', 'উত্তর কোরিয়া', 'ব্রাজিল', 'আর্জেন্টিনা',
    'দক্ষিণ আফ্রিকা', 'নাইজেরিয়া', 'কেনিয়া',
    # Holy cities
    'মক্কা', 'মদিনা', 'জেরুজালেম', 'বেনারস', 'কলকাতা', 'দিল্লি', 'মুম্বাই',
    # English country names (for mixed text)
    'Bangladesh', 'India', 'Pakistan', 'USA', 'UK', 'China', 'Japan',
    'Saudi Arabia', 'Qatar', 'Dubai', 'Turkey', 'Egypt', 'Malaysia',
}

# Religious terms
RELIGIOUS_TERMS = {
    'ইসলাম', 'মুসলিম', 'মুসলমান', 'হিন্দু', 'খ্রিস্টান', 'বৌদ্ধ',
    'কুরআন', 'কোরআন', 'হাদিস', 'হাদীস', 'সুন্নাহ', 'সুন্নত',
    'গীতা', 'বাইবেল', 'ত্রিপিটক', 'বেদ', 'উপনিষদ',
    'নামাজ', 'সালাত', 'রোজা', 'সিয়াম', 'হজ', 'যাকাত', 'জাকাত',
    'ঈমান', 'তাকওয়া', 'তাওহীদ', 'শিরক', 'বিদআত',
    'জান্নাত', 'জাহান্নাম', 'আখিরাত', 'কিয়ামত',
    'সাহাবা', 'সাহাবী', 'তাবেয়ী', 'ফিকহ', 'শরীয়া', 'শরিয়াহ',
    'দার্শনিক', 'শিক্ষাবিদ', 'ধর্মতত্ত্ব',
}

# Date patterns (Bengali and English)
BENGALI_MONTHS = {
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
    'বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র', 'আশ্বিন',
    'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ', 'ফাল্গুন', 'চৈত্র',
    'মুহররম', 'সফর', 'রবিউল', 'জমাদিউল', 'রজব', 'শাবান',
    'রমজান', 'রমাদান', 'শাওয়াল', 'জিলকদ', 'জিলহজ',
}


# ============================================================================
# ENTITY DETECTION FUNCTIONS
# ============================================================================

def _detect_person_names(text):
    """Detect person name spans in Bengali text. Returns list of (start, end, name_text)."""
    entities = []

    # Words that signal the end of a person name
    name_stop_words = RELIGIOUS_TERMS | LOCATION_INDICATORS | KNOWN_LOCATIONS | {
        'হলো', 'করা', 'করে', 'থেকে', 'এবং', 'একজন', 'ছিলেন', 'হয়',
        'মুসলিম', 'হিন্দু', 'দার্শনিক', 'শিক্ষাবিদ', 'লেখক', 'কবি', 'সাহিত্যিক',
        'রাজনীতিবিদ', 'বিজ্ঞানী', 'সাংবাদিক', 'অধ্যাপক', 'শিক্ষক',
    }

    # Pattern 1: Title + following name words (stop at non-name words)
    for title in PERSON_NAME_TITLES:
        title_pattern = re.compile(re.escape(title) + r'(?:\s+[\u0980-\u09FF]+)+')
        for match in title_pattern.finditer(text):
            full_match = match.group(0)
            # Trim from the right — remove trailing words that are stop words
            match_words = full_match.split()
            trimmed_words = [match_words[0]]  # Keep the title
            for name_word in match_words[1:]:
                clean_name_word = re.sub(r'[।,\.\!\?]', '', name_word)
                if clean_name_word in name_stop_words:
                    break
                trimmed_words.append(name_word)
            if len(trimmed_words) >= 2:
                trimmed_name = ' '.join(trimmed_words)
                entities.append((match.start(), match.start() + len(trimmed_name), trimmed_name))

    # Pattern 2: Consecutive known name parts (মুহাম্মাদ নাকিব)
    words = text.split()
    word_positions = []
    current_position = 0
    for word in words:
        start = text.find(word, current_position)
        word_positions.append((start, start + len(word), word))
        current_position = start + len(word)

    consecutive_name_start = None
    consecutive_name_count = 0
    for word_index, (word_start, word_end, word) in enumerate(word_positions):
        clean_word = re.sub(r'[।,\.\!\?]', '', word)
        if clean_word in PERSON_NAME_PARTS:
            if consecutive_name_start is None:
                consecutive_name_start = word_start
            consecutive_name_count += 1
        else:
            if consecutive_name_count >= 2:
                name_end = word_positions[word_index - 1][1]
                name_text = text[consecutive_name_start:name_end]
                entities.append((consecutive_name_start, name_end, name_text))
            consecutive_name_start = None
            consecutive_name_count = 0

    # Handle trailing name sequence
    if consecutive_name_count >= 2:
        name_end = word_positions[-1][1]
        name_text = text[consecutive_name_start:name_end]
        entities.append((consecutive_name_start, name_end, name_text))

    return entities


# Pre-compiled single-pass regexes (compiled once at module load, reused on every call)
_KNOWN_LOCATIONS_PATTERN = re.compile('|'.join(re.escape(location) for location in KNOWN_LOCATIONS))
_LOCATION_INDICATOR_PATTERN = re.compile(r'[\u0980-\u09FF]+\s+(?:' + '|'.join(re.escape(indicator) for indicator in LOCATION_INDICATORS) + r')')
_RELIGIOUS_TERMS_PATTERN = re.compile('|'.join(re.escape(term) for term in sorted(RELIGIOUS_TERMS, key=len, reverse=True)))
_BENGALI_MONTH_PATTERN = re.compile(r'[\u09E6-\u09EF\d]+\s*(?:' + '|'.join(re.escape(month) for month in BENGALI_MONTHS) + r')(?:\s*[\u09E6-\u09EF\d]+)?')
_ENGLISH_DATE_PATTERN = re.compile(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}')
_BENGALI_YEAR_PATTERN = re.compile(r'[\u09E6-\u09EF]{4}')
_BOOK_PAGE_REF_PATTERN = re.compile(r'(?:^|[।\.]\s*)([^\u0964।\.]{5,60}[,।]?\s*পৃ[\.ষ্ঠা]*\s*[\u09E6-\u09EF\d]+)')
_BOOK_QUOTE_PATTERN = re.compile(r'["\u201C]([^"\u201D]+)["\u201D]|\'([^\']+)\'')


def _detect_locations(text):
    """Detect location spans in Bengali text. Single-pass regex."""
    entities = []
    for match in _KNOWN_LOCATIONS_PATTERN.finditer(text):
        entities.append((match.start(), match.end(), match.group(0)))
    for match in _LOCATION_INDICATOR_PATTERN.finditer(text):
        entities.append((match.start(), match.end(), match.group(0)))
    return entities


def _detect_dates(text):
    """Detect date patterns in Bengali text. Single-pass regex."""
    entities = []
    for match in _BENGALI_MONTH_PATTERN.finditer(text):
        entities.append((match.start(), match.end(), match.group(0)))
    for match in _ENGLISH_DATE_PATTERN.finditer(text):
        entities.append((match.start(), match.end(), match.group(0)))
    for match in _BENGALI_YEAR_PATTERN.finditer(text):
        entities.append((match.start(), match.end(), match.group(0)))
    return entities


def _detect_book_references(text):
    """Detect book/publication references in Bengali text."""
    entities = []
    for match in _BOOK_PAGE_REF_PATTERN.finditer(text):
        book_text = match.group(1).strip()
        entities.append((match.start(1), match.start(1) + len(book_text), book_text))
    for match in _BOOK_QUOTE_PATTERN.finditer(text):
        entities.append((match.start(), match.end(), match.group(0)))
    return entities


def _detect_religious_terms(text):
    """Detect religious terms in Bengali text. Single-pass regex."""
    entities = []
    for match in _RELIGIOUS_TERMS_PATTERN.finditer(text):
        entities.append((match.start(), match.end(), match.group(0)))
    return entities


# ============================================================================
# ENTITY CSS CLASSES
# ============================================================================

ENTITY_CSS_CLASS = {
    'person': 'post-entity-person',
    'location': 'post-entity-location',
    'date': 'post-entity-date',
    'book': 'post-entity-book',
    'religious': 'post-entity-religious',
    'keyword': 'post-entity-keyword',
}


# ============================================================================
# MAIN HIGHLIGHT FUNCTION
# ============================================================================

def highlight_entities_in_text(text, keywords=None):
    """Detect named entities + keywords in Bengali text and wrap in <mark> tags.

    Returns HTML-safe string. Text is HTML-escaped first (XSS safe),
    then entities are wrapped in <mark class="post-entity-{type}"> tags.

    Entity priority (higher wins on overlap): person > book > location > date > religious > keyword
    """
    if not text:
        return ''

    # Collect all entities with their types
    all_entities = []

    # Detect entities
    for start, end, entity_text in _detect_person_names(text):
        all_entities.append((start, end, 'person'))

    for start, end, entity_text in _detect_book_references(text):
        all_entities.append((start, end, 'book'))

    for start, end, entity_text in _detect_locations(text):
        all_entities.append((start, end, 'location'))

    for start, end, entity_text in _detect_dates(text):
        all_entities.append((start, end, 'date'))

    for start, end, entity_text in _detect_religious_terms(text):
        all_entities.append((start, end, 'religious'))

    # Detect hashtags (#ট্যাগ, #tag)
    import re
    for match in re.finditer(r'#([\w\u0980-\u09FF]+)', text):
        all_entities.append((match.start(), match.end(), 'hashtag'))

    # Detect @mentions (@username_handle)
    for match in re.finditer(r'@([\w.-]+)', text):
        all_entities.append((match.start(), match.end(), 'mention'))

    # Add theme keywords (lowest priority)
    if keywords:
        for keyword in keywords:
            keyword_pattern = re.escape(keyword) + r'[\u0980-\u09FF]*'
            for match in re.finditer(keyword_pattern, text):
                all_entities.append((match.start(), match.end(), 'keyword'))

    if not all_entities:
        return _replace_flag_emoji_with_twemoji(escape(text))

    # Resolve overlaps — higher priority entity types win
    # Priority order: person=0, book=1, location=2, date=3, religious=4, keyword=5
    priority_order = {'person': 0, 'book': 1, 'location': 2, 'date': 3, 'religious': 4, 'keyword': 5}
    all_entities.sort(key=lambda entity: (entity[0], priority_order.get(entity[2], 99)))

    # Remove overlapping entities (keep higher priority = lower number)
    non_overlapping = []
    last_end = -1
    for start, end, entity_type in all_entities:
        if start >= last_end:
            non_overlapping.append((start, end, entity_type))
            last_end = end

    # Build highlighted HTML
    result_parts = []
    last_position = 0
    for start, end, entity_type in non_overlapping:
        # Add non-entity text before this entity
        if start > last_position:
            result_parts.append(escape(text[last_position:start]))

        # Add entity with highlight
        entity_text = escape(text[start:end])
        if entity_type == 'hashtag':
            tag_value = entity_text[1:] if entity_text.startswith('#') else entity_text
            result_parts.append(f'<a href="/search/?hashtag={tag_value}" class="post-hashtag">{entity_text}</a>')
        elif entity_type == 'mention':
            handle_value = entity_text[1:] if entity_text.startswith('@') else entity_text
            result_parts.append(f'<a href="/social/@{handle_value}/" class="post-mention">{entity_text}</a>')
        else:
            css_class = ENTITY_CSS_CLASS.get(entity_type, 'post-entity-keyword')
            result_parts.append(f'<mark class="{css_class}">{entity_text}</mark>')

        last_position = end

    # Add remaining text after last entity
    if last_position < len(text):
        result_parts.append(escape(text[last_position:]))

    result_html = ''.join(result_parts)

    # Replace flag emojis with Twemoji images (Windows can't render flag emojis).
    # Runs AFTER HTML build so flag img tags won't be corrupted by entity detection.
    result_html = _replace_flag_emoji_with_twemoji(result_html)

    return result_html

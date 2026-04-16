"""Bengali → practical English transliteration.

Produces human-readable Romanized Bengali (how Bengalis actually write in
English), not academic IAST/ISO 15919. Designed for URL slugs, filenames,
and display where readability matters more than reversibility.

Key rule: every Bengali consonant carries an inherent 'o' sound UNLESS
followed by a vowel sign (মাত্রা), হসন্ত (্), or is at end of word.

Usage:
    from amolnama_news.site_apps.englishtobangla.transliterate import bengali_to_english
    bengali_to_english('বাংলাদেশ')  # → 'bangladesh'
"""
import unicodedata

VOWELS = {
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u',
    'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
}

VOWEL_SIGNS = {
    '\u09BE': 'a',   # া
    '\u09BF': 'i',   # ি
    '\u09C0': 'i',   # ী
    '\u09C1': 'u',   # ু
    '\u09C2': 'u',   # ূ
    '\u09C3': 'ri',  # ৃ
    '\u09C7': 'e',   # ে
    '\u09C8': 'oi',  # ৈ
    '\u09CB': 'o',   # ো
    '\u09CC': 'ou',  # ৌ
}

CONSONANTS = {
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 'ch', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l',
    'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't',
}

MODIFIERS = {
    'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n',
}

BENGALI_DIGITS = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
}

HASANTA = '\u09CD'  # ্
NUKTA = '\u09BC'    # ়

VOWEL_SIGN_SET = set(VOWEL_SIGNS.keys())
CONSONANT_SET = set(CONSONANTS.keys())

# High-priority words where automated rules fail. These are political,
# historical, and geographic terms that Bengalis always spell a specific
# way in English. Checked first, before any algorithmic transliteration.
MANUAL_OVERRIDES = {
    'বঙ্গবন্ধু': 'bongobondhu',
    'বাংলাদেশ': 'bangladesh',
    'মুক্তিযুদ্ধ': 'muktijuddho',
    'স্বাধীনতা': 'shadhinota',
    'সংবিধান': 'songbidhan',
    'রাজধানী': 'rajdhani',
    'গণপ্রজাতন্ত্রী': 'gonoprojatontri',
    'প্রধানমন্ত্রী': 'prodhanmontri',
    'রাষ্ট্রপতি': 'rashtropoti',
    'জাতীয় সংসদ': 'jatiyo songsod',
    'সংসদ': 'songsod',
    'শেখ': 'sheikh',
    'মুজিবুর': 'mujibur',
    'রহমান': 'rohman',
    'জিয়াউর': 'ziaur',
    'খালেদা': 'khaleda',
    'হাসিনা': 'hasina',
    'ঢাকা': 'dhaka',
    'চট্টগ্রাম': 'chattogram',
    'রাজশাহী': 'rajshahi',
    'খুলনা': 'khulna',
    'সিলেট': 'sylhet',
    'বরিশাল': 'barishal',
    'রংপুর': 'rangpur',
    'ময়মনসিংহ': 'mymensingh',
    'কক্সবাজার': 'coxsbazar',
    'সুন্দরবন': 'sundarbans',
    'চট্টগ্রাম': 'chattogram',
    'প্রধানমন্ত্রী': 'prodhanmontri',
    'স্বাধীনতা': 'shadhinota',
    'জাতীয়': 'jatiyo',
    'সংসদ': 'songsod',
    'নির্বাচন': 'nirbachon',
    'বিশ্ববিদ্যালয়': 'bishwobidyaloy',
    'প্রজাতন্ত্র': 'projatontro',
    'গণতন্ত্র': 'gonotontro',
    'সংবাদ': 'songbad',
    'সংবাদপত্র': 'songbadpotro',
    'আন্দোলন': 'andolon',
    'বিপ্লব': 'biplob',
    'গণহত্যা': 'gonohottya',
    'জনগণ': 'jonogon',
    'সংখ্যালঘু': 'songkhyaloghu',
    'পরিবেশ': 'poribesh',
    'অর্থনীতি': 'orthoniti',
    'প্রযুক্তি': 'projukti',
    'শিক্ষা': 'shikkha',
    'স্বাস্থ্য': 'shasthyo',
}


def _peek(text, index):
    """Return character at index or empty string if out of bounds."""
    return text[index] if index < len(text) else ''


def _is_word_boundary(character):
    """True if character marks end of a syllable group (space, punctuation, end)."""
    return character == '' or character == ' ' or not (
        character in CONSONANT_SET
        or character in VOWEL_SIGN_SET
        or character in VOWELS
        or character in MODIFIERS
        or character == HASANTA
        or character == NUKTA
    )


def bengali_to_english(text):
    """Transliterate Bengali text to practical Romanized English.

    Strategy (hybrid, per Gemini's recommendation):
      1. Split into words
      2. For each word, check MANUAL_OVERRIDES first (exact match)
      3. If no override, run the algorithmic transliteration
      4. Join with spaces (caller slugifies)

    Returns lowercase ASCII string. Spaces preserved.
    """
    if not text:
        return ''

    text = unicodedata.normalize('NFC', str(text).strip())

    # Check full-phrase override first
    if text in MANUAL_OVERRIDES:
        return MANUAL_OVERRIDES[text]

    # Per-word override + fallback
    words = text.split()
    result_words = []
    for word in words:
        normalized_word = unicodedata.normalize('NFC', word.strip())
        if normalized_word in MANUAL_OVERRIDES:
            result_words.append(MANUAL_OVERRIDES[normalized_word])
        else:
            result_words.append(_transliterate_word(normalized_word))
    return ' '.join(result_words)


# Cluster compression map — consonant pairs that merge phonetically.
# Without this, ঙ্গ becomes "ngg" instead of "ng".
CLUSTER_COMPRESSION = {
    ('ঙ', 'গ'): 'ng',
    ('ঙ', 'ক'): 'nk',
    ('ঞ', 'চ'): 'nch',
    ('ঞ', 'জ'): 'nj',
}

# Initial conjunct overrides — word-start consonant pairs with special pronunciation.
INITIAL_CONJUNCT_OVERRIDES = {
    ('স', 'ব'): 'sh',   # স্ব → "sh" (স্বাধীন → shadhin)
    ('স', 'ত'): 'st',   # স্ত → "st"
    ('স', 'থ'): 'sth',  # স্থ → "sth"
}

# Allophonic conjunct transformations — consonants that change sound in conjuncts.
# য is "j" standalone but "y" after hasanta (্য = Ya-phala).
# ব is "b" standalone but "w" after hasanta (্ব = Ba-phala).
# র is "r" standalone and "r" after hasanta (্র = Ra-phala, no change but kept for clarity).
CONJUNCT_TRANSFORMATIONS = {
    'য': 'y',   # ্য → y (বিদ্যা → bidya, স্বাস্থ্য → shasthyo)
    'র': 'r',   # ্র → r (প্র → pro, তন্ত্র → tontro)
    # ্ব is NOT here — it's "w" after শ/স but "b" after ন/র/স.
    # Too context-dependent for a general rule. Handled by overrides
    # for specific words (বিশ্ব → bishwo) or initial conjunct map (স্ব → sh).
}


def _transliterate_word(text):
    """Algorithmic transliteration for a single Bengali word.

    Incorporates 4 rules for handling unknown words:
    1. Cluster compression (ঙ্গ → ng, not ngg)
    2. Schwa deletion (drop inherent 'o' when next consonant has a vowel sign)
    3. Terminal 'o' on heavy clusters (যুদ্ধ → juddho at word end)
    4. Initial conjunct overrides (স্ব → sh at word start)
    """
    if not text:
        return ''
    result = []
    index = 0
    text_length = len(text)
    is_word_start = True

    while index < text_length:
        character = text[index]

        # Two-char consonants with nukta: ড় (ড + ়), ঢ় (ঢ + ়), য় (য + ়)
        if index + 1 < text_length and text[index + 1] == NUKTA:
            two_char = character + NUKTA
            if two_char in CONSONANTS:
                romanized_consonant = CONSONANTS[two_char]
                index += 2
                # Terminal য় gets 'o' (জাতীয় → jatiyo)
                if two_char == 'য়' and index >= text_length:
                    result.append(romanized_consonant + 'o')
                else:
                    suffix = _resolve_inherent_vowel(
                        text, index, text_length, is_initial=is_word_start,
                    )
                    result.append(romanized_consonant + suffix)
                is_word_start = False
                continue

        if character in CONSONANTS:
            romanized_consonant = CONSONANTS[character]
            index += 1
            cluster_length = 1

            # Consume hasanta + following consonants (conjunct cluster)
            while index < text_length and text[index] == HASANTA:
                index += 1  # skip hasanta
                if index >= text_length:
                    break

                # Check for nukta-consonant (ড় etc after hasanta)
                if index + 1 < text_length and text[index + 1] == NUKTA:
                    two_char_next = text[index] + NUKTA
                    if two_char_next in CONSONANTS:
                        romanized_consonant += CONSONANTS[two_char_next]
                        index += 2
                        cluster_length += 1
                        continue

                if text[index] in CONSONANTS:
                    prev_bengali = character if cluster_length == 1 else None
                    current_bengali = text[index]

                    # Rule 1: Cluster compression (ঙ্গ → ng)
                    if prev_bengali and (prev_bengali, current_bengali) in CLUSTER_COMPRESSION:
                        romanized_consonant = CLUSTER_COMPRESSION[(prev_bengali, current_bengali)]
                    # Rule 4: Initial conjunct overrides (স্ব → sh)
                    elif is_word_start and prev_bengali and (prev_bengali, current_bengali) in INITIAL_CONJUNCT_OVERRIDES:
                        romanized_consonant = INITIAL_CONJUNCT_OVERRIDES[(prev_bengali, current_bengali)]
                    # Rule 5: Allophonic transformation (্য→y, ্ব→w, ্র→r)
                    elif current_bengali in CONJUNCT_TRANSFORMATIONS:
                        romanized_consonant += CONJUNCT_TRANSFORMATIONS[current_bengali]
                    else:
                        romanized_consonant += CONSONANTS[current_bengali]

                    index += 1
                    cluster_length += 1

            # Decide inherent 'o'
            suffix = _resolve_inherent_vowel(
                text, index, text_length, is_initial=is_word_start,
            )

            # Rule 3: Terminal 'o' on heavy clusters (2+ consonants at word end)
            if suffix == '' and cluster_length >= 2 and index >= text_length:
                suffix = 'o'

            result.append(romanized_consonant + suffix)
            is_word_start = False

        elif character in VOWEL_SIGNS:
            result.append(VOWEL_SIGNS[character])
            index += 1
            is_word_start = False

        elif character in VOWELS:
            result.append(VOWELS[character])
            index += 1
            is_word_start = False

        elif character in MODIFIERS:
            result.append(MODIFIERS[character])
            index += 1
            is_word_start = False

        elif character in BENGALI_DIGITS:
            result.append(BENGALI_DIGITS[character])
            index += 1

        elif character == HASANTA:
            index += 1

        elif character == ' ':
            result.append(' ')
            index += 1
            is_word_start = True

        else:
            result.append(character.lower())
            index += 1
            is_word_start = False

    return ''.join(result)


def _resolve_inherent_vowel(text, index, text_length, is_initial=False):
    """Decide whether to append inherent 'o' after a consonant cluster.

    Rules:
      - Followed by vowel sign → NO 'o' (sign provides the vowel)
      - Followed by hasanta → NO 'o' (cluster continues)
      - At end of word → NO 'o' (word-final consonants are closed)
      - Initial consonant → ALWAYS 'o' (Bengali doesn't delete schwa
        at word start: কবিতা = ko-bi-ta, not k-bi-ta)
      - Rule 2 (Schwa deletion, medial only): next consonant has a vowel
        sign right after it → NO 'o'. Fixes "rajdhani" not "rajodhani".
      - Otherwise → ADD 'o'
    """
    if index >= text_length:
        return ''

    next_character = text[index]

    if next_character in VOWEL_SIGN_SET:
        return ''

    if next_character == HASANTA:
        return ''

    if next_character == ' ' or _is_word_boundary(next_character):
        return ''

    # Initial consonant of a word: always keep 'o'.
    # Bengali doesn't delete schwa at word start.
    if is_initial:
        return 'o'

    # Rule 2: Schwa deletion (medial positions only) — if the IMMEDIATELY
    # NEXT consonant has a vowel sign right after it, drop the inherent 'o'.
    if next_character in CONSONANT_SET:
        char_after_next = _peek(text, index + 1)
        if char_after_next in VOWEL_SIGN_SET:
            return ''

    return 'o'

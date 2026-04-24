/* ============================================================
   BanglaInput — Reusable English-to-Bengali transliteration
   Usage: BanglaInput.attach(inputElement, options)

   Features:
   - Avro Phonetic instant transliteration (client-side, zero latency)
   - OpenBangla dictionary suggestions (159K words, offline)
   - Suggestion dropdown with keyboard navigation
   - Space = auto-pick first/best suggestion
   - Arrow Up/Down = browse alternatives
   - Enter/Tab = pick selected
   - Escape = dismiss
   ============================================================ */
const BanglaInput = (function() {
  "use strict";

  let dictionary = null;       // loaded once, shared across all instances
  let dictLoading = false;
  let dictCallbacks = [];
  const avroAvailable = typeof OmicronLab !== "undefined" && OmicronLab.Avro && OmicronLab.Avro.Phonetic;
  // Default to saved preference, fallback to Bengali enabled
  const savedLanguagePreference = localStorage.getItem('bangla_input_enabled');
  let globalBengaliKeyboardEnabled = savedLanguagePreference !== null ? savedLanguagePreference === 'true' : true;

  /* Bengali numerals — index 0-9 maps directly to ০-৯. Indexed by
     the parsed integer so the lookup is a single array index, not
     a switch / conditional. Used by the keydown handler to convert
     digits typed in Bangla mode on-the-fly. */
  const BENGALI_DIGIT_BY_LATIN_INDEX = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

  // ---- Load dictionary ----
  function loadDictionary(callback) {
    if (dictionary) { callback(); return; }
    dictCallbacks.push(callback);
    if (dictLoading) return;
    dictLoading = true;

    // Find the script tag to resolve the static URL base
    const scripts = document.querySelectorAll("script[src*='bangla-input']");
    let base = "";
    if (scripts.length > 0) {
      base = scripts[0].src.replace(/\/js\/utilities\/bangla-input\.js.*$/, "/js/utilities/");
    }

    fetch(base + "bangla-dictionary.json", { cache: "force-cache" })
      .then(function(r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function(data) {
        dictionary = data;
        buildWordIndex();
        dictCallbacks.forEach(function(callback) { callback(); });
        dictCallbacks = [];
      })
      .catch(function() {
        // Dictionary failed — Avro phonetic still works as fallback
        dictionary = {};
        dictCallbacks.forEach(function(callback) { callback(); });
        dictCallbacks = [];
      });
  }

  // ---- Flatten dictionary into a single sorted array (built once) ----
  let allWords = null;

  function buildWordIndex() {
    if (allWords) return;
    allWords = [];
    const keys = Object.keys(dictionary);
    for (let k = 0; k < keys.length; k++) {
      const arr = dictionary[keys[k]];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].length >= 2) allWords.push(arr[i]);
      }
    }
    allWords.sort();
  }

  // Binary search for first word starting with prefix
  function binarySearchPrefix(prefix) {
    let lo = 0, hi = allWords.length - 1, result = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (allWords[mid] >= prefix) { result = mid; hi = mid - 1; }
      else lo = mid + 1;
    }
    return result;
  }

  // Common Bengali suffixes — used to generate word+suffix combinations
  const BN_SUFFIXES = ["ই","ও","এ","তে","তো","র","ের","দের","কে","গুলো","গুলি","টা","টি","টুকু","খানা","খানি","য়","ে","া","ি","ী","ো","ু","ূ"];

  // ---- Dictionary lookup ----
  // Strategy: For input "ektai" → Avro gives "এক্তাই"
  // 1. Search dictionary by English phonetic key for base words
  // 2. For each base word, try appending suffixes to see if base+suffix matches the Avro result
  // 3. Also search for words starting with same Bengali prefix
  function lookupWords(englishWord) {
    if (!englishWord) return [];
    const word = englishWord.toLowerCase();

    const avroResult = avroAvailable ? OmicronLab.Avro.Phonetic.parse(word) : "";
    if (!avroResult) return [];

    const candidates = [];
    const found = {};

    // Determine the dictionary key — first 1-3 chars of English input mapped to phonetic key
    const dictKey = findDictKey(word);
    const dictWords = dictKey && dictionary[dictKey] ? dictionary[dictKey] : [];

    // Strategy 1: Find dictionary words that START with same Bengali chars as Avro result
    // Try progressively shorter Bengali prefix (3 chars, 2 chars, 1 char)
    for (let pLen = Math.min(avroResult.length, 4); pLen >= 1; pLen--) {
      const bnPrefix = avroResult.substring(0, pLen);
      for (let i = 0; i < dictWords.length; i++) {
        if (dictWords[i].length < 2) continue;
        if (!dictWords[i].startsWith(bnPrefix)) continue;

        // Check: is this word similar length to avro result?
        if (Math.abs(dictWords[i].length - avroResult.length) <= 2 && !found[dictWords[i]]) {
          found[dictWords[i]] = true;
          candidates.push(dictWords[i]);
        }

        // Check: can base word + suffix = avro result or similar?
        for (let s = 0; s < BN_SUFFIXES.length && candidates.length < 10; s++) {
          const combined = dictWords[i] + BN_SUFFIXES[s];
          if (!found[combined] && combined.length >= 2 && Math.abs(combined.length - avroResult.length) <= 1) {
            // Combined word should share at least first 2 Bengali chars with avro result
            if (combined.substring(0, 2) === avroResult.substring(0, Math.min(2, avroResult.length))) {
              found[combined] = true;
              candidates.push(combined);
            }
          }
        }

        if (candidates.length >= 8) break;
      }
      if (candidates.length >= 3) break;
    }

    // Strategy 2: Also use the sorted allWords index for broader Bengali prefix search
    if (allWords && candidates.length < 4) {
      for (let pl = Math.min(avroResult.length, 3); pl >= 1 && candidates.length < 6; pl--) {
        const bp = avroResult.substring(0, pl);
        let index = binarySearchPrefix(bp);
        if (index === -1) continue;
        for (let j = index; j < allWords.length && j < index + 100 && candidates.length < 6; j++) {
          if (!allWords[j].startsWith(bp)) break;
          if (allWords[j].length < 2 || found[allWords[j]]) continue;
          if (Math.abs(allWords[j].length - avroResult.length) <= 2) {
            found[allWords[j]] = true;
            candidates.push(allWords[j]);
          }
        }
      }
    }

    // Always include Avro result — put it first if not already there
    if (found[avroResult]) {
      const avroIdx = candidates.indexOf(avroResult);
      if (avroIdx > 0) { candidates.splice(avroIdx, 1); candidates.unshift(avroResult); }
    } else {
      candidates.unshift(avroResult);
    }

    return candidates.slice(0, 6);
  }

  // Map English input to the dictionary key (phonetic consonant cluster)
  let DICT_KEYS_SORTED = []; // sorted by length descending for greedy match
  function findDictKey(engWord) {
    if (DICT_KEYS_SORTED.length === 0 && dictionary) {
      DICT_KEYS_SORTED = Object.keys(dictionary).sort(function(a, b) { return b.length - a.length; });
    }
    const lower = engWord.toLowerCase();
    for (let i = 0; i < DICT_KEYS_SORTED.length; i++) {
      if (lower.startsWith(DICT_KEYS_SORTED[i])) return DICT_KEYS_SORTED[i];
    }
    // Fallback: first char
    return dictionary[lower.charAt(0)] ? lower.charAt(0) : null;
  }

  /* ============================================================
     CONTENTEDITABLE SUPPORT — abstraction layer
     ------------------------------------------------------------
     Original BanglaInput targets <input> / <textarea> only and uses
     .value, .selectionStart, .setSelectionRange. To also support
     contenteditable elements (e.g. the bookwriter chapter title +
     prose), the same code path uses these helpers which switch
     implementation based on the element type. Input/textarea
     behaviour is unchanged — the same property reads/writes happen
     internally; only contenteditable elements take the new path.
     ============================================================ */
  function isContentEditableElement(element) {
    return !!(element && (element.isContentEditable || element.getAttribute('contenteditable') === 'true'));
  }

  /* Read the full text content. Input/textarea uses .value.
     Contenteditable uses textContent (NOT innerText) so the
     character count stays consistent with Range.toString() / the
     walkNode character counter in replaceCharRangeWithText.
     innerText would synthesize "\n" between block elements that
     don't exist as real characters in the DOM, causing the cursor
     offset to drift by 1 for every paragraph above the cursor. */
  function getElementText(element) {
    return isContentEditableElement(element)
      ? (element.textContent || '')
      : (element.value || '');
  }

  /* Caret offset (character index) from the start of the element's
     text. For input/textarea, this is .selectionStart. For
     contenteditable, walk the Selection's start container back to
     the element root and count text characters. Returns 0 if no
     selection / cursor is inside the element. */
  function getElementCursorOffset(element) {
    if (!isContentEditableElement(element)) {
      return typeof element.selectionStart === 'number' ? element.selectionStart : 0;
    }
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    var range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer)) return 0;
    var preCaretRange = document.createRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    return preCaretRange.toString().length;
  }

  /* Replace the [from, to) character range with newText and place
     the caret at the end of the inserted text. For input/textarea,
     this is a simple substring swap + setSelectionRange. For
     contenteditable, we walk text nodes to find the start/end
     positions, build a Range, deleteContents, insertNode(textNode),
     and re-position the caret — this preserves all surrounding
     formatting (bold/italic spans, paragraph wrappers, images). */
  function replaceCharRangeWithText(element, fromCharOffset, toCharOffset, newText) {
    if (!isContentEditableElement(element)) {
      var existingValue = element.value || '';
      element.value = existingValue.substring(0, fromCharOffset) + newText + existingValue.substring(toCharOffset);
      var newCursorPosition = fromCharOffset + newText.length;
      element.setSelectionRange(newCursorPosition, newCursorPosition);
      element.focus();
      return;
    }
    var rangeStartNode = null;
    var rangeStartOffset = 0;
    var rangeEndNode = null;
    var rangeEndOffset = 0;
    var foundStart = false;
    var foundEnd = false;
    var characterCounter = 0;
    function walkNode(currentNode) {
      if (foundStart && foundEnd) return;
      if (currentNode.nodeType === Node.TEXT_NODE) {
        var textLength = currentNode.length;
        if (!foundStart && fromCharOffset >= characterCounter && fromCharOffset <= characterCounter + textLength) {
          rangeStartNode = currentNode;
          rangeStartOffset = fromCharOffset - characterCounter;
          foundStart = true;
        }
        if (!foundEnd && toCharOffset >= characterCounter && toCharOffset <= characterCounter + textLength) {
          rangeEndNode = currentNode;
          rangeEndOffset = toCharOffset - characterCounter;
          foundEnd = true;
        }
        characterCounter += textLength;
      } else {
        for (var childIndex = 0; childIndex < currentNode.childNodes.length; childIndex++) {
          walkNode(currentNode.childNodes[childIndex]);
          if (foundStart && foundEnd) return;
        }
      }
    }
    walkNode(element);
    if (!foundStart || !foundEnd) return;
    /* Select the range to replace, then insert via execCommand. We
       previously did the replace manually (deleteContents + insertNode
       + setStart(textNode, textNode.length)) but that placed the
       cursor at the wrong position for Bengali multi-codepoint
       sequences — for "রাষ্ট্র", the cursor landed between "রা" and
       "ষ্ট্র" instead of at the end. execCommand('insertText') is
       deprecated but it's the only API that handles grapheme-cluster
       cursor placement correctly across browsers. It also fires an
       input event natively, so no manual dispatch needed. */
    var replacementSelection = window.getSelection();
    var replacementRange = document.createRange();
    replacementRange.setStart(rangeStartNode, rangeStartOffset);
    replacementRange.setEnd(rangeEndNode, rangeEndOffset);
    replacementSelection.removeAllRanges();
    replacementSelection.addRange(replacementRange);
    document.execCommand('insertText', false, newText);
  }

  // ---- Attach to an input element ----
  function attach(inputEl, options) {
    if (!inputEl) return;
    options = options || {};

    let suggestBox = null;
    let wordBuffer = "";
    let wordStart = 0;
    let bestSuggestion = "";
    let trailingPunctuation = "";

    /* Stable per-instance id used both as the dropdown's element id
       and as the prefix for option ids, so aria-activedescendant on
       the input can point to the currently-active suggestion option
       (screen-reader autocomplete pattern). */
    const suggestBoxIdSuffix = 'bangla-input-suggest-' + Math.random().toString(36).slice(2, 10);

    // Create suggest dropdown
    function ensureSuggestBox() {
      if (suggestBox) return;
      suggestBox = document.createElement("div");
      suggestBox.className = "bangla-input-suggest";
      suggestBox.id = suggestBoxIdSuffix;
      /* ARIA — announce the dropdown as a listbox so screen readers
         treat each option as a selectable item. The input gets
         role="combobox" + aria-controls / aria-autocomplete. */
      suggestBox.setAttribute('role', 'listbox');
      suggestBox.setAttribute('aria-label', 'Bengali word suggestions');
      if (isContentEditableElement(inputEl)) {
        /* Contenteditable: position fixed relative to viewport so the
           dropdown can sit right under the caret regardless of how
           deep the editable node is in the DOM. Caret coords are
           computed in showSuggestions() each time the box is shown. */
        suggestBox.style.cssText = "display:none;position:fixed;z-index:200;background:#fff;border:1.5px solid #d4d4de;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);max-width:320px;min-width:160px;overflow:hidden;";
        document.body.appendChild(suggestBox);
      } else {
        /* Input/textarea: original parent-relative positioning. */
        suggestBox.style.cssText = "display:none;position:absolute;z-index:200;background:#fff;border:1.5px solid #d4d4de;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);max-width:320px;min-width:160px;overflow:hidden;";
        const parent = inputEl.parentNode;
        if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
        parent.appendChild(suggestBox);
      }
      /* ARIA wiring on the input itself — only set once (idempotent
         via the suggestBox guard above). aria-controls links the
         input to its listbox; aria-autocomplete="list" tells AT this
         is an autocomplete-list pattern, not a free-text combobox. */
      try {
        inputEl.setAttribute('role', 'combobox');
        inputEl.setAttribute('aria-autocomplete', 'list');
        inputEl.setAttribute('aria-controls', suggestBoxIdSuffix);
        inputEl.setAttribute('aria-expanded', 'false');
        inputEl.setAttribute('aria-haspopup', 'listbox');
      } catch (ariaError) { /* read-only attribute on some elements; ignore */ }
    }

    /* For contenteditable, position the suggest box near the current
       caret on every show. Uses the Selection's bounding rect.
       Empty-contenteditable fallback: in Chromium-based browsers,
       a collapsed Range inside an empty contenteditable (no <p>/<br>
       children — only an absolutely-positioned overlay child) returns
       a {0,0,0,0} rect from getBoundingClientRect(). The previous code
       skipped the position update on a zero rect, leaving the dropdown
       parked at its last-shown coordinates (e.g. carried over from a
       different chapter). The user saw the dropdown sitting on the
       page-number pill on the right margin instead of next to the
       caret in the empty page. The fix: when the rect is degenerate,
       fall back to the editable element's own top-left so the dropdown
       still appears where the user is actually typing. */
    function positionSuggestBoxAtCaret() {
      if (!suggestBox || !isContentEditableElement(inputEl)) return;
      var selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      var caretRect = selection.getRangeAt(0).getBoundingClientRect();
      var anchorTopPx;
      var anchorLeftPx;
      var caretRectIsDegenerate = (caretRect.bottom === 0 && caretRect.right === 0 && caretRect.width === 0 && caretRect.height === 0);
      if (caretRectIsDegenerate) {
        var editableRect = inputEl.getBoundingClientRect();
        anchorTopPx = editableRect.top + 24;
        anchorLeftPx = editableRect.left;
      } else {
        anchorTopPx = caretRect.bottom + 4;
        anchorLeftPx = caretRect.left;
      }
      suggestBox.style.top = anchorTopPx + 'px';
      suggestBox.style.left = anchorLeftPx + 'px';
    }

    function hideSuggestions() {
      if (suggestBox) suggestBox.style.display = "none";
      try { inputEl.setAttribute('aria-expanded', 'false'); inputEl.removeAttribute('aria-activedescendant'); } catch (ariaError) {}
      bestSuggestion = "";
    }

    /* Build the dropdown items programmatically with createElement +
       textContent — never innerHTML with concatenated strings. The
       suggestion text comes from the local dictionary AND the Google
       transliterate API; while the local dictionary is controlled,
       the API response should still be treated as untrusted input.
       textContent guarantees no HTML / script injection. Each item
       gets role="option" + a stable id so aria-activedescendant on
       the input can announce the selected suggestion to screen
       readers. */
    function showSuggestions(suggestions) {
      ensureSuggestBox();
      if (!suggestions || suggestions.length === 0) { hideSuggestions(); return; }
      bestSuggestion = suggestions[0];

      /* Clear previous items by removing children — safer than
         innerHTML = '' which can also nuke event listeners on
         retained references (we don't reuse here, but it's the
         defensive default). */
      while (suggestBox.firstChild) suggestBox.removeChild(suggestBox.firstChild);

      suggestions.forEach(function (suggestionText, suggestionIndex) {
        var optionElement = document.createElement('div');
        optionElement.className = 'bangla-input-item';
        optionElement.setAttribute('data-index', String(suggestionIndex));
        optionElement.setAttribute('role', 'option');
        optionElement.id = suggestBoxIdSuffix + '-option-' + suggestionIndex;
        optionElement.style.padding = '.4rem .7rem';
        optionElement.style.fontSize = '.88rem';
        optionElement.style.cursor = 'pointer';
        optionElement.style.borderBottom = '1px solid #f0f0f0';
        if (suggestionIndex === 0) {
          optionElement.setAttribute('data-active', '1');
          optionElement.setAttribute('aria-selected', 'true');
          optionElement.style.background = '#4a6fa5';
          optionElement.style.color = '#fff';
          optionElement.style.fontWeight = '600';
        } else {
          optionElement.setAttribute('aria-selected', 'false');
        }
        /* SAFE: textContent escapes HTML. Even if the suggestion
           string contained `<script>` or `<img onerror=…>`, it would
           render as literal text, not executable HTML. */
        optionElement.textContent = suggestionText;

        optionElement.addEventListener('mousedown', function (mouseDownEvent) {
          mouseDownEvent.preventDefault();
          pickSuggestion(optionElement.textContent);
        });
        optionElement.addEventListener('mouseenter', function () {
          clearActive();
          optionElement.setAttribute('data-active', '1');
          optionElement.setAttribute('aria-selected', 'true');
          optionElement.style.background = '#4a6fa5';
          optionElement.style.color = '#fff';
          optionElement.style.fontWeight = '600';
          bestSuggestion = optionElement.textContent;
          try { inputEl.setAttribute('aria-activedescendant', optionElement.id); } catch (ariaError) {}
        });

        suggestBox.appendChild(optionElement);
      });

      suggestBox.style.display = 'block';
      positionSuggestBoxAtCaret();

      /* Announce expanded state + initially-active option to AT. */
      try {
        inputEl.setAttribute('aria-expanded', 'true');
        var firstOptionId = suggestBoxIdSuffix + '-option-0';
        inputEl.setAttribute('aria-activedescendant', firstOptionId);
      } catch (ariaError) {}
    }

    function clearActive() {
      if (!suggestBox) return;
      suggestBox.querySelectorAll(".bangla-input-item").forEach(function(element) {
        element.removeAttribute("data-active");
        element.setAttribute('aria-selected', 'false');
        element.style.background = "";
        element.style.color = "";
        element.style.fontWeight = "";
      });
    }

    function pickSuggestion(bangla) {
      const replaceLength = wordBuffer.length + trailingPunctuation.length;
      const insertText = bangla + trailingPunctuation + ' ';
      replaceCharRangeWithText(inputEl, wordStart, wordStart + replaceLength, insertText);
      wordBuffer = '';
      trailingPunctuation = '';
      hideSuggestions();
      inputEl.dispatchEvent(new Event('bangla-input-change', { bubbles: true }));
    }

    let suggestTimer = null;
    const suggestCache = {};

    function updateSuggestions(text) {
      clearTimeout(suggestTimer);
      if (!text || text.length < 1) { hideSuggestions(); return; }

      // Step 1: INSTANT — show Avro + dictionary results immediately
      const offlineResults = lookupWords(text);
      if (offlineResults.length > 0) {
        // Check Google cache first
        if (suggestCache[text]) {
          showSuggestions(mergeResults(suggestCache[text], offlineResults));
        } else {
          showSuggestions(offlineResults);
        }
      }

      // Step 2: BACKGROUND — fetch Google suggestions to enrich the list
      if (text.length >= 2) {
        suggestTimer = setTimeout(function() {
          fetch("/tools/api/transliterate/?text=" + encodeURIComponent(text))
            .then(function(r) {
              if (!r.ok) throw new Error("HTTP " + r.status);
              return r.json();
            })
            .then(function(data) {
              const googleResults = data.suggestions || [];
              if (googleResults.length > 0) {
                suggestCache[text] = googleResults;
                if (wordBuffer === text) {
                  let merged = mergeResults(googleResults, offlineResults);
                  showSuggestions(merged);
                  // Google's first result is the best — update bestSuggestion
                  if (merged.length > 0) bestSuggestion = merged[0];
                }
              }
            })
            .catch(function() { /* offline results already showing */ });
        }, 80);
      }
    }

    // Merge Google (better quality, goes FIRST) with offline, dedup, max 6
    function mergeResults(googleResults, offlineResults) {
      const merged = [];
      // Google results first — they have dictionary-quality ranking
      for (let i = 0; i < googleResults.length && merged.length < 6; i++) {
        if (googleResults[i].length >= 2 && merged.indexOf(googleResults[i]) === -1) merged.push(googleResults[i]);
      }
      // Then offline results that aren't already in the list
      for (let j = 0; j < offlineResults.length && merged.length < 6; j++) {
        if (offlineResults[j].length >= 2 && merged.indexOf(offlineResults[j]) === -1) merged.push(offlineResults[j]);
      }
      return merged;
    }

    // ---- Event handlers ----
    inputEl.addEventListener("input", function() {
      if (!globalBengaliKeyboardEnabled) { wordBuffer = ''; hideSuggestions(); return; }
      let val = getElementText(inputEl);
      const cursor = getElementCursorOffset(inputEl);
      const textUpToCursor = val.substring(0, cursor);
      /* Word boundary = last space OR newline (contenteditable spans
         multiple paragraphs; lastIndexOf(" ") alone would skip past
         paragraph breaks and grab a word from the previous block). */
      const lastBoundary = Math.max(textUpToCursor.lastIndexOf(" "), textUpToCursor.lastIndexOf("\n"));
      wordStart = lastBoundary + 1;
      const currentWord = textUpToCursor.substring(wordStart);

      /* Strip trailing punctuation — let transliteration work with commas, periods, etc. */
      const punctuationMatch = currentWord.match(/^([a-zA-Z]+)([,.\-;:!?।\u0964\u0965'"()]+)$/);
      const cleanWord = punctuationMatch ? punctuationMatch[1] : currentWord;
      trailingPunctuation = punctuationMatch ? punctuationMatch[2] : '';

      if (/^[a-zA-Z]+$/.test(cleanWord)) {
        wordBuffer = cleanWord;
        updateSuggestions(cleanWord);
      } else {
        wordBuffer = "";
        trailingPunctuation = '';
        hideSuggestions();
      }
    });

    const PUNCTUATION_KEYS = { ',': 1, '.': 1, ';': 1, ':': 1, '!': 1, '?': 1, '-': 1, "'": 1, '"': 1, '(': 1, ')': 1 };

    inputEl.addEventListener("keydown", function(e) {
      if (!globalBengaliKeyboardEnabled) return;

      /* Bengali digit conversion — type 0-9, get ০-৯. A digit ends
         the Latin word in progress (typing a digit clearly switches
         intent away from the suggestion in flight), so we dismiss
         the dropdown without picking and insert the Bengali digit
         at the cursor. e.preventDefault() stops the browser from
         inserting the Latin digit. */
      if (e.key && e.key.length === 1 && e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        hideSuggestions();
        wordBuffer = '';
        trailingPunctuation = '';
        const cursorOffsetForDigit = getElementCursorOffset(inputEl);
        replaceCharRangeWithText(inputEl, cursorOffsetForDigit, cursorOffsetForDigit, BENGALI_DIGIT_BY_LATIN_INDEX[parseInt(e.key, 10)]);
        return;
      }

      // Space or punctuation — auto-pick best suggestion then let punctuation through
      if ((e.key === " " || PUNCTUATION_KEYS[e.key]) && wordBuffer.length > 0 && bestSuggestion) {
        if (e.key === ' ') {
          e.preventDefault();
          pickSuggestion(bestSuggestion);
        } else {
          /* Punctuation: pick suggestion, let the punctuation character be typed naturally */
          trailingPunctuation = '';
          replaceCharRangeWithText(inputEl, wordStart, wordStart + wordBuffer.length, bestSuggestion);
          wordBuffer = '';
          hideSuggestions();
          inputEl.dispatchEvent(new Event('bangla-input-change', { bubbles: true }));
          /* Let the punctuation key event continue naturally */
        }
        return;
      }

      if (!suggestBox || suggestBox.style.display === "none") {
        // Enter with buffer — flush with Avro fallback
        if (e.key === "Enter" && wordBuffer.length > 0 && avroAvailable) {
          const fb = OmicronLab.Avro.Phonetic.parse(wordBuffer);
          if (fb) {
            e.preventDefault();
            pickSuggestion(fb);
          }
        }
        return;
      }

      const items = suggestBox.querySelectorAll(".bangla-input-item");
      const active = suggestBox.querySelector(".bangla-input-item[data-active]");
      const activeIdx = active ? parseInt(active.getAttribute("data-index")) : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(activeIdx + 1, items.length - 1);
        clearActive();
        items[next].setAttribute("data-active", "1");
        items[next].setAttribute('aria-selected', 'true');
        items[next].style.background = "#4a6fa5";
        items[next].style.color = "#fff";
        items[next].style.fontWeight = "600";
        bestSuggestion = items[next].textContent;
        try { inputEl.setAttribute('aria-activedescendant', items[next].id); } catch (ariaError) {}
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const previous = Math.max(activeIdx - 1, 0);
        clearActive();
        items[previous].setAttribute("data-active", "1");
        items[previous].setAttribute('aria-selected', 'true');
        items[previous].style.background = "#4a6fa5";
        items[previous].style.color = "#fff";
        items[previous].style.fontWeight = "600";
        bestSuggestion = items[previous].textContent;
        try { inputEl.setAttribute('aria-activedescendant', items[previous].id); } catch (ariaError) {}
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickSuggestion(active ? active.textContent : (items.length > 0 ? items[0].textContent : bestSuggestion));
      } else if (e.key === "Escape") {
        hideSuggestions();
      }
    });

    inputEl.addEventListener("blur", function() {
      setTimeout(hideSuggestions, 200);
    });
  }

  // ---- Public API ----
  return {
    attach: function(inputEl, options) {
      if (!inputEl || inputEl.getAttribute('data-bangla-attached') === '1') return;
      inputEl.setAttribute('data-bangla-attached', '1');
      loadDictionary(function() {
        attach(inputEl, options);
      });
    },
    setEnabled: function(enabled) {
      globalBengaliKeyboardEnabled = !!enabled;
      try { localStorage.setItem('bangla_input_enabled', globalBengaliKeyboardEnabled ? 'true' : 'false'); } catch (storageError) {}
    },
    isEnabled: function() {
      return globalBengaliKeyboardEnabled;
    }
  };
})();

// ---- Global header toggle listener ----
// Works on every page — syncs header বাংলা/English radio with BanglaInput
(function() {
  const headerRadios = document.querySelectorAll('input[name="form_lang"]');
  if (!headerRadios.length) return;
  headerRadios.forEach(function(radio) {
    radio.addEventListener('change', function() {
      if (typeof BanglaInput !== 'undefined' && BanglaInput.setEnabled) {
        BanglaInput.setEnabled(this.value === 'bn');
      }
    });
  });
  // Sync header radio to match saved preference on page load
  const savedEnabled = typeof BanglaInput !== 'undefined' && BanglaInput.isEnabled();
  const targetRadio = document.getElementById(savedEnabled ? 'form-lang-bn' : 'form-lang-en');
  if (targetRadio && !targetRadio.checked) {
    targetRadio.checked = true;
  }
})();

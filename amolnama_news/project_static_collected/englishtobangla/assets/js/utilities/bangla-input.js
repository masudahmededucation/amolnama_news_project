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

  // ---- Load dictionary ----
  function loadDictionary(cb) {
    if (dictionary) { cb(); return; }
    dictCallbacks.push(cb);
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
        dictCallbacks.forEach(function(fn) { fn(); });
        dictCallbacks = [];
      })
      .catch(function() {
        // Dictionary failed — Avro phonetic still works as fallback
        dictionary = {};
        dictCallbacks.forEach(function(fn) { fn(); });
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
        let idx = binarySearchPrefix(bp);
        if (idx === -1) continue;
        for (let j = idx; j < allWords.length && j < idx + 100 && candidates.length < 6; j++) {
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
  let DICT_KEYS_SORTED = []; // sorted by length desc for greedy match
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

  // ---- Attach to an input element ----
  function attach(inputEl, options) {
    if (!inputEl) return;
    options = options || {};

    let suggestBox = null;
    let wordBuffer = "";
    let wordStart = 0;
    let bestSuggestion = "";
    let trailingPunctuation = "";

    // Create suggest dropdown
    function ensureSuggestBox() {
      if (suggestBox) return;
      suggestBox = document.createElement("div");
      suggestBox.className = "bangla-input-suggest";
      suggestBox.style.cssText = "display:none;position:absolute;z-index:200;background:#fff;border:1.5px solid #d4d4de;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);max-width:320px;min-width:160px;overflow:hidden;";
      const parent = inputEl.parentNode;
      if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
      parent.appendChild(suggestBox);
    }

    function hideSuggestions() {
      if (suggestBox) suggestBox.style.display = "none";
      bestSuggestion = "";
    }

    function showSuggestions(suggestions) {
      ensureSuggestBox();
      if (!suggestions || suggestions.length === 0) { hideSuggestions(); return; }
      bestSuggestion = suggestions[0];

      const html = suggestions.map(function(s, i) {
        const sel = i === 0
          ? ' data-active="1" style="padding:.4rem .7rem;font-size:.88rem;cursor:pointer;border-bottom:1px solid #f0f0f0;background:#4a6fa5;color:#fff;font-weight:600;"'
          : ' style="padding:.4rem .7rem;font-size:.88rem;cursor:pointer;border-bottom:1px solid #f0f0f0;"';
        return '<div class="bangla-input-item" data-idx="' + i + '"' + sel + '>' + s + '</div>';
      }).join("");
      suggestBox.innerHTML = html;
      suggestBox.style.display = "block";

      suggestBox.querySelectorAll(".bangla-input-item").forEach(function(el) {
        el.addEventListener("mousedown", function(e) {
          e.preventDefault();
          pickSuggestion(el.textContent);
        });
        el.addEventListener("mouseenter", function() {
          clearActive();
          el.setAttribute("data-active", "1");
          el.style.background = "#4a6fa5";
          el.style.color = "#fff";
          el.style.fontWeight = "600";
          bestSuggestion = el.textContent;
        });
      });
    }

    function clearActive() {
      if (!suggestBox) return;
      suggestBox.querySelectorAll(".bangla-input-item").forEach(function(el) {
        el.removeAttribute("data-active");
        el.style.background = "";
        el.style.color = "";
        el.style.fontWeight = "";
      });
    }

    function pickSuggestion(bangla) {
      let val = inputEl.value;
      let before = val.substring(0, wordStart);
      const replaceLength = wordBuffer.length + trailingPunctuation.length;
      let after = val.substring(wordStart + replaceLength);
      const insertText = bangla + trailingPunctuation + ' ';
      inputEl.value = before + insertText + after;
      let newPos = before.length + insertText.length;
      inputEl.setSelectionRange(newPos, newPos);
      inputEl.focus();
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
      let val = inputEl.value;
      const cursor = inputEl.selectionStart;
      const textUpToCursor = val.substring(0, cursor);
      const lastSpace = textUpToCursor.lastIndexOf(" ");
      wordStart = lastSpace + 1;
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
      // Space or punctuation — auto-pick best suggestion then let punctuation through
      if ((e.key === " " || PUNCTUATION_KEYS[e.key]) && wordBuffer.length > 0 && bestSuggestion) {
        if (e.key === ' ') {
          e.preventDefault();
          pickSuggestion(bestSuggestion);
        } else {
          /* Punctuation: pick suggestion, let the punctuation character be typed naturally */
          trailingPunctuation = '';
          const val = inputEl.value;
          const before = val.substring(0, wordStart);
          const after = val.substring(wordStart + wordBuffer.length);
          inputEl.value = before + bestSuggestion + after;
          const newPos = before.length + bestSuggestion.length;
          inputEl.setSelectionRange(newPos, newPos);
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
      const activeIdx = active ? parseInt(active.getAttribute("data-idx")) : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(activeIdx + 1, items.length - 1);
        clearActive();
        items[next].setAttribute("data-active", "1");
        items[next].style.background = "#4a6fa5";
        items[next].style.color = "#fff";
        items[next].style.fontWeight = "600";
        bestSuggestion = items[next].textContent;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(activeIdx - 1, 0);
        clearActive();
        items[prev].setAttribute("data-active", "1");
        items[prev].style.background = "#4a6fa5";
        items[prev].style.color = "#fff";
        items[prev].style.fontWeight = "600";
        bestSuggestion = items[prev].textContent;
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

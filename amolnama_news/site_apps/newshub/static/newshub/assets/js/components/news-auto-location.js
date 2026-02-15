/**
 * news-auto-location.js
 *
 * Auto-detects location names by scanning the content body textarea and
 * selects the matching district / constituency / upazila / union parishad
 * in the sidebar location widget.
 *
 * Data strategy:
 *   Fetches ALL districts, upazilas, and union parishads from
 *   /newshub/api/locations/all/ (with hierarchy links).
 *   Can detect any level directly from content and infer the parent:
 *     - Upazila mentioned → infer district from upazila.district_id
 *     - Union parishad mentioned → infer upazila → infer district
 *   Constituencies are matched from cascade-loaded options (after district set).
 *
 * Matching strategy — two-pass (exact first, then fuzzy):
 *   Pass 1 (exact): full name appears as substring in raw content text.
 *     Handles hyphenated names like "কক্সবাজার-১" and inflected forms.
 *   Pass 2 (fuzzy): word-start matching (same as news-auto-tag.js).
 *     Bengali: "ঢাকা" matches "ঢাকায়", "ঢাকার", "ঢাকাতে" (startsWith)
 *     English: case-insensitive startsWith
 *
 * Manual override protection:
 *   A single userOverride flag. Once the user physically touches ANY location
 *   select (mousedown/keydown → change), auto-detect stops entirely.
 *   No fighting — manual always wins, permanently for the session.
 *
 * DOM dependencies:
 *   #news-content-body-bn      — content body textarea
 *   #news-district-id          — district select
 *   #news-constituency-id      — constituency select (cascade-populated)
 *   #news-upazila-id           — upazila select (cascade-populated)
 *   #news-union-parishad-id    — union parishad select (cascade-populated)
 *
 * API endpoint:
 *   GET /newshub/api/locations/all/ →
 *     { districts: [{id, name_bn, name_en}],
 *       upazilas:  [{id, name_bn, name_en, district_id}],
 *       union_parishads: [{id, name_bn, name_en, upazila_id}] }
 *
 * Requires: news-location-cascade.js (must load first for cascade listeners)
 */
(function () {
  var contentBody = document.getElementById('news-content-body-bn');
  var districtSelect = document.getElementById('news-district-id');
  var constituencySelect = document.getElementById('news-constituency-id');
  var upazilaSelect = document.getElementById('news-upazila-id');
  var unionSelect = document.getElementById('news-union-parishad-id');

  if (!contentBody || !districtSelect) return;

  /* ---- Constants ---- */
  var AUTO_LOC_DELAY = 20000;      /* 20s debounce while typing */
  var INITIAL_SCAN_DELAY = 3000;   /* 3s for form-persist restore */
  var MIN_WORD_LEN = 2;
  var WORD_SPLIT_RE = /[\s,।.!?;:'"()\[\]{}\-–—\u0964\u0965]+/;

  var autoLocTimer = null;

  /* ---- Location data from API ---- */
  var allDistricts = [];       /* [{ id, name_bn, name_en }] */
  var allUpazilas = [];        /* [{ id, name_bn, name_en, district_id }] */
  var allUnions = [];          /* [{ id, name_bn, name_en, upazila_id }] */
  var upazilaByDistrict = {};  /* district_id → [upazila, ...] */
  var unionByUpazila = {};     /* upazila_id → [union, ...] */
  var upazilaIndex = {};       /* upazila_id → upazila object (for reverse lookup) */
  var dataFetched = false;

  /* ---- Manual override: single flag for the entire location section ----
   * Once the user physically touches ANY location select, auto-detect stops
   * entirely. mousedown/keydown fire only on real user interaction (not on
   * programmatic dispatchEvent), so form-persist restore and cascade resets
   * do not trigger the override. */
  var userOverride = false;
  var pendingInteraction = false;

  function trackManualOverride(selectEl) {
    if (!selectEl) return;

    /* mousedown/keydown = real user interaction */
    selectEl.addEventListener('mousedown', function () {
      pendingInteraction = true;
    });
    selectEl.addEventListener('keydown', function () {
      pendingInteraction = true;
    });
    /* On change after real interaction → permanent override */
    selectEl.addEventListener('change', function () {
      if (pendingInteraction) {
        pendingInteraction = false;
        userOverride = true;
      }
    });
  }

  trackManualOverride(districtSelect);
  trackManualOverride(constituencySelect);
  trackManualOverride(upazilaSelect);
  trackManualOverride(unionSelect);

  /* ---- Fetch all locations from API, build indexes ---- */
  function fetchAllLocations(callback) {
    if (dataFetched) { callback(); return; }

    fetch('/newshub/api/locations/all/')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allDistricts = data.districts || [];
        allUpazilas = data.upazilas || [];
        allUnions = data.union_parishads || [];

        /* Build indexes */
        allUpazilas.forEach(function (u) {
          if (!upazilaByDistrict[u.district_id]) upazilaByDistrict[u.district_id] = [];
          upazilaByDistrict[u.district_id].push(u);
          upazilaIndex[u.id] = u;
        });
        allUnions.forEach(function (up) {
          if (!unionByUpazila[up.upazila_id]) unionByUpazila[up.upazila_id] = [];
          unionByUpazila[up.upazila_id].push(up);
        });

        dataFetched = true;
        callback();
      })
      .catch(function () {
        /* API failed — fall back to district-only detection from DOM */
        buildDistrictDataFromDOM();
        dataFetched = true;
        callback();
      });
  }

  /* ---- Fallback: build district data from <option> elements ---- */
  function buildDistrictDataFromDOM() {
    if (allDistricts.length > 0) return;
    var options = districtSelect.options;
    for (var i = 0; i < options.length; i++) {
      var opt = options[i];
      if (!opt.value) continue;
      var text = opt.textContent.trim();
      var name_bn = text;
      var name_en = '';
      var parenIdx = text.indexOf('(');
      if (parenIdx !== -1) {
        name_bn = text.substring(0, parenIdx).trim();
        var closeIdx = text.lastIndexOf(')');
        if (closeIdx > parenIdx) name_en = text.substring(parenIdx + 1, closeIdx).trim();
      }
      allDistricts.push({ id: parseInt(opt.value, 10), name_bn: name_bn, name_en: name_en });
    }
  }

  /* ---- Word splitting ---- */
  function splitWords(text) {
    return text.split(WORD_SPLIT_RE).filter(function (w) {
      return w.length >= MIN_WORD_LEN;
    });
  }

  /* ---- Bengali suffix stripping ----
   * Common case-marker suffixes that attach to location names.
   * Ordered longest-first to avoid partial stripping.
   *   -তেই  (emphatic locative)    -তেও  (inclusive locative)
   *   -য়ে  (locative)             -ের   (possessive)
   *   -এর  (possessive alt)       -তে   (locative)
   *   -কে  (accusative)           -য়   (locative)
   *   -র   (possessive vowel)     -ে    (locative)
   */
  var BN_SUFFIXES = [
    '\u09A4\u09C7\u0987',     /* তেই */
    '\u09A4\u09C7\u0993',     /* তেও */
    '\u09AF\u09BC\u09C7',     /* য়ে  */
    '\u09C7\u09B0',           /* ের  */
    '\u098F\u09B0',           /* এর  */
    '\u09A4\u09C7',           /* তে  */
    '\u0995\u09C7',           /* কে  */
    '\u09AF\u09BC',           /* য়  */
    '\u09B0',                 /* র   */
    '\u09C7'                  /* ে   */
  ];

  function stripBnSuffix(word) {
    for (var i = 0; i < BN_SUFFIXES.length; i++) {
      var sfx = BN_SUFFIXES[i];
      /* Remaining word after stripping must be >= MIN_WORD_LEN */
      if (word.length >= sfx.length + MIN_WORD_LEN
          && word.substring(word.length - sfx.length) === sfx) {
        return word.substring(0, word.length - sfx.length);
      }
    }
    return word;
  }

  /* ---- Suffix-stripped matching (Bengali) ----
   * For each location-name word, check content words:
   *   1. Exact match (content word === name word)
   *   2. Suffix-stripped match (strip suffix, then exact)
   * ALL name words must match. */
  function matchBn(locationName, contentWords) {
    if (!locationName || locationName.length < MIN_WORD_LEN) return false;
    var nameWords = locationName.split(/\s+/).filter(function (w) { return w.length >= MIN_WORD_LEN; });
    if (nameWords.length === 0) return false;

    for (var i = 0; i < nameWords.length; i++) {
      var nw = nameWords[i];
      var found = false;
      for (var j = 0; j < contentWords.length; j++) {
        var cw = contentWords[j];
        /* Exact match */
        if (cw === nw) { found = true; break; }
        /* Suffix-stripped match */
        if (stripBnSuffix(cw) === nw) { found = true; break; }
      }
      if (!found) return false;
    }
    return true;
  }

  /* ---- Word-start matching (English, case-insensitive) ---- */
  function matchEn(locationName, contentWordsLower) {
    if (!locationName || locationName.length < MIN_WORD_LEN) return false;
    var nameWords = locationName.toLowerCase().split(/\s+/).filter(function (w) { return w.length >= MIN_WORD_LEN; });
    if (nameWords.length === 0) return false;

    for (var i = 0; i < nameWords.length; i++) {
      var nw = nameWords[i];
      var found = false;
      for (var j = 0; j < contentWordsLower.length; j++) {
        if (contentWordsLower[j].indexOf(nw) === 0) { /* startsWith */
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  /* ---- Word-boundary check for exact substring matches ----
   * Prevents false positives like "দুল্লা" matching inside "আব্দুল্লাহ".
   * A match is valid only if it starts at position 0 or is preceded by
   * whitespace / punctuation (i.e., a real word boundary). */
  var BOUNDARY_RE = /[\s,।.!?;:'"()\[\]{}\-–—\u0964\u0965]/;

  function isWordBoundary(text, pos) {
    return pos === 0 || BOUNDARY_RE.test(text.charAt(pos - 1));
  }

  /* ---- Exact substring match against raw (unsplit) text ---- */
  function matchExactBn(name, rawText) {
    if (!name || name.length < MIN_WORD_LEN) return false;
    var pos = 0;
    while (true) {
      var idx = rawText.indexOf(name, pos);
      if (idx === -1) return false;
      if (isWordBoundary(rawText, idx)) return true;
      pos = idx + 1;
    }
  }

  function matchExactEn(name, rawTextLower) {
    if (!name || name.length < MIN_WORD_LEN) return false;
    var nameLower = name.toLowerCase();
    var pos = 0;
    while (true) {
      var idx = rawTextLower.indexOf(nameLower, pos);
      if (idx === -1) return false;
      if (isWordBoundary(rawTextLower, idx)) return true;
      pos = idx + 1;
    }
  }

  /* ---- Two-pass find: exact substring first, then fuzzy word-start ---- */
  function findMatch(items, rawText, rawTextLower, contentWords, contentWordsLower) {
    var i;
    /* Pass 1: exact substring in raw text */
    for (i = 0; i < items.length; i++) {
      if (matchExactBn(items[i].name_bn, rawText)) return items[i];
      if (matchExactEn(items[i].name_en, rawTextLower)) return items[i];
    }
    /* Pass 2: fuzzy word-start match */
    for (i = 0; i < items.length; i++) {
      if (matchBn(items[i].name_bn, contentWords)) return items[i];
      if (matchEn(items[i].name_en, contentWordsLower)) return items[i];
    }
    return null;
  }

  /* ---- Poll until a select has options loaded (max 5s) ---- */
  function waitForOptions(selectEl, callback) {
    var attempts = 0;
    var interval = setInterval(function () {
      attempts++;
      if (selectEl.options.length > 1 || attempts > 50) { /* 50 × 100ms = 5s */
        clearInterval(interval);
        if (selectEl.options.length > 1) callback();
      }
    }, 100);
  }

  /* ---- Set a select value and dispatch change (for cascade) ---- */
  function setSelectValue(selectEl, value) {
    if (!selectEl) return;
    selectEl.value = String(value);
    selectEl.dispatchEvent(new Event('change'));
  }

  /* ---- Parse name_bn and name_en from option text "bn (en) — area" ---- */
  function parseOptionNames(text) {
    var name_bn = text;
    var name_en = '';
    var parenIdx = text.indexOf('(');
    if (parenIdx !== -1) {
      name_bn = text.substring(0, parenIdx).trim();
      var closeIdx = text.indexOf(')', parenIdx);
      if (closeIdx > parenIdx) name_en = text.substring(parenIdx + 1, closeIdx).trim();
    }
    return { name_bn: name_bn, name_en: name_en };
  }

  /* ---- Match constituency from cascade-loaded options (two-pass) ---- */
  function matchConstituencyFromOptions(rawText, rawTextLower, contentWords, contentWordsLower) {
    if (!constituencySelect || constituencySelect.value) return;
    if (constituencySelect.options.length <= 1) return;

    var options = constituencySelect.options;
    var i, opt, text, parsed;

    /* Pass 1: exact substring match against raw text */
    for (i = 0; i < options.length; i++) {
      opt = options[i];
      if (!opt.value) continue;
      text = opt.textContent.trim();
      parsed = parseOptionNames(text);

      if (matchExactBn(parsed.name_bn, rawText)) { constituencySelect.value = opt.value; return; }
      if (matchExactEn(parsed.name_en, rawTextLower)) { constituencySelect.value = opt.value; return; }
    }

    /* Pass 2: fuzzy word-start match (name + area names) */
    for (i = 0; i < options.length; i++) {
      opt = options[i];
      if (!opt.value) continue;
      text = opt.textContent.trim();
      parsed = parseOptionNames(text);

      if (matchBn(parsed.name_bn, contentWords)) { constituencySelect.value = opt.value; return; }
      if (matchEn(parsed.name_en, contentWordsLower)) { constituencySelect.value = opt.value; return; }

      /* Also check area names after em-dash (comma-separated) */
      var dashIdx = text.indexOf('\u2014');
      if (dashIdx !== -1) {
        var areaText = text.substring(dashIdx + 1).trim();
        var areaNames = areaText.split(WORD_SPLIT_RE).filter(function (w) { return w.length >= MIN_WORD_LEN; });
        for (var j = 0; j < areaNames.length; j++) {
          if (matchBn(areaNames[j], contentWords)) { constituencySelect.value = opt.value; return; }
        }
      }
    }
  }

  /* ---- Track what was auto-filled so we can reset when content is cleared ---- */
  var autoFilledDistrict = false;

  function resetAutoLocation() {
    if (!autoFilledDistrict) return;
    autoFilledDistrict = false;
    districtSelect.value = '';
    districtSelect.dispatchEvent(new Event('change')); /* cascade clears sub-selects */
  }

  /* ---- Core scan function ---- */
  function scanAndAutoLocate() {
    if (userOverride) return;

    var text = contentBody.value;

    /* If content is emptied, reset auto-filled locations */
    if (!text || text.trim().length < 5) {
      resetAutoLocation();
      return;
    }

    var rawText = text;
    var rawTextLower = text.toLowerCase();

    fetchAllLocations(function () {
      if (userOverride) return; /* re-check after async fetch */

      var contentWords = splitWords(rawText);
      var contentWordsLower = splitWords(rawTextLower);

      /* --- Determine district, upazila, union from content --- */
      var detectedDistrictId = null;
      var detectedUpazilaId = null;
      var detectedUnionId = null;

      /* Try matching a union parishad (most specific → infer upazila → district) */
      var matchedUnion = findMatch(allUnions, rawText, rawTextLower, contentWords, contentWordsLower);
      if (matchedUnion) {
        detectedUnionId = matchedUnion.id;
        detectedUpazilaId = matchedUnion.upazila_id;
        var parentUpazila = upazilaIndex[matchedUnion.upazila_id];
        if (parentUpazila) detectedDistrictId = parentUpazila.district_id;
      }

      /* Try matching an upazila (infer district) */
      if (!detectedUpazilaId) {
        var matchedUpazila = findMatch(allUpazilas, rawText, rawTextLower, contentWords, contentWordsLower);
        if (matchedUpazila) {
          detectedUpazilaId = matchedUpazila.id;
          detectedDistrictId = matchedUpazila.district_id;
        }
      }

      /* Try matching a district directly */
      if (!detectedDistrictId) {
        var matchedDistrict = findMatch(allDistricts, rawText, rawTextLower, contentWords, contentWordsLower);
        if (matchedDistrict) detectedDistrictId = matchedDistrict.id;
      }

      /* Also check: if district matched, try to find upazila within that district */
      if (detectedDistrictId && !detectedUpazilaId) {
        var districtUpazilas = upazilaByDistrict[detectedDistrictId] || [];
        var matchedInDistrict = findMatch(districtUpazilas, rawText, rawTextLower, contentWords, contentWordsLower);
        if (matchedInDistrict) detectedUpazilaId = matchedInDistrict.id;
      }

      /* Also check: if upazila matched, try to find union within that upazila */
      if (detectedUpazilaId && !detectedUnionId) {
        var upazilaUnions = unionByUpazila[detectedUpazilaId] || [];
        var matchedInUpazila = findMatch(upazilaUnions, rawText, rawTextLower, contentWords, contentWordsLower);
        if (matchedInUpazila) detectedUnionId = matchedInUpazila.id;
      }

      /* --- Apply detected values to the form --- */
      if (!detectedDistrictId) return; /* nothing to do */

      /* District */
      if (!districtSelect.value) {
        setSelectValue(districtSelect, detectedDistrictId);
        autoFilledDistrict = true;
      } else if (String(districtSelect.value) !== String(detectedDistrictId)) {
        /* District already set to a different value — don't fight */
        return;
      }
      /* else: district already set to this same value — continue to sub-locations */

      /* Constituency — match from cascade-loaded options (two-pass) */
      if (constituencySelect && !constituencySelect.value) {
        waitForOptions(constituencySelect, function () {
          if (userOverride) return;
          matchConstituencyFromOptions(rawText, rawTextLower, contentWords, contentWordsLower);
        });
      }

      /* Upazila */
      if (detectedUpazilaId && upazilaSelect && !upazilaSelect.value) {
        waitForOptions(upazilaSelect, function () {
          if (userOverride) return;
          setSelectValue(upazilaSelect, detectedUpazilaId);

          /* Union Parishad */
          if (detectedUnionId && unionSelect && !unionSelect.value) {
            waitForOptions(unionSelect, function () {
              if (userOverride) return;
              unionSelect.value = String(detectedUnionId);
            });
          }
        });
      }
    });
  }

  /* ---- Event: debounced scan while typing (20s) ---- */
  contentBody.addEventListener('input', function () {
    clearTimeout(autoLocTimer);
    autoLocTimer = setTimeout(scanAndAutoLocate, AUTO_LOC_DELAY);
  });

  /* ---- Event: immediate scan when user leaves the textarea ---- */
  contentBody.addEventListener('blur', function () {
    clearTimeout(autoLocTimer);
    scanAndAutoLocate();
  });

  /* ---- Initial scan after 3s (catches content restored by news-form-persist.js) ---- */
  setTimeout(function () {
    if (contentBody.value && contentBody.value.length >= 5) {
      scanAndAutoLocate();
    }
  }, INITIAL_SCAN_DELAY);

  /* ---- Public API for other scripts (e.g. news-form-clear.js) ---- */
  window.newshubAutoLocation = {
    /** reset() — clear internal state so auto-detect can run fresh */
    reset: function () {
      userOverride = false;
      autoFilledDistrict = false;
      clearTimeout(autoLocTimer);
    }
  };
})();

/**
 * news-auto-tag.js
 *
 * Auto-suggests tags by scanning the content body textarea for tag name matches.
 * Fetches ALL tags from /newshub/api/tags/all/ (ref_news_category_tag table).
 * Uses a 20-second debounce while typing, plus scans on blur and initial page load.
 * Relies on window.newshubTags API exposed by news-category-tag-cascade.js.
 *
 * Matching strategy — word-start matching:
 *   - Split tag name into words (e.g. "সন্ত্রাসী হামলা" → ["সন্ত্রাসী", "হামলা"])
 *   - Split content body into words (by whitespace and punctuation)
 *   - Each tag word must appear at the START of at least one content word
 *   - Bengali: "হামলা" matches content word "হামলায়" (startsWith ✓)
 *   - Bengali: "রায়" does NOT match content word "মারায়" (startsWith ✗)
 *   - English: case-insensitive startsWith
 *   - ALL words in the tag name must match
 *   - Skips tag words shorter than 2 characters
 *   - Respects manual removals — won't re-add a tag the user explicitly removed
 *
 * DOM dependencies:
 *   #news-content-body-bn — the content body textarea
 *
 * API endpoint:
 *   GET /newshub/api/tags/all/ → { tags: [{ id, name_bn, name_en }, ...] }
 *
 * Requires: news-category-tag-cascade.js (must load first for window.newshubTags)
 */
(function () {
  var api = window.newshubTags;
  if (!api) return;

  var AUTO_TAG_DELAY = 20000; // 20 seconds debounce while typing
  var INITIAL_SCAN_DELAY = 2000; // 2s delay for initial scan (wait for form-persist restore)
  var MIN_WORD_LEN = 2;
  var autoTagTimer = null;

  var allTags = [];      // fetched from API
  var tagsFetched = false;

  var contentBody = document.getElementById('news-content-body-bn');
  if (!contentBody) return;

  /* Regex to split content into words — whitespace + common Bengali/English punctuation */
  var WORD_SPLIT_RE = /[\s,।.!?;:'"()\[\]{}\-–—\u0964\u0965]+/;

  /* ---- fetchAllTags(callback) — fetch all tags from API, cache result ---- */
  function fetchAllTags(callback) {
    if (tagsFetched) {
      callback(allTags);
      return;
    }

    fetch('/newshub/api/tags/all/')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allTags = data.tags || [];
        tagsFetched = true;
        callback(allTags);
      })
      .catch(function () {
        /* Fallback: try embedded JSON if API fails */
        var el = document.getElementById('all-tags-data');
        if (el) {
          try {
            allTags = JSON.parse(el.textContent);
            tagsFetched = true;
          } catch (e) { /* ignore */ }
        }
        callback(allTags);
      });
  }

  /* ---- splitWords() — split text into words array, filter short ones ---- */
  function splitWords(text) {
    return text.split(WORD_SPLIT_RE).filter(function (w) {
      return w.length >= MIN_WORD_LEN;
    });
  }

  /* ---- matchBn() — each tag word must startsWith at least one content word ---- */
  function matchBn(tagName, contentWords) {
    if (!tagName || tagName.length < MIN_WORD_LEN) return false;

    var tagWords = tagName.split(/\s+/).filter(function (w) { return w.length >= MIN_WORD_LEN; });
    if (tagWords.length === 0) return false;

    for (var i = 0; i < tagWords.length; i++) {
      var tw = tagWords[i];
      var found = false;
      for (var j = 0; j < contentWords.length; j++) {
        if (contentWords[j].indexOf(tw) === 0) { // startsWith
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  /* ---- matchEn() — case-insensitive, each tag word must startsWith a content word ---- */
  function matchEn(tagName, contentWordsLower) {
    if (!tagName || tagName.length < MIN_WORD_LEN) return false;

    var tagWords = tagName.toLowerCase().split(/\s+/).filter(function (w) { return w.length >= MIN_WORD_LEN; });
    if (tagWords.length === 0) return false;

    for (var i = 0; i < tagWords.length; i++) {
      var tw = tagWords[i];
      var found = false;
      for (var j = 0; j < contentWordsLower.length; j++) {
        if (contentWordsLower[j].indexOf(tw) === 0) { // startsWith
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  /* ---- scanAndAutoTag() — fetch tags then match against content body words ---- */
  function scanAndAutoTag() {
    var text = contentBody.value;
    if (!text || text.length < 5) return;

    fetchAllTags(function (tags) {
      if (tags.length === 0) return;

      /* Pre-split content into words once (used by all tag comparisons) */
      var contentWords = splitWords(text);
      var contentWordsLower = splitWords(text.toLowerCase());
      var changed = false;

      tags.forEach(function (tag) {
        var id = String(tag.id);

        /* Skip if already selected or manually removed by user */
        if (api.isSelected(id) || api.isRemovedByUser(id)) return;

        /* Bengali name (news_tag_name_bn) — word-start match */
        if (tag.name_bn && matchBn(tag.name_bn, contentWords)) {
          if (api.add(tag)) changed = true;
          return;
        }

        /* English name (news_tag_name_en) — case-insensitive word-start match */
        if (tag.name_en && matchEn(tag.name_en, contentWordsLower)) {
          if (api.add(tag)) changed = true;
          return;
        }
      });

      if (changed) {
        api.save();
        api.render();
      }
    });
  }

  /* ---- Event: debounced scan while typing (20s) ---- */
  contentBody.addEventListener('input', function () {
    clearTimeout(autoTagTimer);
    autoTagTimer = setTimeout(scanAndAutoTag, AUTO_TAG_DELAY);
  });

  /* ---- Event: immediate scan when user leaves the textarea ---- */
  contentBody.addEventListener('blur', function () {
    clearTimeout(autoTagTimer);
    scanAndAutoTag();
  });

  /* ---- Initial scan after short delay (catches content restored by news-form-persist.js) ---- */
  setTimeout(function () {
    if (contentBody.value && contentBody.value.length >= 5) {
      scanAndAutoTag();
    }
  }, INITIAL_SCAN_DELAY);
})();

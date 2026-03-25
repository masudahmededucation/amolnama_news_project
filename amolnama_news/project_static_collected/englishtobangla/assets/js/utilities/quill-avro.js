/**
 * quill-avro.js — Avro phonetic Bengali typing inside Quill rich text editor.
 *
 * Usage: QuillAvro.attach(quillInstance)
 * Requires: avro-phonetic.js + bangla-input.js loaded (for dictionary).
 *
 * When Bengali mode is active (QuillAvro.setEnabled(true)):
 *   - Type English letters → Avro transliterates → suggestion dropdown appears
 *   - Space = auto-pick best suggestion
 *   - Arrow Up/Down = browse alternatives
 *   - Enter/Tab = pick selected
 *   - Escape = dismiss
 *
 * Rich text formatting works normally — bold, italic, color, etc.
 */
var QuillAvro = (function () {
  'use strict';

  var enabled = false;
  var instances = [];

  /* ---- Avro + Dictionary (reuse from BanglaInput internals) ---- */

  var avroAvailable = typeof OmicronLab !== 'undefined' && OmicronLab.Avro && OmicronLab.Avro.Phonetic;
  var dictionary = null;
  var dictLoading = false;
  var dictCallbacks = [];
  var wordIndex = {};

  var BN_SUFFIXES = ['র', 'ে', 'ের', 'তে', 'দের', 'কে', 'য়', 'ই', 'ও', 'তা', 'না', 'লা', 'গুলো', 'সব', 'টা', 'টি'];

  function loadDictionary(callback) {
    if (dictionary) { callback(); return; }
    dictCallbacks.push(callback);
    if (dictLoading) return;
    dictLoading = true;

    var scripts = document.querySelectorAll("script[src*='bangla-input']");
    var base = '';
    if (scripts.length > 0) {
      base = scripts[0].src.replace(/\/js\/utilities\/bangla-input\.js.*$/, '/js/utilities/');
    }

    fetch(base + 'bangla-dictionary.json', { cache: 'force-cache' })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        dictionary = data;
        buildWordIndex();
        dictCallbacks.forEach(function (fn) { fn(); });
        dictCallbacks = [];
      })
      .catch(function () {
        dictCallbacks = [];
      });
  }

  function buildWordIndex() {
    if (!dictionary) return;
    wordIndex = {};
    for (var i = 0; i < dictionary.length; i++) {
      var firstChar = dictionary[i].charAt(0);
      if (!wordIndex[firstChar]) wordIndex[firstChar] = [];
      wordIndex[firstChar].push(dictionary[i]);
    }
  }

  function lookupWords(englishText) {
    if (!avroAvailable || !dictionary) return [];
    var avroResult = OmicronLab.Avro.Phonetic.parse(englishText);
    if (!avroResult) return [];

    var candidates = [];
    var found = {};
    found[avroResult] = true;
    candidates.push(avroResult);

    var dictWords = wordIndex[avroResult.charAt(0)] || [];
    for (var prefixLength = Math.min(avroResult.length, 4); prefixLength >= 1; prefixLength--) {
      var bengaliPrefix = avroResult.substring(0, prefixLength);
      for (var i = 0; i < dictWords.length; i++) {
        if (dictWords[i].length < 2) continue;
        if (!dictWords[i].startsWith(bengaliPrefix)) continue;
        if (Math.abs(dictWords[i].length - avroResult.length) <= 2 && !found[dictWords[i]]) {
          found[dictWords[i]] = true;
          candidates.push(dictWords[i]);
        }
        for (var s = 0; s < BN_SUFFIXES.length && candidates.length < 10; s++) {
          var combined = dictWords[i] + BN_SUFFIXES[s];
          if (!found[combined] && combined.length >= 2 && Math.abs(combined.length - avroResult.length) <= 1) {
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
    return candidates.slice(0, 6);
  }

  /* ---- Suggestion Dropdown ---- */

  function createSuggestionBox() {
    var box = document.createElement('div');
    box.className = 'quill-avro-suggestions';
    box.style.cssText = 'position:absolute;z-index:9999;background:#fff;border:1px solid #ccc;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:280px;display:none;font-family:"Noto Sans Bengali",sans-serif;';
    document.body.appendChild(box);
    return box;
  }

  /* ---- Per-Quill Instance ---- */

  function attachToQuill(quill) {
    var suggestBox = createSuggestionBox();
    var wordBuffer = '';
    var wordStartIndex = 0;  // Quill index where the English word starts
    var bestSuggestion = '';
    var suggestTimer = null;
    var suggestCache = {};

    function hideSuggestions() {
      suggestBox.style.display = 'none';
      wordBuffer = '';
    }

    function showSuggestions(suggestions) {
      if (!suggestions || suggestions.length === 0) { hideSuggestions(); return; }
      bestSuggestion = suggestions[0];

      var html = suggestions.map(function (suggestion, index) {
        var activeStyle = index === 0
          ? ' data-active="1" style="padding:.35rem .65rem;font-size:.85rem;cursor:pointer;border-bottom:1px solid #f0f0f0;background:#4a6fa5;color:#fff;font-weight:600;"'
          : ' style="padding:.35rem .65rem;font-size:.85rem;cursor:pointer;border-bottom:1px solid #f0f0f0;"';
        return '<div class="quill-avro-item" data-index="' + index + '"' + activeStyle + '>' + suggestion + '</div>';
      }).join('');

      suggestBox.innerHTML = html;
      suggestBox.style.display = 'block';

      /* Position near cursor */
      var selection = quill.getSelection();
      if (selection) {
        var bounds = quill.getBounds(selection.index);
        var editorRect = quill.container.getBoundingClientRect();
        suggestBox.style.left = (editorRect.left + bounds.left + window.scrollX) + 'px';
        suggestBox.style.top = (editorRect.top + bounds.bottom + window.scrollY + 4) + 'px';
      }

      /* Click handlers */
      suggestBox.querySelectorAll('.quill-avro-item').forEach(function (item) {
        item.addEventListener('mousedown', function (event) {
          event.preventDefault();
          pickSuggestion(item.textContent);
        });
        item.addEventListener('mouseenter', function () {
          clearActive();
          item.setAttribute('data-active', '1');
          item.style.background = '#4a6fa5';
          item.style.color = '#fff';
          item.style.fontWeight = '600';
          bestSuggestion = item.textContent;
        });
      });
    }

    function clearActive() {
      suggestBox.querySelectorAll('.quill-avro-item').forEach(function (item) {
        item.removeAttribute('data-active');
        item.style.background = '';
        item.style.color = '';
        item.style.fontWeight = '';
      });
    }

    function pickSuggestion(bengaliText) {
      /* Replace the English word in Quill with Bengali text + space */
      var currentFormat = quill.getFormat(wordStartIndex);
      quill.deleteText(wordStartIndex, wordBuffer.length);
      quill.insertText(wordStartIndex, bengaliText + ' ', currentFormat);
      quill.setSelection(wordStartIndex + bengaliText.length + 1);
      wordBuffer = '';
      hideSuggestions();
    }

    function updateSuggestions(englishText) {
      clearTimeout(suggestTimer);
      if (!englishText || englishText.length < 1) { hideSuggestions(); return; }

      var offlineResults = lookupWords(englishText);
      if (offlineResults.length > 0) {
        if (suggestCache[englishText]) {
          showSuggestions(mergeResults(suggestCache[englishText], offlineResults));
        } else {
          showSuggestions(offlineResults);
        }
      }

      if (englishText.length >= 2) {
        suggestTimer = setTimeout(function () {
          fetch('/tools/api/transliterate/?text=' + encodeURIComponent(englishText))
            .then(function (response) { return response.json(); })
            .then(function (data) {
              var googleResults = data.suggestions || [];
              if (googleResults.length > 0) {
                suggestCache[englishText] = googleResults;
                if (wordBuffer === englishText) {
                  showSuggestions(mergeResults(googleResults, offlineResults));
                }
              }
            })
            .catch(function () {});
        }, 150);
      }
    }

    function mergeResults(googleResults, offlineResults) {
      var merged = [];
      for (var i = 0; i < googleResults.length && merged.length < 6; i++) {
        if (googleResults[i].length >= 2 && merged.indexOf(googleResults[i]) === -1) merged.push(googleResults[i]);
      }
      for (var j = 0; j < offlineResults.length && merged.length < 6; j++) {
        if (offlineResults[j].length >= 2 && merged.indexOf(offlineResults[j]) === -1) merged.push(offlineResults[j]);
      }
      return merged;
    }

    /* ---- Quill event handlers ---- */

    quill.on('text-change', function (delta, oldDelta, source) {
      if (!enabled || source !== 'user') return;

      var selection = quill.getSelection();
      if (!selection) return;

      var cursorIndex = selection.index;
      var fullText = quill.getText();
      var textUpToCursor = fullText.substring(0, cursorIndex);

      /* Find the current English word being typed */
      var lastSpace = textUpToCursor.lastIndexOf(' ');
      var lastNewline = textUpToCursor.lastIndexOf('\n');
      var wordStart = Math.max(lastSpace, lastNewline) + 1;
      var currentWord = textUpToCursor.substring(wordStart);

      if (/^[a-zA-Z]+$/.test(currentWord)) {
        wordBuffer = currentWord;
        wordStartIndex = wordStart;
        updateSuggestions(currentWord);
      } else {
        wordBuffer = '';
        hideSuggestions();
      }
    });

    /* Keyboard handling — must use native DOM event on Quill's editor */
    var editorElement = quill.root;
    editorElement.addEventListener('keydown', function (event) {
      if (!enabled) return;

      /* Space — auto-pick best suggestion */
      if (event.key === ' ' && wordBuffer.length > 0 && bestSuggestion) {
        event.preventDefault();
        pickSuggestion(bestSuggestion);
        return;
      }

      if (suggestBox.style.display === 'none') {
        /* Enter with buffer — flush with Avro fallback */
        if (event.key === 'Enter' && wordBuffer.length > 0 && avroAvailable) {
          var fallback = OmicronLab.Avro.Phonetic.parse(wordBuffer);
          if (fallback) {
            event.preventDefault();
            pickSuggestion(fallback);
          }
        }
        return;
      }

      var items = suggestBox.querySelectorAll('.quill-avro-item');
      var activeItem = suggestBox.querySelector('.quill-avro-item[data-active]');
      var activeIndex = activeItem ? parseInt(activeItem.getAttribute('data-index')) : -1;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        var nextIndex = Math.min(activeIndex + 1, items.length - 1);
        clearActive();
        items[nextIndex].setAttribute('data-active', '1');
        items[nextIndex].style.background = '#4a6fa5';
        items[nextIndex].style.color = '#fff';
        items[nextIndex].style.fontWeight = '600';
        bestSuggestion = items[nextIndex].textContent;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        var previousIndex = Math.max(activeIndex - 1, 0);
        clearActive();
        items[previousIndex].setAttribute('data-active', '1');
        items[previousIndex].style.background = '#4a6fa5';
        items[previousIndex].style.color = '#fff';
        items[previousIndex].style.fontWeight = '600';
        bestSuggestion = items[previousIndex].textContent;
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pickSuggestion(activeItem ? activeItem.textContent : (items.length > 0 ? items[0].textContent : bestSuggestion));
      } else if (event.key === 'Escape') {
        hideSuggestions();
      }
    });

    editorElement.addEventListener('blur', function () {
      setTimeout(hideSuggestions, 200);
    });

    instances.push({ quill: quill, suggestBox: suggestBox, hideSuggestions: hideSuggestions });
  }

  /* ---- Public API ---- */

  return {
    attach: function (quillInstance) {
      if (!quillInstance) return;
      loadDictionary(function () {
        attachToQuill(quillInstance);
      });
    },
    setEnabled: function (isEnabled) {
      enabled = isEnabled;
      if (!enabled) {
        /* Hide all suggestion boxes when disabled */
        instances.forEach(function (instance) {
          instance.hideSuggestions();
        });
      }
    },
    isEnabled: function () {
      return enabled;
    },
  };
})();

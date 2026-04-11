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
const QuillAvro = (function () {
  'use strict';

  let enabled = false;
  const instances = [];

  /* ---- Avro + Dictionary (reuse from BanglaInput internals) ---- */

  const avroAvailable = typeof OmicronLab !== 'undefined' && OmicronLab.Avro && OmicronLab.Avro.Phonetic;
  let dictionary = null;
  let dictLoading = false;
  let dictCallbacks = [];
  let wordIndex = {};

  const BN_SUFFIXES = ['র', 'ে', 'ের', 'তে', 'দের', 'কে', 'য়', 'ই', 'ও', 'তা', 'না', 'লা', 'গুলো', 'সব', 'টা', 'টি'];

  function loadDictionary(callback) {
    if (dictionary) { callback(); return; }
    dictCallbacks.push(callback);
    if (dictLoading) return;
    dictLoading = true;

    const scripts = document.querySelectorAll("script[src*='bangla-input']");
    let base = '';
    if (scripts.length > 0) {
      base = scripts[0].src.replace(/\/js\/utilities\/bangla-input\.js.*$/, '/js/utilities/');
    }

    fetch(base + 'bangla-dictionary.json', { cache: 'force-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        dictionary = data;
        buildWordIndex();
        dictCallbacks.forEach(function (callback) { callback(); });
        dictCallbacks = [];
      })
      .catch(function () {
        dictCallbacks = [];
      });
  }

  function buildWordIndex() {
    if (!dictionary) return;
    wordIndex = {};
    for (let i = 0; i < dictionary.length; i++) {
      const firstChar = dictionary[i].charAt(0);
      if (!wordIndex[firstChar]) wordIndex[firstChar] = [];
      wordIndex[firstChar].push(dictionary[i]);
    }
  }

  function lookupWords(englishText) {
    if (!avroAvailable || !dictionary) return [];
    const avroResult = OmicronLab.Avro.Phonetic.parse(englishText);
    if (!avroResult) return [];

    const candidates = [];
    const found = {};
    found[avroResult] = true;
    candidates.push(avroResult);

    const dictWords = wordIndex[avroResult.charAt(0)] || [];
    for (let prefixLength = Math.min(avroResult.length, 4); prefixLength >= 1; prefixLength--) {
      const bengaliPrefix = avroResult.substring(0, prefixLength);
      for (let i = 0; i < dictWords.length; i++) {
        if (dictWords[i].length < 2) continue;
        if (!dictWords[i].startsWith(bengaliPrefix)) continue;
        if (Math.abs(dictWords[i].length - avroResult.length) <= 2 && !found[dictWords[i]]) {
          found[dictWords[i]] = true;
          candidates.push(dictWords[i]);
        }
        for (let s = 0; s < BN_SUFFIXES.length && candidates.length < 10; s++) {
          const combined = dictWords[i] + BN_SUFFIXES[s];
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
    const box = document.createElement('div');
    box.className = 'quill-avro-suggestions';
    box.style.cssText = 'position:absolute;z-index:9999;background:#fff;border:1px solid #ccc;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:280px;display:none;font-family:"Noto Sans Bengali",sans-serif;';
    document.body.appendChild(box);
    return box;
  }

  /* ---- Per-Quill Instance ---- */

  function attachToQuill(quill) {
    const suggestBox = createSuggestionBox();
    let wordBuffer = '';
    let wordStartIndex = 0;  // Quill index where the English word starts
    let bestSuggestion = '';
    let suggestTimer = null;
    const suggestCache = {};

    function hideSuggestions() {
      suggestBox.style.display = 'none';
      wordBuffer = '';
    }

    function showSuggestions(suggestions) {
      if (!suggestions || suggestions.length === 0) { hideSuggestions(); return; }
      bestSuggestion = suggestions[0];

      const html = suggestions.map(function (suggestion, index) {
        const activeStyle = index === 0
          ? ' data-active="1" style="padding:.35rem .65rem;font-size:.85rem;cursor:pointer;border-bottom:1px solid #f0f0f0;background:#4a6fa5;color:#fff;font-weight:600;"'
          : ' style="padding:.35rem .65rem;font-size:.85rem;cursor:pointer;border-bottom:1px solid #f0f0f0;"';
        return '<div class="quill-avro-item" data-index="' + index + '"' + activeStyle + '>' + suggestion + '</div>';
      }).join('');

      suggestBox.innerHTML = html;
      suggestBox.style.display = 'block';

      /* Position near cursor */
      let selection = quill.getSelection();
      if (selection) {
        const bounds = quill.getBounds(selection.index);
        const editorRect = quill.container.getBoundingClientRect();
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
      const currentFormat = quill.getFormat(wordStartIndex);
      quill.deleteText(wordStartIndex, wordBuffer.length);
      quill.insertText(wordStartIndex, bengaliText + ' ', currentFormat);
      quill.setSelection(wordStartIndex + bengaliText.length + 1);
      wordBuffer = '';
      hideSuggestions();
    }

    function updateSuggestions(englishText) {
      clearTimeout(suggestTimer);
      if (!englishText || englishText.length < 1) { hideSuggestions(); return; }

      const offlineResults = lookupWords(englishText);
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
            .then(function (response) {
              if (!response.ok) throw new Error('HTTP ' + response.status);
              return response.json();
            })
            .then(function (data) {
              const googleResults = data.suggestions || [];
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
      const merged = [];
      for (let i = 0; i < googleResults.length && merged.length < 6; i++) {
        if (googleResults[i].length >= 2 && merged.indexOf(googleResults[i]) === -1) merged.push(googleResults[i]);
      }
      for (let j = 0; j < offlineResults.length && merged.length < 6; j++) {
        if (offlineResults[j].length >= 2 && merged.indexOf(offlineResults[j]) === -1) merged.push(offlineResults[j]);
      }
      return merged;
    }

    /* ---- Quill event handlers ---- */

    quill.on('text-change', function (delta, oldDelta, source) {
      if (!enabled || source !== 'user') return;

      const selection = quill.getSelection();
      if (!selection) return;

      const cursorIndex = selection.index;
      const fullText = quill.getText();
      const textUpToCursor = fullText.substring(0, cursorIndex);

      /* Find the current English word being typed */
      const lastSpace = textUpToCursor.lastIndexOf(' ');
      const lastNewline = textUpToCursor.lastIndexOf('\n');
      const wordStart = Math.max(lastSpace, lastNewline) + 1;
      const currentWord = textUpToCursor.substring(wordStart);

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
    const editorElement = quill.root;
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
          const fallback = OmicronLab.Avro.Phonetic.parse(wordBuffer);
          if (fallback) {
            event.preventDefault();
            pickSuggestion(fallback);
          }
        }
        return;
      }

      const items = suggestBox.querySelectorAll('.quill-avro-item');
      const activeItem = suggestBox.querySelector('.quill-avro-item[data-active]');
      const activeIndex = activeItem ? parseInt(activeItem.getAttribute('data-index')) : -1;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = Math.min(activeIndex + 1, items.length - 1);
        clearActive();
        items[nextIndex].setAttribute('data-active', '1');
        items[nextIndex].style.background = '#4a6fa5';
        items[nextIndex].style.color = '#fff';
        items[nextIndex].style.fontWeight = '600';
        bestSuggestion = items[nextIndex].textContent;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const previousIndex = Math.max(activeIndex - 1, 0);
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

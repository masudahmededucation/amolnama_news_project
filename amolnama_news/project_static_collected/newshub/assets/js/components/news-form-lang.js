/**
 * news-form-lang.js
 * Global form language toggle — loaded on every page via core/base.html.
 *
 * Behaviour:
 *   - Reads initial language from the checked input[name="form_lang"] radio
 *     (rendered in header_auth_controls.html from UserProfile.language_pref).
 *   - applyLanguage(lang) swaps:
 *       [data-bn] / [data-en]       → label / heading text
 *       [data-ph-bn] / [data-ph-en] → input placeholder text
 *   - On toggle change → apply + AJAX POST to /account/api/language-pref/
 *     (CSRF read from cookie — works on all pages without a form).
 *   - Also sets data-lang on form.news-multistep-form if present on page.
 *
 * Exposes: window.newshubFormLang = { apply: fn, current: fn }
 *
 * DOM dependencies:
 *   input[name="form_lang"]           — toggle radio buttons (in header)
 */
(function () {
  'use strict';

  /* ========== Detect initial language from toggle state ========== */

  var radios = document.querySelectorAll('input[name="form_lang"]');
  // Prefer localStorage (client-side preference) over server-rendered radio (always defaults to bn)
  var savedBanglaPreference = null;
  try { savedBanglaPreference = localStorage.getItem('bangla_input_enabled'); } catch (storageError) {}
  var currentLang = 'bn';
  if (savedBanglaPreference !== null) {
    currentLang = savedBanglaPreference === 'true' ? 'bn' : 'en';
  } else {
    for (var r = 0; r < radios.length; r++) {
      if (radios[r].checked) { currentLang = radios[r].value; break; }
    }
  }
  if (currentLang !== 'en') currentLang = 'bn';

  /* ========== Apply language to all labelled elements ========== */

  /* Save original mixed text as data-bn for elements that only have data-en */
  var defaultsSaved = false;
  function saveDefaults() {
    if (defaultsSaved) return;
    defaultsSaved = true;
    try {
      document.querySelectorAll('[data-en]:not([data-bn])').forEach(function (el) {
        var textOnly = '';
        for (var c = 0; c < el.childNodes.length; c++) {
          if (el.childNodes[c].nodeType === Node.TEXT_NODE) textOnly += el.childNodes[c].textContent;
        }
        el.setAttribute('data-bn', textOnly.trim());
      });
      document.querySelectorAll('[data-ph-en]:not([data-ph-bn])').forEach(function (el) {
        el.setAttribute('data-ph-bn', el.placeholder || '');
      });
    } catch (e) { /* prevent breaking other scripts */ }
  }

  function applyLanguage(lang) {
    if (lang !== 'bn' && lang !== 'en') return;
    saveDefaults();

    /* Static labels, headings, option text — only elements with BOTH data-bn AND data-en */
    var labelled = document.querySelectorAll('[data-bn][data-en]');
    for (var i = 0; i < labelled.length; i++) {
      var el = labelled[i];
      var text = el.getAttribute('data-' + lang);
      if (text !== null) {
        /* Preserve non-text child nodes (e.g. .field-mandatory-star spans, checkboxes) */
        var kids = Array.prototype.slice.call(el.childNodes).filter(function (n) {
          return n.nodeType !== Node.TEXT_NODE;
        });
        el.textContent = text;
        kids.forEach(function (k) { el.appendChild(k); });
      }
    }

    /* Input / textarea placeholders */
    var inputs = document.querySelectorAll('[data-ph-bn][data-ph-en]');
    for (var j = 0; j < inputs.length; j++) {
      var ph = inputs[j].getAttribute('data-ph-' + lang);
      if (ph !== null) inputs[j].placeholder = ph;
    }

    currentLang = lang;

    /* Set data-lang on body */
    document.body.setAttribute('data-lang', lang);

    /* Toggle lang-field-bn / lang-field-en visibility */
    var bnFields = document.querySelectorAll('.lang-field-bn, .lang-inline-bn');
    var enFields = document.querySelectorAll('.lang-field-en, .lang-inline-en');
    for (var b = 0; b < bnFields.length; b++) {
      bnFields[b].classList.toggle('lang-hidden', lang !== 'bn');
    }
    for (var e = 0; e < enFields.length; e++) {
      enFields[e].classList.toggle('lang-hidden', lang !== 'en');
    }

    /* Keep toggle radios in sync */
    for (var k = 0; k < radios.length; k++) {
      radios[k].checked = (radios[k].value === lang);
    }

    /* Update data-lang on the multistep form if present on this page */
    var form = document.querySelector('form.news-multistep-form');
    if (form) form.setAttribute('data-lang', lang);
  }

  /* ========== CSRF from cookie (works on all pages) ========== */

  function getCsrfToken() {
    var match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? match[1] : '';
  }

  /* ========== AJAX save ========== */

  function saveLangPref(lang) {
    var csrf = getCsrfToken();
    if (!csrf) return;
    var body = new URLSearchParams();
    body.append('lang', lang);
    fetch('/account/api/language-pref/', {
      method: 'POST',
      headers: { 'X-CSRFToken': csrf },
      body: body,
    });
  }

  /* ========== Toggle event listeners ========== */

  for (var lr = 0; lr < radios.length; lr++) {
    radios[lr].addEventListener('change', function () {
      applyLanguage(this.value);
      saveLangPref(this.value);
    });
  }

  /* ========== Initial apply ========== */

  applyLanguage(currentLang);

  /* BanglaInput auto-attach moved to englishtobangla/bangla-input-auto-attach.js (global, modularised) */

  /* ========== QuillAvro — Bengali typing directly inside Quill ========== */

  function attachQuillAvro() {
    if (typeof QuillAvro === 'undefined') {
      setTimeout(attachQuillAvro, 300);
      return;
    }
    /* Attach to all known Quill editors */
    var quillKeys = ['__quillNewsSummary', '__quillNewsBody', '__quillShortDesc', '__quillDesc'];
    for (var qi = 0; qi < quillKeys.length; qi++) {
      var editor = window[quillKeys[qi]];
      if (editor && editor.quill && !editor.quill.__avroAttached) {
        QuillAvro.attach(editor.quill);
        editor.quill.__avroAttached = true;
      }
    }
    /* Enable/disable based on current language */
    QuillAvro.setEnabled(currentLang === 'bn');
  }

  setTimeout(attachQuillAvro, 600);

  /* Hook language toggle → enable/disable QuillAvro */
  var originalApplyForQuill = applyLanguage;
  applyLanguage = function (lang) {
    originalApplyForQuill(lang);
    currentLang = lang;
    if (typeof BanglaInput !== 'undefined' && BanglaInput.setEnabled) {
      BanglaInput.setEnabled(lang === 'bn');
    }
    if (typeof QuillAvro !== 'undefined') {
      QuillAvro.setEnabled(lang === 'bn');
    }
  };

  /* ========== Public API ========== */

  window.newshubFormLang = {
    apply: applyLanguage,
    current: function () { return currentLang; },
  };

})();

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
  var currentLang = 'bn';
  for (var r = 0; r < radios.length; r++) {
    if (radios[r].checked) { currentLang = radios[r].value; break; }
  }
  if (currentLang !== 'en') currentLang = 'bn';

  /* ========== Apply language to all labelled elements ========== */

  function applyLanguage(lang) {
    if (lang !== 'bn' && lang !== 'en') return;

    /* Static labels, headings, option text */
    var labelled = document.querySelectorAll('[data-bn][data-en]');
    for (var i = 0; i < labelled.length; i++) {
      var el = labelled[i];
      var text = el.getAttribute('data-' + lang);
      if (text !== null) {
        /* Preserve non-text child nodes (e.g. .field-mandatory-star spans) */
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

  /* ========== BanglaInput auto-attach to ALL text fields ========== */

  var banglaAttached = new WeakSet();

  // Fields to SKIP — search boxes handled separately, date/number/email/url fields
  var SKIP_TYPES = { date: 1, number: 1, email: 1, url: 1, password: 1, hidden: 1, file: 1 };

  function attachBanglaInput() {
    if (typeof BanglaInput === 'undefined') return;
    // All text inputs and textareas on the page
    var fields = document.querySelectorAll('input[type="text"], textarea');
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      // Skip if already attached
      if (banglaAttached.has(el)) continue;
      // Skip English-only fields (id/name contains _en but not _bn)
      var id = (el.id || '').toLowerCase();
      var name = (el.name || '').toLowerCase();
      if ((id.indexOf('-en') > -1 || name.indexOf('_en') > -1) &&
          id.indexOf('-bn') === -1 && name.indexOf('_bn') === -1) continue;
      // Skip fields explicitly marked as no-transliterate
      if (el.hasAttribute('data-no-bangla')) continue;
      // Skip search inputs that already have BanglaInput (e.g. poem search)
      if (el.hasAttribute('data-bangla-attached')) continue;

      banglaAttached.add(el);
      el.setAttribute('data-bangla-attached', '1');
      BanglaInput.attach(el);
    }
  }

  // Attach on initial load
  setTimeout(attachBanglaInput, 300);

  // Re-attach when DOM changes (dynamic cards, new form sections)
  var observer = new MutationObserver(function () {
    attachBanglaInput();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  /* ========== Public API ========== */

  window.newshubFormLang = {
    apply: applyLanguage,
    current: function () { return currentLang; },
    attachBangla: attachBanglaInput,
  };

})();

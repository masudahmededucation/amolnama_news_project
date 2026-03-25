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

  /* ========== BanglaInput auto-attach to ALL text fields ========== */

  var banglaAttached = new WeakSet();

  // Fields to SKIP — search boxes handled separately, date/number/email/url fields
  var SKIP_TYPES = { date: 1, number: 1, email: 1, url: 1, password: 1, hidden: 1, file: 1 };

  function attachBanglaInput() {
    if (typeof BanglaInput === 'undefined') {
      setTimeout(attachBanglaInput, 300);
      return;
    }
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

  // Re-attach when DOM changes (debounced to prevent excessive calls)
  var mutationTimer = null;
  var observer = new MutationObserver(function () {
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(function () {
      try { attachBanglaInput(); } catch (e) { /* ignore */ }
    }, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

  /* ========== Quill ↔ Bengali textarea swap on language toggle ========== */

  var quillBanglaOverlays = [];  // track created overlays

  function setupQuillBanglaOverlay(quillContainerId, quillWindowKey) {
    var quillContainer = document.getElementById(quillContainerId);
    if (!quillContainer) return;

    // Create the Bengali typing textarea overlay
    var overlay = document.createElement('textarea');
    overlay.className = 'quill-bangla-overlay';
    overlay.id = quillContainerId + '-bangla-overlay';
    overlay.name = quillContainerId + '_bangla_overlay';
    overlay.placeholder = 'বাংলায় টাইপ করুন — Avro ফোনেটিক (Type in Bengali)';
    overlay.style.display = 'none';
    overlay.style.width = '100%';
    overlay.style.minHeight = '150px';
    overlay.style.padding = '.6rem';
    overlay.style.fontSize = '.9rem';
    overlay.style.lineHeight = '1.7';
    overlay.style.border = '1.5px solid var(--border)';
    overlay.style.borderRadius = '6px';
    overlay.style.resize = 'vertical';
    overlay.style.fontFamily = "'Noto Sans Bengali', sans-serif";
    quillContainer.parentNode.insertBefore(overlay, quillContainer.nextSibling);

    quillBanglaOverlays.push({
      quillContainerId: quillContainerId,
      quillWindowKey: quillWindowKey,
      overlay: overlay,
      quillContainer: quillContainer,
    });
  }

  function switchQuillMode(lang) {
    for (var i = 0; i < quillBanglaOverlays.length; i++) {
      var item = quillBanglaOverlays[i];
      var quillEditor = window[item.quillWindowKey];

      if (lang === 'bn') {
        // Bengali mode: copy Quill text → textarea, hide Quill, show textarea
        if (quillEditor && quillEditor.quill) {
          item.overlay.value = quillEditor.quill.getText().trim();
        }
        item.quillContainer.style.display = 'none';
        // Also hide the Quill toolbar
        var toolbar = item.quillContainer.previousElementSibling;
        if (toolbar && toolbar.classList.contains('ql-toolbar')) {
          toolbar.style.display = 'none';
        }
        item.overlay.style.display = 'block';
        // Attach BanglaInput
        if (typeof BanglaInput !== 'undefined' && !item.overlay.getAttribute('data-bangla-attached')) {
          BanglaInput.attach(item.overlay);
          item.overlay.setAttribute('data-bangla-attached', '1');
        }
      } else {
        // English mode: copy textarea text → Quill, hide textarea, show Quill
        if (item.overlay.value.trim() && quillEditor && quillEditor.quill) {
          // Preserve existing Quill content if textarea was edited
          var currentQuillText = quillEditor.quill.getText().trim();
          var overlayText = item.overlay.value.trim();
          if (overlayText !== currentQuillText && overlayText) {
            quillEditor.quill.setText(overlayText);
            quillEditor.syncToHidden();
          }
        }
        item.overlay.style.display = 'none';
        item.quillContainer.style.display = '';
        var toolbar2 = item.quillContainer.previousElementSibling;
        if (toolbar2 && toolbar2.classList.contains('ql-toolbar')) {
          toolbar2.style.display = '';
        }
      }
    }
  }

  // Sync overlay → Quill before form submit (in case user submits while in Bengali mode)
  var forms = document.querySelectorAll('form');
  for (var fi = 0; fi < forms.length; fi++) {
    forms[fi].addEventListener('submit', function () {
      if (currentLang === 'bn') {
        switchQuillMode('en');  // copy overlay text into Quill + sync to hidden textarea
      }
    });
  }

  // Setup overlays for known Quill editors (if they exist on the page)
  setTimeout(function () {
    setupQuillBanglaOverlay('quill-news-summary', '__quillNewsSummary');
    setupQuillBanglaOverlay('quill-news-body', '__quillNewsBody');
    // Also for bangladesh travel hub Quill editors
    setupQuillBanglaOverlay('quill-short-desc', '__quillShortDesc');
    setupQuillBanglaOverlay('quill-desc', '__quillDesc');

    // Apply initial mode
    if (currentLang === 'bn') {
      switchQuillMode('bn');
    }
  }, 500);

  // Hook into language toggle
  var originalApply = applyLanguage;
  applyLanguage = function (lang) {
    originalApply(lang);
    currentLang = lang;
    switchQuillMode(lang);
  };

  /* ========== Public API ========== */

  window.newshubFormLang = {
    apply: applyLanguage,
    current: function () { return currentLang; },
    attachBangla: attachBanglaInput,
  };

})();

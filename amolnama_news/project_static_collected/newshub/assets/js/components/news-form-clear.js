/**
 * news-form-clear.js
 * "Clear Form" button — resets all form fields, cascade selects,
 * selected tags, file attachments, auto-location state, and localStorage draft.
 *
 * DOM dependency:
 *   #news-clear-form-btn — the clear button
 *   .news-collection-form — the form element
 *
 * Requires (loaded before this script):
 *   news-category-tag-cascade.js  → window.newshubTags.clearAll()
 *   news-auto-location.js         → window.newshubAutoLocation.reset()
 *   news-attachment-upload.js      → window.newshubAttachments.reset()
 */
(function () {
  var btn = document.getElementById('news-clear-form-btn');
  var form = document.querySelector('.news-collection-form');
  if (!btn || !form) return;

  /* Inline confirmation message element */
  var msgEl = document.createElement('span');
  msgEl.className = 'clear-form-msg';
  msgEl.style.display = 'none';
  btn.parentNode.insertBefore(msgEl, btn);

  var confirmTimer = null;
  var awaitingConfirm = false;

  btn.addEventListener('click', function () {
    /* First click — show inline confirmation, wait for second click */
    if (!awaitingConfirm) {
      awaitingConfirm = true;
      btn.textContent = '\u09B9\u09CD\u09AF\u09BE\u0981, \u09AE\u09C1\u099B\u09C1\u09A8 (Yes, Clear)';
      btn.classList.add('btn-clear-form-confirm');
      msgEl.textContent = '\u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4? (Sure?)';
      msgEl.style.display = '';
      /* Auto-revert after 4 seconds if no second click */
      confirmTimer = setTimeout(function () {
        awaitingConfirm = false;
        btn.textContent = '\u09A4\u09A5\u09CD\u09AF \u09AE\u09C1\u099B\u09C1\u09A8 (Clear Form)';
        btn.classList.remove('btn-clear-form-confirm');
        msgEl.style.display = 'none';
      }, 4000);
      return;
    }

    /* Second click — confirmed, proceed with clearing */
    awaitingConfirm = false;
    clearTimeout(confirmTimer);
    btn.textContent = '\u09A4\u09A5\u09CD\u09AF \u09AE\u09C1\u099B\u09C1\u09A8 (Clear Form)';
    btn.classList.remove('btn-clear-form-confirm');
    msgEl.textContent = '\u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 (Cleared!)';
    msgEl.style.display = '';
    setTimeout(function () { msgEl.style.display = 'none'; }, 3000);

    /* 1. Clear all form controls via form.elements (works even with display:contents) */
    var elements = form.elements;
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var type = el.type;
      if (el.name === 'csrfmiddlewaretoken') continue;
      if (type === 'submit' || type === 'button') continue;

      if (type === 'radio' || type === 'checkbox') {
        el.checked = false;
      } else if (type === 'file') {
        /* skip — handled by newshubAttachments.reset() */
      } else if (type === 'select-one' || type === 'select-multiple') {
        el.selectedIndex = 0;
      } else {
        /* text, email, tel, url, number, textarea, hidden */
        el.value = '';
      }
    }

    /* 5. Reset occurrence time custom selects (not inside form.elements) */
    ['occ-date', 'occ-hour', 'occ-minute'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var occPeriod = document.getElementById('occ-period');
    if (occPeriod) occPeriod.selectedIndex = 0;

    /* 6. Reset location cascade selects to placeholder-only state */
    var constSel = document.getElementById('news-constituency-id');
    var upazilaSel = document.getElementById('news-upazila-id');
    var unionSel = document.getElementById('news-union-parishad-id');
    if (constSel) constSel.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u099C\u09C7\u09B2\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
    if (upazilaSel) upazilaSel.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u099C\u09C7\u09B2\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
    if (unionSel) unionSel.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u0989\u09AA\u099C\u09C7\u09B2\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';

    /* 8. Reset organisation cascade */
    var orgNameSel = document.getElementById('contributor-organization');
    if (orgNameSel) orgNameSel.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A4\u09BF\u09B7\u09CD\u09A0\u09BE\u09A8\u09C7\u09B0 \u09A8\u09BE\u09AE (\u0990\u099A\u09CD\u099B\u09BF\u0995) --</option>';

    /* 8b. Reset Tom Select instances (district + category) */
    ['news-district-id', 'news-category-id'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.tomselect) el.tomselect.clear(true);
    });

    /* 9. Clear tags via exposed API */
    if (window.newshubTags && window.newshubTags.clearAll) {
      window.newshubTags.clearAll();
    }

    /* 10. Reset auto-location state */
    if (window.newshubAutoLocation && window.newshubAutoLocation.reset) {
      window.newshubAutoLocation.reset();
    }

    /* 11. Clear file attachments via exposed API */
    if (window.newshubAttachments && window.newshubAttachments.reset) {
      window.newshubAttachments.reset();
    }

    /* 12. Clear localStorage drafts */
    localStorage.removeItem('newshub_draft');
    localStorage.removeItem('newshub_draft_tags');

    /* 13. Clear any validation warnings */
    var warnings = form.querySelectorAll('.field-warning');
    for (var m = 0; m < warnings.length; m++) {
      warnings[m].style.display = 'none';
    }
    var shakes = form.querySelectorAll('.field-shake');
    for (var n = 0; n < shakes.length; n++) {
      shakes[n].classList.remove('field-shake');
    }

    /* 14. Clear social URL mismatch warning */
    var socialWarn = document.querySelector('.social-url-mismatch');
    if (socialWarn) socialWarn.style.display = 'none';
  });
})();

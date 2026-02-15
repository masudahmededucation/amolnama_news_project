/**
 * news-form-persist.js
 * Auto-saves ALL form data to localStorage so it survives refresh, login/signup.
 * Restores saved data on page load, including all cascading selects.
 *
 * Cascade restore order:
 *   1. Simple fields (text, textarea, non-cascade selects, checkboxes)
 *   2. Occurrence time (setAttribute so MutationObserver fires)
 *   3. Organisation type → wait → organisation name
 *   4. District → wait → constituency + upazila → wait → union parishad
 *   5. Category radio → tags (restored by news-category-tag-cascade.js)
 *
 * Save is blocked during restore (isRestoring flag) to prevent async cascade
 * fetches from overwriting saved values with empty strings.
 */
(function () {
  var STORAGE_KEY = 'newshub_draft';
  var SKIP_NAMES = ['csrfmiddlewaretoken', 'tag_ids'];
  var form = document.querySelector('.news-collection-form');
  if (!form) return;

  /* --- If submission succeeded, clear draft but keep save listeners active --- */
  var isSuccessPage = !!document.querySelector('.form-message-success');
  if (isSuccessPage) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('newshub_draft_tags');
  }

  /* ========== SAVE ========== */

  var saveTimer = null;
  var isRestoring = false; // blocks saves during restore to prevent race conditions

  function saveDraft() {
    if (isRestoring) return;

    var data = {};
    var elements = form.querySelectorAll('input, select, textarea');

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var name = el.name;
      if (!name || SKIP_NAMES.indexOf(name) !== -1) continue;
      if (el.type === 'file') continue;

      if (el.type === 'radio') {
        if (el.checked) data[name] = el.value;
      } else if (el.type === 'checkbox') {
        data[name] = el.checked ? '1' : '';
      } else {
        data[name] = el.value;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function debouncedSave() {
    if (isRestoring) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 400);
  }

  form.addEventListener('input', debouncedSave);
  form.addEventListener('change', debouncedSave);

  /* ========== RESTORE ========== */

  var raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  var saved;
  try { saved = JSON.parse(raw); } catch (e) { return; }
  if (!saved || typeof saved !== 'object') return;

  /* Block saves while restoring — async cascade fetches would otherwise
     overwrite saved values (e.g. constituency_id) with empty strings */
  isRestoring = true;

  /* Fields restored via cascade (skip in the simple loop) */
  var CASCADE = [
    'district_id', 'constituency_id', 'upazila_id', 'union_parishad_id',
    'news_category_id',
    'organisation_type_id', 'contributor_organization_id',
    'occurrence_at',
  ];

  /* 1. Restore simple fields */
  Object.keys(saved).forEach(function (name) {
    if (CASCADE.indexOf(name) !== -1) return;

    var els = form.querySelectorAll('[name="' + name + '"]');
    if (!els.length) return;

    var el = els[0];
    if (el.type === 'radio') {
      for (var i = 0; i < els.length; i++) {
        els[i].checked = (els[i].value === saved[name]);
      }
    } else if (el.type === 'checkbox') {
      el.checked = saved[name] === '1';
    } else {
      el.value = saved[name];
    }
  });

  /* 1b. Re-trigger contributor type so Self hide/show logic runs with restored value */
  var ctypeSelect = document.getElementById('contributor-type');
  if (ctypeSelect && saved.contributor_type_id) {
    ctypeSelect.dispatchEvent(new Event('change'));
  }

  /* 2. Occurrence time — setAttribute so MutationObserver in occurrence-time.js fires */
  var occHidden = document.getElementById('news-occurrence-at');
  if (occHidden && saved.occurrence_at) {
    occHidden.setAttribute('value', saved.occurrence_at);
  }

  /* 3. Organisation type → org name cascade */
  var orgTypeSel = document.getElementById('contributor-org-type');
  var orgNameSel = document.getElementById('contributor-organization');

  if (orgTypeSel && saved.organisation_type_id) {
    orgTypeSel.value = saved.organisation_type_id;
    orgTypeSel.dispatchEvent(new Event('change'));

    if (saved.contributor_organization_id) {
      waitForOptions(orgNameSel, function () {
        orgNameSel.value = saved.contributor_organization_id;
      });
    }
  }

  /* 4. Location cascade: district → constituency + upazila → union parishad */
  var districtSel = document.getElementById('news-district-id');
  var constSel = document.getElementById('news-constituency-id');
  var upazilaSel = document.getElementById('news-upazila-id');
  var unionSel = document.getElementById('news-union-parishad-id');

  if (districtSel && saved.district_id) {
    districtSel.value = saved.district_id;
    if (districtSel.tomselect) {
      districtSel.tomselect.setValue(saved.district_id, true);
    }
    districtSel.dispatchEvent(new Event('change'));

    if (saved.constituency_id && constSel) {
      waitForOptions(constSel, function () {
        constSel.value = saved.constituency_id;
      });
    }

    if (saved.upazila_id && upazilaSel) {
      waitForOptions(upazilaSel, function () {
        upazilaSel.value = saved.upazila_id;

        if (saved.union_parishad_id && unionSel) {
          upazilaSel.dispatchEvent(new Event('change'));
          waitForOptions(unionSel, function () {
            unionSel.value = saved.union_parishad_id;
          });
        }
      });
    }
  }

  /* 5. Category → tags cascade */
  var catSelect = document.getElementById('news-category-id');

  if (saved.news_category_id && catSelect) {
    catSelect.value = saved.news_category_id;
    /* If Tom Select is wrapping this element, sync its display */
    if (catSelect.tomselect) {
      catSelect.tomselect.setValue(saved.news_category_id, true);
    }
    catSelect.dispatchEvent(new Event('change'));
    /* Tags are restored by news-category-tag-cascade.js via its own localStorage key */
  }

  /* Unblock saves after all async cascade fetches have had time to complete.
     waitForOptions polls up to 50×100ms = 5s, so 6s covers the worst case. */
  setTimeout(function () { isRestoring = false; }, 6000);

  /* ========== Helpers ========== */

  function waitForOptions(selectEl, callback) {
    var attempts = 0;
    var interval = setInterval(function () {
      attempts++;
      if (selectEl.options.length > 1 || attempts > 50) {
        clearInterval(interval);
        callback();
      }
    }, 100);
  }

})();

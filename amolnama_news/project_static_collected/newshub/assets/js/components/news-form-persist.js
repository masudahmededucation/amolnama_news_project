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
  var formTypeInput = document.getElementById('news-form-type');
  var formTypeCode = formTypeInput ? formTypeInput.value : '';
  var STORAGE_KEY = formTypeCode ? ('newshub_draft_' + formTypeCode) : 'newshub_draft';
  var TAGS_STORAGE_KEY = formTypeCode ? ('newshub_draft_tags_' + formTypeCode) : 'newshub_draft_tags';

  var SKIP_NAMES = ['csrfmiddlewaretoken', 'tag_ids', 'news_form_type', 'wcv_fir_status',
    'accused_json', 'victim_json', 'witness_json'];
  var form = document.querySelector('.news-collection-form, .news-multistep-form');
  if (!form) return;

  /* --- If submission succeeded, clear draft but keep save listeners active --- */
  var isSuccessPage = !!document.querySelector('.form-message-success');
  if (isSuccessPage) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TAGS_STORAGE_KEY);
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
        /* Save only the checked radio's value (skip unchecked ones) */
        if (el.checked) data[name] = el.value;
      } else if (el.type === 'checkbox') {
        /* For checkboxes with same name, store comma-separated checked values */
        if (el.checked) {
          data[name] = data[name] ? (data[name] + ',' + el.value) : el.value;
        }
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

  /* Skip localStorage restore in edit mode — server data takes priority */
  if (window.__EDIT_MODE__) return;

  var raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  var saved;
  try { saved = JSON.parse(raw); } catch (e) { return; }
  if (!saved || typeof saved !== 'object') return;

  /* Purge skipped keys from saved data so stale values never linger */
  var purged = false;
  SKIP_NAMES.forEach(function (k) {
    if (saved.hasOwnProperty(k)) { delete saved[k]; purged = true; }
  });
  if (purged) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

  /* Block saves while restoring — async cascade fetches would otherwise
     overwrite saved values (e.g. constituency_id) with empty strings */
  isRestoring = true;

  /* Fields restored via cascade (skip in the simple loop) */
  var CASCADE = [
    'district_id', 'constituency_id', 'upazila_id', 'union_parishad_id',
    'ward_id', 'village_id',
    'news_category_id',
    'organisation_type_id', 'contributor_organization_id',
    'occurrence_at',
  ];

  /* 1. Restore simple fields */
  Object.keys(saved).forEach(function (name) {
    if (CASCADE.indexOf(name) !== -1) return;
    if (SKIP_NAMES.indexOf(name) !== -1) return;

    var els = form.querySelectorAll('[name="' + name + '"]');
    if (!els.length) return;

    var el = els[0];
    if (el.type === 'radio') {
      /* Find and check the radio with the saved value, dispatch change for conditional rows */
      for (var r = 0; r < els.length; r++) {
        if (els[r].value === saved[name]) {
          els[r].checked = true;
          els[r].dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    } else if (el.type === 'checkbox') {
      /* Restore checkboxes — saved as comma-separated values */
      var savedValues = (saved[name] || '').split(',');
      for (var c = 0; c < els.length; c++) {
        els[c].checked = savedValues.indexOf(els[c].value) !== -1;
      }
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
  var organizationTypeSelect = document.getElementById('contributor-org-type');
  var organizationNameSelect = document.getElementById('contributor-organization');

  if (organizationTypeSelect && saved.organisation_type_id) {
    organizationTypeSelect.value = saved.organisation_type_id;
    organizationTypeSelect.dispatchEvent(new Event('change'));

    if (saved.contributor_organization_id) {
      waitForOptions(organizationNameSelect, function () {
        organizationNameSelect.value = saved.contributor_organization_id;
      });
    }
  }

  /* 4. Location cascade: district → constituency + subdistrict → local body → ward → village */
  var districtSelect = document.getElementById('news-district-id');
  var constituencySelect = document.getElementById('news-constituency-id');
  var upazilaSelect = document.getElementById('news-upazila-id');
  var unionSelect = document.getElementById('news-union-parishad-id');
  var wardSelect = document.getElementById('news-ward-id');
  var villageSelect = document.getElementById('news-village-id');

  if (districtSelect && saved.district_id) {
    districtSelect.value = saved.district_id;
    if (districtSelect.tomselect) {
      districtSelect.tomselect.setValue(saved.district_id, true);
    }
    districtSelect.dispatchEvent(new Event('change'));

    /* Constituency is a hidden input — set directly */
    if (saved.constituency_id && constituencySelect) {
      constituencySelect.value = saved.constituency_id;
    }

    if (saved.upazila_id && upazilaSelect) {
      waitForOptions(upazilaSelect, function () {
        upazilaSelect.value = saved.upazila_id;

        if (saved.union_parishad_id && unionSelect) {
          upazilaSelect.dispatchEvent(new Event('change'));
          waitForOptions(unionSelect, function () {
            unionSelect.value = saved.union_parishad_id;

            if (saved.ward_id && wardSelect) {
              unionSelect.dispatchEvent(new Event('change'));
              waitForOptions(wardSelect, function () {
                wardSelect.value = saved.ward_id;

                if (saved.village_id && villageSelect) {
                  wardSelect.dispatchEvent(new Event('change'));
                  waitForOptions(villageSelect, function () {
                    villageSelect.value = saved.village_id;
                  });
                }
              });
            }
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
     Cascade is now 5 levels deep (district → subdistrict → local body → ward → village),
     waitForOptions polls up to 50×100ms = 5s per level, so 10s covers the worst case. */
  setTimeout(function () { isRestoring = false; }, 10000);

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

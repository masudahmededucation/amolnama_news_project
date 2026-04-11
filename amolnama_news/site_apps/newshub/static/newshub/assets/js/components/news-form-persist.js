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
  const formTypeInput = document.getElementById('news-form-type');
  const formTypeCode = formTypeInput ? formTypeInput.value : '';
  const STORAGE_KEY = formTypeCode ? ('newshub_draft_' + formTypeCode) : 'newshub_draft';
  const TAGS_STORAGE_KEY = formTypeCode ? ('newshub_draft_tags_' + formTypeCode) : 'newshub_draft_tags';

  const SKIP_NAMES = ['csrfmiddlewaretoken', 'tag_ids', 'news_form_type', 'wcv_fir_status',
    'accused_json', 'victim_json', 'witness_json'];
  const form = document.querySelector('.news-collection-form, .news-multistep-form');
  if (!form) return;

  /* --- If submission succeeded, clear draft and block saves briefly.
     Save listeners stay active for new form, but block saves for 2s
     so Tom Select / cascade init events don't re-save stale defaults. --- */
  const isSuccessPage = !!document.querySelector('.form-message-success');
  let isSuccessBlocked = false;
  if (isSuccessPage) {
    /* Clear all newshub draft keys — per-type + generic + tags */
    Object.keys(localStorage).forEach(function (key) {
      if (key.startsWith('newshub_draft')) localStorage.removeItem(key);
    });
    isSuccessBlocked = true;
    setTimeout(function () { isSuccessBlocked = false; }, 2000);
  }

  /* ========== SAVE ========== */

  let saveTimer = null;
  let isRestoring = false; // blocks saves during restore to prevent race conditions

  function saveDraft() {
    if (isRestoring || isSuccessBlocked) return;

    const data = {};
    const elements = form.querySelectorAll('input, select, textarea');

    for (let i = 0; i < elements.length; i++) {
      let element = elements[i];
      let name = element.name;
      if (!name || SKIP_NAMES.indexOf(name) !== -1) continue;
      if (element.type === 'file') continue;

      if (element.type === 'radio') {
        /* Save only the checked radio's value (skip unchecked ones) */
        if (element.checked) data[name] = element.value;
      } else if (element.type === 'checkbox') {
        /* For checkboxes with same name, store comma-separated checked values */
        if (element.checked) {
          data[name] = data[name] ? (data[name] + ',' + element.value) : element.value;
        }
      } else {
        data[name] = element.value;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function debouncedSave() {
    if (isRestoring || isSuccessBlocked) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 400);
  }

  form.addEventListener('input', debouncedSave);
  form.addEventListener('change', debouncedSave);

  /* ========== RESTORE ========== */

  /* Skip restore after successful submission — form is fresh */
  if (isSuccessPage) return;

  /* Skip localStorage restore in edit mode — server data takes priority */
  if (window.__EDIT_MODE__) return;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  let saved;
  try { saved = JSON.parse(raw); } catch (e) { return; }
  if (!saved || typeof saved !== 'object') return;

  /* Purge skipped keys from saved data so stale values never linger */
  let purged = false;
  SKIP_NAMES.forEach(function (k) {
    if (saved.hasOwnProperty(k)) { delete saved[k]; purged = true; }
  });
  if (purged) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

  /* Block saves while restoring — async cascade fetches would otherwise
     overwrite saved values (e.g. constituency_id) with empty strings */
  isRestoring = true;

  /* Fields restored via cascade (skip in the simple loop) */
  const CASCADE = [
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

    const els = form.querySelectorAll('[name="' + name + '"]');
    if (!els.length) return;

    const element = els[0];
    if (element.type === 'radio') {
      /* Find and check the radio with the saved value, dispatch change for conditional rows */
      for (let r = 0; r < els.length; r++) {
        if (els[r].value === saved[name]) {
          els[r].checked = true;
          els[r].dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    } else if (element.type === 'checkbox') {
      /* Restore checkboxes — saved as comma-separated values */
      const savedValues = (saved[name] || '').split(',');
      for (let c = 0; c < els.length; c++) {
        els[c].checked = savedValues.indexOf(els[c].value) !== -1;
      }
    } else {
      element.value = saved[name];
    }
  });

  /* 1b. Re-trigger contributor type so Self hide/show logic runs with restored value */
  const ctypeSelect = document.getElementById('contributor-type');
  if (ctypeSelect && saved.contributor_type_id) {
    ctypeSelect.dispatchEvent(new Event('change'));
  }

  /* 2. Occurrence time — setAttribute so MutationObserver in occurrence-time.js fires */
  const occHidden = document.getElementById('news-occurrence-at');
  if (occHidden && saved.occurrence_at) {
    occHidden.setAttribute('value', saved.occurrence_at);
  }

  /* 3. Organisation type → org name cascade */
  const organizationTypeSelect = document.getElementById('contributor-org-type');
  const organizationNameSelect = document.getElementById('contributor-organization');

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
  const districtSelect = document.getElementById('news-district-id');
  const constituencySelect = document.getElementById('news-constituency-id');
  const upazilaSelect = document.getElementById('news-upazila-id');
  const unionSelect = document.getElementById('news-union-parishad-id');
  const wardSelect = document.getElementById('news-ward-id');
  const villageSelect = document.getElementById('news-village-id');

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
  const catSelect = document.getElementById('news-category-id');

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
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      if (selectEl.options.length > 1 || attempts > 50) {
        clearInterval(interval);
        callback();
      }
    }, 100);
  }

  /* SPA cleanup */
  if (window.spaCleanupRegister) {
    window.spaCleanupRegister(function () {
      isRestoring = false;
      clearTimeout(saveTimer);
    });
  }
})();

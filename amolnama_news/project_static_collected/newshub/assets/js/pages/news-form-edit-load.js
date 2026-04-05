/**
 * news-form-edit-load.js
 * Pre-populates the multistep form from existing DB data (edit mode).
 *
 * This script MUST load BEFORE component scripts (accused-repeater, extortion-incident, etc.)
 * so that hidden JSON inputs are populated before those components call restoreFromHiddenInput().
 *
 * Data source: <script type="application/json" id="edit-data"> injected by Django template.
 *
 * Phase 1: Sets hidden JSON inputs immediately (actors, extortion incident, legal).
 * Phase 2: Deferred — cascading fields (district, category, tags) after component JS loads.
 */
(function () {
  'use strict';

  const editDataEl = document.getElementById('edit-data');
  if (!editDataEl) return;

  let data;
  try { data = JSON.parse(editDataEl.textContent); } catch (e) { return; }
  if (!data || typeof data !== 'object') return;

  /* Signal to news-form-persist.js: skip localStorage restore */
  window.__EDIT_MODE__ = true;

  /* Clear any saved draft so it doesn't interfere with edit data.
     Use per-form-type keys if available (set by news-form-persist.js),
     but also clear legacy key in case old drafts exist. */
  const formTypeInput = document.getElementById('news-form-type');
  const formTypeCode = formTypeInput ? formTypeInput.value : '';
  if (formTypeCode) {
    localStorage.removeItem('newshub_draft_' + formTypeCode);
    localStorage.removeItem('newshub_draft_tags_' + formTypeCode);
  }
  localStorage.removeItem('newshub_draft');
  localStorage.removeItem('newshub_draft_tags');

  /* ========== PHASE 1: Immediate — set values BEFORE component scripts run ========== */

  /* --- Step 2: Contributor fields --- */
  const c = data.contributor || {};
  setFieldValue('contributor-full-name', c.full_name_bn);
  setFieldValue('contributor-type', c.type_id);
  setFieldValue('contributor-email', c.email);
  setFieldValue('contributor-phone', c.phone);
  /* Organization will be set in deferred phase (needs cascade) */

  /* --- Step 3: News content fields --- */
  let n = data.news_entry || {};
  setFieldValue('news-headline-bn', n.headline_bn);
  setFieldValue('news-summary-bn', n.summary_bn);
  setFieldValue('news-content-body-bn', n.content_body_bn);
  /* Occurrence date set via setAttribute for MutationObserver */
  const occHidden = document.getElementById('news-occurrence-at');
  if (occHidden && n.occurrence_at) {
    occHidden.setAttribute('value', n.occurrence_at);
  }

  /* --- Steps 4-6: Actors — set hidden JSON inputs for repeater components --- */
  if (data.accused && data.accused.length) {
    setHiddenJson('accused-json', data.accused);
  }
  if (data.victims && data.victims.length) {
    setHiddenJson('victim-json', data.victims);
  }
  if (data.witnesses && data.witnesses.length) {
    setHiddenJson('witness-json', data.witnesses);
  }

  /* --- Step 7: Extortion incident — set hidden JSON for extortion-incident.js --- */
  if (data.extortion_incident) {
    setHiddenJson('extortion-incident-json', data.extortion_incident);
  }

  /* --- Step 8: Extortion legal — set hidden JSON for extortion-legal.js --- */
  if (data.ext_legal) {
    setHiddenJson('ext-legal', data.ext_legal);
  }

  /* --- Step 10: Social sources — set hidden JSON for social-source-repeater.js --- */
  if (data.social_sources && data.social_sources.length) {
    setHiddenJson('social-source-json', { sources: data.social_sources });
  }

  /* --- Breaking news checkbox --- */
  if (data.is_breaking) {
    const breakingCb = document.getElementById('news-is-breaking');
    if (breakingCb) breakingCb.checked = true;
  }

  /* ========== PHASE 2: Deferred — cascade fields after all JS loads ========== */

  /* Wait for all component scripts to initialize (they load after this script) */
  window.addEventListener('load', function () {
    setTimeout(function () { populateCascadeFields(); }, 500);
  });

  function populateCascadeFields() {
    /* --- Quill editors: ensure content is loaded (backup in case init ran before hidden values set) --- */
    const n = data.news_entry || {};
    if (n.summary_bn && window.__quillNewsSummary) window.__quillNewsSummary.setContent(n.summary_bn);
    if (n.content_body_bn && window.__quillNewsBody) window.__quillNewsBody.setContent(n.content_body_bn);

    const loc = data.location || {};

    /* --- Step 9: Location cascade --- */
    const districtSelect = document.getElementById('news-district-id');
    if (districtSelect && loc.district_id) {
      /* Use Tom Select if available */
      if (districtSelect.tomselect) {
        districtSelect.tomselect.setValue(String(loc.district_id), true);
      } else {
        districtSelect.value = String(loc.district_id);
      }
      districtSelect.dispatchEvent(new Event('change', { bubbles: true }));

      /* Constituency (hidden input) */
      const constituencySelect = document.getElementById('news-constituency-id');
      if (constituencySelect && loc.constituency_id) {
        constituencySelect.value = String(loc.constituency_id);
      }

      /* Subdistrict (upazila) — wait for cascade to load options */
      const upazilaSelect = document.getElementById('news-upazila-id');
      if (upazilaSelect && loc.upazila_city_corporation_name) {
        waitForOptions(upazilaSelect, function () {
          /* Try to find option by text match since we store name, not ID */
          selectOptionByText(upazilaSelect, loc.upazila_city_corporation_name);
          upazilaSelect.dispatchEvent(new Event('change', { bubbles: true }));

          /* Union parishad */
          const unionSelect = document.getElementById('news-union-parishad-id');
          if (unionSelect && loc.union_parishad_id) {
            waitForOptions(unionSelect, function () {
              unionSelect.value = String(loc.union_parishad_id);
              unionSelect.dispatchEvent(new Event('change', { bubbles: true }));
            });
          }
        });
      }

      /* Ward and village (text fields, not cascades) */
      setFieldValue('news-ward-name', loc.ward_name);
      setFieldValue('news-village-moholla-name', loc.village_moholla_name);

      /* GPS coordinates */
      setFieldValue('news-latitude', loc.latitude);
      setFieldValue('news-longitude', loc.longitude);
      setFieldValue('news-formatted-address-bn', loc.formatted_address_bn);
      setFieldValue('news-full-address-bn', loc.full_address_bn);
    }

    /* --- Step 11: Category & Tags --- */
    const catSelect = document.getElementById('news-category-id');
    if (catSelect && data.category_id) {
      if (catSelect.tomselect) {
        catSelect.tomselect.setValue(String(data.category_id), true);
      } else {
        catSelect.value = String(data.category_id);
      }
      catSelect.dispatchEvent(new Event('change', { bubbles: true }));

      /* Tags — wait for tag cascade to load, then add via public API */
      if (data.tags && data.tags.length) {
        setTimeout(function () {
          populateTags(data.tags);
        }, 1000);
      }
    }

    /* --- Contributor type — dispatch change to trigger Self hide/show logic --- */
    const ctypeSelect = document.getElementById('contributor-type');
    if (ctypeSelect && c.type_id) {
      ctypeSelect.value = String(c.type_id);
      ctypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /* ========== Helpers ========== */

  function setFieldValue(id, value) {
    if (!value && value !== 0) return;
    let el = document.getElementById(id);
    if (el) el.value = String(value);
  }

  function setHiddenJson(id, data) {
    const el = document.getElementById(id);
    if (el) el.value = JSON.stringify(data);
  }

  function waitForOptions(selectEl, callback) {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      if (selectEl.options.length > 1 || attempts > 80) {
        clearInterval(interval);
        callback();
      }
    }, 100);
  }

  function selectOptionByText(selectEl, text) {
    if (!text) return;
    const normalizedText = text.trim().toLowerCase();
    for (let i = 0; i < selectEl.options.length; i++) {
      const optText = selectEl.options[i].textContent.trim().toLowerCase();
      if (optText.indexOf(normalizedText) !== -1 || normalizedText.indexOf(optText) !== -1) {
        selectEl.value = selectEl.options[i].value;
        return;
      }
    }
  }

  function populateTags(tags) {
    /* Tags use chip-based selection via window.newshubTags API */
    if (!window.newshubTags) return;

    for (let i = 0; i < tags.length; i++) {
      window.newshubTags.add(tags[i]);
    }
    /* Persist to localStorage so tag cascade doesn't overwrite on category fetch */
    window.newshubTags.save();
    window.newshubTags.render();
  }

})();

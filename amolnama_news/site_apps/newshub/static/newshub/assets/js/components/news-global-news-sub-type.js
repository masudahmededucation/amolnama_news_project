/**
 * news-global-news-sub-type.js
 * Populates the issue sub-type dropdown from DB-driven JSON
 * (#global-news-sub-types-data) into the #global-news-sub-type <select>.
 * When the "Other" option (status_code="other") is selected, shows a
 * text input for additional detail.
 *
 * DOM dependencies:
 *   #global-news-sub-type               — <select> element
 *   #global-news-sub-types-data         — CSP-safe JSON with issue sub-types
 *   #global-news-sub-type-other-row     — wrapper div (toggled when "Other" selected)
 *   #global-news-sub-type-other-detail  — text input for "Other" details
 *
 * Exposes: window.newshubGlobalNewsSubType = { reset: fn }
 */
(function () {
  'use strict';

  var selectEl  = document.getElementById('global-news-sub-type');
  var dataEl    = document.getElementById('global-news-sub-types-data');
  var otherRow  = document.getElementById('global-news-sub-type-other-row');
  var otherText = document.getElementById('global-news-sub-type-other-detail');
  if (!selectEl || !dataEl) return;

  var subTypes = [];
  try { subTypes = JSON.parse(dataEl.textContent) || []; } catch (e) { return; }

  /* Track which status_id is the "Other" option */
  var otherStatusId = '';

  subTypes.forEach(function (st) {
    var option = document.createElement('option');
    option.value = st.status_id;
    var icon = st.status_icon ? st.status_icon + ' ' : '';
    option.textContent = icon + st.status_name_bn + ' (' + st.status_name_en + ')';
    option.dataset.statusCode = st.status_code || '';
    selectEl.appendChild(option);

    if (st.status_code === 'other') {
      otherStatusId = String(st.status_id);
    }
  });

  /* Toggle "Other" detail row */
  selectEl.addEventListener('change', function () {
    if (otherRow) {
      otherRow.style.display = (selectEl.value === otherStatusId) ? '' : 'none';
    }
    if (otherText && selectEl.value !== otherStatusId) {
      otherText.value = '';
    }
  });

  /* Public API for form-clear */
  window.newshubGlobalNewsSubType = {
    reset: function () {
      selectEl.value = '';
      if (otherRow)  otherRow.style.display = 'none';
      if (otherText) otherText.value = '';
    },
  };
})();

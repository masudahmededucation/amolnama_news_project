/**
 * news-global-news-countries.js
 * Serializes the Countries & International Organizations form (Step 4 of
 * the Global News form) into a hidden JSON input.
 *
 * DOM dependencies:
 *   #global-news-countries-json       — hidden input (JSON payload)
 *   #global-news-primary-country      — text input
 *   #global-news-countries-involved   — textarea
 *   #global-news-org-un / eu / nato / imf / worldbank / wto / who /
 *     asean / oic / saarc / g7 / g20 / brics / icc / other — checkboxes
 *   #global-news-org-other-row        — wrapper div (toggled by 'other')
 *   #global-news-org-other-name       — text input
 */
(function () {
  'use strict';

  var hiddenInput = document.getElementById('global-news-countries-json');
  if (!hiddenInput) return;

  var primaryCountryEl    = document.getElementById('global-news-primary-country');
  var countriesInvolvedEl = document.getElementById('global-news-countries-involved');
  var orgOtherRow         = document.getElementById('global-news-org-other-row');
  var orgOtherNameEl      = document.getElementById('global-news-org-other-name');

  /* Checkbox ID → JSON key mapping */
  var orgMap = {
    'global-news-org-un':        'orgUN',
    'global-news-org-eu':        'orgEU',
    'global-news-org-nato':      'orgNATO',
    'global-news-org-imf':       'orgIMF',
    'global-news-org-worldbank': 'orgWorldBank',
    'global-news-org-wto':       'orgWTO',
    'global-news-org-who':       'orgWHO',
    'global-news-org-asean':     'orgASEAN',
    'global-news-org-oic':       'orgOIC',
    'global-news-org-saarc':     'orgSAARC',
    'global-news-org-g7':        'orgG7',
    'global-news-org-g20':       'orgG20',
    'global-news-org-brics':     'orgBRICS',
    'global-news-org-icc':       'orgICC',
    'global-news-org-other':     'orgOther'
  };

  /* Toggle "other org name" field */
  var orgOtherCb = document.getElementById('global-news-org-other');
  if (orgOtherCb) {
    orgOtherCb.addEventListener('change', function () {
      if (orgOtherRow) orgOtherRow.style.display = orgOtherCb.checked ? '' : 'none';
      syncToHiddenInput();
    });
  }

  function collectData() {
    var data = {
      primaryCountry:    (primaryCountryEl    && primaryCountryEl.value.trim())    || '',
      involvedCountries: (countriesInvolvedEl && countriesInvolvedEl.value.trim()) || '',
      otherOrgName:      (orgOtherNameEl      && orgOtherNameEl.value.trim())      || ''
    };
    /* Add each org as a boolean flag */
    var keys = Object.keys(orgMap);
    for (var i = 0; i < keys.length; i++) {
      var el = document.getElementById(keys[i]);
      data[orgMap[keys[i]]] = !!(el && el.checked);
    }
    return data;
  }

  function hasAnyData(d) {
    if (d.primaryCountry || d.involvedCountries) return true;
    var keys = Object.keys(orgMap);
    for (var i = 0; i < keys.length; i++) {
      if (d[orgMap[keys[i]]]) return true;
    }
    return false;
  }

  function syncToHiddenInput() {
    var data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  var section = document.getElementById('section-global-news-countries');
  if (section) {
    section.addEventListener('input', syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  var form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

  /* ---- Restore UI from saved hidden input JSON ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    try {
      var data = JSON.parse(hiddenInput.value);
      if (primaryCountryEl && data.primaryCountry)       primaryCountryEl.value    = data.primaryCountry;
      if (countriesInvolvedEl && data.involvedCountries)  countriesInvolvedEl.value = data.involvedCountries;
      if (orgOtherNameEl && data.otherOrgName)            orgOtherNameEl.value      = data.otherOrgName;
      var keys = Object.keys(orgMap);
      for (var i = 0; i < keys.length; i++) {
        var el = document.getElementById(keys[i]);
        if (el) el.checked = !!data[orgMap[keys[i]]];
      }
      if (orgOtherCb && orgOtherRow) orgOtherRow.style.display = orgOtherCb.checked ? '' : 'none';
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  window.newshubGlobalNewsCountries = {
    reset: function () {
      if (primaryCountryEl)    primaryCountryEl.value    = '';
      if (countriesInvolvedEl) countriesInvolvedEl.value = '';
      var keys = Object.keys(orgMap);
      for (var i = 0; i < keys.length; i++) {
        var el = document.getElementById(keys[i]);
        if (el) el.checked = false;
      }
      if (orgOtherRow)    orgOtherRow.style.display = 'none';
      if (orgOtherNameEl) orgOtherNameEl.value = '';
      hiddenInput.value = '';
    }
  };
})();

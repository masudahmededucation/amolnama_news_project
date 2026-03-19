/**
 * news-watchdog-bangladesh-section-switcher.js
 * Shows/hides the correct watchdog field section based on the selected
 * watchdog sub-type group.
 *
 * Listens to: watchdogBangladesh:subTypeChanged  { detail: { subTypeId, groupCode } }
 *
 * Each group_code maps to a form section ID:
 *   watchdog_bangladesh_form_watchdog_statment  → section-contradiction
 *   watchdog_bangladesh_form_watchdog_issue     → section-watchdog-issue
 *   watchdog_bangladesh_form_watchdog_party_change → section-watchdog-party-change
 *   watchdog_bangladesh_form_watchdog_proxy_puppet → section-watchdog-proxy-puppet
 *   watchdog_bangladesh_form_watchdog_bootlicker   → section-watchdog-bootlicker
 *   watchdog_bangladesh_form_watchdog_women_fixer   → section-watchdog-women-fixer
 *
 * All sections start hidden (style="display:none" in HTML).
 * On init, checks if a value is already set (form-persist restore).
 *
 * Exposes: window.newshubWatchdogSectionSwitcher = { reset: fn }
 */
(function () {
  'use strict';

  var GROUP_TO_SECTION = {
    'watchdog_bangladesh_form_watchdog_statment':     'section-contradiction',
    'watchdog_bangladesh_form_watchdog_issue':        'section-watchdog-issue',
    'watchdog_bangladesh_form_watchdog_party_change': 'section-watchdog-party-change',
    'watchdog_bangladesh_form_watchdog_proxy_puppet': 'section-watchdog-proxy-puppet',
    'watchdog_bangladesh_form_watchdog_bootlicker':   'section-watchdog-bootlicker',
    'watchdog_bangladesh_form_watchdog_women_fixer':  'section-watchdog-women-fixer'
  };

  var ALL_SECTION_IDS = Object.keys(GROUP_TO_SECTION).map(function (k) {
    return GROUP_TO_SECTION[k];
  });

  function hideAll() {
    ALL_SECTION_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  function showSection(groupCode) {
    hideAll();
    if (!groupCode) return;
    var sectionId = GROUP_TO_SECTION[groupCode];
    if (!sectionId) return;
    var el = document.getElementById(sectionId);
    if (el) el.style.display = '';
  }

  /* Listen for sub-type changes */
  document.addEventListener('watchdogBangladesh:subTypeChanged', function (e) {
    var groupCode = e.detail ? e.detail.groupCode : '';
    showSection(groupCode);

    /* Re-init flatpickr on newly visible date inputs */
    if (window.newshubDatePicker && window.newshubDatePicker.init) {
      window.newshubDatePicker.init();
    }
  });

  /* On init: if a value is already set (form-persist), show the matching section */
  function initFromExisting() {
    var hidden = document.getElementById('watchdog-bangladesh-sub-type');
    if (!hidden || !hidden.value) return;

    /* Find which radio has this value and get its group */
    var radio = document.querySelector(
      'input[name="watchdog_bangladesh_sub_type_radio"][value="' + hidden.value + '"]'
    );
    if (!radio) return;

    var group = radio.closest('.radio-card-group');
    if (!group) return;

    var groupCode = group.getAttribute('data-group');
    showSection(groupCode);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFromExisting);
  } else {
    initFromExisting();
  }

  /* Public API */
  window.newshubWatchdogSectionSwitcher = {
    reset: function () {
      hideAll();
    }
  };
})();

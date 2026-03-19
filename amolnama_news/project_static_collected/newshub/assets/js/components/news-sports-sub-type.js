/**
 * news-sports-sub-type.js
 * Binds the sport-type select and sub-type radio cards to their hidden inputs.
 * Broadcasts custom events so downstream steps (match-event, teams-result,
 * key-performances) can show/hide sport-specific fields (e.g. cricket format, toss).
 *
 * DOM dependencies:
 *   #sports-sub-type          — hidden input (sub-type value)
 *   #sports-sport-type        — hidden input (sport type value)
 *   #sports-sport-type-select — visible <select>
 *   #sports-sub-type-grid     — radio card container
 *
 * Custom events dispatched on `document`:
 *   sports:sportChanged    { detail: { sport: string } }
 *   sports:subTypeChanged  { detail: { subType: string } }
 */
(function () {
  'use strict';

  var subTypeHidden   = document.getElementById('sports-sub-type');
  var sportTypeHidden = document.getElementById('sports-sport-type');

  /* Guard — only active on the Sports form page */
  if (!subTypeHidden && !sportTypeHidden) return;

  /* ---- Sport type dropdown ---- */
  var sportSelect = document.getElementById('sports-sport-type-select');
  if (sportSelect && sportTypeHidden) {
    sportSelect.addEventListener('change', function () {
      sportTypeHidden.value = sportSelect.value;
      document.dispatchEvent(
        new CustomEvent('sports:sportChanged', { detail: { sport: sportSelect.value } })
      );
    });
  }

  /* ---- Sub-type radio cards ---- */
  var grid = document.getElementById('sports-sub-type-grid');
  if (grid && subTypeHidden) {
    grid.addEventListener('change', function (e) {
      if (e.target.type === 'radio') {
        subTypeHidden.value = e.target.value;
        document.dispatchEvent(
          new CustomEvent('sports:subTypeChanged', { detail: { subType: e.target.value } })
        );
      }
    });
  }

  /* ---- Public API for form-clear.js ---- */
  window.newshubSportsSubType = {
    reset: function () {
      if (sportSelect)     sportSelect.value = '';
      if (sportTypeHidden) sportTypeHidden.value = '';
      document.querySelectorAll('input[name="sports_sub_type_radio"]')
        .forEach(function (r) { r.checked = false; });
      if (subTypeHidden) subTypeHidden.value = '';
      /* Notify downstream steps to hide conditional fields */
      document.dispatchEvent(
        new CustomEvent('sports:sportChanged', { detail: { sport: '' } })
      );
      document.dispatchEvent(
        new CustomEvent('sports:subTypeChanged', { detail: { subType: '' } })
      );
    }
  };
})();

/**
 * news-entertainment-sub-type.js
 * Binds the entertainment medium select and sub-type radio cards to their
 * hidden inputs. Broadcasts a custom event so Step 6 (performance) can
 * show/hide the award section.
 *
 * DOM dependencies:
 *   #entertainment-sub-type      — hidden input (sub-type value)
 *   #entertainment-medium-id     — hidden input (medium value)
 *   #entertainment-medium-select — visible <select>
 *   #entertainment-sub-type-grid — radio card container
 *
 * Custom event dispatched on `document`:
 *   entertainment:subTypeChanged  { detail: { subType: string } }
 */
(function () {
  'use strict';

  var subTypeHidden  = document.getElementById('entertainment-sub-type');
  var mediumHidden   = document.getElementById('entertainment-medium-id');

  /* Guard — only active on the Entertainment form page */
  if (!subTypeHidden && !mediumHidden) return;

  /* ---- Medium dropdown ---- */
  var mediumSelect = document.getElementById('entertainment-medium-select');
  if (mediumSelect && mediumHidden) {
    mediumSelect.addEventListener('change', function () {
      mediumHidden.value = mediumSelect.value;
    });
  }

  /* ---- Sub-type radio cards ---- */
  var grid = document.getElementById('entertainment-sub-type-grid');
  if (grid && subTypeHidden) {
    grid.addEventListener('change', function (e) {
      if (e.target.type === 'radio') {
        subTypeHidden.value = e.target.value;
        document.dispatchEvent(
          new CustomEvent('entertainment:subTypeChanged',
            { detail: { subType: e.target.value } })
        );
      }
    });
  }

  /* ---- Public API for form-clear.js ---- */
  window.newshubEntertainmentSubType = {
    reset: function () {
      if (mediumSelect)  mediumSelect.value  = '';
      if (mediumHidden)  mediumHidden.value  = '';
      document.querySelectorAll('input[name="entertainment_sub_type_radio"]')
        .forEach(function (r) { r.checked = false; });
      if (subTypeHidden) subTypeHidden.value = '';
      document.dispatchEvent(
        new CustomEvent('entertainment:subTypeChanged', { detail: { subType: '' } })
      );
    }
  };
})();

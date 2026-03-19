/**
 * news-date-picker.js
 * Replaces native <input type="date"> elements with a styled flatpickr calendar.
 * Requires flatpickr CDN to be loaded before this script.
 *
 * Reusable — call window.newshubDatePicker.init() after adding new date inputs
 * dynamically (e.g. inside a repeater card).
 *
 * Behavior:
 *   - altInput: true    → visible input shows dd/mm/yyyy; original input stores
 *                         Y-m-d (Django ISO format) for form submission.
 *   - Fires change on the original input so existing JS serialize listeners work.
 *   - Safe to call init() multiple times — already-initialized inputs are skipped.
 *   - On mobile: native date picker is used (disableMobile: false) for better UX.
 *
 * Exposes: window.newshubDatePicker = { init: fn }
 */
(function () {
  'use strict';

  if (typeof flatpickr === 'undefined') return;

  var OPTIONS = {
    dateFormat:    'Y-m-d',              /* value stored — Django ISO */
    altInput:      true,                 /* show user-friendly format */
    altFormat:     'd/m/Y',             /* dd/mm/yyyy */
    altInputClass: 'datepicker-alt-input',
    allowInput:    false,
    locale:        { firstDayOfWeek: 0 },
    disableMobile: false,               /* native picker on mobile */
    onReady: function (selectedDates, dateStr, instance) {
      if (instance.altInput) {
        instance.altInput.placeholder = 'DD/MM/YYYY';
        /* Give alt input a visible id so <label for="..."> works.
           Original hidden input keeps its id for JS value reads.
           Flatpickr alt input gets id + '-visible' suffix, and we
           update any matching label's `for` attribute. */
        var origId = instance.input.id;
        if (origId) {
          var altId = origId + '-visible';
          instance.altInput.id = altId;
          var label = document.querySelector('label[for="' + origId + '"]');
          if (label) label.setAttribute('for', altId);
        }
      }
    },
  };

  function initAll() {
    var scope = document.querySelector('.news-multistep-form') || document;
    var inputs = scope.querySelectorAll('input[type="date"]');
    inputs.forEach(function (input) {
      if (input._flatpickr) return;  /* skip already-initialized */
      var opts = Object.assign({}, OPTIONS);
      var maxAttr = input.getAttribute('max');
      var minAttr = input.getAttribute('min');
      if (maxAttr) opts.maxDate = maxAttr;
      if (minAttr) opts.minDate = minAttr;
      flatpickr(input, opts);
    });
  }

  /* Expose public API */
  window.newshubDatePicker = { init: initAll };

  /* Auto-init — scripts are at bottom so DOM is already parsed */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

})();

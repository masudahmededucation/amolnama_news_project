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
 * Exposes: window.newshubDatePicker = { init: callback }
 */
(function () {
  'use strict';

  if (typeof flatpickr === 'undefined') return;

  const OPTIONS = {
    dateFormat:    'Y-m-d',              /* value stored — Django ISO */
    altInput:      true,                 /* show user-friendly format */
    altFormat:     'd/m/Y',             /* dd/mm/yyyy */
    altInputClass: 'datepicker-alt-input',
    allowInput:    false,
    locale:        { firstDayOfWeek: 0 },
    disableMobile: false,               /* native picker on mobile */
    onReady: function (selectedDates, dateStr, instance) {
      const origId = instance.input.id || '';
      const nameBase = origId.replace(/-/g, '_');

      /* Alt input (desktop) — visible formatted input */
      if (instance.altInput) {
        instance.altInput.placeholder = 'DD/MM/YYYY';
        if (origId) {
          const altId = origId + '-visible';
          instance.altInput.id = altId;
          instance.altInput.setAttribute('name', nameBase + '_visible');
          /* Update any label that references the original hidden input or has matching id pattern */
          const label = document.querySelector('label[for="' + origId + '"]') ||
                      document.getElementById(origId + '-label');
          if (label) label.setAttribute('for', altId);
        }
      }

      /* Mobile input — native date picker fallback */
      if (instance.mobileInput && origId) {
        instance.mobileInput.id = origId + '-mobile';
        instance.mobileInput.setAttribute('name', nameBase + '_mobile');
      }

      /* Flatpickr internal calendar elements — add id/name to suppress browser warnings */
      if (instance.calendarContainer && origId) {
        const monthDropdown = instance.calendarContainer.querySelector('.flatpickr-monthDropdown-months');
        if (monthDropdown && !monthDropdown.id) {
          monthDropdown.id = origId + '-flatpickr-month';
          monthDropdown.setAttribute('name', nameBase + '_flatpickr_month');
        }
        const yearInput = instance.calendarContainer.querySelector('.cur-year');
        if (yearInput && !yearInput.id) {
          yearInput.id = origId + '-flatpickr-year';
          yearInput.setAttribute('name', nameBase + '_flatpickr_year');
        }
      }
    },
  };

  function initAll() {
    const scope = document.querySelector('.news-multistep-form') || document;
    const inputs = scope.querySelectorAll('input[type="date"]');
    inputs.forEach(function (input) {
      if (input._flatpickr) return;  /* skip already-initialized */
      const opts = Object.assign({}, OPTIONS);
      const maxAttr = input.getAttribute('max');
      const minAttr = input.getAttribute('min');
      if (maxAttr) opts.maxDate = maxAttr;
      if (minAttr) opts.minDate = minAttr;
      flatpickr(input, opts);
    });
  }

  /* Expose public API */
  window.newshubDatePicker = { init: initAll };

  /* Register SPA cleanup — destroy all flatpickr instances properly */
  if (window.spaCleanupRegister) {
    window.spaCleanupRegister(function () {
      document.querySelectorAll('[data-date-picker]').forEach(function (input) {
        if (input._flatpickr) input._flatpickr.destroy();
      });
    });
  }

  /* Auto-init — scripts are at bottom so DOM is already parsed */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

})();

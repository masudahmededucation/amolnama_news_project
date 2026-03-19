/**
 * news-watchdog-bangladesh-bootlicker.js
 * Reads Bootlicker Watchdog fields and serializes to #bootlicker-json
 * hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #bootlicker-target-person  — target person text
 *   #bootlicker-statement      — sycophantic statement textarea
 *   #bootlicker-statement-date — statement date
 *   #bootlicker-context        — context textarea
 *   #bootlicker-benefit        — benefit textarea
 *   #bootlicker-source         — source URL
 *   #bootlicker-json           — hidden JSON input
 *
 * Exposes: window.newshubWatchdogBootlicker = { reset: fn }
 */
(function () {
  'use strict';

  var targetPerson = document.getElementById('bootlicker-target-person');
  var statement    = document.getElementById('bootlicker-statement');
  var stmtDate     = document.getElementById('bootlicker-statement-date');
  var context      = document.getElementById('bootlicker-context');
  var benefit      = document.getElementById('bootlicker-benefit');
  var source       = document.getElementById('bootlicker-source');
  var hiddenJson   = document.getElementById('bootlicker-json');

  if (!hiddenJson) return;

  function serialize() {
    var data = {
      targetPerson:  targetPerson ? targetPerson.value.trim() : '',
      statement:     statement ? statement.value.trim() : '',
      statementDate: stmtDate ? stmtDate.value : '',
      context:       context ? context.value.trim() : '',
      benefit:       benefit ? benefit.value.trim() : '',
      source:        source ? source.value.trim() : ''
    };
    hiddenJson.value = JSON.stringify(data);
  }

  var fields = [targetPerson, statement, stmtDate, context, benefit, source];
  fields.forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', serialize);
  });

  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  window.newshubWatchdogBootlicker = {
    reset: function () {
      fields.forEach(function (el) { if (el) el.value = ''; });
      hiddenJson.value = '';
    }
  };

  /* Step validator: require target person + statement when section is visible */
  var section = document.getElementById('section-watchdog-bootlicker');
  var panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    var step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      if (section && section.style.display === 'none') return { warnings: [] };
      var warnings = [];
      if (!targetPerson || !targetPerson.value.trim()) {
        warnings.push('\u09AF\u09BE\u0995\u09C7 \u09A4\u09CB\u09B7\u09BE\u09AE\u09CB\u09A6 \u0995\u09B0\u09BE \u09B9\u099A\u09CD\u099B\u09C7 \u09A4\u09BE\u09B0 \u09A8\u09BE\u09AE \u09A6\u09BF\u09A8 (Please enter who is being flattered)');
      }
      if (!statement || !statement.value.trim()) {
        warnings.push('\u099A\u09BE\u099F\u09C1\u0995\u09BE\u09B0\u09AE\u09C2\u09B2\u0995 \u09AC\u0995\u09CD\u09A4\u09AC\u09CD\u09AF \u09A6\u09BF\u09A8 (Please enter the sycophantic statement)');
      }
      return { warnings: warnings };
    }});
  }
})();

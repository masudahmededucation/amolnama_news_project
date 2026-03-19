/**
 * news-watchdog-bangladesh-party-change.js
 * Reads Party Change Watchdog fields and serializes to #party-change-json
 * hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #party-change-previous-party — previous party text
 *   #party-change-current-party  — current party text
 *   #party-change-date           — date of change
 *   #party-change-reason         — reason textarea
 *   #party-change-benefit        — benefit textarea
 *   #party-change-history        — history textarea
 *   #party-change-source         — source URL
 *   #party-change-json           — hidden JSON input
 *
 * Exposes: window.newshubWatchdogPartyChange = { reset: fn }
 */
(function () {
  'use strict';

  var prevParty  = document.getElementById('party-change-previous-party');
  var curParty   = document.getElementById('party-change-current-party');
  var changeDate = document.getElementById('party-change-date');
  var reason     = document.getElementById('party-change-reason');
  var benefit    = document.getElementById('party-change-benefit');
  var history    = document.getElementById('party-change-history');
  var source     = document.getElementById('party-change-source');
  var hiddenJson = document.getElementById('party-change-json');

  if (!hiddenJson) return;

  function serialize() {
    var data = {
      previousParty: prevParty ? prevParty.value.trim() : '',
      currentParty:  curParty ? curParty.value.trim() : '',
      changeDate:    changeDate ? changeDate.value : '',
      reason:        reason ? reason.value.trim() : '',
      benefit:       benefit ? benefit.value.trim() : '',
      history:       history ? history.value.trim() : '',
      source:        source ? source.value.trim() : ''
    };
    hiddenJson.value = JSON.stringify(data);
  }

  var fields = [prevParty, curParty, changeDate, reason, benefit, history, source];
  fields.forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', serialize);
  });

  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  window.newshubWatchdogPartyChange = {
    reset: function () {
      fields.forEach(function (el) { if (el) el.value = ''; });
      hiddenJson.value = '';
    }
  };

  /* Step validator: require previous + current party when section is visible */
  var section = document.getElementById('section-watchdog-party-change');
  var panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    var step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      if (section && section.style.display === 'none') return { warnings: [] };
      var warnings = [];
      if (!prevParty || !prevParty.value.trim()) {
        warnings.push('\u0986\u0997\u09C7\u09B0 \u09A6\u09B2 \u09A6\u09BF\u09A8 (Please enter the previous party)');
      }
      if (!curParty || !curParty.value.trim()) {
        warnings.push('\u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09A6\u09B2 \u09A6\u09BF\u09A8 (Please enter the current party)');
      }
      return { warnings: warnings };
    }});
  }
})();

/**
 * news-watchdog-bangladesh-women-fixer.js
 * Reads Women Fixer Watchdog fields and serializes to #women-fixer-json
 * hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #women-fixer-incident-type        — incident type select
 *   #women-fixer-incident-description — incident description textarea
 *   #women-fixer-incident-date        — incident date
 *   #women-fixer-victim-count         — victim count number
 *   #women-fixer-network-description  — network description textarea
 *   #women-fixer-legal-action         — legal action textarea
 *   #women-fixer-source               — source URL
 *   #women-fixer-json                 — hidden JSON input
 *
 * Exposes: window.newshubWatchdogWomenFixer = { reset: fn }
 */
(function () {
  'use strict';

  var incidentType = document.getElementById('women-fixer-incident-type');
  var description  = document.getElementById('women-fixer-incident-description');
  var incidentDate = document.getElementById('women-fixer-incident-date');
  var victimCount  = document.getElementById('women-fixer-victim-count');
  var network      = document.getElementById('women-fixer-network-description');
  var legalAction  = document.getElementById('women-fixer-legal-action');
  var source       = document.getElementById('women-fixer-source');
  var hiddenJson   = document.getElementById('women-fixer-json');

  if (!hiddenJson) return;

  function serialize() {
    var data = {
      incidentType:       incidentType ? incidentType.value : '',
      incidentDescription: description ? description.value.trim() : '',
      incidentDate:       incidentDate ? incidentDate.value : '',
      victimCount:        victimCount ? victimCount.value : '',
      networkDescription: network ? network.value.trim() : '',
      legalAction:        legalAction ? legalAction.value.trim() : '',
      source:             source ? source.value.trim() : ''
    };
    hiddenJson.value = JSON.stringify(data);
  }

  var fields = [incidentType, description, incidentDate, victimCount, network, legalAction, source];
  fields.forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', serialize);
    el.addEventListener('change', serialize);
  });

  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  window.newshubWatchdogWomenFixer = {
    reset: function () {
      fields.forEach(function (el) {
        if (!el) return;
        if (el.tagName === 'SELECT') {
          el.selectedIndex = 0;
        } else {
          el.value = '';
        }
      });
      hiddenJson.value = '';
    }
  };

  /* Step validator: require incident type + description when section is visible */
  var section = document.getElementById('section-watchdog-women-fixer');
  var panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    var step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      if (section && section.style.display === 'none') return { warnings: [] };
      var warnings = [];
      if (!incidentType || !incidentType.value) {
        warnings.push('\u0998\u099F\u09A8\u09BE\u09B0 \u09A7\u09B0\u09A8 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 (Please select the incident type)');
      }
      if (!description || !description.value.trim()) {
        warnings.push('\u0998\u099F\u09A8\u09BE\u09B0 \u09AC\u09BF\u09AC\u09B0\u09A3 \u09A6\u09BF\u09A8 (Please enter the incident description)');
      }
      return { warnings: warnings };
    }});
  }
})();

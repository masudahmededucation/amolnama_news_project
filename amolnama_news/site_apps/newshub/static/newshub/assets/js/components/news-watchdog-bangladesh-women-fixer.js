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
 * Exposes: window.newshubWatchdogWomenFixer = { reset: callback }
 */
(function () {
  'use strict';

  const incidentType = document.getElementById('women-fixer-incident-type');
  const description  = document.getElementById('women-fixer-incident-description');
  const incidentDate = document.getElementById('women-fixer-incident-date');
  const victimCount  = document.getElementById('women-fixer-victim-count');
  const network      = document.getElementById('women-fixer-network-description');
  const legalAction  = document.getElementById('women-fixer-legal-action');
  const source       = document.getElementById('women-fixer-source');
  const hiddenJson   = document.getElementById('women-fixer-json');

  if (!hiddenJson) return;

  function serialize() {
    let data = {
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

  const fields = [incidentType, description, incidentDate, victimCount, network, legalAction, source];
  fields.forEach(function (element) {
    if (!element) return;
    element.addEventListener('input', serialize);
    element.addEventListener('change', serialize);
  });

  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* ---- Restore UI from saved hidden input JSON ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    try {
      const data = JSON.parse(hiddenJson.value);
      if (incidentType && data.incidentType)              incidentType.value = data.incidentType;
      if (description && data.incidentDescription)        description.value  = data.incidentDescription;
      if (incidentDate && data.incidentDate)              incidentDate.value = data.incidentDate;
      if (victimCount && data.victimCount)                victimCount.value  = data.victimCount;
      if (network && data.networkDescription)             network.value      = data.networkDescription;
      if (legalAction && data.legalAction)                legalAction.value  = data.legalAction;
      if (source && data.source)                          source.value       = data.source;
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  window.newshubWatchdogWomenFixer = {
    reset: function () {
      fields.forEach(function (element) {
        if (!element) return;
        if (element.tagName === 'SELECT') {
          element.selectedIndex = 0;
        } else {
          element.value = '';
        }
      });
      hiddenJson.value = '';
    }
  };

  /* Step validator: require incident type + description when section is visible */
  const section = document.getElementById('section-watchdog-women-fixer');
  const panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, callback: function () {
      if (section && section.hidden) return { warnings: [] };
      const warnings = [];
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

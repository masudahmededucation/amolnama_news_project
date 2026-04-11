/**
 * news-watchdog-bangladesh-issue.js
 * Reads Issue Watchdog fields and serializes to #issue-watchdog-json
 * hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #issue-topic             — issue topic textarea
 *   #issue-original-stance   — previous stance textarea
 *   #issue-original-date     — previous stance date
 *   #issue-original-source   — previous source URL
 *   #issue-current-stance    — current stance textarea
 *   #issue-current-date      — current stance date
 *   #issue-current-source    — current source URL
 *   #issue-impact            — impact textarea
 *   #issue-watchdog-json     — hidden JSON input
 *
 * Exposes: window.newshubWatchdogIssue = { reset: callback }
 */
(function () {
  'use strict';

  const topic          = document.getElementById('issue-topic');
  const origStance     = document.getElementById('issue-original-stance');
  const origDate       = document.getElementById('issue-original-date');
  const origSource     = document.getElementById('issue-original-source');
  const curStance      = document.getElementById('issue-current-stance');
  const curDate        = document.getElementById('issue-current-date');
  const curSource      = document.getElementById('issue-current-source');
  const impact         = document.getElementById('issue-impact');
  const hiddenJson     = document.getElementById('issue-watchdog-json');

  if (!hiddenJson) return;

  function serialize() {
    let data = {
      topic:          topic ? topic.value.trim() : '',
      originalStance: origStance ? origStance.value.trim() : '',
      originalDate:   origDate ? origDate.value : '',
      originalSource: origSource ? origSource.value.trim() : '',
      currentStance:  curStance ? curStance.value.trim() : '',
      currentDate:    curDate ? curDate.value : '',
      currentSource:  curSource ? curSource.value.trim() : '',
      impact:         impact ? impact.value.trim() : ''
    };
    hiddenJson.value = JSON.stringify(data);
  }

  const fields = [topic, origStance, origDate, origSource, curStance, curDate, curSource, impact];
  fields.forEach(function (element) {
    if (!element) return;
    element.addEventListener('input', serialize);
  });

  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* ---- Restore UI from saved hidden input JSON ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    try {
      const data = JSON.parse(hiddenJson.value);
      if (topic && data.topic)              topic.value      = data.topic;
      if (origStance && data.originalStance) origStance.value = data.originalStance;
      if (origDate && data.originalDate)    origDate.value    = data.originalDate;
      if (origSource && data.originalSource) origSource.value = data.originalSource;
      if (curStance && data.currentStance)  curStance.value   = data.currentStance;
      if (curDate && data.currentDate)      curDate.value     = data.currentDate;
      if (curSource && data.currentSource)  curSource.value   = data.currentSource;
      if (impact && data.impact)            impact.value      = data.impact;
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  window.newshubWatchdogIssue = {
    reset: function () {
      fields.forEach(function (element) { if (element) element.value = ''; });
      hiddenJson.value = '';
    }
  };

  /* Step validator: require topic + both stances when section is visible */
  const section = document.getElementById('section-watchdog-issue');
  const panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, callback: function () {
      if (section && section.hidden) return { warnings: [] };
      const warnings = [];
      if (!topic || !topic.value.trim()) {
        warnings.push('\u0987\u09B8\u09CD\u09AF\u09C1\u09B0 \u09AC\u09BF\u09B7\u09AF\u09BC \u09A6\u09BF\u09A8 (Please enter the issue topic)');
      }
      if (!origStance || !origStance.value.trim()) {
        warnings.push('\u0986\u0997\u09C7\u09B0 \u0985\u09AC\u09B8\u09CD\u09A5\u09BE\u09A8 \u09A6\u09BF\u09A8 (Please enter the previous stance)');
      }
      if (!curStance || !curStance.value.trim()) {
        warnings.push('\u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u0985\u09AC\u09B8\u09CD\u09A5\u09BE\u09A8 \u09A6\u09BF\u09A8 (Please enter the current stance)');
      }
      return { warnings: warnings };
    }});
  }
})();

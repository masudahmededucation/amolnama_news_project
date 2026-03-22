/**
 * news-watchdog-bangladesh-proxy-puppet.js
 * Reads Proxy & Puppet Watchdog fields and serializes to #proxy-puppet-json
 * hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #proxy-puppet-master        — puppet master text
 *   #proxy-front-person         — front person text
 *   #proxy-relationship         — relationship textarea
 *   #proxy-evidence-description — evidence textarea
 *   #proxy-incident-date        — incident date
 *   #proxy-benefit-exchange     — benefit textarea
 *   #proxy-source               — source URL
 *   #proxy-puppet-json          — hidden JSON input
 *
 * Exposes: window.newshubWatchdogProxyPuppet = { reset: fn }
 */
(function () {
  'use strict';

  var master       = document.getElementById('proxy-puppet-master');
  var frontPerson  = document.getElementById('proxy-front-person');
  var relationship = document.getElementById('proxy-relationship');
  var evidence     = document.getElementById('proxy-evidence-description');
  var incidentDate = document.getElementById('proxy-incident-date');
  var benefit      = document.getElementById('proxy-benefit-exchange');
  var source       = document.getElementById('proxy-source');
  var hiddenJson   = document.getElementById('proxy-puppet-json');

  if (!hiddenJson) return;

  function serialize() {
    var data = {
      puppetMaster:       master ? master.value.trim() : '',
      frontPerson:        frontPerson ? frontPerson.value.trim() : '',
      relationship:       relationship ? relationship.value.trim() : '',
      evidenceDescription: evidence ? evidence.value.trim() : '',
      incidentDate:       incidentDate ? incidentDate.value : '',
      benefitExchange:    benefit ? benefit.value.trim() : '',
      source:             source ? source.value.trim() : ''
    };
    hiddenJson.value = JSON.stringify(data);
  }

  var fields = [master, frontPerson, relationship, evidence, incidentDate, benefit, source];
  fields.forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', serialize);
  });

  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* ---- Restore UI from saved hidden input JSON ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    try {
      var data = JSON.parse(hiddenJson.value);
      if (master && data.puppetMaster)            master.value       = data.puppetMaster;
      if (frontPerson && data.frontPerson)        frontPerson.value  = data.frontPerson;
      if (relationship && data.relationship)      relationship.value = data.relationship;
      if (evidence && data.evidenceDescription)   evidence.value     = data.evidenceDescription;
      if (incidentDate && data.incidentDate)      incidentDate.value = data.incidentDate;
      if (benefit && data.benefitExchange)        benefit.value      = data.benefitExchange;
      if (source && data.source)                  source.value       = data.source;
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 350);

  window.newshubWatchdogProxyPuppet = {
    reset: function () {
      fields.forEach(function (el) { if (el) el.value = ''; });
      hiddenJson.value = '';
    }
  };

  /* Step validator: require puppet master + front person when section is visible */
  var section = document.getElementById('section-watchdog-proxy-puppet');
  var panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    var step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      if (section && section.style.display === 'none') return { warnings: [] };
      var warnings = [];
      if (!master || !master.value.trim()) {
        warnings.push('\u09A8\u09C7\u09AA\u09A5\u09CD\u09AF\u09C7\u09B0 \u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF/\u0997\u09CB\u09B7\u09CD\u09A0\u09C0 \u09A6\u09BF\u09A8 (Please enter the person/group behind scenes)');
      }
      if (!frontPerson || !frontPerson.value.trim()) {
        warnings.push('\u09B8\u09BE\u09AE\u09A8\u09C7\u09B0 \u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF \u09A6\u09BF\u09A8 (Please enter the front person)');
      }
      return { warnings: warnings };
    }});
  }
})();

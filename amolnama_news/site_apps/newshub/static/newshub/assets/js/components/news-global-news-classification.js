/**
 * news-global-news-classification.js
 * Serializes the Significance & Story Status section (part of Step 3
 * of the Global News form) into a hidden JSON input.
 *
 * News sub-type is handled separately by news-global-news-sub-type.js
 * (dropdown with direct POST as global_news_sub_type).
 *
 * DOM dependencies:
 *   #global-news-classification-json  — hidden input (JSON payload)
 *   #global-news-significance-group   — container (DB-driven radios from news-significance-data)
 *   #global-news-significance         — hidden input (significance status_id)
 *   #news-significance-data           — JSON embed (ref_status data)
 *   #global-news-is-developing        — checkbox
 *   #global-news-is-breaking          — checkbox
 *   #global-news-has-bangladesh-angle — checkbox
 */
(function () {
  'use strict';

  const hiddenInput = document.getElementById('global-news-classification-json');
  if (!hiddenInput) return;

  const significanceHidden = document.getElementById('global-news-significance');
  const isDevelopingEl     = document.getElementById('global-news-is-developing');
  const isBreakingEl      = document.getElementById('global-news-is-breaking');
  const hasBdAngleEl      = document.getElementById('global-news-has-bangladesh-angle');

  /* ---- Build significance radios from JSON embed ---- */
  const sigGroup = document.getElementById('global-news-significance-group');
  const sigDataEl = document.getElementById('news-significance-data');
  if (sigGroup && sigDataEl) {
    try {
      const sigOptions = JSON.parse(sigDataEl.textContent || '[]');
      sigGroup.innerHTML = '';
      sigOptions.forEach(function (opt) {
        const label = document.createElement('label');
        label.className = 'radio-inline';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'global_news_significance_radio';
        radio.value = opt.status_id;
        radio.id = 'global_news_significance_radio-' + opt.status_id;
        const icon = opt.status_icon ? opt.status_icon + ' ' : '';
        label.appendChild(radio);
        label.appendChild(document.createTextNode(' ' + icon + opt.status_name_bn + ' (' + opt.status_name_en + ')'));
        sigGroup.appendChild(label);
      });
    } catch (e) { /* ignore parse errors */ }
  }

  /* Bind significance radio group */
  if (sigGroup) {
    sigGroup.addEventListener('change', function (e) {
      if (e.target.type === 'radio' && significanceHidden) {
        significanceHidden.value = e.target.value;
        syncToHiddenInput();
      }
    });
  }

  function collectData() {
    return {
      significanceId:     parseInt(significanceHidden && significanceHidden.value, 10) || 0,
      isDeveloping:       !!(isDevelopingEl && isDevelopingEl.checked),
      isBreaking:         !!(isBreakingEl  && isBreakingEl.checked),
      hasBangladeshAngle: !!(hasBdAngleEl  && hasBdAngleEl.checked)
    };
  }

  function hasAnyData(d) {
    return d.significanceId || d.isDeveloping || d.isBreaking || d.hasBangladeshAngle;
  }

  function syncToHiddenInput() {
    let data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  const section = document.getElementById('section-global-news-classification');
  if (section) {
    section.addEventListener('input', syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  const form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

  /* ---- Restore UI from saved hidden input JSON ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    try {
      const data = JSON.parse(hiddenInput.value);
      if (data.significanceId && significanceHidden) {
        significanceHidden.value = data.significanceId;
        let sigRadios = document.querySelectorAll('input[name="global_news_significance_radio"]');
        for (let s = 0; s < sigRadios.length; s++) {
          sigRadios[s].checked = (sigRadios[s].value === String(data.significanceId));
        }
      }
      if (isDevelopingEl) isDevelopingEl.checked = !!data.isDeveloping;
      if (isBreakingEl)   isBreakingEl.checked   = !!data.isBreaking;
      if (hasBdAngleEl)   hasBdAngleEl.checked   = !!data.hasBangladeshAngle;
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  window.newshubGlobalNewsClassification = {
    reset: function () {
      const sigRadios = document.querySelectorAll('input[name="global_news_significance_radio"]');
      for (let s = 0; s < sigRadios.length; s++) sigRadios[s].checked = false;
      if (significanceHidden) significanceHidden.value = '';

      if (isDevelopingEl) isDevelopingEl.checked = false;
      if (isBreakingEl)   isBreakingEl.checked   = false;
      if (hasBdAngleEl)   hasBdAngleEl.checked   = false;

      hiddenInput.value = '';
    }
  };
})();

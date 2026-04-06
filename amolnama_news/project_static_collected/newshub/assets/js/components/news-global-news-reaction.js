/**
 * news-global-news-reaction.js
 * Serializes the International Reaction form (Step 7 of the Global News form)
 * into a hidden JSON input.
 *
 * DOM dependencies:
 *   #global-news-reaction-json           — hidden input (JSON payload)
 *   #global-news-world-reaction-group    — container (DB-driven radios from global-reactions-data)
 *   #global-news-world-reaction          — hidden input (reaction status_id)
 *   #global-reactions-data               — JSON embed (ref_status data)
 *   #global-news-intl-statement          — textarea
 *   #global-news-sanctions-imposed       — checkbox
 *   #global-news-sanctions-row           — wrapper div (toggled by checkbox)
 *   #global-news-sanctions-desc          — textarea
 *   #global-news-agreement-reached       — checkbox
 *   #global-news-agreement-row           — wrapper div (toggled by checkbox)
 *   #global-news-agreement-desc          — textarea
 *   #global-news-media-coverage-group    — container (DB-driven radios from media-coverage-data)
 *   #global-news-media-coverage          — hidden input (coverage status_id)
 *   #media-coverage-data                 — JSON embed (ref_status data)
 */
(function () {
  'use strict';

  const hiddenInput = document.getElementById('global-news-reaction-json');
  if (!hiddenInput) return;

  const worldReactionHidden  = document.getElementById('global-news-world-reaction');
  const intlStatementEl      = document.getElementById('global-news-intl-statement');
  const sanctionsCbEl        = document.getElementById('global-news-sanctions-imposed');
  const sanctionsRow         = document.getElementById('global-news-sanctions-row');
  const sanctionsDescEl      = document.getElementById('global-news-sanctions-desc');
  const agreementCbEl        = document.getElementById('global-news-agreement-reached');
  const agreementRow         = document.getElementById('global-news-agreement-row');
  const agreementDescEl      = document.getElementById('global-news-agreement-desc');
  const mediaCoverageHidden  = document.getElementById('global-news-media-coverage');

  /* ---- Build world reaction radios from JSON embed ---- */
  const reactionGroup = document.getElementById('global-news-world-reaction-group');
  const rxnDataEl = document.getElementById('global-reactions-data');
  if (reactionGroup && rxnDataEl) {
    try {
      const rxnOptions = JSON.parse(rxnDataEl.textContent || '[]');
      reactionGroup.innerHTML = '';
      rxnOptions.forEach(function (opt) {
        let label = document.createElement('label');
        label.className = 'radio-inline';
        let radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'global_news_world_reaction_radio';
        radio.value = opt.status_id;
        radio.id = 'global_news_world_reaction_radio-' + opt.status_id;
        label.appendChild(radio);
        label.appendChild(document.createTextNode(' ' + opt.status_name_bn + ' (' + opt.status_name_en + ')'));
        reactionGroup.appendChild(label);
      });
    } catch (e) { /* ignore parse errors */ }
  }

  /* ---- Build media coverage radios from JSON embed ---- */
  const coverageGroup = document.getElementById('global-news-media-coverage-group');
  const covDataEl = document.getElementById('media-coverage-data');
  if (coverageGroup && covDataEl) {
    try {
      const covOptions = JSON.parse(covDataEl.textContent || '[]');
      coverageGroup.innerHTML = '';
      covOptions.forEach(function (opt) {
        const label = document.createElement('label');
        label.className = 'radio-inline';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'global_news_media_coverage_radio';
        radio.value = opt.status_id;
        radio.id = 'global_news_media_coverage_radio-' + opt.status_id;
        const icon = opt.status_icon ? opt.status_icon + ' ' : '';
        label.appendChild(radio);
        label.appendChild(document.createTextNode(' ' + icon + opt.status_name_bn + ' (' + opt.status_name_en + ')'));
        coverageGroup.appendChild(label);
      });
    } catch (e) { /* ignore parse errors */ }
  }

  /* Bind world reaction radio group */
  if (reactionGroup) {
    reactionGroup.addEventListener('change', function (e) {
      if (e.target.type === 'radio' && worldReactionHidden) {
        worldReactionHidden.value = e.target.value;
        syncToHiddenInput();
      }
    });
  }

  /* Bind media coverage radio group */
  if (coverageGroup) {
    coverageGroup.addEventListener('change', function (e) {
      if (e.target.type === 'radio' && mediaCoverageHidden) {
        mediaCoverageHidden.value = e.target.value;
        syncToHiddenInput();
      }
    });
  }

  /* Toggle conditional rows */
  if (sanctionsCbEl) {
    sanctionsCbEl.addEventListener('change', function () {
      if (sanctionsRow) sanctionsRow.hidden = !sanctionsCbEl.checked;
      syncToHiddenInput();
    });
  }
  if (agreementCbEl) {
    agreementCbEl.addEventListener('change', function () {
      if (agreementRow) agreementRow.hidden = !agreementCbEl.checked;
      syncToHiddenInput();
    });
  }

  function collectData() {
    return {
      worldReactionId:  parseInt(worldReactionHidden && worldReactionHidden.value, 10) || 0,
      intlStatement:    (intlStatementEl     && intlStatementEl.value.trim()) || '',
      sanctionsImposed: !!(sanctionsCbEl     && sanctionsCbEl.checked),
      sanctionsDesc:    (sanctionsDescEl     && sanctionsDescEl.value.trim()) || '',
      agreementReached: !!(agreementCbEl     && agreementCbEl.checked),
      agreementDesc:    (agreementDescEl     && agreementDescEl.value.trim()) || '',
      mediaCoverageId:  parseInt(mediaCoverageHidden && mediaCoverageHidden.value, 10) || 0
    };
  }

  function hasAnyData(d) {
    return d.worldReactionId || d.intlStatement || d.sanctionsImposed
      || d.agreementReached || d.mediaCoverageId;
  }

  function syncToHiddenInput() {
    let data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  const section = document.getElementById('section-global-news-reaction');
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
      if (data.worldReactionId && worldReactionHidden) {
        worldReactionHidden.value = data.worldReactionId;
        let reactionRadios = document.querySelectorAll('input[name="global_news_world_reaction_radio"]');
        for (let i = 0; i < reactionRadios.length; i++) {
          reactionRadios[i].checked = (reactionRadios[i].value === String(data.worldReactionId));
        }
      }
      if (intlStatementEl && data.intlStatement)   intlStatementEl.value     = data.intlStatement;
      if (sanctionsCbEl)                           sanctionsCbEl.checked     = !!data.sanctionsImposed;
      if (sanctionsRow)                            (sanctionsCbEl && sanctionsRow.hidden = !sanctionsCbEl.checked);
      if (sanctionsDescEl && data.sanctionsDesc)   sanctionsDescEl.value     = data.sanctionsDesc;
      if (agreementCbEl)                           agreementCbEl.checked     = !!data.agreementReached;
      if (agreementRow)                            (agreementCbEl && agreementRow.hidden = !agreementCbEl.checked);
      if (agreementDescEl && data.agreementDesc)   agreementDescEl.value     = data.agreementDesc;
      if (data.mediaCoverageId && mediaCoverageHidden) {
        mediaCoverageHidden.value = data.mediaCoverageId;
        let coverageRadios = document.querySelectorAll('input[name="global_news_media_coverage_radio"]');
        for (let c = 0; c < coverageRadios.length; c++) {
          coverageRadios[c].checked = (coverageRadios[c].value === String(data.mediaCoverageId));
        }
      }
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  window.newshubGlobalNewsReaction = {
    reset: function () {
      const reactionRadios = document.querySelectorAll('input[name="global_news_world_reaction_radio"]');
      for (let i = 0; i < reactionRadios.length; i++) reactionRadios[i].checked = false;
      if (worldReactionHidden) worldReactionHidden.value = '';
      if (intlStatementEl)     intlStatementEl.value     = '';

      if (sanctionsCbEl)  sanctionsCbEl.checked  = false;
      if (sanctionsRow)   sanctionsRow.hidden = true;
      if (sanctionsDescEl) sanctionsDescEl.value = '';

      if (agreementCbEl)  agreementCbEl.checked  = false;
      if (agreementRow)   agreementRow.hidden = true;
      if (agreementDescEl) agreementDescEl.value = '';

      const coverageRadios = document.querySelectorAll('input[name="global_news_media_coverage_radio"]');
      for (let c = 0; c < coverageRadios.length; c++) coverageRadios[c].checked = false;
      if (mediaCoverageHidden) mediaCoverageHidden.value = '';

      hiddenInput.value = '';
    }
  };
})();

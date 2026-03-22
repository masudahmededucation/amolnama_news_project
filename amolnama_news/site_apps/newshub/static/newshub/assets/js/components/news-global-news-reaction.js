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

  var hiddenInput = document.getElementById('global-news-reaction-json');
  if (!hiddenInput) return;

  var worldReactionHidden  = document.getElementById('global-news-world-reaction');
  var intlStatementEl      = document.getElementById('global-news-intl-statement');
  var sanctionsCbEl        = document.getElementById('global-news-sanctions-imposed');
  var sanctionsRow         = document.getElementById('global-news-sanctions-row');
  var sanctionsDescEl      = document.getElementById('global-news-sanctions-desc');
  var agreementCbEl        = document.getElementById('global-news-agreement-reached');
  var agreementRow         = document.getElementById('global-news-agreement-row');
  var agreementDescEl      = document.getElementById('global-news-agreement-desc');
  var mediaCoverageHidden  = document.getElementById('global-news-media-coverage');

  /* ---- Build world reaction radios from JSON embed ---- */
  var reactionGroup = document.getElementById('global-news-world-reaction-group');
  var rxnDataEl = document.getElementById('global-reactions-data');
  if (reactionGroup && rxnDataEl) {
    try {
      var rxnOptions = JSON.parse(rxnDataEl.textContent || '[]');
      reactionGroup.innerHTML = '';
      rxnOptions.forEach(function (opt) {
        var label = document.createElement('label');
        label.className = 'radio-inline';
        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'global_news_world_reaction_radio';
        radio.value = opt.status_id;
        label.appendChild(radio);
        label.appendChild(document.createTextNode(' ' + opt.status_name_bn + ' (' + opt.status_name_en + ')'));
        reactionGroup.appendChild(label);
      });
    } catch (e) { /* ignore parse errors */ }
  }

  /* ---- Build media coverage radios from JSON embed ---- */
  var coverageGroup = document.getElementById('global-news-media-coverage-group');
  var covDataEl = document.getElementById('media-coverage-data');
  if (coverageGroup && covDataEl) {
    try {
      var covOptions = JSON.parse(covDataEl.textContent || '[]');
      coverageGroup.innerHTML = '';
      covOptions.forEach(function (opt) {
        var label = document.createElement('label');
        label.className = 'radio-inline';
        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'global_news_media_coverage_radio';
        radio.value = opt.status_id;
        var icon = opt.status_icon ? opt.status_icon + ' ' : '';
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
      if (sanctionsRow) sanctionsRow.style.display = sanctionsCbEl.checked ? '' : 'none';
      syncToHiddenInput();
    });
  }
  if (agreementCbEl) {
    agreementCbEl.addEventListener('change', function () {
      if (agreementRow) agreementRow.style.display = agreementCbEl.checked ? '' : 'none';
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
    var data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  var section = document.getElementById('section-global-news-reaction');
  if (section) {
    section.addEventListener('input', syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  var form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

  /* ---- Restore UI from saved hidden input JSON ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    try {
      var data = JSON.parse(hiddenInput.value);
      if (data.worldReactionId && worldReactionHidden) {
        worldReactionHidden.value = data.worldReactionId;
        var reactionRadios = document.querySelectorAll('input[name="global_news_world_reaction_radio"]');
        for (var i = 0; i < reactionRadios.length; i++) {
          reactionRadios[i].checked = (reactionRadios[i].value == data.worldReactionId);
        }
      }
      if (intlStatementEl && data.intlStatement)   intlStatementEl.value     = data.intlStatement;
      if (sanctionsCbEl)                           sanctionsCbEl.checked     = !!data.sanctionsImposed;
      if (sanctionsRow)                            sanctionsRow.style.display = sanctionsCbEl && sanctionsCbEl.checked ? '' : 'none';
      if (sanctionsDescEl && data.sanctionsDesc)   sanctionsDescEl.value     = data.sanctionsDesc;
      if (agreementCbEl)                           agreementCbEl.checked     = !!data.agreementReached;
      if (agreementRow)                            agreementRow.style.display = agreementCbEl && agreementCbEl.checked ? '' : 'none';
      if (agreementDescEl && data.agreementDesc)   agreementDescEl.value     = data.agreementDesc;
      if (data.mediaCoverageId && mediaCoverageHidden) {
        mediaCoverageHidden.value = data.mediaCoverageId;
        var coverageRadios = document.querySelectorAll('input[name="global_news_media_coverage_radio"]');
        for (var c = 0; c < coverageRadios.length; c++) {
          coverageRadios[c].checked = (coverageRadios[c].value == data.mediaCoverageId);
        }
      }
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  window.newshubGlobalNewsReaction = {
    reset: function () {
      var reactionRadios = document.querySelectorAll('input[name="global_news_world_reaction_radio"]');
      for (var i = 0; i < reactionRadios.length; i++) reactionRadios[i].checked = false;
      if (worldReactionHidden) worldReactionHidden.value = '';
      if (intlStatementEl)     intlStatementEl.value     = '';

      if (sanctionsCbEl)  sanctionsCbEl.checked  = false;
      if (sanctionsRow)   sanctionsRow.style.display  = 'none';
      if (sanctionsDescEl) sanctionsDescEl.value = '';

      if (agreementCbEl)  agreementCbEl.checked  = false;
      if (agreementRow)   agreementRow.style.display  = 'none';
      if (agreementDescEl) agreementDescEl.value = '';

      var coverageRadios = document.querySelectorAll('input[name="global_news_media_coverage_radio"]');
      for (var c = 0; c < coverageRadios.length; c++) coverageRadios[c].checked = false;
      if (mediaCoverageHidden) mediaCoverageHidden.value = '';

      hiddenInput.value = '';
    }
  };
})();

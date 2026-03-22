/**
 * news-global-news-bangladesh.js
 * Serializes the Bangladesh Connection & Impact form (Step 6 of the Global News
 * form) into a hidden JSON input.
 *
 * DOM dependencies:
 *   #global-news-bangladesh-json      — hidden input (JSON payload)
 *   #global-news-bd-relevance-group   — container (DB-driven radios from bd-relevance-data)
 *   #global-news-bd-relevance         — hidden input (relevance status_id)
 *   #bd-relevance-data                — JSON embed (ref_status data)
 *   #global-news-bd-stake             — textarea
 *   #global-news-bd-expat-affected    — checkbox
 *   #global-news-bd-expat-row         — wrapper div (toggled by checkbox)
 *   #global-news-bd-expat-count       — number input
 *   #global-news-bd-expat-desc        — textarea
 *   #global-news-bd-economic-impact   — textarea
 *   #global-news-bd-govt-position     — textarea
 */
(function () {
  'use strict';

  var hiddenInput = document.getElementById('global-news-bangladesh-json');
  if (!hiddenInput) return;

  var relevanceHidden   = document.getElementById('global-news-bd-relevance');
  var stakeEl           = document.getElementById('global-news-bd-stake');
  var expatCbEl         = document.getElementById('global-news-bd-expat-affected');
  var expatRow          = document.getElementById('global-news-bd-expat-row');
  var expatCountEl      = document.getElementById('global-news-bd-expat-count');
  var expatDescEl       = document.getElementById('global-news-bd-expat-desc');
  var economicImpactEl  = document.getElementById('global-news-bd-economic-impact');
  var govtPositionEl    = document.getElementById('global-news-bd-govt-position');

  /* ---- Build BD relevance radios from JSON embed ---- */
  var relevanceGroup = document.getElementById('global-news-bd-relevance-group');
  var relDataEl = document.getElementById('bd-relevance-data');
  if (relevanceGroup && relDataEl) {
    try {
      var relOptions = JSON.parse(relDataEl.textContent || '[]');
      relevanceGroup.innerHTML = '';
      relOptions.forEach(function (opt) {
        var label = document.createElement('label');
        label.className = 'radio-inline';
        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'global_news_bd_relevance_radio';
        radio.value = opt.status_id;
        var icon = opt.status_icon ? opt.status_icon + ' ' : '';
        label.appendChild(radio);
        label.appendChild(document.createTextNode(' ' + icon + opt.status_name_bn + ' (' + opt.status_name_en + ')'));
        relevanceGroup.appendChild(label);
      });
    } catch (e) { /* ignore parse errors */ }
  }

  /* Bind relevance radio group */
  if (relevanceGroup) {
    relevanceGroup.addEventListener('change', function (e) {
      if (e.target.type === 'radio' && relevanceHidden) {
        relevanceHidden.value = e.target.value;
        syncToHiddenInput();
      }
    });
  }

  /* Toggle expat impact rows */
  if (expatCbEl) {
    expatCbEl.addEventListener('change', function () {
      if (expatRow) expatRow.style.display = expatCbEl.checked ? '' : 'none';
      syncToHiddenInput();
    });
  }

  function collectData() {
    return {
      relevanceId:    parseInt(relevanceHidden && relevanceHidden.value, 10) || 0,
      stake:          (stakeEl          && stakeEl.value.trim())         || '',
      expatAffected:  !!(expatCbEl      && expatCbEl.checked),
      expatCount:     parseInt(expatCountEl && expatCountEl.value, 10) || 0,
      expatDesc:      (expatDescEl      && expatDescEl.value.trim())     || '',
      economicImpact: (economicImpactEl && economicImpactEl.value.trim()) || '',
      govtPosition:   (govtPositionEl   && govtPositionEl.value.trim())  || ''
    };
  }

  function hasAnyData(d) {
    return d.relevanceId || d.stake || d.expatAffected || d.economicImpact || d.govtPosition;
  }

  function syncToHiddenInput() {
    var data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  var section = document.getElementById('section-global-news-bangladesh');
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
      if (data.relevanceId && relevanceHidden) {
        relevanceHidden.value = data.relevanceId;
        var relRadios = document.querySelectorAll('input[name="global_news_bd_relevance_radio"]');
        for (var i = 0; i < relRadios.length; i++) {
          relRadios[i].checked = (relRadios[i].value == data.relevanceId);
        }
      }
      if (stakeEl && data.stake)                   stakeEl.value          = data.stake;
      if (expatCbEl)                               expatCbEl.checked      = !!data.expatAffected;
      if (expatRow)                                expatRow.style.display = expatCbEl && expatCbEl.checked ? '' : 'none';
      if (expatCountEl && data.expatCount)         expatCountEl.value     = data.expatCount;
      if (expatDescEl && data.expatDesc)           expatDescEl.value      = data.expatDesc;
      if (economicImpactEl && data.economicImpact) economicImpactEl.value = data.economicImpact;
      if (govtPositionEl && data.govtPosition)     govtPositionEl.value   = data.govtPosition;
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 350);

  window.newshubGlobalNewsBangladesh = {
    reset: function () {
      var relRadios = document.querySelectorAll('input[name="global_news_bd_relevance_radio"]');
      for (var i = 0; i < relRadios.length; i++) relRadios[i].checked = false;
      if (relevanceHidden)  relevanceHidden.value  = '';
      if (stakeEl)          stakeEl.value          = '';
      if (expatCbEl)        expatCbEl.checked       = false;
      if (expatRow)         expatRow.style.display  = 'none';
      if (expatCountEl)     expatCountEl.value      = '';
      if (expatDescEl)      expatDescEl.value       = '';
      if (economicImpactEl) economicImpactEl.value  = '';
      if (govtPositionEl)   govtPositionEl.value    = '';
      hiddenInput.value = '';
    }
  };
})();

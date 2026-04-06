/**
 * news-war-conflict-geopolitics.js
 * Reads geopolitics fields (global reaction, 4 strategic impact checkboxes,
 * local impact checkbox + description) and serializes to
 * #global-geopolitics-json hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #global-reaction                    — select (populated from global-reactions-data)
 *   #global-reaction-details            — textarea (reaction detail text)
 *   #global-strategic-currency-economy  — checkbox (مুদ্রা ও অর্থনীতি)
 *   #global-strategic-food-supply       — checkbox (খাদ্য সরবরাহ)
 *   #global-strategic-oil-energy        — checkbox (তেল ও জ্বালানি)
 *   #global-strategic-shipping-lanes    — checkbox (শিপিং রুট)
 *   #global-local-impact                — checkbox
 *   #global-local-impact-description    — textarea (shown/hidden by checkbox)
 *   #global-local-impact-row            — row container (toggled)
 *   #global-geopolitics-json            — hidden JSON input for form submission
 *   #global-reactions-data              — CSP-safe JSON with global reaction list
 *
 * Serializes to:
 *   globalReactionId, globalReactionDetails,
 *   strategicCurrencyEconomy, strategicFoodSupply, strategicOilEnergy, strategicShippingLanes,
 *   localImpact, localImpactDescription
 *
 * Maps to DB columns in conflict_form_impact:
 *   link_conflict_form_global_reaction_id, global_reaction_details_bn,
 *   global_is_impact_currency_economy, global_is_impact_food_supply,
 *   global_is_impact_oil_energy, global_is_impact_shipping_lanes,
 *   local_has_bangladesh_impact, local_impact_description_bn
 *
 * Exposes: window.newshubGlobalGeopolitics = { reset: fn }
 */
(function () {
  'use strict';

  const globalReaction = document.getElementById('global-reaction');
  const globalReactionDetails = document.getElementById('global-reaction-details');
  const strategicCurrencyEconomy = document.getElementById('global-strategic-currency-economy');
  const strategicFoodSupply = document.getElementById('global-strategic-food-supply');
  const strategicOilEnergy = document.getElementById('global-strategic-oil-energy');
  const strategicShippingLanes = document.getElementById('global-strategic-shipping-lanes');
  const localImpact = document.getElementById('global-local-impact');
  const localImpactDesc = document.getElementById('global-local-impact-description');
  const localImpactRow = document.getElementById('global-local-impact-row');
  const hiddenJson = document.getElementById('global-geopolitics-json');

  if (!hiddenJson) return;

  /* ========== Parse reference data ========== */

  function parseJsonData(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  const globalReactions = parseJsonData('global-reactions-data');

  /* Populate global reaction dropdown */
  if (globalReaction && globalReactions.length) {
    for (let r = 0; r < globalReactions.length; r++) {
      const s = globalReactions[r];
      const opt = document.createElement('option');
      opt.value = s.status_id;
      opt.textContent = (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')';
      globalReaction.appendChild(opt);
    }
  }

  /* Toggle local impact row visibility */
  function toggleLocalImpactRow() {
    if (!localImpact || !localImpactRow) return;
    localImpactRow.hidden = !localImpact.checked;
    if (!localImpact.checked && localImpactDesc) {
      localImpactDesc.value = '';
    }
  }

  function serialize() {
    let data = {
      globalReactionId: globalReaction ? (parseInt(globalReaction.value, 10) || 0) : 0,
      globalReactionDetails: globalReactionDetails ? globalReactionDetails.value.trim() : '',
      strategicCurrencyEconomy: strategicCurrencyEconomy ? strategicCurrencyEconomy.checked : false,
      strategicFoodSupply: strategicFoodSupply ? strategicFoodSupply.checked : false,
      strategicOilEnergy: strategicOilEnergy ? strategicOilEnergy.checked : false,
      strategicShippingLanes: strategicShippingLanes ? strategicShippingLanes.checked : false,
      localImpact: localImpact ? localImpact.checked : false,
      localImpactDescription: localImpactDesc ? localImpactDesc.value.trim() : '',
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for changes */
  if (globalReaction) globalReaction.addEventListener('change', serialize);
  if (globalReactionDetails) globalReactionDetails.addEventListener('input', serialize);

  const strategicCheckboxes = [strategicCurrencyEconomy, strategicFoodSupply, strategicOilEnergy, strategicShippingLanes];
  for (let i = 0; i < strategicCheckboxes.length; i++) {
    if (strategicCheckboxes[i]) strategicCheckboxes[i].addEventListener('change', serialize);
  }

  /* Local impact: toggle + serialize */
  if (localImpact) {
    localImpact.addEventListener('change', function () {
      toggleLocalImpactRow();
      serialize();
    });
  }

  if (localImpactDesc) {
    localImpactDesc.addEventListener('input', serialize);
  }

  /* Serialize before form submit */
  const form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* Initial state */
  toggleLocalImpactRow();

  /* ---- Restore UI from saved hidden input JSON ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    try {
      const data = JSON.parse(hiddenJson.value);
      if (globalReaction && data.globalReactionId)             globalReaction.value        = data.globalReactionId;
      if (globalReactionDetails && data.globalReactionDetails) globalReactionDetails.value = data.globalReactionDetails;
      if (strategicCurrencyEconomy) strategicCurrencyEconomy.checked = !!data.strategicCurrencyEconomy;
      if (strategicFoodSupply)      strategicFoodSupply.checked      = !!data.strategicFoodSupply;
      if (strategicOilEnergy)       strategicOilEnergy.checked       = !!data.strategicOilEnergy;
      if (strategicShippingLanes)   strategicShippingLanes.checked   = !!data.strategicShippingLanes;
      if (localImpact)              localImpact.checked              = !!data.localImpact;
      if (localImpactDesc && data.localImpactDescription) localImpactDesc.value = data.localImpactDescription;
      toggleLocalImpactRow();
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear */
  window.newshubGlobalGeopolitics = {
    reset: function () {
      if (globalReaction) globalReaction.selectedIndex = 0;
      if (globalReactionDetails) globalReactionDetails.value = '';
      for (let i = 0; i < strategicCheckboxes.length; i++) {
        if (strategicCheckboxes[i]) strategicCheckboxes[i].checked = false;
      }
      if (localImpact) localImpact.checked = false;
      if (localImpactDesc) localImpactDesc.value = '';
      toggleLocalImpactRow();
      hiddenJson.value = '';
    },
  };
})();

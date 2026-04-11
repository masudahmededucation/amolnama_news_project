/**
 * news-july-uprising-context.js
 * Reads context fields (protest scale, internet status, curfew status)
 * and serializes to #july-context-json hidden input
 * on change and before form submit.
 *
 * DOM dependencies:
 *   #july-scale            — select
 *   #july-internet-status  — select
 *   #july-curfew-status    — select
 *   #july-context-json     — hidden JSON input for form submission
 *
 * Exposes: window.newshubJulyContext = { reset: callback }
 */
(function () {
  'use strict';

  const scale = document.getElementById('july-scale');
  const internetStatus = document.getElementById('july-internet-status');
  const curfewStatus = document.getElementById('july-curfew-status');
  const hiddenJson = document.getElementById('july-context-json');

  if (!hiddenJson) return;

  function serialize() {
    let data = {
      scale: scale ? scale.value : '',
      internetStatus: internetStatus ? internetStatus.value : '',
      curfewStatus: curfewStatus ? curfewStatus.value : '',
    };
    hiddenJson.value = JSON.stringify(data);
  }

  const fields = [scale, internetStatus, curfewStatus];
  fields.forEach(function (element) {
    if (element) element.addEventListener('change', serialize);
  });

  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* ========== Restore from saved data ========== */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }
    if (!data || typeof data !== 'object') return;

    if (scale && data.scale) {
      scale.value = data.scale;
      if (scale.tomselect) scale.tomselect.setValue(data.scale, true);
    }
    if (internetStatus && data.internetStatus) {
      internetStatus.value = data.internetStatus;
      if (internetStatus.tomselect) internetStatus.tomselect.setValue(data.internetStatus, true);
    }
    if (curfewStatus && data.curfewStatus) {
      curfewStatus.value = data.curfewStatus;
      if (curfewStatus.tomselect) curfewStatus.tomselect.setValue(data.curfewStatus, true);
    }
  }

  setTimeout(restoreFromSavedData, 100);

  window.newshubJulyContext = {
    reset: function () {
      if (scale) scale.selectedIndex = 0;
      if (internetStatus) internetStatus.selectedIndex = 0;
      if (curfewStatus) curfewStatus.selectedIndex = 0;
      hiddenJson.value = '';
    },
  };
})();

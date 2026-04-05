/**
 * news-entertainment-project.js
 * Reads project fields (platform, project stage, IP type, rumor flag)
 * and serializes to #entertainment-project-json hidden input
 * on change and before form submit.
 *
 * DOM dependencies:
 *   #entertainment-platform            — select
 *   #entertainment-project-stage       — select
 *   input[name="entertainment_ip_type"] — radio buttons
 *   #entertainment-rumor               — checkbox
 *   #entertainment-project-json        — hidden JSON input for form submission
 *
 * Exposes: window.newshubEntertainmentProject = { reset: fn }
 */
(function () {
  'use strict';

  const platform = document.getElementById('entertainment-platform');
  const projectStage = document.getElementById('entertainment-project-stage');
  const ipRadios = document.querySelectorAll('input[name="entertainment_ip_type"]');
  const rumorCheckbox = document.getElementById('entertainment-rumor');
  const hiddenJson = document.getElementById('entertainment-project-json');

  if (!hiddenJson) return;

  function getIpType() {
    for (let i = 0; i < ipRadios.length; i++) {
      if (ipRadios[i].checked) return ipRadios[i].value;
    }
    return 'original';
  }

  function serialize() {
    let data = {
      platform: platform ? platform.value : '',
      projectStage: projectStage ? projectStage.value : '',
      ipType: getIpType(),
      isRumor: rumorCheckbox ? rumorCheckbox.checked : false,
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for changes on selects */
  const changeFields = [platform, projectStage];
  changeFields.forEach(function (el) {
    if (el) el.addEventListener('change', serialize);
  });

  /* Listen for changes on IP type radios */
  for (let i = 0; i < ipRadios.length; i++) {
    ipRadios[i].addEventListener('change', serialize);
  }

  /* Listen for rumor checkbox */
  if (rumorCheckbox) {
    rumorCheckbox.addEventListener('change', serialize);
  }

  /* Serialize before form submit */
  const form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }

    if (platform && data.platform)         platform.value     = data.platform;
    if (projectStage && data.projectStage) projectStage.value = data.projectStage;
    if (data.ipType) {
      for (let j = 0; j < ipRadios.length; j++) {
        if (ipRadios[j].value === data.ipType) {
          ipRadios[j].checked = true;
          break;
        }
      }
    }
    if (rumorCheckbox) rumorCheckbox.checked = !!data.isRumor;
  }
  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear */
  window.newshubEntertainmentProject = {
    reset: function () {
      if (platform) platform.selectedIndex = 0;
      if (projectStage) projectStage.selectedIndex = 0;
      if (ipRadios.length > 0) ipRadios[0].checked = true;
      if (rumorCheckbox) rumorCheckbox.checked = false;
      hiddenJson.value = '';
    },
  };

  /* Step validator: require platform selection */
  const panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      const warnings = [];
      if (!platform || !platform.value) {
        warnings.push('প্ল্যাটফর্ম নির্বাচন করুন (Please select a platform)');
      }
      return { warnings: warnings };
    }});
  }
})();

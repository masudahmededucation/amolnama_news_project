/**
 * news-july-uprising-story.js
 * Reads story fields (last words, life story, how joined,
 * breadwinner status, dependents, family impact) and serializes
 * to #july-story-json hidden input on input/change and before form submit.
 *
 * Toggles dependents row based on breadwinner checkbox.
 *
 * DOM dependencies:
 *   #july-last-words       — textarea
 *   #july-life-story       — textarea
 *   #july-how-joined       — textarea
 *   #july-breadwinner      — checkbox
 *   #july-dependents-row   — conditional row container
 *   #july-dependents       — number input
 *   #july-family-impact    — textarea
 *   #july-story-json       — hidden JSON input for form submission
 *
 * Exposes: window.newshubJulyStory = { reset: callback }
 */
(function () {
  'use strict';

  const lastWords = document.getElementById('july-last-words');
  const lifeStory = document.getElementById('july-life-story');
  const howJoined = document.getElementById('july-how-joined');
  const breadwinner = document.getElementById('july-breadwinner');
  const dependentsRow = document.getElementById('july-dependents-row');
  const dependents = document.getElementById('july-dependents');
  const familyImpact = document.getElementById('july-family-impact');
  const hiddenJson = document.getElementById('july-story-json');

  if (!hiddenJson) return;

  function toggleDependentsRow() {
    if (dependentsRow) {
      (breadwinner && dependentsRow.hidden = !breadwinner.checked);
    }
  }

  function serialize() {
    let data = {
      lastWords: lastWords ? lastWords.value.trim() : '',
      lifeStory: lifeStory ? lifeStory.value.trim() : '',
      howJoined: howJoined ? howJoined.value.trim() : '',
      breadwinner: breadwinner ? breadwinner.checked : false,
      dependents: (breadwinner && breadwinner.checked && dependents) ? dependents.value : '',
      familyImpact: familyImpact ? familyImpact.value.trim() : '',
    };
    hiddenJson.value = JSON.stringify(data);
  }

  const textFields = [lastWords, lifeStory, howJoined, familyImpact];
  textFields.forEach(function (element) {
    if (element) element.addEventListener('input', serialize);
  });

  if (dependents) dependents.addEventListener('input', serialize);

  if (breadwinner) {
    breadwinner.addEventListener('change', function () {
      toggleDependentsRow();
      serialize();
    });
  }

  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  toggleDependentsRow();

  /* ========== Restore from saved data ========== */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }
    if (!data || typeof data !== 'object') return;

    if (lastWords && data.lastWords) lastWords.value = data.lastWords;
    if (lifeStory && data.lifeStory) lifeStory.value = data.lifeStory;
    if (howJoined && data.howJoined) howJoined.value = data.howJoined;
    if (breadwinner && data.breadwinner) breadwinner.checked = true;
    if (dependents && data.dependents) dependents.value = data.dependents;
    if (familyImpact && data.familyImpact) familyImpact.value = data.familyImpact;

    toggleDependentsRow();
  }

  setTimeout(restoreFromSavedData, 100);

  window.newshubJulyStory = {
    reset: function () {
      if (lastWords) lastWords.value = '';
      if (lifeStory) lifeStory.value = '';
      if (howJoined) howJoined.value = '';
      if (breadwinner) breadwinner.checked = false;
      if (dependents) dependents.value = '';
      if (familyImpact) familyImpact.value = '';
      toggleDependentsRow();
      hiddenJson.value = '';
    },
  };
})();

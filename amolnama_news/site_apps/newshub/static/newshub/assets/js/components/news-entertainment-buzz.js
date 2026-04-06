/**
 * news-entertainment-buzz.js
 * Reads buzz fields (audience sentiment, trending hashtag, meme factor,
 * plagiarism checkbox + source, boycott level) and serializes to
 * #entertainment-buzz-json hidden input on input/change and before form submit.
 *
 * Toggles plagiarism source row based on checkbox state.
 *
 * DOM dependencies:
 *   input[name="entertainment_sentiment"]  — radio buttons
 *   #entertainment-trending-hashtag        — text input
 *   #entertainment-meme-factor             — select
 *   #entertainment-plagiarism-check        — checkbox
 *   #entertainment-plagiarism-row          — conditional row container
 *   #entertainment-plagiarism-source       — text input
 *   #entertainment-boycott-level           — select
 *   #entertainment-buzz-json               — hidden JSON input for form submission
 *
 * Exposes: window.newshubEntertainmentBuzz = { reset: fn }
 */
(function () {
  'use strict';

  const sentimentRadios = document.querySelectorAll('input[name="entertainment_sentiment"]');
  const trendingHashtag = document.getElementById('entertainment-trending-hashtag');
  const memeFactor = document.getElementById('entertainment-meme-factor');
  const plagiarismCheck = document.getElementById('entertainment-plagiarism-check');
  const plagiarismRow = document.getElementById('entertainment-plagiarism-row');
  const plagiarismSource = document.getElementById('entertainment-plagiarism-source');
  const boycottLevel = document.getElementById('entertainment-boycott-level');
  const hiddenJson = document.getElementById('entertainment-buzz-json');

  if (!hiddenJson) return;

  function getSentiment() {
    for (let i = 0; i < sentimentRadios.length; i++) {
      if (sentimentRadios[i].checked) return sentimentRadios[i].value;
    }
    return '';
  }

  /* Toggle plagiarism source row based on checkbox */
  function togglePlagiarismRow() {
    if (plagiarismRow) {
      (plagiarismCheck && plagiarismRow.hidden = !plagiarismCheck.checked);
    }
  }

  function serialize() {
    let data = {
      sentiment: getSentiment(),
      trendingHashtag: trendingHashtag ? trendingHashtag.value.trim() : '',
      memeFactor: memeFactor ? memeFactor.value : '',
      plagiarism: plagiarismCheck ? plagiarismCheck.checked : false,
      plagiarismSource: (plagiarismCheck && plagiarismCheck.checked && plagiarismSource)
        ? plagiarismSource.value.trim() : '',
      boycottLevel: boycottLevel ? boycottLevel.value : '',
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for changes on sentiment radios */
  for (let i = 0; i < sentimentRadios.length; i++) {
    sentimentRadios[i].addEventListener('change', serialize);
  }

  /* Listen for input on text fields */
  const inputFields = [trendingHashtag, plagiarismSource];
  inputFields.forEach(function (el) {
    if (el) el.addEventListener('input', serialize);
  });

  /* Listen for changes on selects */
  const changeFields = [memeFactor, boycottLevel];
  changeFields.forEach(function (el) {
    if (el) el.addEventListener('change', serialize);
  });

  /* Listen for plagiarism checkbox */
  if (plagiarismCheck) {
    plagiarismCheck.addEventListener('change', function () {
      togglePlagiarismRow();
      serialize();
    });
  }

  /* Serialize before form submit */
  const form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* Initial state */
  togglePlagiarismRow();

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }

    if (data.sentiment) {
      for (let j = 0; j < sentimentRadios.length; j++) {
        if (sentimentRadios[j].value === data.sentiment) {
          sentimentRadios[j].checked = true;
          break;
        }
      }
    }
    if (trendingHashtag && data.trendingHashtag) trendingHashtag.value = data.trendingHashtag;
    if (memeFactor && data.memeFactor)           memeFactor.value      = data.memeFactor;
    if (plagiarismCheck)                         plagiarismCheck.checked = !!data.plagiarism;
    if (plagiarismSource && data.plagiarismSource) plagiarismSource.value = data.plagiarismSource;
    if (boycottLevel && data.boycottLevel)       boycottLevel.value    = data.boycottLevel;
    togglePlagiarismRow();
  }
  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear */
  window.newshubEntertainmentBuzz = {
    reset: function () {
      for (let j = 0; j < sentimentRadios.length; j++) {
        sentimentRadios[j].checked = false;
      }
      if (trendingHashtag) trendingHashtag.value = '';
      if (memeFactor) memeFactor.selectedIndex = 0;
      if (plagiarismCheck) plagiarismCheck.checked = false;
      if (plagiarismSource) plagiarismSource.value = '';
      if (boycottLevel) boycottLevel.selectedIndex = 0;
      togglePlagiarismRow();
      hiddenJson.value = '';
    },
  };
})();

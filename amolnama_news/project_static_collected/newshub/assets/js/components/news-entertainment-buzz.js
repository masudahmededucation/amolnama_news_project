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

  var sentimentRadios = document.querySelectorAll('input[name="entertainment_sentiment"]');
  var trendingHashtag = document.getElementById('entertainment-trending-hashtag');
  var memeFactor = document.getElementById('entertainment-meme-factor');
  var plagiarismCheck = document.getElementById('entertainment-plagiarism-check');
  var plagiarismRow = document.getElementById('entertainment-plagiarism-row');
  var plagiarismSource = document.getElementById('entertainment-plagiarism-source');
  var boycottLevel = document.getElementById('entertainment-boycott-level');
  var hiddenJson = document.getElementById('entertainment-buzz-json');

  if (!hiddenJson) return;

  function getSentiment() {
    for (var i = 0; i < sentimentRadios.length; i++) {
      if (sentimentRadios[i].checked) return sentimentRadios[i].value;
    }
    return '';
  }

  /* Toggle plagiarism source row based on checkbox */
  function togglePlagiarismRow() {
    if (plagiarismRow) {
      plagiarismRow.style.display = (plagiarismCheck && plagiarismCheck.checked) ? '' : 'none';
    }
  }

  function serialize() {
    var data = {
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
  for (var i = 0; i < sentimentRadios.length; i++) {
    sentimentRadios[i].addEventListener('change', serialize);
  }

  /* Listen for input on text fields */
  var inputFields = [trendingHashtag, plagiarismSource];
  inputFields.forEach(function (el) {
    if (el) el.addEventListener('input', serialize);
  });

  /* Listen for changes on selects */
  var changeFields = [memeFactor, boycottLevel];
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
  var form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* Initial state */
  togglePlagiarismRow();

  /* Public API for form-clear */
  window.newshubEntertainmentBuzz = {
    reset: function () {
      for (var j = 0; j < sentimentRadios.length; j++) {
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

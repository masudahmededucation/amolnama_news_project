/**
 * news-entertainment-production.js
 * Serializes the Production Details form (Step 4 of the Entertainment form)
 * into a hidden JSON input #entertainment-production-json.
 *
 * DOM dependencies:
 *   #entertainment-production-json  — hidden input (JSON payload)
 *   #entertainment-title            — text (title/name)
 *   #entertainment-language-select  — select (language)
 *   #entertainment-industry-select  — select (industry/origin)
 *   #entertainment-director         — text
 *   #entertainment-producer         — text
 *   #entertainment-writer           — text
 *   #entertainment-music-director   — text
 */
(function () {
  'use strict';

  var hiddenInput     = document.getElementById('entertainment-production-json');
  if (!hiddenInput) return;

  var titleEl         = document.getElementById('entertainment-title');
  var languageSelect  = document.getElementById('entertainment-language-select');
  var industrySelect  = document.getElementById('entertainment-industry-select');
  var directorEl      = document.getElementById('entertainment-director');
  var producerEl      = document.getElementById('entertainment-producer');
  var writerEl        = document.getElementById('entertainment-writer');
  var musicEl         = document.getElementById('entertainment-music-director');

  function v(el) { return el && el.value.trim() || ''; }
  function sel(el) { return el && el.value || ''; }

  function collectData() {
    return {
      title:         v(titleEl),
      language:      sel(languageSelect),
      industry:      sel(industrySelect),
      director:      v(directorEl),
      producer:      v(producerEl),
      writer:        v(writerEl),
      musicDirector: v(musicEl)
    };
  }

  function hasAnyData(d) {
    return d.title || d.language || d.industry || d.director
      || d.producer || d.writer || d.musicDirector;
  }

  function syncToHiddenInput() {
    var data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  var section = document.getElementById('section-entertainment-production');
  if (section) {
    section.addEventListener('input',  syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  var form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    var data;
    try { data = JSON.parse(hiddenInput.value); } catch (e) { return; }

    if (titleEl && data.title)               titleEl.value        = data.title;
    if (languageSelect && data.language)     languageSelect.value = data.language;
    if (industrySelect && data.industry)     industrySelect.value = data.industry;
    if (directorEl && data.director)         directorEl.value     = data.director;
    if (producerEl && data.producer)         producerEl.value     = data.producer;
    if (writerEl && data.writer)             writerEl.value       = data.writer;
    if (musicEl && data.musicDirector)       musicEl.value        = data.musicDirector;
  }
  setTimeout(restoreFromSavedData, 100);

  /* ---- Public API for form-clear.js ---- */
  window.newshubEntertainmentProduction = {
    reset: function () {
      if (titleEl)        titleEl.value        = '';
      if (languageSelect) languageSelect.value = '';
      if (industrySelect) industrySelect.value = '';
      if (directorEl)     directorEl.value     = '';
      if (producerEl)     producerEl.value     = '';
      if (writerEl)       writerEl.value       = '';
      if (musicEl)        musicEl.value        = '';
      hiddenInput.value = '';
    }
  };
})();

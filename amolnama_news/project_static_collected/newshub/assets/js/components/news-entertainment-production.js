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

  const hiddenInput     = document.getElementById('entertainment-production-json');
  if (!hiddenInput) return;

  const titleEl         = document.getElementById('entertainment-title');
  const languageSelect  = document.getElementById('entertainment-language-select');
  const industrySelect  = document.getElementById('entertainment-industry-select');
  const directorEl      = document.getElementById('entertainment-director');
  const producerEl      = document.getElementById('entertainment-producer');
  const writerEl        = document.getElementById('entertainment-writer');
  const musicEl         = document.getElementById('entertainment-music-director');

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
    let data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  const section = document.getElementById('section-entertainment-production');
  if (section) {
    section.addEventListener('input',  syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  const form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    let data;
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

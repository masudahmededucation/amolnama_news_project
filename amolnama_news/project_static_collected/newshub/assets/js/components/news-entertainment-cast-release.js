/**
 * news-entertainment-cast-release.js
 * Serializes the Cast & Release form (Step 5 of the Entertainment form)
 * into a hidden JSON input #entertainment-cast-release-json.
 *
 * DB table: [investigation].[entertainment_form_fact]
 * Saved keys: leadCast, suppCast, releaseDate, platform, genre
 *
 * DOM dependencies:
 *   #entertainment-cast-release-json  — hidden input (JSON payload)
 *   #entertainment-lead-cast          — textarea
 *   #entertainment-supporting-cast    — textarea
 *   #entertainment-release-date       — date input
 *   #entertainment-platform-select    — select
 *   #entertainment-genre-select       — select (single)
 */
(function () {
  'use strict';

  const hiddenInput      = document.getElementById('entertainment-cast-release-json');
  if (!hiddenInput) return;

  const leadCastEl       = document.getElementById('entertainment-lead-cast');
  const suppCastEl       = document.getElementById('entertainment-supporting-cast');
  const releaseDateEl    = document.getElementById('entertainment-release-date');
  const platformSelect   = document.getElementById('entertainment-platform-select');
  const genreSelect      = document.getElementById('entertainment-genre-select');

  function collectData() {
    return {
      leadCast:      (leadCastEl     && leadCastEl.value.trim())     || '',
      suppCast:      (suppCastEl     && suppCastEl.value.trim())     || '',
      releaseDate:   (releaseDateEl  && releaseDateEl.value)         || '',
      platform:      (platformSelect && platformSelect.value)        || '',
      genre:         (genreSelect    && genreSelect.value)           || ''
    };
  }

  function hasAnyData(d) {
    return d.leadCast || d.suppCast || d.releaseDate || d.platform || d.genre;
  }

  function syncToHiddenInput() {
    let data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  const section = document.getElementById('section-entertainment-cast-release');
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

    if (leadCastEl && data.leadCast)         leadCastEl.value     = data.leadCast;
    if (suppCastEl && data.suppCast)         suppCastEl.value     = data.suppCast;
    if (releaseDateEl && data.releaseDate)   releaseDateEl.value  = data.releaseDate;
    if (platformSelect && data.platform)     platformSelect.value = data.platform;
    if (genreSelect && data.genre)           genreSelect.value    = data.genre;
  }
  setTimeout(restoreFromSavedData, 100);

  /* ---- Public API for form-clear.js ---- */
  window.newshubEntertainmentCastRelease = {
    reset: function () {
      if (leadCastEl)     leadCastEl.value     = '';
      if (suppCastEl)     suppCastEl.value     = '';
      if (releaseDateEl)  releaseDateEl.value  = '';
      if (platformSelect) platformSelect.value = '';
      if (genreSelect)    genreSelect.value    = '';
      hiddenInput.value = '';
    }
  };
})();

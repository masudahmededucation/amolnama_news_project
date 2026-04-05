/**
 * news-social-source-repeater.js
 * Social media source repeater — each row has platform select, URL, embed code.
 * Auto-detects platform from pasted URL. Warns on mismatch.
 * Serializes to #social-source-json as:
 *   { sources: [{ platformId, platformName, url, embedCode }] }
 *
 * DOM dependencies:
 *   #social-source-json              — hidden JSON input
 *   #social-source-row-template      — <template> for cloning rows
 *   #social-source-rows-container    — container div
 *   #btn-add-social-source           — add button
 *
 * Exposes: window.newshubSocialSource = { serialize: fn, reset: fn }
 */
(function () {
  'use strict';

  const hiddenJson = document.getElementById('social-source-json');
  const template = document.getElementById('social-source-row-template');
  const container = document.getElementById('social-source-rows-container');
  const addBtn = document.getElementById('btn-add-social-source');

  if (!hiddenJson || !template || !container) return;

  let rowCounter = 0;

  /* ---- URL ↔ Platform helpers ---- */

  function getHost(url) {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  function getPlatformHost(option) {
    let base = option.getAttribute('data-base-url');
    if (!base) return '';
    if (base.indexOf('://') === -1) base = 'https://' + base;
    return getHost(base);
  }

  function detectPlatform(platformSelect, urlHost) {
    if (!urlHost) return null;
    const options = platformSelect.querySelectorAll('option[data-base-url]');
    for (let i = 0; i < options.length; i++) {
      const pHost = getPlatformHost(options[i]);
      if (pHost && urlHost.indexOf(pHost) !== -1) return options[i];
    }
    return null;
  }

  function checkUrlMatch(rowEl) {
    let platformSelect = rowEl.querySelector('.social-row-platform');
    let urlInput = rowEl.querySelector('.social-row-url');
    const warningEl = rowEl.querySelector('.social-url-mismatch');
    if (!platformSelect || !urlInput || !warningEl) return;

    let url = urlInput.value.trim();
    if (!url) { warningEl.classList.add('display-hidden'); return; }

    const urlHost = getHost(url);
    if (!urlHost) { warningEl.classList.add('display-hidden'); return; }

    const selectedOption = platformSelect.options[platformSelect.selectedIndex];

    /* Auto-select platform if none chosen */
    if (!platformSelect.value) {
      const match = detectPlatform(platformSelect, urlHost);
      if (match) {
        platformSelect.value = match.value;
        platformSelect.dispatchEvent(new Event('change'));
      }
      warningEl.classList.add('display-hidden');
      return;
    }

    /* Check mismatch */
    const platformHost = getPlatformHost(selectedOption);
    if (platformHost && urlHost.indexOf(platformHost) === -1) {
      const detected = detectPlatform(platformSelect, urlHost);
      const hint = detected ? detected.textContent.trim() : urlHost;
      warningEl.textContent = '\u09B2\u09BF\u0982\u0995\u099F\u09BF '
        + selectedOption.textContent.trim()
        + ' \u098F\u09B0 \u09A8\u09AF\u09BC, \u09AE\u09A8\u09C7 \u09B9\u099A\u09CD\u099B\u09C7 '
        + hint
        + ' (URL doesn\'t match ' + selectedOption.textContent.trim() + ')';
      warningEl.classList.remove('display-hidden');
    } else {
      warningEl.classList.add('display-hidden');
    }
  }

  /* ---- Add row ---- */

  function addRow() {
    const index = rowCounter++;
    const clone = template.content.cloneNode(true);
    let rowEl = clone.querySelector('.social-source-row');
    rowEl.setAttribute('data-row-index', index);

    /* Row number label */
    let numEl = rowEl.querySelector('.social-source-row-number');
    if (numEl) numEl.textContent = '\u09B8\u09C2\u09A4\u09CD\u09B0 #' + (index + 1);

    /* Wire remove button */
    const removeBtn = rowEl.querySelector('.btn-remove-social-source');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        removeRow(rowEl);
      });
    }

    /* Wire URL check listeners */
    let urlInput = rowEl.querySelector('.social-row-url');
    let platformSelect = rowEl.querySelector('.social-row-platform');
    if (urlInput) {
      urlInput.addEventListener('input', function () { checkUrlMatch(rowEl); });
      urlInput.addEventListener('change', function () { checkUrlMatch(rowEl); });
    }
    if (platformSelect) {
      platformSelect.addEventListener('change', function () { checkUrlMatch(rowEl); });
    }

    container.appendChild(clone);
    updateRowNumbers();
  }

  /* ---- Remove row ---- */

  function removeRow(rowEl) {
    rowEl.remove();
    updateRowNumbers();
  }

  /* ---- Update row numbers after add/remove ---- */

  function updateRowNumbers() {
    let rows = container.querySelectorAll('.social-source-row');
    for (let i = 0; i < rows.length; i++) {
      const numEl = rows[i].querySelector('.social-source-row-number');
      if (numEl) numEl.textContent = '\u09B8\u09C2\u09A4\u09CD\u09B0 #' + (i + 1);
    }
  }

  /* ---- Serialize ---- */

  function serialize() {
    let rows = container.querySelectorAll('.social-source-row');
    let sources = [];
    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
      let platformSelect = row.querySelector('.social-row-platform');
      let urlInput = row.querySelector('.social-row-url');
      let embedInput = row.querySelector('.social-row-embed');

      const url = urlInput ? urlInput.value.trim() : '';
      if (!url) continue;  /* skip empty rows */

      const platformId = platformSelect ? parseInt(platformSelect.value, 10) || 0 : 0;
      let platformName = '';
      if (platformSelect && platformSelect.selectedIndex > 0) {
        platformName = platformSelect.options[platformSelect.selectedIndex].textContent.trim();
      }

      sources.push({
        platformId: platformId,
        platformName: platformName,
        url: url,
        embedCode: embedInput ? embedInput.value.trim() || '' : ''
      });
    }

    hiddenJson.value = sources.length ? JSON.stringify({ sources: sources }) : '';
  }

  /* ---- Reset ---- */

  function reset() {
    container.innerHTML = '';
    rowCounter = 0;
    hiddenJson.value = '';
    addRow();  /* start with one empty row */
  }

  /* ---- Wire form submit ---- */

  const form = container.closest('form');
  if (form) {
    form.addEventListener('submit', function () { serialize(); });
  }

  /* ---- Wire add button ---- */
  if (addBtn) {
    addBtn.addEventListener('click', function () { addRow(); });
  }

  /* ---- Restore from hidden input (for edit mode pre-population) ---- */
  function restoreFromHiddenInput() {
    const raw = hiddenJson.value;
    if (!raw) return false;
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return false; }
    const sources = parsed.sources || parsed;
    if (!Array.isArray(sources) || !sources.length) return false;

    container.innerHTML = '';
    rowCounter = 0;

    for (let i = 0; i < sources.length; i++) {
      addRow();
      const rows = container.querySelectorAll('.social-source-row');
      const rowEl = rows[rows.length - 1];
      const platformSelect = rowEl.querySelector('.social-row-platform');
      const urlInput = rowEl.querySelector('.social-row-url');
      const embedInput = rowEl.querySelector('.social-row-embed');

      if (urlInput) urlInput.value = sources[i].url || '';
      if (embedInput) embedInput.value = sources[i].embedCode || '';
      if (platformSelect && sources[i].platformId) {
        platformSelect.value = String(sources[i].platformId);
      }
      checkUrlMatch(rowEl);
    }
    return true;
  }

  /* ---- Init: restore saved data or add first empty row ---- */
  if (!restoreFromHiddenInput()) {
    addRow();
  }

  /* ---- Expose API ---- */
  window.newshubSocialSource = {
    serialize: serialize,
    reset: reset
  };
})();

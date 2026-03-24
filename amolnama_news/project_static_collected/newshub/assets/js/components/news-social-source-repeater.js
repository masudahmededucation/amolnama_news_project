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

  var hiddenJson = document.getElementById('social-source-json');
  var template = document.getElementById('social-source-row-template');
  var container = document.getElementById('social-source-rows-container');
  var addBtn = document.getElementById('btn-add-social-source');

  if (!hiddenJson || !template || !container) return;

  var rowCounter = 0;

  /* ---- URL ↔ Platform helpers ---- */

  function getHost(url) {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  function getPlatformHost(option) {
    var base = option.getAttribute('data-base-url');
    if (!base) return '';
    if (base.indexOf('://') === -1) base = 'https://' + base;
    return getHost(base);
  }

  function detectPlatform(platformSelect, urlHost) {
    if (!urlHost) return null;
    var options = platformSelect.querySelectorAll('option[data-base-url]');
    for (var i = 0; i < options.length; i++) {
      var pHost = getPlatformHost(options[i]);
      if (pHost && urlHost.indexOf(pHost) !== -1) return options[i];
    }
    return null;
  }

  function checkUrlMatch(rowEl) {
    var platformSelect = rowEl.querySelector('.social-row-platform');
    var urlInput = rowEl.querySelector('.social-row-url');
    var warningEl = rowEl.querySelector('.social-url-mismatch');
    if (!platformSelect || !urlInput || !warningEl) return;

    var url = urlInput.value.trim();
    if (!url) { warningEl.style.display = 'none'; return; }

    var urlHost = getHost(url);
    if (!urlHost) { warningEl.style.display = 'none'; return; }

    var selectedOption = platformSelect.options[platformSelect.selectedIndex];

    /* Auto-select platform if none chosen */
    if (!platformSelect.value) {
      var match = detectPlatform(platformSelect, urlHost);
      if (match) {
        platformSelect.value = match.value;
        platformSelect.dispatchEvent(new Event('change'));
      }
      warningEl.style.display = 'none';
      return;
    }

    /* Check mismatch */
    var platformHost = getPlatformHost(selectedOption);
    if (platformHost && urlHost.indexOf(platformHost) === -1) {
      var detected = detectPlatform(platformSelect, urlHost);
      var hint = detected ? detected.textContent.trim() : urlHost;
      warningEl.textContent = '\u09B2\u09BF\u0982\u0995\u099F\u09BF '
        + selectedOption.textContent.trim()
        + ' \u098F\u09B0 \u09A8\u09AF\u09BC, \u09AE\u09A8\u09C7 \u09B9\u099A\u09CD\u099B\u09C7 '
        + hint
        + ' (URL doesn\'t match ' + selectedOption.textContent.trim() + ')';
      warningEl.style.display = 'block';
    } else {
      warningEl.style.display = 'none';
    }
  }

  /* ---- Add row ---- */

  function addRow() {
    var index = rowCounter++;
    var clone = template.content.cloneNode(true);
    var rowEl = clone.querySelector('.social-source-row');
    rowEl.setAttribute('data-row-index', index);

    /* Row number label */
    var numEl = rowEl.querySelector('.social-source-row-number');
    if (numEl) numEl.textContent = '\u09B8\u09C2\u09A4\u09CD\u09B0 #' + (index + 1);

    /* Wire remove button */
    var removeBtn = rowEl.querySelector('.btn-remove-social-source');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        removeRow(rowEl);
      });
    }

    /* Wire URL check listeners */
    var urlInput = rowEl.querySelector('.social-row-url');
    var platformSelect = rowEl.querySelector('.social-row-platform');
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
    var rows = container.querySelectorAll('.social-source-row');
    for (var i = 0; i < rows.length; i++) {
      var numEl = rows[i].querySelector('.social-source-row-number');
      if (numEl) numEl.textContent = '\u09B8\u09C2\u09A4\u09CD\u09B0 #' + (i + 1);
    }
  }

  /* ---- Serialize ---- */

  function serialize() {
    var rows = container.querySelectorAll('.social-source-row');
    var sources = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var platformSelect = row.querySelector('.social-row-platform');
      var urlInput = row.querySelector('.social-row-url');
      var embedInput = row.querySelector('.social-row-embed');

      var url = urlInput ? urlInput.value.trim() : '';
      if (!url) continue;  /* skip empty rows */

      var platformId = platformSelect ? parseInt(platformSelect.value, 10) || 0 : 0;
      var platformName = '';
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

  var form = container.closest('form');
  if (form) {
    form.addEventListener('submit', function () { serialize(); });
  }

  /* ---- Wire add button ---- */
  if (addBtn) {
    addBtn.addEventListener('click', function () { addRow(); });
  }

  /* ---- Restore from hidden input (for edit mode pre-population) ---- */
  function restoreFromHiddenInput() {
    var raw = hiddenJson.value;
    if (!raw) return false;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return false; }
    var sources = parsed.sources || parsed;
    if (!Array.isArray(sources) || !sources.length) return false;

    container.innerHTML = '';
    rowCounter = 0;

    for (var i = 0; i < sources.length; i++) {
      addRow();
      var rows = container.querySelectorAll('.social-source-row');
      var rowEl = rows[rows.length - 1];
      var platformSelect = rowEl.querySelector('.social-row-platform');
      var urlInput = rowEl.querySelector('.social-row-url');
      var embedInput = rowEl.querySelector('.social-row-embed');

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

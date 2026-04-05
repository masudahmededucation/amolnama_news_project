/**
 * news-thana-search-select.js
 * Reusable Tom Select component for searching thana (police station) by name.
 *
 * Fetches from /newshub/api/thana/search/?q= and renders bilingual results:
 *   - type badge (মেট্রো থানা / উপজেলা থানা)
 *   - Bengali + English name
 *   - location breadcrumb path
 *
 * Falls back gracefully to plain <input> when Tom Select is unavailable.
 *
 * Usage:
 *   const ts = window.newshubThanaSearchSelect.initThanaSearchSelect(inputEl, {
 *     onChange: function () { serialize(); }
 *   });
 *
 * Returns the TomSelect instance, or null if Tom Select is unavailable.
 *
 * Exposes: window.newshubThanaSearchSelect = { initThanaSearchSelect: fn }
 *
 * CSS dependencies:
 *   .thana-search-option, .thana-search-header, .thana-search-name,
 *   .thana-search-path, .location-search-type-badge  — in news-collection.css
 */
(function () {
  'use strict';

  /**
   * Render a thana search result option row.
   * @param {object} item   — API result: { name_bn, name_en, type, title_bn }
   * @param {fn}     escape — Tom Select HTML-escape helper
   */
  function renderThanaDropdownOption(item, escape) {
    let displayName = item.name_bn || '';
    if (item.name_en) displayName += ' (' + item.name_en + ')';
    const typeLabel = item.type === 'metropolitan_thana' ? 'মেট্রো থানা' : 'উপজেলা থানা';

    return '<div class="thana-search-option">'
      + '<div class="thana-search-header">'
        + '<span class="location-search-type-badge">' + escape(typeLabel) + '</span> '
        + '<span class="thana-search-name">' + escape(displayName) + '</span>'
      + '</div>'
      + '<div class="thana-search-path">' + escape(item.title_bn || '') + '</div>'
      + '</div>';
  }

  /**
   * Render the selected-item chip (compact, no badge/path needed).
   * @param {object} item   — selected item
   * @param {fn}     escape — Tom Select HTML-escape helper
   */
  function renderThanaSelectedItem(item, escape) {
    return '<div>' + escape(item.title_bn || item.name_bn || '') + '</div>';
  }

  /**
   * Fetch thana results from the search API.
   * @param {string}   query    — search term
   * @param {function} callback — Tom Select callback(results)
   */
  function fetchThanaSearchResults(query, callback) {
    if (query.length < 2) return callback();
    fetch('/newshub/api/thana/search/?q=' + encodeURIComponent(query))
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) { callback(data.results || []); })
      .catch(function () { callback(); });
  }

  /**
   * Initialise a Tom Select thana search on the given input element.
   *
   * @param {HTMLInputElement} inputEl   — the plain <input type="text"> to enhance
   * @param {object}           [options]
   * @param {function}         [options.onChange] — fired when the selected value changes
   * @param {string}           [options.placeholder] — override default Bengali placeholder
   * @returns {TomSelect|null}
   */
  function initThanaSearchSelect(inputEl, options) {
    if (!inputEl) return null;
    if (typeof TomSelect === 'undefined') return null;

    const opts = options || {};
    const onChangeFn = typeof opts.onChange === 'function' ? opts.onChange : function () {};

    try {
      return new TomSelect(inputEl, {
        valueField:    'title_bn',
        labelField:    'title_bn',
        searchField:   ['name_en'],
        maxItems:      1,
        create:        true,
        createOnBlur:  false,
        maxOptions:    20,
        loadThrottle:  250,
        openOnFocus:   false,
        placeholder:   opts.placeholder || 'যেমন: মিরপুর মডেল... লিখে খুঁজুন অথবা সরাসরি নাম লিখুন',

        load: fetchThanaSearchResults,

        render: {
          option:        renderThanaDropdownOption,
          item:          renderThanaSelectedItem,
          no_results:    function () {
            return '<div class="no-results">কোনো থানা পাওয়া যায়নি — সরাসরি নাম লিখুন</div>';
          },
          option_create: function (data, escape) {
            return '<div class="create">সরাসরি লিখুন: <strong>' + escape(data.input) + '</strong></div>';
          },
        },

        onChange: onChangeFn,
      });
    } catch (e) {
      return null;
    }
  }

  /* ========== Public API ========== */

  window.newshubThanaSearchSelect = {
    initThanaSearchSelect: initThanaSearchSelect,
  };

})();

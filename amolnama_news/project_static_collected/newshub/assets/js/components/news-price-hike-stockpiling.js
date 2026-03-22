/**
 * news-price-hike-stockpiling.js
 * Commodity stockpiling repeater — each row has a Tom Select commodity search,
 * artificial crisis checkbox, description, estimated quantity, and supply chain issue.
 * Serializes to #stockpiling-json as:
 *   { commodities: [{ commodityId, artificialCrisis, description,
 *                      estimatedQuantity, supplyChainIssue }] }
 *
 * DOM dependencies:
 *   #stockpiling-json                    — hidden JSON input
 *   #stockpile-row-template              — <template> for cloning rows
 *   #stockpile-rows-container            — container div
 *   #btn-add-stockpile                   — add button
 *   #stockpile-commodity-search-url-data — CSP-safe JSON with API URL
 *
 * Exposes: window.newshubStockpiling = { reset: fn }
 */
(function () {
  'use strict';

  var hiddenJson = document.getElementById('stockpiling-json');
  var template = document.getElementById('stockpile-row-template');
  var container = document.getElementById('stockpile-rows-container');
  var addBtn = document.getElementById('btn-add-stockpile');

  if (!hiddenJson || !template || !container) return;

  /* Read commodity API URL from CSP-safe JSON */
  var apiUrl = '';
  var urlDataEl = document.getElementById('stockpile-commodity-search-url-data');
  if (urlDataEl) {
    try { apiUrl = JSON.parse(urlDataEl.textContent).url || ''; }
    catch (e) { /* ignore */ }
  }

  var rowCounter = 0;
  var tomInstances = {};  /* rowIndex → TomSelect instance */

  /* ---- Tom Select config ---- */
  function createTomSelect(selectEl, rowIndex) {
    var ts = new TomSelect(selectEl, {
      valueField: 'id',
      labelField: 'label',
      searchField: ['name_bn', 'name_en', 'group_bn'],
      maxItems: 1,
      openOnFocus: true,
      preload: 'focus',

      load: function (query, callback) {
        var url = apiUrl;
        if (query && query.length > 0) {
          url += '?q=' + encodeURIComponent(query);
        }
        fetch(url)
          .then(function (resp) { return resp.json(); })
          .then(function (data) {
            var items = (data.commodities || []).map(function (c) {
              var label = c.name_bn;
              if (c.variant_bn) label += ' (' + c.variant_bn + ')';
              if (c.group_bn) label += ' — ' + c.group_bn;
              return {
                id: c.id,
                label: label,
                name_bn: c.name_bn,
                name_en: c.name_en,
                group_bn: c.group_bn,
                variant_bn: c.variant_bn,
                unit: c.unit,
              };
            });
            callback(items);
          })
          .catch(function () { callback(); });
      },

      render: {
        option: function (item, escape) {
          var html = '<div class="ts-option-commodity">';
          html += '<span class="ts-commodity-name">' + escape(item.name_bn);
          if (item.variant_bn) html += ' <small>(' + escape(item.variant_bn) + ')</small>';
          html += '</span>';
          if (item.group_bn) html += ' <span class="ts-commodity-group">— ' + escape(item.group_bn) + '</span>';
          html += '</div>';
          return html;
        },
        item: function (item, escape) {
          var text = escape(item.name_bn);
          if (item.variant_bn) text += ' (' + escape(item.variant_bn) + ')';
          return '<div>' + text + '</div>';
        },
      },

      onChange: function () {
        serialize();
      },
    });

    tomInstances[rowIndex] = ts;
    return ts;
  }

  /* ---- Add a new stockpile row ---- */
  function addRow() {
    var index = rowCounter++;
    var clone = template.content.cloneNode(true);
    var rowEl = clone.querySelector('.stockpile-row');
    rowEl.setAttribute('data-row-index', index);

    /* Row number label */
    var numberLabel = rowEl.querySelector('.stockpile-row-number');
    if (numberLabel) numberLabel.textContent = 'পণ্য #' + (container.children.length + 1);

    /* Remove button */
    var removeBtn = rowEl.querySelector('.btn-remove-stockpile');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        removeRow(rowEl, index);
      });
    }

    /* Input listeners */
    var crisisEl = rowEl.querySelector('.stockpile-artificial-crisis');
    var descEl = rowEl.querySelector('.stockpile-description');
    var qtyEl = rowEl.querySelector('.stockpile-estimated-quantity');
    var chainEl = rowEl.querySelector('.stockpile-supply-chain-issue');

    if (crisisEl) crisisEl.addEventListener('change', serialize);
    if (descEl) descEl.addEventListener('input', serialize);
    if (qtyEl) qtyEl.addEventListener('input', serialize);
    if (chainEl) chainEl.addEventListener('input', serialize);

    container.appendChild(rowEl);

    /* Initialize Tom Select on the select element */
    var selectEl = rowEl.querySelector('.stockpile-commodity-select');
    if (selectEl) createTomSelect(selectEl, index);

    updateRowNumbers();
  }

  /* ---- Remove a stockpile row ---- */
  function removeRow(rowEl, index) {
    if (tomInstances[index]) {
      tomInstances[index].destroy();
      delete tomInstances[index];
    }
    rowEl.remove();
    updateRowNumbers();
    serialize();
  }

  /* ---- Update row number labels after add/remove ---- */
  function updateRowNumbers() {
    var rows = container.querySelectorAll('.stockpile-row');
    for (var i = 0; i < rows.length; i++) {
      var label = rows[i].querySelector('.stockpile-row-number');
      if (label) label.textContent = 'পণ্য #' + (i + 1);
    }
  }

  /* ---- Serialize all rows ---- */
  function serialize() {
    var commodities = [];
    var rows = container.querySelectorAll('.stockpile-row');

    for (var i = 0; i < rows.length; i++) {
      var rowEl = rows[i];
      var index = parseInt(rowEl.getAttribute('data-row-index'), 10);
      var ts = tomInstances[index];

      var commodityId = '';
      if (ts && ts.getValue()) {
        commodityId = ts.getValue();
      }

      var crisisEl = rowEl.querySelector('.stockpile-artificial-crisis');
      var descEl = rowEl.querySelector('.stockpile-description');
      var qtyEl = rowEl.querySelector('.stockpile-estimated-quantity');
      var chainEl = rowEl.querySelector('.stockpile-supply-chain-issue');

      commodities.push({
        commodityId: commodityId,
        artificialCrisis: crisisEl ? crisisEl.checked : false,
        description: descEl ? descEl.value.trim() : '',
        estimatedQuantity: qtyEl ? qtyEl.value.trim() : '',
        supplyChainIssue: chainEl ? chainEl.value.trim() : '',
      });
    }

    hiddenJson.value = JSON.stringify({ commodities: commodities });
  }

  /* ---- Event listeners ---- */
  if (addBtn) addBtn.addEventListener('click', addRow);

  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* ---- Auto-add first row on init ---- */
  addRow();

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    var data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }
    if (!data || typeof data !== 'object') return;
    var commodities = data.commodities;
    if (!commodities || !commodities.length) return;

    /* Clear the auto-added first row */
    for (var key in tomInstances) {
      if (tomInstances[key]) tomInstances[key].destroy();
    }
    tomInstances = {};
    container.innerHTML = '';
    rowCounter = 0;

    for (var i = 0; i < commodities.length; i++) {
      var item = commodities[i];
      var index = rowCounter++;
      var clone = template.content.cloneNode(true);
      var rowEl = clone.querySelector('.stockpile-row');
      rowEl.setAttribute('data-row-index', index);

      var numberLabel = rowEl.querySelector('.stockpile-row-number');
      if (numberLabel) numberLabel.textContent = 'পণ্য #' + (i + 1);

      var removeBtn = rowEl.querySelector('.btn-remove-stockpile');
      if (removeBtn) {
        (function (el, idx) {
          removeBtn.addEventListener('click', function () { removeRow(el, idx); });
        })(rowEl, index);
      }

      /* Set field values */
      var crisisEl = rowEl.querySelector('.stockpile-artificial-crisis');
      var descEl = rowEl.querySelector('.stockpile-description');
      var qtyEl = rowEl.querySelector('.stockpile-estimated-quantity');
      var chainEl = rowEl.querySelector('.stockpile-supply-chain-issue');

      if (crisisEl && item.artificialCrisis) crisisEl.checked = true;
      if (descEl && item.description) descEl.value = item.description;
      if (qtyEl && item.estimatedQuantity) qtyEl.value = item.estimatedQuantity;
      if (chainEl && item.supplyChainIssue) chainEl.value = item.supplyChainIssue;

      if (crisisEl) crisisEl.addEventListener('change', serialize);
      if (descEl) descEl.addEventListener('input', serialize);
      if (qtyEl) qtyEl.addEventListener('input', serialize);
      if (chainEl) chainEl.addEventListener('input', serialize);

      container.appendChild(rowEl);

      /* Init Tom Select and restore commodity */
      var selectEl = rowEl.querySelector('.stockpile-commodity-select');
      if (selectEl && item.commodityId) {
        var ts = createTomSelect(selectEl, index);
        ts.addOption({
          id: item.commodityId,
          label: item.commodityId,
          name_bn: '',
          name_en: '',
          group_bn: '',
          variant_bn: '',
          unit: '',
        });
        ts.setValue(item.commodityId, true);
      } else if (selectEl) {
        createTomSelect(selectEl, index);
      }
    }
  }

  setTimeout(restoreFromSavedData, 100);

  /* ---- Public API for form-clear ---- */
  window.newshubStockpiling = {
    reset: function () {
      for (var key in tomInstances) {
        if (tomInstances[key]) tomInstances[key].destroy();
      }
      tomInstances = {};
      container.innerHTML = '';
      rowCounter = 0;
      hiddenJson.value = '';
      addRow();
    },
  };
})();

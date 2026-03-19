/**
 * news-price-hike-price-gap.js
 * Commodity price repeater — each row has a Tom Select commodity search,
 * govt rate, market rate, auto-calculated gap/markup%, and consumer impact.
 * Serializes to #price-gap-json as:
 *   { commodities: [{ commodityId, commodityNameBn, unit, govtRate, marketRate,
 *                      priceGap, markupPercent, consumerImpact }] }
 *
 * DOM dependencies:
 *   #price-gap-json              — hidden JSON input
 *   #commodity-row-template      — <template> for cloning rows
 *   #commodity-rows-container    — container div
 *   #btn-add-commodity           — add button
 *   #commodity-search-url-data   — CSP-safe JSON with API URL
 *
 * Exposes: window.newshubPriceGap = { reset: fn }
 */
(function () {
  'use strict';

  var hiddenJson = document.getElementById('price-gap-json');
  var template = document.getElementById('commodity-row-template');
  var container = document.getElementById('commodity-rows-container');
  var addBtn = document.getElementById('btn-add-commodity');

  if (!hiddenJson || !template || !container) return;

  /* Read commodity API URL from CSP-safe JSON */
  var apiUrl = '';
  var urlDataEl = document.getElementById('commodity-search-url-data');
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

      onChange: function (value) {
        /* Update commodity detail display in this row */
        var row = selectEl.closest('.commodity-price-row');
        var detailDisplay = row ? row.querySelector('.commodity-detail-display') : null;
        var groupDisplay = row ? row.querySelector('.commodity-row-group') : null;
        var variantDisplay = row ? row.querySelector('.commodity-row-variant') : null;
        var unitDisplay = row ? row.querySelector('.commodity-row-unit') : null;

        if (value && this.options[value]) {
          var opt = this.options[value];
          if (groupDisplay) groupDisplay.textContent = opt.group_bn || '—';
          if (variantDisplay) variantDisplay.textContent = opt.variant_bn || '—';
          if (unitDisplay) unitDisplay.textContent = opt.unit || '—';
          if (detailDisplay) detailDisplay.style.display = '';
        } else {
          if (detailDisplay) detailDisplay.style.display = 'none';
        }

        serialize();
      },
    });

    tomInstances[rowIndex] = ts;
    return ts;
  }

  /* ---- Calculate gap/markup display for a single row ---- */
  function calculateRow(rowEl) {
    var govtInput = rowEl.querySelector('.commodity-govt-rate');
    var marketInput = rowEl.querySelector('.commodity-market-rate');
    var gapDisplay = rowEl.querySelector('.commodity-gap-display');
    var diffDisplay = rowEl.querySelector('.commodity-gap-diff');
    var markupDisplay = rowEl.querySelector('.commodity-gap-markup');

    var govt = parseFloat(govtInput.value) || 0;
    var market = parseFloat(marketInput.value) || 0;

    if (govt > 0 || market > 0) {
      var gap = market - govt;
      var markup = govt > 0 ? ((gap / govt) * 100) : 0;
      if (diffDisplay) diffDisplay.textContent = gap.toFixed(2) + ' টাকা';
      if (markupDisplay) markupDisplay.textContent = markup.toFixed(2) + '%';
      if (gapDisplay) gapDisplay.style.display = '';
    } else {
      if (gapDisplay) gapDisplay.style.display = 'none';
    }
  }

  /* ---- Add a new commodity row ---- */
  function addRow() {
    var index = rowCounter++;
    var clone = template.content.cloneNode(true);
    var rowEl = clone.querySelector('.commodity-price-row');
    rowEl.setAttribute('data-row-index', index);

    /* Row number label */
    var numberLabel = rowEl.querySelector('.commodity-row-number');
    if (numberLabel) numberLabel.textContent = 'পণ্য #' + (container.children.length + 1);

    /* Remove button */
    var removeBtn = rowEl.querySelector('.btn-remove-commodity');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        removeRow(rowEl, index);
      });
    }

    /* Price input listeners */
    var govtInput = rowEl.querySelector('.commodity-govt-rate');
    var marketInput = rowEl.querySelector('.commodity-market-rate');
    if (govtInput) govtInput.addEventListener('input', function () { calculateRow(rowEl); serialize(); });
    if (marketInput) marketInput.addEventListener('input', function () { calculateRow(rowEl); serialize(); });

    /* Consumer impact listener */
    var impactEl = rowEl.querySelector('.commodity-consumer-impact');
    if (impactEl) impactEl.addEventListener('input', serialize);

    container.appendChild(rowEl);

    /* Initialize Tom Select on the select element */
    var selectEl = rowEl.querySelector('.commodity-select');
    if (selectEl) createTomSelect(selectEl, index);

    updateRowNumbers();
  }

  /* ---- Remove a commodity row ---- */
  function removeRow(rowEl, index) {
    /* Destroy Tom Select instance */
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
    var rows = container.querySelectorAll('.commodity-price-row');
    for (var i = 0; i < rows.length; i++) {
      var label = rows[i].querySelector('.commodity-row-number');
      if (label) label.textContent = 'পণ্য #' + (i + 1);
    }
  }

  /* ---- Serialize all rows ---- */
  function serialize() {
    var commodities = [];
    var rows = container.querySelectorAll('.commodity-price-row');

    for (var i = 0; i < rows.length; i++) {
      var rowEl = rows[i];
      var index = parseInt(rowEl.getAttribute('data-row-index'), 10);
      var ts = tomInstances[index];

      var commodityId = '';
      var commodityNameBn = '';
      var unit = '';

      if (ts && ts.getValue()) {
        var val = ts.getValue();
        commodityId = val;
        var opt = ts.options[val];
        if (opt) {
          commodityNameBn = opt.name_bn || '';
          unit = opt.unit || '';
        }
      }

      var govtInput = rowEl.querySelector('.commodity-govt-rate');
      var marketInput = rowEl.querySelector('.commodity-market-rate');
      var impactEl = rowEl.querySelector('.commodity-consumer-impact');
      var govt = parseFloat(govtInput ? govtInput.value : '') || 0;
      var market = parseFloat(marketInput ? marketInput.value : '') || 0;
      var gap = market - govt;
      var markup = govt > 0 ? ((gap / govt) * 100) : 0;

      commodities.push({
        commodityId: commodityId,
        commodityNameBn: commodityNameBn,
        unit: unit,
        govtRate: govt,
        marketRate: market,
        priceGap: parseFloat(gap.toFixed(2)),
        markupPercent: parseFloat(markup.toFixed(2)),
        consumerImpact: impactEl ? impactEl.value.trim() : '',
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

  /* ---- Public API for form-clear ---- */
  window.newshubPriceGap = {
    reset: function () {
      /* Destroy all Tom Select instances */
      for (var key in tomInstances) {
        if (tomInstances[key]) tomInstances[key].destroy();
      }
      tomInstances = {};
      container.innerHTML = '';
      rowCounter = 0;
      hiddenJson.value = '';
      /* Re-add first empty row */
      addRow();
    },
  };

  /* ---- Step validator: validate commodity rows on Next ---- */
  var priceGapPanel = hiddenJson.closest('.step-panel[data-step]');
  if (priceGapPanel) {
    var priceGapStep = parseInt(priceGapPanel.getAttribute('data-step'), 10);

    var validator = function () {
      var warnings = [];
      var rows = container.querySelectorAll('.commodity-price-row');
      var filledRows = 0;

      for (var i = 0; i < rows.length; i++) {
        var rowEl = rows[i];
        var index = parseInt(rowEl.getAttribute('data-row-index'), 10);
        var ts = tomInstances[index];
        var hasCommodity = ts && ts.getValue();
        var govtInput = rowEl.querySelector('.commodity-govt-rate');
        var marketInput = rowEl.querySelector('.commodity-market-rate');
        var hasGovt = govtInput && parseFloat(govtInput.value) > 0;
        var hasMarket = marketInput && parseFloat(marketInput.value) > 0;
        var hasPrice = hasGovt || hasMarket;

        if (hasCommodity || hasPrice) {
          filledRows++;
          if (!hasCommodity) {
            warnings.push('পণ্য #' + (i + 1) + ' — পণ্য নির্বাচন করুন (Please select a commodity)');
          }
          if (!hasPrice) {
            warnings.push('পণ্য #' + (i + 1) + ' — মূল্য দিন (Please enter at least one price)');
          }
        }
      }

      if (filledRows === 0) {
        warnings.push('অন্তত একটি পণ্যের তথ্য দিন (Please add at least one commodity with price information)');
      }

      return { warnings: warnings };
    };

    /* Deferred queue — stepper loads after us */
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: priceGapStep, fn: validator });
  }
})();

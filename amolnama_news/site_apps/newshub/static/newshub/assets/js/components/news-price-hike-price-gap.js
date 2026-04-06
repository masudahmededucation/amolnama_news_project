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

  const hiddenJson = document.getElementById('price-gap-json');
  const template = document.getElementById('commodity-row-template');
  const container = document.getElementById('commodity-rows-container');
  const addBtn = document.getElementById('btn-add-commodity');

  if (!hiddenJson || !template || !container) return;

  /* Read commodity API URL from CSP-safe JSON */
  let apiUrl = '';
  const urlDataEl = document.getElementById('commodity-search-url-data');
  if (urlDataEl) {
    try { apiUrl = JSON.parse(urlDataEl.textContent).url || ''; }
    catch (e) { /* ignore */ }
  }

  let rowCounter = 0;
  let tomInstances = {};  /* rowIndex → TomSelect instance */

  /* ---- Tom Select config ---- */
  function createTomSelect(selectEl, rowIndex) {
    let ts = new TomSelect(selectEl, {
      valueField: 'id',
      labelField: 'label',
      searchField: ['name_bn', 'name_en', 'group_bn'],
      maxItems: 1,
      openOnFocus: true,
      preload: 'focus',

      load: function (query, callback) {
        let url = apiUrl;
        if (query && query.length > 0) {
          url += '?q=' + encodeURIComponent(query);
        }
        fetch(url)
          .then(function (resp) { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
          .then(function (data) {
            const items = (data.commodities || []).map(function (c) {
              let label = c.name_bn;
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
          let html = '<div class="ts-option-commodity">';
          html += '<span class="ts-commodity-name">' + escape(item.name_bn);
          if (item.variant_bn) html += ' <small>(' + escape(item.variant_bn) + ')</small>';
          html += '</span>';
          if (item.group_bn) html += ' <span class="ts-commodity-group">— ' + escape(item.group_bn) + '</span>';
          html += '</div>';
          return html;
        },
        item: function (item, escape) {
          let text = escape(item.name_bn);
          if (item.variant_bn) text += ' (' + escape(item.variant_bn) + ')';
          return '<div>' + text + '</div>';
        },
      },

      onChange: function (value) {
        /* Update commodity detail display in this row */
        let row = selectEl.closest('.commodity-price-row');
        const detailDisplay = row ? row.querySelector('.commodity-detail-display') : null;
        const groupDisplay = row ? row.querySelector('.commodity-row-group') : null;
        const variantDisplay = row ? row.querySelector('.commodity-row-variant') : null;
        const unitDisplay = row ? row.querySelector('.commodity-row-unit') : null;

        if (value && this.options[value]) {
          let opt = this.options[value];
          if (groupDisplay) groupDisplay.textContent = opt.group_bn || '—';
          if (variantDisplay) variantDisplay.textContent = opt.variant_bn || '—';
          if (unitDisplay) unitDisplay.textContent = opt.unit || '—';
          if (detailDisplay) detailDisplay.hidden = false;
        } else {
          if (detailDisplay) detailDisplay.hidden = true;
        }

        serialize();
      },
    });

    tomInstances[rowIndex] = ts;
    return ts;
  }

  /* ---- Calculate gap/markup display for a single row ---- */
  function calculateRow(rowEl) {
    let govtInput = rowEl.querySelector('.commodity-govt-rate');
    let marketInput = rowEl.querySelector('.commodity-market-rate');
    const gapDisplay = rowEl.querySelector('.commodity-gap-display');
    const diffDisplay = rowEl.querySelector('.commodity-gap-diff');
    const markupDisplay = rowEl.querySelector('.commodity-gap-markup');

    let govt = parseFloat(govtInput.value) || 0;
    let market = parseFloat(marketInput.value) || 0;

    if (govt > 0 || market > 0) {
      let gap = market - govt;
      let markup = govt > 0 ? ((gap / govt) * 100) : 0;
      if (diffDisplay) diffDisplay.textContent = gap.toFixed(2) + ' টাকা';
      if (markupDisplay) markupDisplay.textContent = markup.toFixed(2) + '%';
      if (gapDisplay) gapDisplay.hidden = false;
    } else {
      if (gapDisplay) gapDisplay.hidden = true;
    }
  }

  /* ---- Add a new commodity row ---- */
  function addRow() {
    let index = rowCounter++;
    let clone = template.content.cloneNode(true);
    let rowEl = clone.querySelector('.commodity-price-row');
    rowEl.setAttribute('data-row-index', index);

    /* Row number label */
    let numberLabel = rowEl.querySelector('.commodity-row-number');
    if (numberLabel) numberLabel.textContent = 'পণ্য #' + (container.children.length + 1);

    /* Remove button */
    let removeBtn = rowEl.querySelector('.btn-remove-commodity');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        removeRow(rowEl, index);
      });
    }

    /* Price input listeners */
    let govtInput = rowEl.querySelector('.commodity-govt-rate');
    let marketInput = rowEl.querySelector('.commodity-market-rate');
    if (govtInput) govtInput.addEventListener('input', function () { calculateRow(rowEl); serialize(); });
    if (marketInput) marketInput.addEventListener('input', function () { calculateRow(rowEl); serialize(); });

    /* Consumer impact listener */
    let impactEl = rowEl.querySelector('.commodity-consumer-impact');
    if (impactEl) impactEl.addEventListener('input', serialize);

    container.appendChild(rowEl);

    /* Initialize Tom Select on the select element */
    let selectEl = rowEl.querySelector('.commodity-select');
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
    let rows = container.querySelectorAll('.commodity-price-row');
    for (let i = 0; i < rows.length; i++) {
      const label = rows[i].querySelector('.commodity-row-number');
      if (label) label.textContent = 'পণ্য #' + (i + 1);
    }
  }

  /* ---- Serialize all rows ---- */
  function serialize() {
    let commodities = [];
    let rows = container.querySelectorAll('.commodity-price-row');

    for (let i = 0; i < rows.length; i++) {
      let rowEl = rows[i];
      let index = parseInt(rowEl.getAttribute('data-row-index'), 10);
      let ts = tomInstances[index];

      let commodityId = '';
      let commodityNameBn = '';
      let unit = '';

      if (ts && ts.getValue()) {
        const val = ts.getValue();
        commodityId = val;
        let opt = ts.options[val];
        if (opt) {
          commodityNameBn = opt.name_bn || '';
          unit = opt.unit || '';
        }
      }

      let govtInput = rowEl.querySelector('.commodity-govt-rate');
      let marketInput = rowEl.querySelector('.commodity-market-rate');
      let impactEl = rowEl.querySelector('.commodity-consumer-impact');
      const govt = parseFloat(govtInput ? govtInput.value : '') || 0;
      const market = parseFloat(marketInput ? marketInput.value : '') || 0;
      const gap = market - govt;
      const markup = govt > 0 ? ((gap / govt) * 100) : 0;

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

  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* ---- Auto-add first row on init ---- */
  addRow();

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }
    if (!data || typeof data !== 'object') return;
    const commodities = data.commodities;
    if (!commodities || !commodities.length) return;

    /* Clear the auto-added first row */
    for (let key in tomInstances) {
      if (tomInstances[key]) tomInstances[key].destroy();
    }
    tomInstances = {};
    container.innerHTML = '';
    rowCounter = 0;

    for (let i = 0; i < commodities.length; i++) {
      const item = commodities[i];
      let index = rowCounter++;
      const clone = template.content.cloneNode(true);
      let rowEl = clone.querySelector('.commodity-price-row');
      rowEl.setAttribute('data-row-index', index);

      const numberLabel = rowEl.querySelector('.commodity-row-number');
      if (numberLabel) numberLabel.textContent = 'পণ্য #' + (i + 1);

      const removeBtn = rowEl.querySelector('.btn-remove-commodity');
      if (removeBtn) {
        (function (el, idx) {
          removeBtn.addEventListener('click', function () { removeRow(el, idx); });
        })(rowEl, index);
      }

      /* Set price inputs */
      let govtInput = rowEl.querySelector('.commodity-govt-rate');
      let marketInput = rowEl.querySelector('.commodity-market-rate');
      const impactEl = rowEl.querySelector('.commodity-consumer-impact');
      if (govtInput && item.govtRate) govtInput.value = item.govtRate;
      if (marketInput && item.marketRate) marketInput.value = item.marketRate;
      if (impactEl && item.consumerImpact) impactEl.value = item.consumerImpact;

      if (govtInput) govtInput.addEventListener('input', (function (r) { return function () { calculateRow(r); serialize(); }; })(rowEl));
      if (marketInput) marketInput.addEventListener('input', (function (r) { return function () { calculateRow(r); serialize(); }; })(rowEl));
      if (impactEl) impactEl.addEventListener('input', serialize);

      container.appendChild(rowEl);

      /* Init Tom Select and restore commodity */
      const selectEl = rowEl.querySelector('.commodity-select');
      if (selectEl && item.commodityId) {
        let ts = createTomSelect(selectEl, index);
        const opt = {
          id: item.commodityId,
          label: item.commodityNameBn || '',
          name_bn: item.commodityNameBn || '',
          name_en: '',
          group_bn: '',
          variant_bn: '',
          unit: item.unit || '',
        };
        ts.addOption(opt);
        ts.setValue(item.commodityId, true);
      } else if (selectEl) {
        createTomSelect(selectEl, index);
      }

      calculateRow(rowEl);
    }
  }

  setTimeout(restoreFromSavedData, 100);

  /* ---- Public API for form-clear ---- */
  window.newshubPriceGap = {
    reset: function () {
      /* Destroy all Tom Select instances */
      for (let key in tomInstances) {
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
  const priceGapPanel = hiddenJson.closest('.step-panel[data-step]');
  if (priceGapPanel) {
    const priceGapStep = parseInt(priceGapPanel.getAttribute('data-step'), 10);

    const validator = function () {
      const warnings = [];
      const rows = container.querySelectorAll('.commodity-price-row');
      let filledRows = 0;

      for (let i = 0; i < rows.length; i++) {
        const rowEl = rows[i];
        const index = parseInt(rowEl.getAttribute('data-row-index'), 10);
        const ts = tomInstances[index];
        const hasCommodity = ts && ts.getValue();
        const govtInput = rowEl.querySelector('.commodity-govt-rate');
        const marketInput = rowEl.querySelector('.commodity-market-rate');
        const hasGovt = govtInput && parseFloat(govtInput.value) > 0;
        const hasMarket = marketInput && parseFloat(marketInput.value) > 0;
        const hasPrice = hasGovt || hasMarket;

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

  /* SPA cleanup — destroy Tom Select instances on page transition */
  if (window.spaCleanupRegister) {
    window.spaCleanupRegister(function () {
      for (var key in tomInstances) {
        if (tomInstances[key]) tomInstances[key].destroy();
      }
      tomInstances = {};
    });
  }
})();

/**
 * news-location-search.js
 * Unified location search via Tom Select remote search.
 * Queries /newshub/api/locations/search/?q=... with startswith matching.
 * Each result shows the location name plus the full hierarchy path underneath.
 * On selection, resolves parent chain via /newshub/api/locations/resolve/
 * and auto-fills the cascade dropdowns.
 *
 * Depends on:
 *   Tom Select (loaded via CDN)
 *   news-location-cascade.js (cascade event dispatching)
 *   news-map-pinpoint.js (optional — suppress map auto-center)
 */
(function () {
  'use strict';

  if (typeof TomSelect === 'undefined') return;

  var searchSelect = document.getElementById('news-location-search');
  if (!searchSelect) return;

  var districtSelect = document.getElementById('news-district-id');
  var subDistrictSelect = document.getElementById('news-upazila-id');
  var localBodySelect = document.getElementById('news-union-parishad-id');
  var wardSelect = document.getElementById('news-ward-id');
  var villageSelect = document.getElementById('news-village-id');

  var ts = new TomSelect(searchSelect, {
    valueField: 'id',
    labelField: 'title_bn',
    searchField: ['name_bn', 'name_en', 'title_bn', 'title_en'],
    placeholder: '\u0997\u09CD\u09B0\u09BE\u09AE, \u0987\u0989\u09A8\u09BF\u09AF\u09BC\u09A8, \u0989\u09AA\u099C\u09C7\u09B2\u09BE, \u09AC\u09BE \u099C\u09C7\u09B2\u09BE \u09B2\u09BF\u0996\u09C7 \u0996\u09C1\u0981\u099C\u09C1\u09A8... (Search by village, union, upazila or district...)',
    loadThrottle: 250,
    openOnFocus: false,

    load: function (query, callback) {
      if (query.length < 1) return callback();
      fetch('/newshub/api/locations/search/?q=' + encodeURIComponent(query))
        .then(function (r) { return r.json(); })
        .then(function (data) { callback(data.locations || []); })
        .catch(function () { callback(); });
    },

    render: {
      option: function (item, escape) {
        /* Name line: Bengali name (English name) */
        var nameText = item.name_bn || '';
        if (item.name_en) nameText += ' (' + item.name_en + ')';

        /* Type badge from location_type (e.g. "Upazila", "Union Parishad") */
        var typeText = item.type || '';

        return '<div class="location-search-option">'
          + '<div class="location-search-header">'
            + (typeText ? '<span class="location-search-type-badge">' + escape(typeText) + '</span> ' : '')
            + '<span class="location-search-name">' + escape(nameText) + '</span>'
          + '</div>'
          + '<div class="location-search-path-bn">' + escape(item.title_bn || '') + '</div>'
          + '<div class="location-search-path-en">' + escape(item.title_en || '') + '</div>'
        + '</div>';
      },
      item: function (item, escape) {
        var nameText = item.name_bn || '';
        if (item.name_en) nameText += ' (' + item.name_en + ')';
        return '<div>' + escape(nameText) + '</div>';
      },
      no_results: function () {
        return '<div class="no-results">\u0995\u09CB\u09A8\u09CB \u09AB\u09B2\u09BE\u09AB\u09B2 \u09AA\u09BE\u0993\u09AF\u09BC\u09BE \u09AF\u09BE\u09AF\u09BC\u09A8\u09BF</div>';
      }
    },

    onChange: function (value) {
      if (!value) return;
      var item = ts.options[value];
      if (!item) return;

      /* Resolve parent chain, then auto-fill cascade */
      resolveAndFillCascade(item);

      /* Clear the search after selection */
      setTimeout(function () { ts.clear(true); ts.clearOptions(); }, 100);
    }
  });

  /* ---- Resolve parent IDs and fill cascade ---- */

  function resolveAndFillCascade(item) {
    var url = '/newshub/api/locations/resolve/?table='
      + encodeURIComponent(item.table)
      + '&id=' + encodeURIComponent(item.entity_id);

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var ids = data.parent_ids || {};
        fillCascade(ids);
      })
      .catch(function () { /* silently ignore resolve failure */ });
  }

  function fillCascade(ids) {
    if (!ids.district_id || !districtSelect) return;

    /* Suppress all map centering during auto-fill */
    if (window.newshubMapPinpoint && window.newshubMapPinpoint.suppressNextDistrictCenter) {
      window.newshubMapPinpoint.suppressNextDistrictCenter();
    }
    if (window.newshubLocationCascade && window.newshubLocationCascade.suppressMapCenter) {
      window.newshubLocationCascade.suppressMapCenter(true);
    }

    /* Step 1: District */
    setSelectValue(districtSelect, String(ids.district_id));

    /* Step 2: Subdistrict (upazila or metro thana) */
    var subDistrictId = ids.upazila_id || ids.metropolitan_thana_id;
    if (subDistrictId && subDistrictSelect) {
      waitForOptions(subDistrictSelect, function () {
        setSelectValue(subDistrictSelect, String(subDistrictId));

        /* Step 3: Local body */
        var localBodyId = ids.union_parishad_id || ids.municipality_id || ids.city_corporation_id;
        if (localBodyId && localBodySelect) {
          waitForOptions(localBodySelect, function () {
            setSelectValue(localBodySelect, String(localBodyId));

            /* Step 4: Ward */
            var wardId = ids.union_parishad_ward_id || ids.municipality_ward_id || ids.city_corporation_ward_id;
            if (wardId && wardSelect) {
              waitForOptions(wardSelect, function () {
                setSelectValue(wardSelect, String(wardId));

                /* Step 5: Village */
                var villageId = ids.union_parishad_village_id;
                if (villageId && villageSelect) {
                  waitForOptions(villageSelect, function () {
                    villageSelect.value = String(villageId);
                    endFillAndCenterMap();
                  });
                } else {
                  endFillAndCenterMap();
                }
              });
            } else {
              endFillAndCenterMap();
            }
          });
        } else {
          endFillAndCenterMap();
        }
      });
    } else {
      endFillAndCenterMap();
    }
  }

  function endFillAndCenterMap() {
    /* Re-enable cascade map centering */
    if (window.newshubLocationCascade && window.newshubLocationCascade.suppressMapCenter) {
      window.newshubLocationCascade.suppressMapCenter(false);
    }
    if (!window.newshubMapPinpoint) return;

    /* Walk from deepest to shallowest until we find one with lat/lng */
    var levels = [
      { el: villageSelect,     zoom: window.newshubMapPinpoint.VILLAGE_CENTER_ZOOM },
      { el: wardSelect,        zoom: window.newshubMapPinpoint.WARD_CENTER_ZOOM },
      { el: localBodySelect,   zoom: window.newshubMapPinpoint.LOCAL_BODY_CENTER_ZOOM },
      { el: subDistrictSelect, zoom: window.newshubMapPinpoint.SUBDISTRICT_CENTER_ZOOM },
      { el: districtSelect,    zoom: window.newshubMapPinpoint.DISTRICT_CENTER_ZOOM },
    ];

    /* Find the deepest level with a selected value (for zoom + geocoding) */
    var deepestZoom = window.newshubMapPinpoint.DISTRICT_CENTER_ZOOM;
    var deepestEl = null;
    for (var j = 0; j < levels.length; j++) {
      if (levels[j].el && levels[j].el.value) {
        deepestZoom = levels[j].zoom;
        deepestEl = levels[j].el;
        break;
      }
    }

    /* Build address text from cascade option names for display */
    var addressText = buildCascadeAddressText();

    /* Try lat/lng from the deepest selected level only (don't fall back to parent
       levels — parent coordinates would center on the wrong area) */
    if (deepestEl && deepestEl.value) {
      var opt = deepestEl.options[deepestEl.selectedIndex];
      if (opt && opt.dataset && opt.dataset.lat && opt.dataset.lng) {
        window.newshubMapPinpoint.centerOn(opt.dataset.lat, opt.dataset.lng, deepestZoom);
        /* Update address display from cascade text (centerOn doesn't reverse geocode) */
        if (addressText) {
          window.newshubMapPinpoint.updateAddress(addressText);
          if (window.newshubMapSearch) window.newshubMapSearch.setSearchText(addressText);
        }
        return;
      }
    }

    /* Geocode from cascade option texts via Nominatim (deepest → district).
       geocodeAndCenter updates address display from Nominatim result automatically. */
    if (window.newshubLocationCascade && window.newshubLocationCascade.buildGeocodingQuery) {
      var query = window.newshubLocationCascade.buildGeocodingQuery(deepestEl);
      if (query) {
        window.newshubMapPinpoint.geocodeAndCenter(query, deepestZoom);
      }
    }
  }

  /* ---- Helpers ---- */

  /** Build Bengali address text from selected cascade options (deepest → district) */
  function buildCascadeAddressText() {
    var parts = [];
    var selects = [villageSelect, wardSelect, localBodySelect, subDistrictSelect, districtSelect];
    for (var i = 0; i < selects.length; i++) {
      var sel = selects[i];
      if (!sel || !sel.value) continue;
      var opt = sel.options[sel.selectedIndex];
      if (opt && opt.textContent) {
        var text = opt.textContent.trim();
        if (text) parts.push(text);
      }
    }
    return parts.length > 0 ? parts.join(', ') : '';
  }

  function setSelectValue(selectEl, value) {
    if (selectEl.tomselect) {
      selectEl.tomselect.setValue(value, true);
    } else {
      selectEl.value = value;
    }
    selectEl.dispatchEvent(new Event('change'));
  }

  function waitForOptions(selectEl, callback) {
    var attempts = 0;
    var interval = setInterval(function () {
      attempts++;
      if (selectEl.options.length > 1 || attempts > 50) {
        clearInterval(interval);
        callback();
      }
    }, 100);
  }

  /* ---- Public API ---- */

  window.newshubLocationSearch = {
    clear: function () {
      ts.clear(true);
      ts.clearOptions();
    }
  };
})();

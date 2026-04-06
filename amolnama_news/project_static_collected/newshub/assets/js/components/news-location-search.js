/**
 * news-location-search.js
 * Factory for Tom Select remote location search + cascade auto-fill.
 * Queries /newshub/api/locations/search/?q=... with startswith matching.
 * On selection, resolves parent chain via /newshub/api/locations/resolve/
 * and auto-fills the target cascade dropdowns.
 *
 * Usage:
 *   window.newshubCreateLocationSearch(cfg) → creates instance, returns API
 *
 * cfg properties (all optional except searchInputId):
 *   searchInputId {string}  — ID of the Tom Select <select> element (required)
 *   districtId    {string}  — ID of district select
 *   upazilaId     {string}  — ID of upazila/subdistrict select
 *   localBodyId   {string}  — ID of union parishad / local body select
 *   wardId        {string}  — ID of ward select
 *   villageId     {string}  — ID of village select (optional, rural path)
 *   cascadeApi    {string}  — window property name of the cascade API
 *                             (used for buildGeocodingQuery + suppressMapCenter)
 *   hasMap        {boolean} default false — whether to center map after fill
 *   placeholder   {string}  — Tom Select placeholder text
 *   publicApi     {string}  — window property name for this module's public API
 *
 * Auto-initializes the standard incident location search (news-* IDs, with map).
 * Exposes: window.newshubCreateLocationSearch — factory for additional instances
 *          window.newshubLocationSearch       — standard incident location search API
 *
 * Depends on: Tom Select (CDN), news-location-cascade.js, news-map-pinpoint.js (optional)
 */
(function () {
  'use strict';

  if (typeof TomSelect === 'undefined') return;

  function createLocationSearch(cfg) {
    const searchSelect    = document.getElementById(cfg.searchInputId);
    if (!searchSelect) return null;

    const districtSelect    = cfg.districtId  ? document.getElementById(cfg.districtId)  : null;
    const subDistrictSelect = cfg.upazilaId   ? document.getElementById(cfg.upazilaId)   : null;
    const localBodySelect   = cfg.localBodyId ? document.getElementById(cfg.localBodyId) : null;
    const wardSelect        = cfg.wardId      ? document.getElementById(cfg.wardId)       : null;
    const villageSelect     = cfg.villageId   ? document.getElementById(cfg.villageId)    : null;
    const hasMap            = cfg.hasMap === true;
    const placeholder       = cfg.placeholder || 'এলাকার নাম লিখে খুজুন';

    const ts = new TomSelect(searchSelect, {
      valueField:  'id',
      labelField:  'title_bn',
      searchField: ['name_bn', 'name_en', 'title_bn', 'title_en'],
      placeholder: placeholder,
      loadThrottle: 250,
      openOnFocus: false,

      load: function (query, callback) {
        if (query.length < 1) return callback();
        fetch('/newshub/api/locations/search/?q=' + encodeURIComponent(query))
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (data) { callback(data.locations || []); })
          .catch(function () { callback(); });
      },

      render: {
        option: function (item, escape) {
          let nameText = item.name_bn || '';
          if (item.name_en) nameText += ' (' + item.name_en + ')';
          const typeText = item.type || '';
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
          let nameText = item.name_bn || '';
          if (item.name_en) nameText += ' (' + item.name_en + ')';
          return '<div>' + escape(nameText) + '</div>';
        },
        no_results: function () {
          return '<div class="no-results">\u0995\u09CB\u09A8\u09CB \u09AB\u09B2\u09BE\u09AB\u09B2 \u09AA\u09BE\u0993\u09AF\u09BC\u09BE \u09AF\u09BE\u09AF\u09BC\u09A8\u09BF</div>';
        }
      },

      onChange: function (value) {
        if (!value) return;
        const item = ts.options[value];
        if (!item) return;
        resolveAndFillCascade(item);
        setTimeout(function () { ts.clear(true); ts.clearOptions(); }, 100);
      }
    });

    /* ---- Resolve parent IDs and fill cascade ---- */

    function resolveAndFillCascade(item) {
      const url = '/newshub/api/locations/resolve/?table='
        + encodeURIComponent(item.table)
        + '&id=' + encodeURIComponent(item.entity_id);
      fetch(url)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (data) { fillCascade(data.parent_ids || {}); })
        .catch(function () {});
    }

    function fillCascade(ids) {
      if (!ids.district_id || !districtSelect) return;

      /* Suppress map centering during auto-fill */
      if (hasMap) {
        if (window.newshubMapPinpoint && window.newshubMapPinpoint.suppressNextDistrictCenter) {
          window.newshubMapPinpoint.suppressNextDistrictCenter();
        }
        let cascadeApiObj = cfg.cascadeApi ? window[cfg.cascadeApi] : null;
        if (cascadeApiObj && cascadeApiObj.suppressMapCenter) {
          cascadeApiObj.suppressMapCenter(true);
        }
      }

      /* Step 1: District */
      setSelectValue(districtSelect, String(ids.district_id));

      /* Step 2: Subdistrict (upazila, metro thana, city corporation, municipality) */
      let subDistrictId = ids.upazila_id || ids.metropolitan_thana_id;
      let directSubdistrict = false;
      if (!subDistrictId && ids.city_corporation_id) {
        subDistrictId = ids.city_corporation_id;
        directSubdistrict = true;
      }
      if (!subDistrictId && ids.municipality_id) {
        subDistrictId = ids.municipality_id;
        directSubdistrict = true;
      }
      /* Metro thana, city corp, municipality all skip local body → wards directly */
      const skipLocalBody = directSubdistrict || !!ids.metropolitan_thana_id;

      if (subDistrictId && subDistrictSelect) {
        waitForOptions(subDistrictSelect, function () {
          setSelectValue(subDistrictSelect, String(subDistrictId));

          if (skipLocalBody) {
            let wardId = ids.city_corporation_ward_id || ids.municipality_ward_id;
            if (wardId && wardSelect) {
              waitForOptions(wardSelect, function () {
                setSelectValue(wardSelect, String(wardId));
                endFillAndCenterMap();
              });
            } else {
              endFillAndCenterMap();
            }
          } else {
            const localBodyId = ids.union_parishad_id;
            if (localBodyId && localBodySelect) {
              waitForOptions(localBodySelect, function () {
                setSelectValue(localBodySelect, String(localBodyId));

                const wardId = ids.union_parishad_ward_id;
                if (wardId && wardSelect) {
                  waitForOptions(wardSelect, function () {
                    setSelectValue(wardSelect, String(wardId));

                    const villageId = ids.union_parishad_village_id;
                    if (villageId && villageSelect) {
                      waitForOptions(villageSelect, function () {
                        setSelectValue(villageSelect, String(villageId));
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
          }
        });
      } else {
        endFillAndCenterMap();
      }
    }

    function endFillAndCenterMap() {
      if (!hasMap) return;

      const cascadeApiObj = cfg.cascadeApi ? window[cfg.cascadeApi] : null;
      if (cascadeApiObj && cascadeApiObj.suppressMapCenter) {
        cascadeApiObj.suppressMapCenter(false);
      }
      if (!window.newshubMapPinpoint) return;

      const levels = [
        { el: villageSelect,     zoom: window.newshubMapPinpoint.VILLAGE_CENTER_ZOOM },
        { el: wardSelect,        zoom: window.newshubMapPinpoint.WARD_CENTER_ZOOM },
        { el: localBodySelect,   zoom: window.newshubMapPinpoint.LOCAL_BODY_CENTER_ZOOM },
        { el: subDistrictSelect, zoom: window.newshubMapPinpoint.SUBDISTRICT_CENTER_ZOOM },
        { el: districtSelect,    zoom: window.newshubMapPinpoint.DISTRICT_CENTER_ZOOM },
      ];

      let deepestZoom = window.newshubMapPinpoint.DISTRICT_CENTER_ZOOM;
      let deepestEl   = null;
      for (let j = 0; j < levels.length; j++) {
        if (levels[j].el && levels[j].el.value) {
          deepestZoom = levels[j].zoom;
          deepestEl   = levels[j].el;
          break;
        }
      }

      const addressText = buildCascadeAddressText();

      if (deepestEl && deepestEl.value) {
        let opt = deepestEl.options[deepestEl.selectedIndex];
        if (opt && opt.dataset && opt.dataset.lat && opt.dataset.lng) {
          window.newshubMapPinpoint.centerOn(opt.dataset.lat, opt.dataset.lng, deepestZoom);
          if (addressText) {
            window.newshubMapPinpoint.updateAddress(addressText);
            if (window.newshubMapSearch) window.newshubMapSearch.setSearchText(addressText);
          }
          return;
        }
      }

      if (cascadeApiObj && cascadeApiObj.buildGeocodingQuery) {
        const query = cascadeApiObj.buildGeocodingQuery(deepestEl);
        if (query) window.newshubMapPinpoint.geocodeAndCenter(query, deepestZoom);
      }
    }

    /* ---- Helpers ---- */

    function buildCascadeAddressText() {
      const parts = [];
      const selects = [villageSelect, wardSelect, localBodySelect, subDistrictSelect, districtSelect];
      for (let i = 0; i < selects.length; i++) {
        const sel = selects[i];
        if (!sel || !sel.value) continue;
        const opt = sel.options[sel.selectedIndex];
        if (opt && opt.textContent) {
          const text = opt.textContent.trim();
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
      let attempts = 0;
      const interval = setInterval(function () {
        attempts++;
        if (selectEl.options.length > 1 || attempts > 50) {
          clearInterval(interval);
          callback();
        }
      }, 100);
    }

    /* ---- Public API ---- */

    const api = {
      clear: function () { ts.clear(true); ts.clearOptions(); }
    };

    if (cfg.publicApi) window[cfg.publicApi] = api;
    return api;
  }

  /* ========== Auto-initialize standard incident location search ========== */

  createLocationSearch({
    searchInputId: 'news-location-search',
    districtId:    'news-district-id',
    upazilaId:     'news-upazila-id',
    localBodyId:   'news-union-parishad-id',
    wardId:        'news-ward-id',
    villageId:     'news-village-id',
    cascadeApi:    'newshubLocationCascade',
    hasMap:        true,
    placeholder:   'এলাকার নাম যেমন: রূপনগর, সাভার......লিখে খুজুন',
    publicApi:     'newshubLocationSearch',
  });

  /* Expose factory for additional instances */
  window.newshubCreateLocationSearch = createLocationSearch;

  /* SPA cleanup — destroy Tom Select instances on page transition */
  if (window.spaCleanupRegister) {
    window.spaCleanupRegister(function () {
      document.querySelectorAll('select').forEach(function (s) {
        if (s.tomselect) s.tomselect.destroy();
      });
    });
  }

})();

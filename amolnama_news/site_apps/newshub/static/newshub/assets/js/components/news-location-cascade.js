/**
 * news-location-cascade.js
 * Factory for cascading location dropdowns with parallel rural/urban/city paths:
 *   District → Subdistrict (Upazila / Metro Thana / City Corporation)
 *   Subdistrict → Local Body (Union Parishad / Municipality / City Corporation)
 *                 OR directly to Ward if City Corporation/Metro Thana selected
 *   Local Body → Ward (UP Ward / Muni Ward / City Corp Ward)
 *   Ward → Village (rural path only, via union parishad ID)  [optional]
 *
 * Usage:
 *   window.newshubCreateLocationCascade(cfg) → creates instance, returns API object
 *
 * cfg properties (all optional except districtId):
 *   districtId        {string}  — ID of district select (required)
 *   upazilaId         {string}  — ID of upazila/subdistrict select
 *   localBodyId       {string}  — ID of union parishad / local body select
 *   wardId            {string}  — ID of ward select
 *   villageId         {string}  — ID of village select
 *   villageOtherId    {string}  — ID of village "other" text input
 *   villageRowId      {string}  — ID of village row container
 *   constituencyId    {string}  — ID of constituency hidden input
 *   subdistrictTypeId {string}  — ID of subdistrict type hidden input
 *   localBodyTypeId   {string}  — ID of local body type hidden input
 *   wardTypeId        {string}  — ID of ward type hidden input
 *   upazilaNameId     {string}  — ID of upazila name hidden input
 *   wardNameId        {string}  — ID of ward name hidden input
 *   villageNameId     {string}  — ID of village name hidden input
 *   fullAddressId     {string}  — ID of full address hidden input
 *   hasMap            {boolean} default true — center map on selection
 *   publicApi         {string}  — window property name for public API
 *
 * Auto-initializes the standard incident location cascade with news-* IDs.
 * Exposes: window.newshubCreateLocationCascade — factory for additional instances
 *          window.newshubLocationCascade       — standard incident location API
 */
(function () {
  'use strict';

  function createCascade(cfg) {
    const districtSelect    = document.getElementById(cfg.districtId);
    const subDistrictSelect = cfg.upazilaId        ? document.getElementById(cfg.upazilaId)        : null;
    const localBodySelect   = cfg.localBodyId      ? document.getElementById(cfg.localBodyId)      : null;
    const wardSelect        = cfg.wardId           ? document.getElementById(cfg.wardId)           : null;
    const villageSelect     = cfg.villageId        ? document.getElementById(cfg.villageId)        : null;
    const villageOtherInput = cfg.villageOtherId   ? document.getElementById(cfg.villageOtherId)   : null;
    const villageRow        = cfg.villageRowId     ? document.getElementById(cfg.villageRowId)     : null;
    const constituencyInput = cfg.constituencyId   ? document.getElementById(cfg.constituencyId)   : null;
    const subDistrictTypeInput = cfg.subdistrictTypeId ? document.getElementById(cfg.subdistrictTypeId) : null;
    const localBodyTypeInput   = cfg.localBodyTypeId   ? document.getElementById(cfg.localBodyTypeId)   : null;
    const wardTypeInput        = cfg.wardTypeId        ? document.getElementById(cfg.wardTypeId)        : null;
    const upazilaNameInput  = cfg.upazilaNameId    ? document.getElementById(cfg.upazilaNameId)    : null;
    const wardNameInput     = cfg.wardNameId       ? document.getElementById(cfg.wardNameId)       : null;
    const villageNameInput  = cfg.villageNameId    ? document.getElementById(cfg.villageNameId)    : null;
    const fullAddressInput  = cfg.fullAddressId    ? document.getElementById(cfg.fullAddressId)    : null;
    const hasMap            = cfg.hasMap           !== false;

    if (!districtSelect) return null;

    let cachedConstituencies = [];
    let suppressMapCenter    = false;

    /* ========== Helpers ========== */

    function getSelectedType(selectEl) {
      if (!selectEl || selectEl.selectedIndex < 0) return '';
      let opt = selectEl.options[selectEl.selectedIndex];
      return (opt && opt.dataset && opt.dataset.type) || '';
    }

    const TYPE_LABELS = {
      'upazila':            'উপজেলা',
      'metropolitan_thana': 'থানা',
      'city_corporation':   'সিটি কর্পোরেশন',
      'union_parishad':     'ইউনিয়ন পরিষদ',
      'municipality':       'পৌরসভা',
      'union_parishad_ward':    'ওয়ার্ড',
      'municipality_ward':      'ওয়ার্ড',
      'city_corporation_ward':  'ওয়ার্ড'
    };

    function buildTypedOptions(items, placeholder) {
      let opts = '<option value="">' + placeholder + '</option>';
      let currentGroup = null;
      items.forEach(function (item) {
        if (item.group && item.group !== currentGroup) {
          if (currentGroup !== null) opts += '</optgroup>';
          opts += '<optgroup label="' + escapeHtml(item.group) + '">';
          currentGroup = item.group;
        }
        let label = item.name_bn || '';
        if (item.name_en) label += ' (' + item.name_en + ')';
        if (!item.group) {
          const typeLabel = TYPE_LABELS[item.type] || '';
          if (typeLabel) label += ' [' + typeLabel + ']';
        }
        let latAttr = item.lat != null ? ' data-lat="' + item.lat + '"' : '';
        let lngAttr = item.lng != null ? ' data-lng="' + item.lng + '"' : '';
        opts += '<option value="' + item.id + '" data-type="' + (item.type || '') + '"'
              + latAttr + lngAttr + '>'
              + escapeHtml(label) + '</option>';
      });
      if (currentGroup !== null) opts += '</optgroup>';
      return opts;
    }

    function centerMapOnSelected(selectEl, zoom) {
      if (!hasMap || suppressMapCenter) return;
      if (!selectEl || selectEl.selectedIndex < 0) return;
      let opt = selectEl.options[selectEl.selectedIndex];
      if (!opt || !opt.value) return;
      let lat = opt.dataset.lat;
      let lng = opt.dataset.lng;
      if (lat && lng && window.newshubMapPinpoint) {
        window.newshubMapPinpoint.centerOn(lat, lng, zoom);
      } else if (window.newshubMapPinpoint && window.newshubMapPinpoint.geocodeAndCenter) {
        const query = buildGeocodingQuery(selectEl);
        if (query) window.newshubMapPinpoint.geocodeAndCenter(query, zoom);
      }
    }

    function buildGeocodingQuery(upToSelect) {
      let parts = [];
      const selects = [villageSelect, wardSelect, localBodySelect, subDistrictSelect, districtSelect];
      let reached = false;
      for (let i = 0; i < selects.length; i++) {
        const sel = selects[i];
        if (sel === upToSelect) reached = true;
        if (!reached) continue;
        if (!sel || !sel.value) continue;
        let opt = sel.options[sel.selectedIndex];
        if (opt && opt.textContent) {
          const fullText = opt.textContent.trim();
          const match = fullText.match(/\(([^)]+)\)/);
          let text = match ? match[1].trim() : fullText.split('(')[0].trim();
          if (text) parts.push(text);
        }
      }
      if (parts.length === 0) return '';
      parts.push('Bangladesh');
      return parts.join(', ');
    }


    function getBnName(selectEl) {
      if (!selectEl || !selectEl.value) return '';
      let opt = selectEl.options[selectEl.selectedIndex];
      if (!opt) return '';
      let text = opt.textContent.trim();
      text = text.replace(/\s*\[.*?\]\s*$/, '');
      text = text.replace(/\s*\(.*?\)\s*$/, '');
      return text.trim();
    }

    /* ---- Constituency matching ---- */

    function matchConstituencyByUpazila() {
      if (!constituencyInput || !subDistrictSelect) return;
      const type = getSelectedType(subDistrictSelect);
      if (type !== 'upazila') {
        constituencyInput.value = '';
        return;
      }
      const selectedOption = subDistrictSelect.options[subDistrictSelect.selectedIndex];
      if (!selectedOption || !selectedOption.value) {
        constituencyInput.value = '';
        return;
      }
      const upazilaText = selectedOption.textContent.trim();
      const upazilaName = upazilaText.split('(')[0].trim();
      for (let i = 0; i < cachedConstituencies.length; i++) {
        const c = cachedConstituencies[i];
        if (c.area_bn && c.area_bn.indexOf(upazilaName) !== -1) {
          constituencyInput.value = c.id;
          return;
        }
      }
      constituencyInput.value = '';
    }

    /* ========== Reset Helpers ========== */

    function resetSubDistrict() {
      if (subDistrictSelect) {
        subDistrictSelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u099C\u09C7\u09B2\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
      }
      if (subDistrictTypeInput) subDistrictTypeInput.value = '';
    }

    function resetLocalBody() {
      if (localBodySelect) {
        localBodySelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u0989\u09AA\u099C\u09C7\u09B2\u09BE/\u09A5\u09BE\u09A8\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
      }
      if (localBodyTypeInput) localBodyTypeInput.value = '';
    }

    function resetWard() {
      if (wardSelect) {
        wardSelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u09B8\u09CD\u09A5\u09BE\u09A8\u09C0\u09AF\u09BC \u09B8\u09B0\u0995\u09BE\u09B0 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
      }
      if (wardTypeInput) wardTypeInput.value = '';
    }

    function resetVillageOptions() {
      if (villageSelect) {
        villageSelect.hidden = false;
        villageSelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u0987\u0989\u09A8\u09BF\u09AF\u09BC\u09A8 \u09AA\u09B0\u09BF\u09B7\u09A6 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
      }
      if (villageOtherInput) {
        villageOtherInput.hidden = true;
        villageOtherInput.value = '';
      }
    }

    function resetVillage() {
      resetVillageOptions();
      showVillageRow(false);
    }

    function showVillageRow(show) {
      if (villageRow) villageRow.hidden = !show;
    }

    /* ========== District Change ========== */

    districtSelect.addEventListener('change', function () {
      const districtId = districtSelect.value;

      cachedConstituencies = [];
      if (constituencyInput) constituencyInput.value = '';
      resetLocalBody();
      resetWard();
      resetVillage();

      if (!districtId) {
        resetSubDistrict();
        return;
      }

      if (subDistrictSelect) {
        subDistrictSelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7... --</option>';
      }

      if (constituencyInput) {
        fetch('/newshub/api/constituencies/' + districtId + '/')
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (data) {
            cachedConstituencies = data.constituencies || [];
            if (subDistrictSelect && subDistrictSelect.value) {
              matchConstituencyByUpazila();
            }
          })
          .catch(function () { cachedConstituencies = []; });
      }

      if (subDistrictSelect) {
        fetch('/newshub/api/subdistricts/' + districtId + '/')
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (data) {
            let items = data.subdistricts || [];
            subDistrictSelect.innerHTML = buildTypedOptions(
              items, '-- \u0989\u09AA\u099C\u09C7\u09B2\u09BE/\u09A5\u09BE\u09A8\u09BE/\u09B8\u09BF\u099F\u09BF \u0995\u09B0\u09CD\u09AA\u09CB\u09B0\u09C7\u09B6\u09A8 (\u0990\u099A\u09CD\u099B\u09BF\u0995) --'
            );
          })
          .catch(function () {
            subDistrictSelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 --</option>';
          });
      }
    });

    /* ========== Subdistrict Change ========== */

    if (subDistrictSelect) {
      subDistrictSelect.addEventListener('change', function () {
        const subDistrictId   = subDistrictSelect.value;
        const subDistrictType = getSelectedType(subDistrictSelect);

        if (subDistrictTypeInput) subDistrictTypeInput.value = subDistrictType;
        matchConstituencyByUpazila();
        centerMapOnSelected(subDistrictSelect, window.newshubMapPinpoint ? window.newshubMapPinpoint.SUBDISTRICT_CENTER_ZOOM : 12);
        resetWard();
        resetVillage();

        if (!subDistrictId) {
          resetLocalBody();
          return;
        }

        if (subDistrictType === 'city_corporation' || subDistrictType === 'metropolitan_thana' || subDistrictType === 'municipality') {
          resetLocalBody();
          if (localBodyTypeInput) localBodyTypeInput.value = subDistrictType;

          if (villageSelect) villageSelect.hidden = true;
          if (villageOtherInput) villageOtherInput.hidden = false;
          showVillageRow(villageOtherInput != null);

          if (wardSelect) {
            wardSelect.innerHTML = '<option value="">-- \u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7... --</option>';
            let wardUrl;
            if (subDistrictType === 'city_corporation') {
              wardUrl = '/newshub/api/city-corporation-wards/' + subDistrictId + '/';
            } else if (subDistrictType === 'metropolitan_thana') {
              wardUrl = '/newshub/api/city-corporation-wards/metro-thana/' + subDistrictId + '/';
            } else {
              wardUrl = '/newshub/api/municipality-wards/' + subDistrictId + '/';
            }
            fetch(wardUrl)
              .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
              .then(function (data) {
                wardSelect.innerHTML = buildTypedOptions(
                  data.wards || [], '-- \u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 (\u0990\u099A\u09CD\u099B\u09BF\u0995) --'
                );
              })
              .catch(function () {
                wardSelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 --</option>';
              });
          }
          return;
        }

        if (localBodySelect) {
          localBodySelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7... --</option>';
          fetch('/newshub/api/local-bodies/?parent_type=' + subDistrictType + '&parent_id=' + subDistrictId)
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
              const items = data.local_bodies || [];
              localBodySelect.innerHTML = buildTypedOptions(
                items, '-- \u0987\u0989\u09A8\u09BF\u09AF\u09BC\u09A8 \u09AA\u09B0\u09BF\u09B7\u09A6 (\u0990\u099A\u09CD\u099B\u09BF\u0995) --'
              );
            })
            .catch(function () {
              localBodySelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 --</option>';
            });
        }
      });
    }

    /* ========== Local Body Change ========== */

    if (localBodySelect) {
      localBodySelect.addEventListener('change', function () {
        const localBodyId   = localBodySelect.value;
        const localBodyType = getSelectedType(localBodySelect);

        if (localBodyTypeInput) localBodyTypeInput.value = localBodyType;
        centerMapOnSelected(localBodySelect, window.newshubMapPinpoint ? window.newshubMapPinpoint.LOCAL_BODY_CENTER_ZOOM : 13);
        resetWard();
        resetVillageOptions();

        if (!localBodyId) {
          showVillageRow(false);
          return;
        }

        if (localBodyType === 'union_parishad') {
          showVillageRow(true);
          fetchVillages(localBodyId);
        } else {
          showVillageRow(false);
        }

        if (wardSelect) {
          wardSelect.innerHTML = '<option value="">-- \u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7... --</option>';
          let wardUrl;
          if (localBodyType === 'union_parishad') {
            wardUrl = '/newshub/api/union-parishad-wards/' + localBodyId + '/';
          } else if (localBodyType === 'municipality') {
            wardUrl = '/newshub/api/municipality-wards/' + localBodyId + '/';
          } else if (localBodyType === 'city_corporation') {
            wardUrl = '/newshub/api/city-corporation-wards/' + localBodyId + '/';
          } else {
            resetWard();
            return;
          }
          fetch(wardUrl)
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
              wardSelect.innerHTML = buildTypedOptions(
                data.wards || [], '-- \u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 (\u0990\u099A\u09CD\u099B\u09BF\u0995) --'
              );
            })
            .catch(function () {
              wardSelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 --</option>';
            });
        }
      });
    }

    /* ========== Ward Change ========== */

    if (wardSelect) {
      wardSelect.addEventListener('change', function () {
        const wardType = getSelectedType(wardSelect);
        if (wardTypeInput) wardTypeInput.value = wardType;
        centerMapOnSelected(wardSelect, window.newshubMapPinpoint ? window.newshubMapPinpoint.WARD_CENTER_ZOOM : 14);
      });
    }

    /* ========== Fetch Villages ========== */

    function fetchVillages(unionParishadId) {
      if (!villageSelect || !unionParishadId) return;
      villageSelect.innerHTML = '<option value="">-- \u0997\u09CD\u09B0\u09BE\u09AE \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7... --</option>';
      fetch('/newshub/api/union-parishad-villages/' + unionParishadId + '/')
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (data) {
          let opts = '<option value="">-- \u0997\u09CD\u09B0\u09BE\u09AE (\u0990\u099A\u09CD\u099B\u09BF\u0995) --</option>';
          if (data.villages && data.villages.length > 0) {
            data.villages.forEach(function (v) {
              let label = v.name_bn || '';
              if (v.name_en) label += ' (' + v.name_en + ')';
              const latAttr = v.lat != null ? ' data-lat="' + v.lat + '"' : '';
              const lngAttr = v.lng != null ? ' data-lng="' + v.lng + '"' : '';
              opts += '<option value="' + v.id + '"' + latAttr + lngAttr + '>' + escapeHtml(label) + '</option>';
            });
          }
          opts += '<option value="other">\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF (Other)</option>';
          villageSelect.innerHTML = opts;
        })
        .catch(function () {
          villageSelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 --</option>';
        });
    }

    /* ========== Village "Other" toggle ========== */

    if (villageSelect) {
      villageSelect.addEventListener('change', function () {
        if (villageSelect.value === 'other') {
          if (villageOtherInput) { villageOtherInput.hidden = false; villageOtherInput.focus(); }
        } else {
          if (villageOtherInput) { villageOtherInput.hidden = true; villageOtherInput.value = ''; }
          centerMapOnSelected(villageSelect, window.newshubMapPinpoint ? window.newshubMapPinpoint.VILLAGE_CENTER_ZOOM : 15);
        }
      });
    }

    /* ========== Full Address & Name Sync ========== */

    const ADDRESS_LABELS = {
      'upazila':            '\u0989\u09AA\u099C\u09C7\u09B2\u09BE/\u09A5\u09BE\u09A8\u09BE/\u09B8\u09BF\u099F\u09BF \u0995\u09B0\u09CD\u09AA\u09CB\u09B0\u09C7\u09B6\u09A8 (Upazila/Thana/City Corporation)',
      'metropolitan_thana': '\u0989\u09AA\u099C\u09C7\u09B2\u09BE/\u09A5\u09BE\u09A8\u09BE/\u09B8\u09BF\u099F\u09BF \u0995\u09B0\u09CD\u09AA\u09CB\u09B0\u09C7\u09B6\u09A8 (Upazila/Thana/City Corporation)',
      'city_corporation':   '\u0989\u09AA\u099C\u09C7\u09B2\u09BE/\u09A5\u09BE\u09A8\u09BE/\u09B8\u09BF\u099F\u09BF \u0995\u09B0\u09CD\u09AA\u09CB\u09B0\u09C7\u09B6\u09A8 (Upazila/Thana/City Corporation)',
      'union_parishad':     '\u0987\u0989\u09A8\u09BF\u09AF\u09BC\u09A8 \u09AA\u09B0\u09BF\u09B7\u09A6 (Union Parishad)',
      'municipality':       '\u09AA\u09CC\u09B0\u09B8\u09AD\u09BE (Municipality)'
    };

    function getCleanOptionText(selectEl) {
      if (!selectEl || !selectEl.value) return '';
      const opt = selectEl.options[selectEl.selectedIndex];
      if (!opt) return '';
      return opt.textContent.trim().replace(/\s*\[.*?\]\s*$/, '');
    }

    function buildFullAddress() {
      const parts = [];
      let villageName = '';
      if (villageRow && !villageRow.hidden) {
        if (villageSelect && villageSelect.value && villageSelect.value !== 'other') {
          villageName = getCleanOptionText(villageSelect);
        } else if (villageOtherInput && villageOtherInput.value.trim()) {
          villageName = villageOtherInput.value.trim();
        }
      }
      if (villageName) parts.push('\u0997\u09CD\u09B0\u09BE\u09AE/\u09AE\u09B9\u09B2\u09CD\u09B2\u09BE (Village/Moholla): ' + villageName);
      const wardName = getCleanOptionText(wardSelect);
      if (wardName) parts.push('\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 (Ward): ' + wardName);
      const localBodyName = getCleanOptionText(localBodySelect);
      if (localBodyName) {
        const lbType  = getSelectedType(localBodySelect);
        const lbLabel = ADDRESS_LABELS[lbType] || '\u09B8\u09CD\u09A5\u09BE\u09A8\u09C0\u09AF\u09BC \u09B8\u09B0\u0995\u09BE\u09B0 (Local Body)';
        parts.push(lbLabel + ': ' + localBodyName);
      }
      const subDistrictName = getCleanOptionText(subDistrictSelect);
      if (subDistrictName) {
        const sdType  = getSelectedType(subDistrictSelect);
        const sdLabel = ADDRESS_LABELS[sdType] || '\u0989\u09AA\u099C\u09C7\u09B2\u09BE/\u09A5\u09BE\u09A8\u09BE/\u09B8\u09BF\u099F\u09BF \u0995\u09B0\u09CD\u09AA\u09CB\u09B0\u09C7\u09B6\u09A8 (Upazila/Thana/City Corporation)';
        parts.push(sdLabel + ': ' + subDistrictName);
      }
      const districtName = getCleanOptionText(districtSelect);
      if (districtName) parts.push('\u099C\u09C7\u09B2\u09BE (District): ' + districtName);
      return parts.join(', ');
    }

    function syncLocationNames() {
      if (upazilaNameInput) upazilaNameInput.value = getBnName(subDistrictSelect) || '';
      if (wardNameInput)    wardNameInput.value    = getBnName(wardSelect)        || '';
      if (villageNameInput) {
        let vName = '';
        if (villageRow && !villageRow.hidden) {
          if (villageOtherInput && !villageOtherInput.hidden && villageOtherInput.value.trim()) {
            vName = villageOtherInput.value.trim();
          } else if (villageSelect && villageSelect.value && villageSelect.value !== 'other') {
            vName = getBnName(villageSelect);
          }
        }
        villageNameInput.value = vName;
      }
    }

    const locationForm = fullAddressInput || upazilaNameInput || districtSelect;
    if (locationForm) {
      const addrForm = locationForm.closest('form');
      if (addrForm) {
        addrForm.addEventListener('submit', function () {
          if (fullAddressInput) fullAddressInput.value = buildFullAddress() || '';
          syncLocationNames();
        });
      }
    }

    /* ========== Public API ========== */

    const api = {
      /* Standard incident location API (backward compatible) */
      getConstituencies: function () { return cachedConstituencies; },
      setConstituency:   function (id) { if (constituencyInput) constituencyInput.value = id || ''; },
      matchConstituency: function ()   { matchConstituencyByUpazila(); },
      getSelectedType:   function (level) {
        if (level === 'subdistrict') return getSelectedType(subDistrictSelect);
        if (level === 'local_body')  return getSelectedType(localBodySelect);
        if (level === 'ward')        return getSelectedType(wardSelect);
        return '';
      },
      showVillageRow:    function (show) { showVillageRow(show); },
      suppressMapCenter: function (s)    { suppressMapCenter = s; },
      buildGeocodingQuery: function (fromSelect) { return buildGeocodingQuery(fromSelect || districtSelect); },
      buildFullAddress:  function () { return buildFullAddress(); },
      /* Generic read/reset — available on all instances */
      read: function () {
        return {
          districtId:    parseInt(districtSelect.value,  10) || 0,
          districtName:  getBnName(districtSelect),
          upazilaId:     subDistrictSelect ? (parseInt(subDistrictSelect.value, 10) || 0) : 0,
          upazilaName:   getBnName(subDistrictSelect),
          localBodyId:   localBodySelect   ? (parseInt(localBodySelect.value,   10) || 0) : 0,
          localBodyName: getBnName(localBodySelect),
          wardId:        wardSelect        ? (parseInt(wardSelect.value,        10) || 0) : 0,
          wardName:      getBnName(wardSelect),
        };
      },
      reset: function () {
        if (districtSelect) districtSelect.value = '';
        resetSubDistrict();
        resetLocalBody();
        resetWard();
        resetVillage();
        if (constituencyInput) constituencyInput.value = '';
      },
    };

    if (cfg.publicApi) window[cfg.publicApi] = api;
    return api;
  }

  /* ========== Auto-initialize standard incident location cascade ========== */

  createCascade({
    districtId:        'news-district-id',
    upazilaId:         'news-upazila-id',
    localBodyId:       'news-union-parishad-id',
    wardId:            'news-ward-id',
    villageId:         'news-village-id',
    villageOtherId:    'news-village-other',
    villageRowId:      'news-village-row',
    constituencyId:    'news-constituency-id',
    subdistrictTypeId: 'news-subdistrict-type',
    localBodyTypeId:   'news-local-body-type',
    wardTypeId:        'news-ward-type',
    upazilaNameId:     'news-upazila-name',
    wardNameId:        'news-ward-name',
    villageNameId:     'news-village-name',
    fullAddressId:     'news-full-address-bn',
    hasMap:            true,
    publicApi:         'newshubLocationCascade',
  });

  /* Expose factory for additional instances */
  window.newshubCreateLocationCascade = createCascade;

})();

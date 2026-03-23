/**
 * news-land-grab-incident.js
 * Serializes the Land Grabbing Incident Details form into a hidden JSON
 * input for form submission.
 * Saved to [investigation].[incident_evidence_land_grabbing] on the server.
 * All lookup fields (property type, area unit, document status, grabbing method,
 * current status) are DB-driven from ref_status via embedded JSON data elements.
 *
 * DOM dependencies:
 *   #land-grab-incident-json             — hidden input (JSON payload)
 *   #land-property-type-data             — <script type="application/json"> (ref_status array)
 *   #land-grabbing-method-data           — <script type="application/json">
 *   #land-current-status-data            — <script type="application/json">
 *   #land-document-title-status-data     — <script type="application/json">
 *   #land-area-unit-data                 — <script type="application/json">
 *   #land-grab-property-type-grid        — radio card grid (populated by JS)
 *   #land-grab-property-type             — hidden input (selected property type status_id)
 *   #land-grab-property-type-other-row   — row shown when OTHER is selected
 *   #land-grab-property-type-other       — text input for "other" property detail
 *   #land-grab-mouza                     — text input (মৌজার নাম)
 *   #land-grab-daag                      — text input (দাগ নম্বর)
 *   #land-grab-khatian                   — text input (খতিয়ান নম্বর)
 *   #land-grab-area-amount               — number input (land area)
 *   #land-grab-area-unit                 — select (populated by JS from land-area-unit-data)
 *   #land-doc-title-status-checkboxes    — container (populated by JS)
 *   #land-grabbing-method-checkboxes     — container (populated by JS)
 *   #land-grab-method-other-row          — row shown when OTHER_METHOD is selected
 *   #land-grab-method-other-detail       — text input for "other method" detail
 *   #land-grab-status-group             — inline radio group (populated by JS)
 *   #land-grab-current-status           — hidden input (selected current status status_id)
 *   #land-grab-families-evicted         — number input
 *   #land-grab-violence-occurred        — checkbox
 *   #land-grab-violence-desc-row        — wrapper div
 *   #land-grab-violence-desc            — textarea
 * Note: Legal action fields handled by news-land-grab-legal.js (Step 8).
 */
(function () {
  'use strict';

  var hiddenInput = document.getElementById('land-grab-incident-json');
  if (!hiddenInput) return;

  /* ---- Parse embedded JSON reference data ---- */
  function parseJsonData(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  var propertyTypeData       = parseJsonData('land-property-type-data');
  var grabbingMethodData     = parseJsonData('land-grabbing-method-data');
  var currentStatusData      = parseJsonData('land-current-status-data');
  var docTitleStatusData     = parseJsonData('land-document-title-status-data');
  var areaUnitData           = parseJsonData('land-area-unit-data');

  /* ---- Element references ---- */
  var propertyTypeHidden    = document.getElementById('land-grab-property-type');
  var propertyTypeOtherRow  = document.getElementById('land-grab-property-type-other-row');
  var propertyTypeOtherEl   = document.getElementById('land-grab-property-type-other');
  var mouzaEl               = document.getElementById('land-grab-mouza');
  var daagEl                = document.getElementById('land-grab-daag');
  var khatianEl             = document.getElementById('land-grab-khatian');
  var areaAmountEl          = document.getElementById('land-grab-area-amount');
  var areaUnitEl            = document.getElementById('land-grab-area-unit');
  var methodOtherRow        = document.getElementById('land-grab-method-other-row');
  var methodOtherDetailEl   = document.getElementById('land-grab-method-other-detail');
  var familiesEl            = document.getElementById('land-grab-families-evicted');
  var violenceEl            = document.getElementById('land-grab-violence-occurred');
  var violenceDescRow       = document.getElementById('land-grab-violence-desc-row');
  var violenceDescEl        = document.getElementById('land-grab-violence-desc');
  var currentStatusHidden   = document.getElementById('land-grab-current-status');

  /* ---- Status IDs for "Other" detection ---- */
  var propertyTypeOtherId = 0;
  var methodOtherId       = 0;
  for (var pi = 0; pi < propertyTypeData.length; pi++) {
    if ((propertyTypeData[pi].status_code || '').toUpperCase() === 'OTHER') {
      propertyTypeOtherId = propertyTypeData[pi].status_id;
      break;
    }
  }
  for (var mi = 0; mi < grabbingMethodData.length; mi++) {
    if ((grabbingMethodData[mi].status_code || '').toUpperCase() === 'OTHER_METHOD') {
      methodOtherId = grabbingMethodData[mi].status_id;
      break;
    }
  }

  /* ---- Populate property type radio card grid ---- */
  var propTypeGrid = document.getElementById('land-grab-property-type-grid');
  if (propTypeGrid && propertyTypeData.length) {
    for (var i = 0; i < propertyTypeData.length; i++) {
      var pt = propertyTypeData[i];
      var label = document.createElement('label');
      label.className = 'radio-card';
      var inp = document.createElement('input');
      inp.type  = 'radio';
      inp.name  = 'land_grab_property_type_radio';
      inp.value = pt.status_id;
      inp.id    = 'land_grab_property_type_radio-' + pt.status_id;
      var iconSpan  = document.createElement('span');
      iconSpan.className = 'radio-card-icon';
      iconSpan.textContent = pt.status_icon || '';
      var textSpan  = document.createElement('span');
      textSpan.className = 'radio-card-label';
      textSpan.textContent = (pt.status_name_bn || '') + ' (' + (pt.status_name_en || '') + ')';
      label.appendChild(inp);
      label.appendChild(iconSpan);
      label.appendChild(textSpan);
      propTypeGrid.appendChild(label);
    }
  }

  /* ---- Populate area unit select ---- */
  if (areaUnitEl && areaUnitData.length) {
    for (var ai = 0; ai < areaUnitData.length; ai++) {
      var au = areaUnitData[ai];
      var opt = document.createElement('option');
      opt.value = au.status_id;
      opt.textContent = (au.status_name_bn || '') + ' (' + (au.status_name_en || '') + ')';
      areaUnitEl.appendChild(opt);
    }
  }

  /* ---- Populate document title status checkboxes ---- */
  var docContainer = document.getElementById('land-doc-title-status-checkboxes');
  if (docContainer && docTitleStatusData.length) {
    for (var di = 0; di < docTitleStatusData.length; di++) {
      var ds = docTitleStatusData[di];
      var dlabel = document.createElement('label');
      dlabel.className = 'checkbox-label';
      var dinp = document.createElement('input');
      dinp.type  = 'checkbox';
      dinp.name  = 'land_doc_title_status';
      dinp.value = ds.status_id;
      dinp.id    = 'land_doc_title_status-' + ds.status_id;
      dlabel.appendChild(dinp);
      dlabel.appendChild(document.createTextNode(
        ' ' + (ds.status_name_bn || '') + ' (' + (ds.status_name_en || '') + ')'
      ));
      docContainer.appendChild(dlabel);
      dinp.addEventListener('change', syncToHiddenInput);
    }
  }

  /* ---- Populate grabbing method checkboxes ---- */
  var methodContainer = document.getElementById('land-grabbing-method-checkboxes');
  if (methodContainer && grabbingMethodData.length) {
    for (var gi = 0; gi < grabbingMethodData.length; gi++) {
      var gm = grabbingMethodData[gi];
      var glabel = document.createElement('label');
      glabel.className = 'checkbox-label';
      var ginp = document.createElement('input');
      ginp.type  = 'checkbox';
      ginp.name  = 'land_grabbing_method';
      ginp.value = gm.status_id;
      ginp.id    = 'land_grabbing_method-' + gm.status_id;
      glabel.appendChild(ginp);
      glabel.appendChild(document.createTextNode(
        ' ' + (gm.status_name_bn || '') + ' (' + (gm.status_name_en || '') + ')'
      ));
      methodContainer.appendChild(glabel);
      /* Toggle "other method" row when OTHER_METHOD checkbox changes */
      if (gm.status_id === methodOtherId) {
        ginp.addEventListener('change', function () {
          if (methodOtherRow) methodOtherRow.style.display = this.checked ? '' : 'none';
          if (!this.checked && methodOtherDetailEl) methodOtherDetailEl.value = '';
          syncToHiddenInput();
        });
      } else {
        ginp.addEventListener('change', syncToHiddenInput);
      }
    }
  }

  /* ---- Populate current status inline radios ---- */
  var statusGroup = document.getElementById('land-grab-status-group');
  if (statusGroup && currentStatusData.length) {
    for (var si = 0; si < currentStatusData.length; si++) {
      var cs = currentStatusData[si];
      var slabel = document.createElement('label');
      slabel.className = 'radio-inline';
      var sinp = document.createElement('input');
      sinp.type  = 'radio';
      sinp.name  = 'land_grab_status_radio';
      sinp.value = cs.status_id;
      sinp.id    = 'land_grab_status_radio-' + cs.status_id;
      slabel.appendChild(sinp);
      slabel.appendChild(document.createTextNode(
        ' ' + (cs.status_name_bn || '') + ' (' + (cs.status_name_en || '') + ')'
      ));
      statusGroup.appendChild(slabel);
    }
  }

  /* ---- Bind property type radio card grid → hidden input ---- */
  if (propTypeGrid && propertyTypeHidden) {
    propTypeGrid.addEventListener('change', function (e) {
      if (e.target.type === 'radio') {
        var selectedId = parseInt(e.target.value, 10);
        propertyTypeHidden.value = selectedId;
        var isOther = (selectedId === propertyTypeOtherId);
        if (propertyTypeOtherRow) propertyTypeOtherRow.style.display = isOther ? '' : 'none';
        if (!isOther && propertyTypeOtherEl) propertyTypeOtherEl.value = '';
        syncToHiddenInput();
      }
    });
  }

  /* ---- Bind current status inline radio group → hidden input ---- */
  if (statusGroup && currentStatusHidden) {
    statusGroup.addEventListener('change', function (e) {
      if (e.target.type === 'radio') {
        currentStatusHidden.value = parseInt(e.target.value, 10);
        syncToHiddenInput();
      }
    });
  }

  /* ---- Toggle violence description row ---- */
  if (violenceEl) {
    violenceEl.addEventListener('change', function () {
      if (violenceDescRow) violenceDescRow.style.display = violenceEl.checked ? '' : 'none';
      syncToHiddenInput();
    });
  }

  /* ---- Collect checked IDs by checkbox name ---- */
  function collectCheckedIds(name) {
    var checked = document.querySelectorAll('input[name="' + name + '"]:checked');
    var ids = [];
    for (var ci = 0; ci < checked.length; ci++) {
      ids.push(parseInt(checked[ci].value, 10));
    }
    return ids;
  }

  /* ---- Collect & serialize all data ---- */
  function collectData() {
    return {
      propertyTypeId:    parseInt(propertyTypeHidden && propertyTypeHidden.value, 10) || 0,
      propertyTypeOther: (propertyTypeOtherEl && propertyTypeOtherEl.value.trim()) || '',
      mouza:             (mouzaEl   && mouzaEl.value.trim())   || '',
      daag:              (daagEl    && daagEl.value.trim())    || '',
      khatian:           (khatianEl && khatianEl.value.trim()) || '',
      areaAmount:        parseFloat(areaAmountEl && areaAmountEl.value) || 0,
      areaUnitId:        parseInt(areaUnitEl && areaUnitEl.value, 10) || 0,
      documentIds:       collectCheckedIds('land_doc_title_status'),
      methodIds:         collectCheckedIds('land_grabbing_method'),
      methodOther:       (methodOtherDetailEl && methodOtherDetailEl.value.trim()) || '',
      currentStatusId:   parseInt(currentStatusHidden && currentStatusHidden.value, 10) || 0,
      familiesEvicted:   parseInt(familiesEl && familiesEl.value, 10) || 0,
      violenceOccurred:  !!(violenceEl && violenceEl.checked),
      violenceDesc:      (violenceDescEl && violenceDescEl.value.trim()) || '',
      /* caseStatus / caseNumber serialized by news-land-grab-legal.js */
    };
  }

  function hasAnyData(d) {
    return d.propertyTypeId > 0 || d.mouza || d.daag || d.khatian
      || d.areaAmount > 0 || d.documentIds.length > 0
      || d.methodIds.length > 0 || d.currentStatusId > 0
      || d.familiesEvicted > 0 || d.violenceOccurred;
  }

  function syncToHiddenInput() {
    var data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  /* Sync on any input/change inside the section */
  var section = document.getElementById('section-land-grab-incident-details');
  if (section) {
    section.addEventListener('input', syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  /* Re-sync before form submit */
  var form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    var data;
    try { data = JSON.parse(hiddenInput.value); } catch (e) { return; }

    /* Property type radio */
    if (data.propertyTypeId) {
      var propRadios = document.querySelectorAll('input[name="land_grab_property_type_radio"]');
      for (var i = 0; i < propRadios.length; i++) {
        if (parseInt(propRadios[i].value, 10) === data.propertyTypeId) {
          propRadios[i].checked = true;
          break;
        }
      }
      if (propertyTypeHidden) propertyTypeHidden.value = data.propertyTypeId;
      var isOther = (data.propertyTypeId === propertyTypeOtherId);
      if (propertyTypeOtherRow) propertyTypeOtherRow.style.display = isOther ? '' : 'none';
      if (isOther && propertyTypeOtherEl && data.propertyTypeOther) {
        propertyTypeOtherEl.value = data.propertyTypeOther;
      }
    }

    /* Land record fields */
    if (mouzaEl && data.mouza)            mouzaEl.value      = data.mouza;
    if (daagEl && data.daag)              daagEl.value       = data.daag;
    if (khatianEl && data.khatian)        khatianEl.value    = data.khatian;
    if (areaAmountEl && data.areaAmount)  areaAmountEl.value = data.areaAmount;
    if (areaUnitEl && data.areaUnitId)    areaUnitEl.value   = data.areaUnitId;

    /* Document title status checkboxes */
    if (data.documentIds && data.documentIds.length) {
      var docCbs = document.querySelectorAll('input[name="land_doc_title_status"]');
      for (var d = 0; d < docCbs.length; d++) {
        if (data.documentIds.indexOf(parseInt(docCbs[d].value, 10)) !== -1) {
          docCbs[d].checked = true;
        }
      }
    }

    /* Grabbing method checkboxes */
    if (data.methodIds && data.methodIds.length) {
      var methCbs = document.querySelectorAll('input[name="land_grabbing_method"]');
      for (var m = 0; m < methCbs.length; m++) {
        if (data.methodIds.indexOf(parseInt(methCbs[m].value, 10)) !== -1) {
          methCbs[m].checked = true;
        }
      }
      /* Show "other method" row if OTHER_METHOD is among saved methods */
      if (methodOtherId && data.methodIds.indexOf(methodOtherId) !== -1) {
        if (methodOtherRow) methodOtherRow.style.display = '';
        if (methodOtherDetailEl && data.methodOther) methodOtherDetailEl.value = data.methodOther;
      }
    }

    /* Current status radio */
    if (data.currentStatusId) {
      var statusRadios = document.querySelectorAll('input[name="land_grab_status_radio"]');
      for (var s = 0; s < statusRadios.length; s++) {
        if (parseInt(statusRadios[s].value, 10) === data.currentStatusId) {
          statusRadios[s].checked = true;
          break;
        }
      }
      if (currentStatusHidden) currentStatusHidden.value = data.currentStatusId;
    }

    /* Human impact */
    if (familiesEl && data.familiesEvicted)  familiesEl.value   = data.familiesEvicted;
    if (violenceEl) violenceEl.checked = !!data.violenceOccurred;
    if (violenceDescRow) violenceDescRow.style.display = data.violenceOccurred ? '' : 'none';
    if (violenceDescEl && data.violenceDesc) violenceDescEl.value = data.violenceDesc;
  }
  setTimeout(restoreFromSavedData, 100);

  /* ---- Public API for form-clear.js ---- */
  window.newshubLandGrabIncident = {
    reset: function () {
      /* Property type radio cards */
      var propRadios = document.querySelectorAll('input[name="land_grab_property_type_radio"]');
      for (var i = 0; i < propRadios.length; i++) propRadios[i].checked = false;
      if (propertyTypeHidden)   propertyTypeHidden.value           = '';
      if (propertyTypeOtherEl)  propertyTypeOtherEl.value          = '';
      if (propertyTypeOtherRow) propertyTypeOtherRow.style.display = 'none';

      /* Land record fields */
      if (mouzaEl)      mouzaEl.value      = '';
      if (daagEl)       daagEl.value       = '';
      if (khatianEl)    khatianEl.value    = '';
      if (areaAmountEl) areaAmountEl.value = '';
      if (areaUnitEl)   areaUnitEl.selectedIndex = 0;

      /* Document title status checkboxes */
      var docCbs = document.querySelectorAll('input[name="land_doc_title_status"]');
      for (var d = 0; d < docCbs.length; d++) docCbs[d].checked = false;

      /* Method checkboxes */
      var methCbs = document.querySelectorAll('input[name="land_grabbing_method"]');
      for (var m = 0; m < methCbs.length; m++) methCbs[m].checked = false;
      if (methodOtherDetailEl) methodOtherDetailEl.value        = '';
      if (methodOtherRow)      methodOtherRow.style.display     = 'none';

      /* Current status */
      var statusRadios = document.querySelectorAll('input[name="land_grab_status_radio"]');
      for (var s = 0; s < statusRadios.length; s++) statusRadios[s].checked = false;
      if (currentStatusHidden) currentStatusHidden.value = '';

      /* Human impact */
      if (familiesEl)      familiesEl.value      = '';
      if (violenceEl)      violenceEl.checked    = false;
      if (violenceDescRow) violenceDescRow.style.display = 'none';
      if (violenceDescEl)  violenceDescEl.value  = '';

      hiddenInput.value = '';
    }
  };
})();

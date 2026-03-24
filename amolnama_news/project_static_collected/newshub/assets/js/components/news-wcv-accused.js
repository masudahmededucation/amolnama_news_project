/**
 * news-wcv-accused.js
 * Perpetrator repeater — supports multiple accused per submission.
 * DB-driven relationship/position selects and attribute checkboxes.
 * Conditional "previous history" textarea per card.
 * Serializes as a JSON array to #wcv-accused.
 *
 * DOM dependencies:
 *   #wcv-accused                     — hidden input for form submission
 *   #wcv-accused-list                — card container
 *   #wcv-accused-add-btn             — add card button
 *   wcv-attacker-relationships-data  — JSON data script
 *   wcv-attacker-positions-data      — JSON data script
 *   wcv-attacker-attributes-data     — JSON data script
 *
 * Exposes: window.newshubWcvAccused = { reset: fn }
 */
(function () {
  'use strict';

  var hiddenJson = document.getElementById('wcv-accused');
  var container = document.getElementById('wcv-accused-list');
  var addBtn = document.getElementById('wcv-accused-add-btn');

  if (!hiddenJson || !container) return;

  /* ========== Parse reference data (once) ========== */

  function parseJsonData(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  var relationships = parseJsonData('wcv-attacker-relationships-data');
  var positions = parseJsonData('wcv-attacker-positions-data');
  var attributesRaw = parseJsonData('wcv-attacker-attributes-data');
  /* Move "Previous History of Violence" checkbox to last position */
  var attributes = [];
  var prevHistAttr = null;
  for (var ai = 0; ai < attributesRaw.length; ai++) {
    if ((attributesRaw[ai].status_code || '') === 'has_previous_history_of_violence') {
      prevHistAttr = attributesRaw[ai];
    } else {
      attributes.push(attributesRaw[ai]);
    }
  }
  if (prevHistAttr) attributes.push(prevHistAttr);

  var accusedGenders = parseJsonData('wcv-accused-genders-data');
  var accusedReligions = parseJsonData('wcv-accused-religions-data');
  var accusedDistricts = parseJsonData('wcv-accused-districts-data');
  var accusedOccupations = parseJsonData('wcv-accused-occupations-data');

  var identityRefData = { genders: accusedGenders, religions: accusedReligions, districts: accusedDistricts };

  /* ID of the "OTHER" relationship option — used to toggle free-text row */
  var otherRelId = '';
  for (var ri = 0; ri < relationships.length; ri++) {
    if ((relationships[ri].status_code || '') === 'other') {
      otherRelId = String(relationships[ri].status_id);
      break;
    }
  }

  var cardCounter = 0;

  /* ========== Populate helpers ========== */

  function populateSelect(selectEl, items) {
    for (var i = 0; i < items.length; i++) {
      var s = items[i];
      var opt = document.createElement('option');
      opt.value = s.status_id;
      opt.textContent = (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')';
      selectEl.appendChild(opt);
    }
  }

  function populateCheckboxes(containerEl, items, cardIndex) {
    for (var i = 0; i < items.length; i++) {
      var s = items[i];
      var label = document.createElement('label');
      label.className = 'checkbox-inline';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'wcv_accused_attr-' + cardIndex + '-' + s.status_id;
      input.name = 'wcv_accused_attr_' + cardIndex;
      input.className = 'wcv-attr-cb';
      input.value = s.status_id;
      input.dataset.code = s.status_code || '';
      label.appendChild(input);
      label.appendChild(document.createTextNode(
        ' ' + (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')'
      ));
      containerEl.appendChild(label);
    }
  }

  /* ========== DOM helpers ========== */

  function makeFormField(labelText, inputEl) {
    var field = document.createElement('div');
    field.className = 'form-field';
    var lbl = document.createElement('label');
    if (inputEl.id) lbl.setAttribute('for', inputEl.id);
    lbl.textContent = labelText;
    field.appendChild(lbl);
    field.appendChild(inputEl);
    return field;
  }

  function makeActorGroup(titleBn, titleEn) {
    var group = document.createElement('div');
    group.className = 'actor-group';
    group.style.borderLeftColor = '#e57373';
    var h5 = document.createElement('h5');
    h5.className = 'actor-group-title';
    h5.setAttribute('data-bn', titleBn);
    h5.setAttribute('data-en', titleEn);
    h5.textContent = titleBn + ' (' + titleEn + ')';
    group.appendChild(h5);
    return group;
  }

  /* ========== Create card ========== */

  function createCard() {
    var n = cardCounter++;

    var card = document.createElement('div');
    card.className = 'wcv-accused-card';
    card.setAttribute('data-card-index', n);

    /* --- Header --- */
    var header = document.createElement('div');
    header.className = 'wcv-accused-card-header';

    var numSpan = document.createElement('span');
    numSpan.className = 'wcv-card-number';
    header.appendChild(numSpan);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-repeater-delete btn-wcv-remove';
    removeBtn.innerHTML = 'ডিলিট <span class="btn-delete-x">&times;</span>';
    removeBtn.style.display = 'none';
    header.appendChild(removeBtn);

    card.appendChild(header);

    /* ======== Group 1 — Name (shared module: news-person-name.js) ======== */
    var nameGroup = window.newshubPersonName.buildNameGroupDom('wcv-accused', '#e57373');
    var firstNameEnInput  = nameGroup.inputs.firstNameEn;
    var lastNameEnInput   = nameGroup.inputs.lastNameEn;
    var firstNameBnInput  = nameGroup.inputs.firstNameBn;
    var lastNameBnInput   = nameGroup.inputs.lastNameBn;
    var fatherFirstInput  = nameGroup.inputs.fatherFirstName;
    var fatherLastInput   = nameGroup.inputs.fatherLastName;
    card.appendChild(nameGroup.element);

    /* ======== Group 2 — Personal Identity (shared module) ======== */
    var identityGroup = window.newshubPersonIdentity.buildIdentityGroupDom('wcv-accused', identityRefData, '#e57373');
    var ageInput = identityGroup.inputs.age;
    var genderSelect = identityGroup.inputs.genderId;
    card.appendChild(identityGroup.element);

    /* ======== Group 3 — Occupation & Workplace (WCV-specific) ======== */
    var grpOccupation = makeActorGroup('\u09AA\u09C7\u09B6\u09BE \u0993 \u0995\u09B0\u09CD\u09AE\u09B8\u09CD\u09A5\u09B2', 'Occupation & Workplace');

    /* --- Occupation --- */
    var occSelect = document.createElement('select');
    occSelect.id = 'wcv-accused-occupation-' + n;
    occSelect.name = 'wcv_accused_occupation';
    occSelect.className = 'wcv-accused-occupation';
    var occDefault = document.createElement('option');
    occDefault.value = '';
    occDefault.setAttribute('data-bn', '-- \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --');
    occDefault.setAttribute('data-en', '-- Select --');
    occDefault.textContent = '-- \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 (Select) --';
    occSelect.appendChild(occDefault);
    populateSelect(occSelect, accusedOccupations);
    grpOccupation.appendChild(makeFormField('\u09AA\u09C7\u09B6\u09BE (Occupation)', occSelect));

    /* --- Institution / Workplace --- */
    var institutionInput = document.createElement('input');
    institutionInput.type = 'text';
    institutionInput.id = 'wcv-accused-institution-' + n;
    institutionInput.name = 'wcv_accused_institution';
    institutionInput.className = 'wcv-accused-institution';
    institutionInput.setAttribute('data-ph-bn', '\u09AA\u09CD\u09B0\u09A4\u09BF\u09B7\u09CD\u09A0\u09BE\u09A8 / \u0995\u09B0\u09CD\u09AE\u09B8\u09CD\u09A5\u09B2 (\u09AC\u09BE\u0982\u09B2\u09BE)...');
    institutionInput.setAttribute('data-ph-en', 'Institution / Workplace...');
    institutionInput.placeholder = '\u09AA\u09CD\u09B0\u09A4\u09BF\u09B7\u09CD\u09A0\u09BE\u09A8 / \u0995\u09B0\u09CD\u09AE\u09B8\u09CD\u09A5\u09B2 (\u09AC\u09BE\u0982\u09B2\u09BE)...';
    grpOccupation.appendChild(makeFormField('\u09AA\u09CD\u09B0\u09A4\u09BF\u09B7\u09CD\u09A0\u09BE\u09A8 / \u0995\u09B0\u09CD\u09AE\u09B8\u09CD\u09A5\u09B2 (Institution / Workplace)', institutionInput));

    card.appendChild(grpOccupation);

    /* ======== Group 4 — Relationship to Victim ======== */
    var grpRelationship = makeActorGroup('ভুক্তভোগীর সাথে সম্পর্ক', 'Relationship to Victim');

    /* --- Relationship select --- */
    var relSelect = document.createElement('select');
    relSelect.id = 'wcv-rel-select-' + n;
    relSelect.name = 'wcv_accused_relationship';
    relSelect.className = 'wcv-rel-select';
    var relDefault = document.createElement('option');
    relDefault.value = '';
    relDefault.setAttribute('data-bn', '-- নির্বাচন করুন --');
    relDefault.setAttribute('data-en', '-- Select --');
    relDefault.textContent = '-- নির্বাচন করুন (Select) --';
    relSelect.appendChild(relDefault);
    populateSelect(relSelect, relationships);
    grpRelationship.appendChild(makeFormField('ভুক্তভোগীর সাথে সম্পর্ক (Relationship to Victim)', relSelect));

    /* --- Relationship — other details (conditional) --- */
    var relOtherRow = document.createElement('div');
    relOtherRow.className = 'form-field wcv-rel-other-row';
    relOtherRow.style.display = 'none';
    var relOtherLabel = document.createElement('label');
    relOtherLabel.setAttribute('for', 'wcv-rel-other-' + n);
    relOtherLabel.textContent = 'অন্য সম্পর্কের বিবরণ (Specify Other Relationship)';
    var relOtherInput = document.createElement('input');
    relOtherInput.type = 'text';
    relOtherInput.id = 'wcv-rel-other-' + n;
    relOtherInput.name = 'wcv_accused_relationship_other';
    relOtherInput.className = 'wcv-rel-other';
    relOtherInput.maxLength = 200;
    relOtherInput.setAttribute('data-ph-bn', 'সম্পর্ক বিস্তারিত লিখুন...');
    relOtherInput.setAttribute('data-ph-en', 'e.g. Neighbour\'s son, shop owner');
    relOtherInput.placeholder = 'সম্পর্ক বিস্তারিত লিখুন... (e.g. প্রতিবেশীর ছেলে, দোকান মালিক)';
    relOtherRow.appendChild(relOtherLabel);
    relOtherRow.appendChild(relOtherInput);
    grpRelationship.appendChild(relOtherRow);

    /* --- Count --- */
    var countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.id = 'wcv-accused-count-' + n;
    countInput.name = 'wcv_accused_count';
    countInput.className = 'wcv-accused-count';
    countInput.min = '1';
    countInput.max = '999';
    countInput.style.maxWidth = '150px';
    countInput.setAttribute('data-ph-bn', 'সংখ্যা লিখুন...');
    countInput.setAttribute('data-ph-en', 'Enter number...');
    countInput.placeholder = 'সংখ্যা লিখুন...';
    grpRelationship.appendChild(makeFormField('অভিযুক্ত পক্ষের সংখ্যা (Number of Perpetrators)', countInput));

    /* --- Position select --- */
    var posSelect = document.createElement('select');
    posSelect.id = 'wcv-pos-select-' + n;
    posSelect.name = 'wcv_accused_position';
    posSelect.className = 'wcv-pos-select';
    var posDefault = document.createElement('option');
    posDefault.value = '';
    posDefault.setAttribute('data-bn', '-- নির্বাচন করুন --');
    posDefault.setAttribute('data-en', '-- Select --');
    posDefault.textContent = '-- নির্বাচন করুন (Select) --';
    posSelect.appendChild(posDefault);
    populateSelect(posSelect, positions);
    grpRelationship.appendChild(makeFormField('অভিযুক্ত পক্ষের ক্ষমতার অবস্থান (Power Position)', posSelect));

    /* --- Position remarks --- */
    var posRemarks = document.createElement('textarea');
    posRemarks.id = 'wcv-pos-remarks-' + n;
    posRemarks.name = 'wcv_accused_pos_remarks';
    posRemarks.className = 'wcv-pos-remarks';
    posRemarks.rows = 3;
    posRemarks.setAttribute('data-ph-bn', 'ক্ষমতার অবস্থান সম্পর্কে বিস্তারিত লিখুন...');
    posRemarks.setAttribute('data-ph-en', "Describe the perpetrator's position, role, or influence...");
    posRemarks.placeholder = 'ক্ষমতার অবস্থান সম্পর্কে বিস্তারিত লিখুন... (Describe the perpetrator\'s position, role, or influence...)';
    grpRelationship.appendChild(makeFormField('ক্ষমতার অবস্থান বিবরণ (Position Details)', posRemarks));

    /* --- Attribute checkboxes --- */
    var attrField = document.createElement('div');
    attrField.className = 'form-field';
    var attrLabel = document.createElement('span');
    attrLabel.className = 'form-field-label';
    attrLabel.textContent = 'অতিরিক্ত তথ্য (Additional Information)';
    var attrBox = document.createElement('div');
    attrBox.id = 'wcv-attr-checkboxes-' + n;
    attrBox.className = 'checkbox-group wcv-attr-checkboxes';
    populateCheckboxes(attrBox, attributes, n);
    attrField.appendChild(attrLabel);
    attrField.appendChild(attrBox);
    grpRelationship.appendChild(attrField);

    /* --- Previous history row (conditional) --- */
    var histRow = document.createElement('div');
    histRow.className = 'form-field wcv-prev-history-row';
    histRow.style.display = 'none';
    var histLabel = document.createElement('label');
    histLabel.setAttribute('for', 'wcv-prev-history-details-' + n);
    histLabel.textContent = 'পূর্ববর্তী নির্যাতনের বিবরণ (Previous Violence Details)';
    var histDetails = document.createElement('textarea');
    histDetails.id = 'wcv-prev-history-details-' + n;
    histDetails.name = 'wcv_accused_prev_history';
    histDetails.className = 'wcv-prev-history-details';
    histDetails.rows = 3;
    histDetails.setAttribute('data-ph-bn', 'আগের ঘটনার তারিখ, ধরন ও বিস্তারিত লিখুন...');
    histDetails.setAttribute('data-ph-en', 'Date, type and details of previous incident...');
    histDetails.placeholder = 'আগের ঘটনার তারিখ, ধরন ও বিস্তারিত লিখুন... (Date, type and details of previous incident...)';
    histRow.appendChild(histLabel);
    histRow.appendChild(histDetails);
    grpRelationship.appendChild(histRow);

    /* --- General remarks --- */
    var remarksInput = document.createElement('textarea');
    remarksInput.id = 'wcv-accused-remarks-' + n;
    remarksInput.name = 'wcv_accused_remarks';
    remarksInput.className = 'wcv-remarks';
    remarksInput.rows = 2;
    remarksInput.setAttribute('data-ph-bn', 'অভিযুক্ত পক্ষ সম্পর্কে অতিরিক্ত তথ্য...');
    remarksInput.setAttribute('data-ph-en', 'Additional information about the accused party...');
    remarksInput.placeholder = 'অভিযুক্ত পক্ষ সম্পর্কে অতিরিক্ত তথ্য...';
    grpRelationship.appendChild(makeFormField('মন্তব্য (Remarks)', remarksInput));

    card.appendChild(grpRelationship);

    /* ---- Wire events ---- */

    var prevHistoryCb = attrBox.querySelector('input[data-code="HAS_PREVIOUS_HISTORY_OF_VIOLENCE"]');

    function toggleHistory() {
      var show = prevHistoryCb && prevHistoryCb.checked;
      histRow.style.display = show ? '' : 'none';
      if (!show) histDetails.value = '';
    }

    if (prevHistoryCb) {
      prevHistoryCb.addEventListener('change', function () { toggleHistory(); serialize(); });
    }

    function toggleRelOther() {
      var isOther = otherRelId && String(relSelect.value) === otherRelId;
      relOtherRow.style.display = isOther ? '' : 'none';
      if (!isOther) relOtherInput.value = '';
    }

    /* Wire text/number inputs */
    var contactInput = identityGroup.inputs.contact;
    var dobInput = identityGroup.inputs.dob;
    var religionSelect = identityGroup.inputs.religionId;
    var districtSelect = identityGroup.inputs.districtId;

    [firstNameEnInput, lastNameEnInput, firstNameBnInput, lastNameBnInput,
     fatherFirstInput, fatherLastInput, ageInput, contactInput, institutionInput, countInput, posRemarks, histDetails, remarksInput, relOtherInput].forEach(function (inp) {
      inp.addEventListener('input', serialize);
    });

    /* Wire select/date change events */
    relSelect.addEventListener('change', function () { toggleRelOther(); serialize(); });
    posSelect.addEventListener('change', serialize);
    genderSelect.addEventListener('change', serialize);
    religionSelect.addEventListener('change', serialize);
    districtSelect.addEventListener('change', serialize);
    dobInput.addEventListener('change', serialize);
    occSelect.addEventListener('change', serialize);

    var attrCbs = attrBox.querySelectorAll('input[type="checkbox"]');
    for (var i = 0; i < attrCbs.length; i++) {
      if (attrCbs[i] !== prevHistoryCb) {
        attrCbs[i].addEventListener('change', serialize);
      }
    }

    removeBtn.addEventListener('click', function () {
      card.remove();
      updateCardNumbers();
      updateRemoveButtons();
      serialize();
    });

    toggleHistory();
    return card;
  }

  /* ========== Card management ========== */

  function updateCardNumbers() {
    var cards = container.querySelectorAll('.wcv-accused-card');
    for (var i = 0; i < cards.length; i++) {
      var numSpan = cards[i].querySelector('.wcv-card-number');
      if (numSpan) {
        numSpan.textContent = 'অভিযুক্ত পক্ষ ' + (i + 1) + ' (Accused Party ' + (i + 1) + ')';
      }
    }
  }

  function updateRemoveButtons() {
    var cards = container.querySelectorAll('.wcv-accused-card');
    var showRemove = cards.length > 1;
    for (var i = 0; i < cards.length; i++) {
      var btn = cards[i].querySelector('.btn-wcv-remove');
      if (btn) btn.style.display = showRemove ? '' : 'none';
    }
  }

  function addCard() {
    var card = createCard();
    container.appendChild(card);
    updateCardNumbers();
    updateRemoveButtons();
    serialize();
    /* Init Flatpickr on any date inputs in the new card */
    if (window.newshubDatePicker) window.newshubDatePicker.init();
  }

  /* ========== Serialize ========== */

  function serialize() {
    var cards = container.querySelectorAll('.wcv-accused-card');
    var list = [];
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var firstEnEl = card.querySelector('.wcv-accused-firstname-en');
      var lastEnEl = card.querySelector('.wcv-accused-lastname-en');
      var firstBnEl = card.querySelector('.wcv-accused-firstname-bn');
      var lastBnEl = card.querySelector('.wcv-accused-lastname-bn');
      var fatherFirstEl = card.querySelector('.wcv-accused-father-firstname');
      var fatherLastEl = card.querySelector('.wcv-accused-father-lastname');
      var aliasEl = card.querySelector('.wcv-accused-alias');
      var ageEl = card.querySelector('.wcv-accused-age');
      var genderEl = card.querySelector('.wcv-accused-gender');
      var religionEl = card.querySelector('.wcv-accused-religion');
      var dobEl = card.querySelector('.wcv-accused-dob');
      var districtEl = card.querySelector('.wcv-accused-district');
      var contactEl = card.querySelector('.wcv-accused-contact');
      var occEl = card.querySelector('.wcv-accused-occupation');
      var instEl = card.querySelector('.wcv-accused-institution');
      var relEl = card.querySelector('.wcv-rel-select');
      var relOtherEl = card.querySelector('.wcv-rel-other');
      var countEl = card.querySelector('.wcv-accused-count');
      var posEl = card.querySelector('.wcv-pos-select');
      var posRemarksEl = card.querySelector('.wcv-pos-remarks');
      var remarksEl = card.querySelector('.wcv-remarks');
      var attrCbs = card.querySelectorAll('.wcv-attr-cb');
      var histCb = card.querySelector('input[data-code="HAS_PREVIOUS_HISTORY_OF_VIOLENCE"]');
      var histDetailsEl = card.querySelector('.wcv-prev-history-details');

      var attrIds = [];
      for (var j = 0; j < attrCbs.length; j++) {
        if (attrCbs[j].checked) attrIds.push(parseInt(attrCbs[j].value, 10));
      }

      var hasPrevHistory = histCb ? histCb.checked : false;
      list.push({
        firstNameEn: firstEnEl ? firstEnEl.value.trim() : '',
        lastNameEn: lastEnEl ? lastEnEl.value.trim() : '',
        firstNameBn: firstBnEl ? firstBnEl.value.trim() : '',
        lastNameBn: lastBnEl ? lastBnEl.value.trim() : '',
        fatherFirstName: fatherFirstEl ? fatherFirstEl.value.trim() : '',
        fatherLastName: fatherLastEl ? fatherLastEl.value.trim() : '',
        alias: aliasEl ? aliasEl.value.trim() : '',
        age: ageEl ? (parseInt(ageEl.value, 10) || 0) : 0,
        genderId: genderEl ? (parseInt(genderEl.value, 10) || 0) : 0,
        gender: genderEl && genderEl.value ? genderEl.options[genderEl.selectedIndex].textContent.trim() : '',
        religionId: religionEl ? (parseInt(religionEl.value, 10) || 0) : 0,
        dob: dobEl ? dobEl.value : '',
        districtId: districtEl ? (parseInt(districtEl.value, 10) || 0) : 0,
        contact: contactEl ? contactEl.value.trim() : '',
        occupationId: occEl ? (parseInt(occEl.value, 10) || 0) : 0,
        occupation: occEl && occEl.value ? occEl.options[occEl.selectedIndex].textContent.trim() : '',
        institution: instEl ? instEl.value.trim() : '',
        relationshipId: relEl ? (parseInt(relEl.value, 10) || 0) : 0,
        relationshipOther: relOtherEl ? relOtherEl.value.trim() : '',
        accusedCount: countEl ? (parseInt(countEl.value, 10) || 0) : 0,
        positionId: posEl ? (parseInt(posEl.value, 10) || 0) : 0,
        positionRemarks: posRemarksEl ? posRemarksEl.value.trim() : '',
        attributeIds: attrIds,
        previousHistoryDetails: hasPrevHistory && histDetailsEl ? histDetailsEl.value.trim() : '',
        remarks: remarksEl ? remarksEl.value.trim() : ''
      });
    }
    hiddenJson.value = JSON.stringify(list);
  }

  /* ========== Init ========== */

  if (addBtn) {
    addBtn.addEventListener('click', addCard);
  }

  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  addCard();  /* start with one empty card */

  /* ========== Public API ========== */

  window.newshubWcvAccused = {
    reset: function () {
      container.innerHTML = '';
      cardCounter = 0;
      hiddenJson.value = '';
      addCard();
    }
  };

  /* Step validator: require at least one perpetrator name */
  var panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    var step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      var warnings = [];
      var cards = container.querySelectorAll('.wcv-accused-card');
      var hasName = false;
      for (var i = 0; i < cards.length; i++) {
        var firstEnEl = cards[i].querySelector('.wcv-accused-firstname-en');
        if (firstEnEl && firstEnEl.value.trim()) { hasName = true; break; }
      }
      if (!hasName) {
        warnings.push('অন্তত একজন অভিযুক্ত পক্ষের প্রথম নাম (ইংরেজি) দিন (Enter at least one accused party first name in English)');
      }
      return { warnings: warnings };
    }});
  }
})();

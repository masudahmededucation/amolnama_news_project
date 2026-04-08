/**
 * news-form-clear.js
 * "Clear Form" button — resets all form fields, cascade selects,
 * selected tags, file attachments, auto-location state, and localStorage draft.
 *
 * DOM dependency:
 *   #news-clear-form-button — the clear button
 *   .news-collection-form — the form element
 *
 * Requires (loaded before this script):
 *   news-category-tag-cascade.js  → window.newshubTags.clearAll()
 *   news-auto-location.js         → window.newshubAutoLocation.reset()
 *   news-attachment-upload.js      → window.newshubAttachments.reset()
 */
(function () {
  const button = document.getElementById('news-clear-form-button');
  const form = document.querySelector('.news-collection-form, .news-multistep-form');
  if (!button || !form) return;

  /* Inline confirmation message element */
  const messageElement = document.createElement('span');
  messageElement.className = 'news-clear-form-message';
  messageElement.hidden = true;
  button.parentNode.insertBefore(messageElement, button);

  let confirmTimer = null;
  let awaitingConfirm = false;

  button.addEventListener('click', function () {
    /* First click — show inline confirmation, wait for second click */
    if (!awaitingConfirm) {
      awaitingConfirm = true;
      button.textContent = '\u09B9\u09CD\u09AF\u09BE\u0981, \u09AE\u09C1\u099B\u09C1\u09A8 (Yes, Clear)';
      button.classList.add('news-clear-form-button-confirm');
      messageElement.textContent = '\u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4? (Sure?)';
      messageElement.hidden = false;
      /* Auto-revert after 4 seconds if no second click */
      confirmTimer = setTimeout(function () {
        awaitingConfirm = false;
        button.textContent = '\u09A4\u09A5\u09CD\u09AF \u09AE\u09C1\u099B\u09C1\u09A8 (Clear Form)';
        button.classList.remove('news-clear-form-button-confirm');
        messageElement.hidden = true;
      }, 4000);
      return;
    }

    /* Second click — confirmed, proceed with clearing */
    awaitingConfirm = false;
    clearTimeout(confirmTimer);
    button.textContent = '\u09A4\u09A5\u09CD\u09AF \u09AE\u09C1\u099B\u09C1\u09A8 (Clear Form)';
    button.classList.remove('news-clear-form-button-confirm');
    messageElement.textContent = '\u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 (Cleared!)';
    messageElement.hidden = false;
    setTimeout(function () { messageElement.hidden = true; }, 3000);

    /* 1. Clear all form controls via form.elements (works even with display:contents) */
    const elements = form.elements;
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const type = element.type;
      if (element.name === 'csrfmiddlewaretoken') continue;
      if (type === 'submit' || type === 'button') continue;

      if (type === 'radio' || type === 'checkbox') {
        element.checked = false;
      } else if (type === 'file') {
        /* skip — handled by newshubAttachments.reset() */
      } else if (type === 'select-one' || type === 'select-multiple') {
        element.selectedIndex = 0;
      } else {
        /* text, email, tel, url, number, textarea, hidden */
        element.value = '';
      }
    }

    /* 5. Reset occurrence time custom selects (not inside form.elements) */
    ['occ-date', 'occ-hour', 'occ-minute'].forEach(function (fieldId) {
      let field = document.getElementById(fieldId);
      if (field) field.value = '';
    });
    const occPeriod = document.getElementById('occ-period');
    if (occPeriod) occPeriod.selectedIndex = 0;

    /* 6. Reset location cascade selects to placeholder-only state */
    const constituencySelect = document.getElementById('news-constituency-id');
    const upazilaSelect = document.getElementById('news-upazila-id');
    const unionSelect = document.getElementById('news-union-parishad-id');
    const wardSelect = document.getElementById('news-ward-id');
    const villageSelect = document.getElementById('news-village-id');
    const villageOtherInput = document.getElementById('news-village-other');
    const villageRow = document.getElementById('news-village-row');
    if (constituencySelect) constituencySelect.value = '';
    if (upazilaSelect) upazilaSelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u099C\u09C7\u09B2\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
    if (unionSelect) unionSelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u0989\u09AA\u099C\u09C7\u09B2\u09BE/\u09A5\u09BE\u09A8\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
    if (wardSelect) wardSelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u09B8\u09CD\u09A5\u09BE\u09A8\u09C0\u09AF\u09BC \u09B8\u09B0\u0995\u09BE\u09B0 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
    if (villageSelect) villageSelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
    if (villageOtherInput) { villageOtherInput.hidden = true; villageOtherInput.value = ''; }
    if (villageRow) villageRow.hidden = true;
    /* Clear type tracking hidden inputs */
    ['news-subdistrict-type', 'news-local-body-type', 'news-ward-type'].forEach(function (fieldId) {
      const field = document.getElementById(fieldId);
      if (field) field.value = '';
    });

    /* 8. Reset organisation cascade */
    const organizationSelect = document.getElementById('contributor-organization');
    if (organizationSelect) organizationSelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A4\u09BF\u09B7\u09CD\u09A0\u09BE\u09A8\u09C7\u09B0 \u09A8\u09BE\u09AE (\u0990\u099A\u09CD\u099B\u09BF\u0995) --</option>';

    /* 8b. Reset Tom Select instances (district, category, location search) */
    ['news-district-id', 'news-category-id'].forEach(function (selectId) {
      const selectElement = document.getElementById(selectId);
      if (selectElement && selectElement.tomselect) selectElement.tomselect.clear(true);
    });

    /* 8c. Reset unified location search */
    if (window.newshubLocationSearch && window.newshubLocationSearch.clear) {
      window.newshubLocationSearch.clear();
    }

    /* 9. Clear tags via exposed API */
    if (window.newshubTags && window.newshubTags.clearAll) {
      window.newshubTags.clearAll();
    }

    /* 10. Reset auto-location state */
    if (window.newshubAutoLocation && window.newshubAutoLocation.reset) {
      window.newshubAutoLocation.reset();
    }

    /* 10b. Reset map pinpoint and search */
    if (window.newshubMapPinpoint && window.newshubMapPinpoint.resetMapToDefault) {
      window.newshubMapPinpoint.resetMapToDefault();
    }
    if (window.newshubMapSearch && window.newshubMapSearch.clearSearchInput) {
      window.newshubMapSearch.clearSearchInput();
    }

    /* 11. Clear file attachments via exposed API */
    if (window.newshubAttachments && window.newshubAttachments.reset) {
      window.newshubAttachments.reset();
    }

    /* 11b. Clear involved parties repeater (legacy combined form) */
    if (window.newshubInvolvedParties && window.newshubInvolvedParties.reset) {
      window.newshubInvolvedParties.reset();
    }

    /* 11b2. Clear split accused / victim / witness repeaters */
    if (window.newshubAccused && window.newshubAccused.reset) {
      window.newshubAccused.reset();
    }
    if (window.newshubVictim && window.newshubVictim.reset) {
      window.newshubVictim.reset();
    }
    if (window.newshubWitness && window.newshubWitness.reset) {
      window.newshubWitness.reset();
    }

    /* 11c. Clear crime casualties & weapons */
    if (window.newshubCrimeCasualties && window.newshubCrimeCasualties.reset) {
      window.newshubCrimeCasualties.reset();
    }
    if (window.newshubCrimeWeapons && window.newshubCrimeWeapons.reset) {
      window.newshubCrimeWeapons.reset();
    }

    /* 11cc. Clear extortion incident fields */
    if (window.newshubExtortionIncident && window.newshubExtortionIncident.reset) {
      window.newshubExtortionIncident.reset();
    }

    /* 11cd. Clear land grabbing incident fields */
    if (window.newshubLandGrabIncident && window.newshubLandGrabIncident.reset) {
      window.newshubLandGrabIncident.reset();
    }

    /* 11d. Clear price hike fields (price gap repeater, stockpiling) */
    if (window.newshubPriceGap && window.newshubPriceGap.reset) {
      window.newshubPriceGap.reset();
    }
    if (window.newshubStockpiling && window.newshubStockpiling.reset) {
      window.newshubStockpiling.reset();
    }

    /* 11e. Clear watchdog_bangladesh fields (contradiction, context) */
    if (window.newshubPoliticalContradiction && window.newshubPoliticalContradiction.reset) {
      window.newshubPoliticalContradiction.reset();
    }
    if (window.newshubPoliticalContext && window.newshubPoliticalContext.reset) {
      window.newshubPoliticalContext.reset();
    }
    /* Clear watchdog type-specific field sections */
    if (window.newshubWatchdogIssue && window.newshubWatchdogIssue.reset) {
      window.newshubWatchdogIssue.reset();
    }
    if (window.newshubWatchdogPartyChange && window.newshubWatchdogPartyChange.reset) {
      window.newshubWatchdogPartyChange.reset();
    }
    if (window.newshubWatchdogProxyPuppet && window.newshubWatchdogProxyPuppet.reset) {
      window.newshubWatchdogProxyPuppet.reset();
    }
    if (window.newshubWatchdogBootlicker && window.newshubWatchdogBootlicker.reset) {
      window.newshubWatchdogBootlicker.reset();
    }
    if (window.newshubWatchdogWomenFixer && window.newshubWatchdogWomenFixer.reset) {
      window.newshubWatchdogWomenFixer.reset();
    }
    /* Reset section switcher (hides all watchdog field sections) */
    if (window.newshubWatchdogSectionSwitcher && window.newshubWatchdogSectionSwitcher.reset) {
      window.newshubWatchdogSectionSwitcher.reset();
    }
    /* Clear political sub-type radios */
    const politicalRadios = document.querySelectorAll('input[name="political_sub_type_radio"]');
    for (let p = 0; p < politicalRadios.length; p++) { politicalRadios[p].checked = false; }
    const politicalHidden = document.getElementById('political-sub-type');
    if (politicalHidden) politicalHidden.value = '';

    /* 11f. Clear civic & community fields (impact, status) */
    if (window.newshubCivicImpact && window.newshubCivicImpact.reset) {
      window.newshubCivicImpact.reset();
    }
    if (window.newshubCivicStatus && window.newshubCivicStatus.reset) {
      window.newshubCivicStatus.reset();
    }
    /* Clear civic sub-type radios */
    const civicRadios = document.querySelectorAll('input[name="civic_sub_type_radio"]');
    for (let c = 0; c < civicRadios.length; c++) { civicRadios[c].checked = false; }
    const civicHidden = document.getElementById('civic-sub-type');
    if (civicHidden) civicHidden.value = '';

    /* 11g. Clear global news / war & conflict fields (sub-type, parties, frontline, humanitarian, geopolitics) */
    if (window.newshubGlobalSubType && window.newshubGlobalSubType.reset) {
      window.newshubGlobalSubType.reset();
    }
    if (window.newshubGlobalConflictParties && window.newshubGlobalConflictParties.reset) {
      window.newshubGlobalConflictParties.reset();
    }
    if (window.newshubGlobalFrontline && window.newshubGlobalFrontline.reset) {
      window.newshubGlobalFrontline.reset();
    }
    if (window.newshubGlobalHumanitarian && window.newshubGlobalHumanitarian.reset) {
      window.newshubGlobalHumanitarian.reset();
    }
    if (window.newshubGlobalGeopolitics && window.newshubGlobalGeopolitics.reset) {
      window.newshubGlobalGeopolitics.reset();
    }
    /* Clear strategic impact checkboxes */
    const strategicCheckboxes = document.querySelectorAll('input[name="strategic_impact"]');
    for (let s = 0; s < strategicCheckboxes.length; s++) { strategicCheckboxes[s].checked = false; }

    /* 11g2. Clear general global news fields (sub-type, countries, classification, bangladesh, reaction) */
    if (window.newshubGlobalNewsSubType && window.newshubGlobalNewsSubType.reset) {
      window.newshubGlobalNewsSubType.reset();
    }
    if (window.newshubGlobalNewsCountries && window.newshubGlobalNewsCountries.reset) {
      window.newshubGlobalNewsCountries.reset();
    }
    if (window.newshubGlobalNewsClassification && window.newshubGlobalNewsClassification.reset) {
      window.newshubGlobalNewsClassification.reset();
    }
    if (window.newshubGlobalNewsBangladesh && window.newshubGlobalNewsBangladesh.reset) {
      window.newshubGlobalNewsBangladesh.reset();
    }
    if (window.newshubGlobalNewsReaction && window.newshubGlobalNewsReaction.reset) {
      window.newshubGlobalNewsReaction.reset();
    }

    /* 11h. Clear sports fields (sub-type, match-event, teams-result, key-performances) */
    if (window.newshubSportsSubType && window.newshubSportsSubType.reset) {
      window.newshubSportsSubType.reset();
    }
    if (window.newshubSportsMatchEvent && window.newshubSportsMatchEvent.reset) {
      window.newshubSportsMatchEvent.reset();
    }
    if (window.newshubSportsTeamsResult && window.newshubSportsTeamsResult.reset) {
      window.newshubSportsTeamsResult.reset();
    }
    if (window.newshubSportsKeyPerformances && window.newshubSportsKeyPerformances.reset) {
      window.newshubSportsKeyPerformances.reset();
    }

    /* 11i. Clear entertainment fields (sub-type, production, cast-release, performance) */
    if (window.newshubEntertainmentSubType && window.newshubEntertainmentSubType.reset) {
      window.newshubEntertainmentSubType.reset();
    }
    if (window.newshubEntertainmentProduction && window.newshubEntertainmentProduction.reset) {
      window.newshubEntertainmentProduction.reset();
    }
    if (window.newshubEntertainmentCastRelease && window.newshubEntertainmentCastRelease.reset) {
      window.newshubEntertainmentCastRelease.reset();
    }
    if (window.newshubEntertainmentPerformance && window.newshubEntertainmentPerformance.reset) {
      window.newshubEntertainmentPerformance.reset();
    }

    /* 11i2. Clear crime / extortion / land grab legal fields */
    if (window.newshubCrimeLegal && window.newshubCrimeLegal.reset) {
      window.newshubCrimeLegal.reset();
    }
    if (window.newshubExtortionLegal && window.newshubExtortionLegal.reset) {
      window.newshubExtortionLegal.reset();
    }
    if (window.newshubLandGrabLegal && window.newshubLandGrabLegal.reset) {
      window.newshubLandGrabLegal.reset();
    }

    /* 11j. Clear women & child violence fields (type, victim, accused, injury, legal) */
    if (window.newshubWcvType && window.newshubWcvType.reset) {
      window.newshubWcvType.reset();
    }
    if (window.newshubWcvVictim && window.newshubWcvVictim.reset) {
      window.newshubWcvVictim.reset();
    }
    if (window.newshubWcvConditionInjury && window.newshubWcvConditionInjury.reset) {
      window.newshubWcvConditionInjury.reset();
    }
    if (window.newshubWcvAccused && window.newshubWcvAccused.reset) {
      window.newshubWcvAccused.reset();
    }
    if (window.newshubWcvLegal && window.newshubWcvLegal.reset) {
      window.newshubWcvLegal.reset();
    }

    /* 11k. Clear july uprising fields (sub-type, context, martyr, story, cause, oppressors, evidence) */
    if (window.newshubJulySubType && window.newshubJulySubType.reset) {
      window.newshubJulySubType.reset();
    }
    if (window.newshubJulyContext && window.newshubJulyContext.reset) {
      window.newshubJulyContext.reset();
    }
    if (window.newshubJulyMartyr && window.newshubJulyMartyr.reset) {
      window.newshubJulyMartyr.reset();
    }
    if (window.newshubJulyStory && window.newshubJulyStory.reset) {
      window.newshubJulyStory.reset();
    }
    if (window.newshubJulyCause && window.newshubJulyCause.reset) {
      window.newshubJulyCause.reset();
    }
    if (window.newshubJulyOppressors && window.newshubJulyOppressors.reset) {
      window.newshubJulyOppressors.reset();
    }
    if (window.newshubJulyEvidence && window.newshubJulyEvidence.reset) {
      window.newshubJulyEvidence.reset();
    }
    /* Clear july uprising sub-type radios */
    const julyRadios = document.querySelectorAll('input[name="july_sub_type_radio"]');
    for (let jr = 0; jr < julyRadios.length; jr++) { julyRadios[jr].checked = false; }
    const julyHidden = document.getElementById('july-sub-type');
    if (julyHidden) julyHidden.value = '';

    /* 12. Clear localStorage drafts (per-form-type).
       Field resets above trigger change events → debouncedSave (400ms).
       Clear now AND again after 500ms to kill any pending save. */
    const formTypeInput = document.getElementById('news-form-type');
    const formTypeCode = formTypeInput ? formTypeInput.value : '';
    const draftKey = formTypeCode ? ('newshub_draft_' + formTypeCode) : 'newshub_draft';
    const draftTagsKey = formTypeCode ? ('newshub_draft_tags_' + formTypeCode) : 'newshub_draft_tags';
    localStorage.removeItem(draftKey);
    localStorage.removeItem(draftTagsKey);
    setTimeout(function () {
      localStorage.removeItem(draftKey);
      localStorage.removeItem(draftTagsKey);
    }, 500);

    /* 13. Clear any validation warnings */
    const warnings = form.querySelectorAll('.field-warning');
    for (let m = 0; m < warnings.length; m++) {
      warnings[m].hidden = true;
    }
    const shakes = form.querySelectorAll('.field-shake');
    for (let n = 0; n < shakes.length; n++) {
      shakes[n].classList.remove('field-shake');
    }

    /* 14. Clear social source repeater */
    if (window.newshubSocialSource && window.newshubSocialSource.reset) {
      window.newshubSocialSource.reset();
    }
  });

  /* SPA cleanup */
  if (window.spaCleanupRegister) {
    window.spaCleanupRegister(function () {
      awaitingConfirm = false;
    });
  }
})();

/**
 * news-sports-key-performances.js
 * Serializes the Key Performances & Records form (Step 6 of the Sports form)
 * into a hidden JSON input #sports-key-performances-json.
 *
 * DB table: [investigation].[sports_form_fact]
 * Saved keys: performer1Name/Detail, performer2Name/Detail, performer3Name/Detail,
 *             records, standing
 *
 * NOTE: Transfer and Injury conditional fields have no DB columns — NOT serialized.
 *       The template sections are kept for future use but excluded from JSON.
 *
 * DOM dependencies:
 *   #sports-key-performances-json  — hidden input (JSON payload)
 *   #sports-performer-1-name       — text
 *   #sports-performer-1-detail     — text
 *   #sports-performer-2-name       — text
 *   #sports-performer-2-detail     — text
 *   #sports-performer-3-name       — text
 *   #sports-performer-3-detail     — text
 *   #sports-records-milestones     — textarea
 *   #sports-tournament-standing    — text
 */
(function () {
  'use strict';

  const hiddenInput = document.getElementById('sports-key-performances-json');
  if (!hiddenInput) return;

  const p1NameEl    = document.getElementById('sports-performer-1-name');
  const p1DetEl     = document.getElementById('sports-performer-1-detail');
  const p2NameEl    = document.getElementById('sports-performer-2-name');
  const p2DetEl     = document.getElementById('sports-performer-2-detail');
  const p3NameEl    = document.getElementById('sports-performer-3-name');
  const p3DetEl     = document.getElementById('sports-performer-3-detail');
  const recordsEl   = document.getElementById('sports-records-milestones');
  const standingEl  = document.getElementById('sports-tournament-standing');

  function v(element) { return element && element.value.trim() || ''; }

  function collectData() {
    return {
      performer1Name:   v(p1NameEl),
      performer1Detail: v(p1DetEl),
      performer2Name:   v(p2NameEl),
      performer2Detail: v(p2DetEl),
      performer3Name:   v(p3NameEl),
      performer3Detail: v(p3DetEl),
      records:          v(recordsEl),
      standing:         v(standingEl)
    };
  }

  function hasAnyData(d) {
    return d.performer1Name || d.performer2Name || d.performer3Name
      || d.records || d.standing;
  }

  function syncToHiddenInput() {
    let data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  const section = document.getElementById('section-sports-key-performances');
  if (section) {
    section.addEventListener('input',  syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  const form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    let data;
    try { data = JSON.parse(hiddenInput.value); } catch (e) { return; }

    if (p1NameEl && data.performer1Name)     p1NameEl.value   = data.performer1Name;
    if (p1DetEl && data.performer1Detail)     p1DetEl.value    = data.performer1Detail;
    if (p2NameEl && data.performer2Name)     p2NameEl.value   = data.performer2Name;
    if (p2DetEl && data.performer2Detail)     p2DetEl.value    = data.performer2Detail;
    if (p3NameEl && data.performer3Name)     p3NameEl.value   = data.performer3Name;
    if (p3DetEl && data.performer3Detail)     p3DetEl.value    = data.performer3Detail;
    if (recordsEl && data.records)            recordsEl.value  = data.records;
    if (standingEl && data.standing)          standingEl.value = data.standing;
  }
  setTimeout(restoreFromSavedData, 100);

  /* ---- Public API for form-clear.js ---- */
  window.newshubSportsKeyPerformances = {
    reset: function () {
      [p1NameEl, p1DetEl, p2NameEl, p2DetEl, p3NameEl, p3DetEl,
       recordsEl, standingEl
      ].forEach(function (element) { if (element) element.value = ''; });
      hiddenInput.value = '';
    }
  };
})();

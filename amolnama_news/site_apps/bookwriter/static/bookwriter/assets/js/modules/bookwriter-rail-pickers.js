/* ============================================================
   bookwriter — chapter-rail status pickers + book-metadata
   field autosave (standalone, event-delegated)
   ============================================================ */
(function () {
  'use strict';

  /* ========================================================
     CHAPTER STATUS + VISIBILITY PICKERS (per rail row)
     ======================================================== */
  var chaptersContainerForStatusPickers = document.getElementById('chapters');
  if (chaptersContainerForStatusPickers) {
    chaptersContainerForStatusPickers.addEventListener('change', function (changeEvent) {
      var changedSelect = changeEvent.target;
      if (!changedSelect || !changedSelect.matches('.bookwriter-chapter-status-select, .bookwriter-chapter-visibility-select')) return;
      var targetChapterId = changedSelect.dataset.targetChapterId;
      var targetField = changedSelect.dataset.targetField;
      if (!targetChapterId || !targetField) return;
      var payload = {};
      payload[targetField] = changedSelect.value;
      window.bookwriter.apiPost('/bookwriter/api/chapter/' + encodeURIComponent(targetChapterId) + '/status/', payload)
        .then(function () {
          var row = changedSelect.closest('.bookwriter-chapter');
          if (row) row.dataset[targetField === 'chapter_status_code' ? 'chapterStatusCode' : 'chapterVisibilityCode'] = changedSelect.value;
        })
        .catch(function () {
          // Revert select to the previous server-known value.
          var row = changedSelect.closest('.bookwriter-chapter');
          if (row) {
            var previousValue = (targetField === 'chapter_status_code')
              ? row.dataset.chapterStatusCode
              : row.dataset.chapterVisibilityCode;
            if (previousValue) changedSelect.value = previousValue;
          }
        });
    });
  }


  /* ========================================================
     BOOK METADATA FIELDS (status / targets / synopsis)
     ======================================================== */
  var BOOK_METADATA_AUTOSAVE_DEBOUNCE_MS = 600;
  var bookMetadataAutosaveTimers = {};

  function persistBookMetadataField(targetBookId, fieldName, fieldValue, debounceMs) {
    if (!targetBookId || !fieldName) return;
    var timerKey = targetBookId + ':' + fieldName;
    if (bookMetadataAutosaveTimers[timerKey]) clearTimeout(bookMetadataAutosaveTimers[timerKey]);
    bookMetadataAutosaveTimers[timerKey] = setTimeout(function () {
      var payload = {};
      payload[fieldName] = fieldValue;
      window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(targetBookId) + '/title/', payload)
        .catch(function () { /* keystroke retry; field value preserved */ });
    }, debounceMs);
  }

  var bookMetadataFieldsContainer = document.querySelector('.bookwriter-book-metadata-fields');
  if (bookMetadataFieldsContainer) {
    bookMetadataFieldsContainer.addEventListener('input', function (inputEvent) {
      var changedField = inputEvent.target;
      if (!changedField || !changedField.matches('.bookwriter-book-metadata-input, .bookwriter-book-metadata-textarea')) return;
      var fieldName = changedField.dataset.targetField;
      var rawValue = changedField.value;
      var fieldValue = rawValue;
      if (changedField.type === 'number') {
        fieldValue = (rawValue === '' || rawValue == null) ? null : parseInt(rawValue, 10);
        if (fieldValue !== null && Number.isNaN(fieldValue)) return;
      }
      persistBookMetadataField(changedField.dataset.targetBookId, fieldName, fieldValue, BOOK_METADATA_AUTOSAVE_DEBOUNCE_MS);
    });
    bookMetadataFieldsContainer.addEventListener('change', function (changeEvent) {
      var changedSelect = changeEvent.target;
      if (!changedSelect || !changedSelect.matches('.bookwriter-book-metadata-select')) return;
      persistBookMetadataField(changedSelect.dataset.targetBookId, changedSelect.dataset.targetField, changedSelect.value, 0);
    });
  }
})();

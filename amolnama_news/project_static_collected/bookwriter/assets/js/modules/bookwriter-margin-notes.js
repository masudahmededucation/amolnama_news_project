/* ============================================================
   bookwriter — margin notes module (standalone)
   --------------------------------------------------------
   Toggle the right-rail panel via the toolbar's "✎ notes"
   button. First open per chapter loads from
   /api/chapter/<id>/margin-notes/. Add posts to
   /margin-note/create/, resolve PATCHes
   /margin-note/<id>/save/, delete DELETEs.
   Notes are scoped to the currently-active chapter — if the
   user switches chapters, the next open clears + reloads.
   ============================================================ */
(function () {
  'use strict';

  var loadedMarginNotesForChapterId = null;

  function activeMarginNoteChapterId() {
    var editorElement = document.querySelector('.bookwriter-manuscript .bookwriter-prose[data-chapter-id]')
      || document.querySelector('[data-chapter-id]');
    return editorElement ? editorElement.dataset.chapterId : null;
  }

  function renderMarginNoteRow(noteRecord) {
    var rowElement = document.createElement('div');
    rowElement.className = 'bookwriter-margin-note-row' + (noteRecord.is_resolved ? ' bookwriter-is-resolved' : '');
    rowElement.dataset.marginNoteId = String(noteRecord.id);

    var bodyElement = document.createElement('div');
    bodyElement.className = 'bookwriter-margin-note-row-body';
    bodyElement.textContent = noteRecord.note_text || '';

    var metaElement = document.createElement('div');
    metaElement.className = 'bookwriter-margin-note-row-meta';

    var resolveButton = document.createElement('button');
    resolveButton.type = 'button';
    resolveButton.id = 'bookwriter-margin-note-' + noteRecord.id + '-resolve-button';
    resolveButton.name = 'bookwriter_margin_note_' + noteRecord.id + '_resolve_button';
    resolveButton.textContent = noteRecord.is_resolved ? '↺ unresolve' : '✓ resolve';
    resolveButton.addEventListener('click', function () {
      var nextResolved = !rowElement.classList.contains('bookwriter-is-resolved');
      window.bookwriter.apiPost('/bookwriter/api/margin-note/' + encodeURIComponent(noteRecord.id) + '/save/', { is_resolved: nextResolved })
        .then(function () {
          rowElement.classList.toggle('bookwriter-is-resolved', nextResolved);
          resolveButton.textContent = nextResolved ? '↺ unresolve' : '✓ resolve';
        })
        .catch(function () { /* leave UI as-is */ });
    });

    var deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.id = 'bookwriter-margin-note-' + noteRecord.id + '-delete-button';
    deleteButton.name = 'bookwriter_margin_note_' + noteRecord.id + '_delete_button';
    deleteButton.textContent = '× delete';
    window.bookwriter.wireTwoClickConfirmDelete(deleteButton, {
      initialLabel: '× delete',
      confirmingLabel: '× confirm',
      onConfirm: function () {
        window.bookwriter.apiDelete('/bookwriter/api/margin-note/' + encodeURIComponent(noteRecord.id) + '/delete/')
          .then(function () { rowElement.parentNode.removeChild(rowElement); refreshMarginNotesEmptyState(); })
          .catch(function () { /* leave row */ });
      },
    });

    metaElement.appendChild(resolveButton);
    metaElement.appendChild(deleteButton);
    rowElement.appendChild(bodyElement);
    rowElement.appendChild(metaElement);
    return rowElement;
  }

  function refreshMarginNotesEmptyState() {
    var listElement = document.getElementById('bookwriter-margin-notes-list');
    if (!listElement) return;
    var hasAnyRow = !!listElement.querySelector('.bookwriter-margin-note-row');
    var emptyMessage = listElement.querySelector('.bookwriter-margin-notes-empty');
    if (!hasAnyRow && !emptyMessage) {
      var newEmpty = document.createElement('div');
      newEmpty.className = 'bookwriter-margin-notes-empty';
      newEmpty.textContent = 'No margin notes for this chapter yet.';
      listElement.appendChild(newEmpty);
    } else if (hasAnyRow && emptyMessage) {
      emptyMessage.parentNode.removeChild(emptyMessage);
    }
  }

  function loadMarginNotesForActiveChapter() {
    var chapterId = activeMarginNoteChapterId();
    var listElement = document.getElementById('bookwriter-margin-notes-list');
    if (!listElement) return;
    if (!chapterId) {
      listElement.innerHTML = '<div class="bookwriter-margin-notes-empty">Open a chapter first.</div>';
      return;
    }
    if (loadedMarginNotesForChapterId === chapterId) return;
    listElement.innerHTML = '<div class="bookwriter-margin-notes-empty">Loading…</div>';
    window.bookwriter.apiGet('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/margin-notes/')
      .then(function (data) {
        listElement.innerHTML = '';
        var noteRecords = data.margin_notes || [];
        if (noteRecords.length === 0) {
          var emptyEl = document.createElement('div');
          emptyEl.className = 'bookwriter-margin-notes-empty';
          emptyEl.textContent = 'No margin notes for this chapter yet.';
          listElement.appendChild(emptyEl);
        } else {
          noteRecords.forEach(function (note) { listElement.appendChild(renderMarginNoteRow(note)); });
        }
        loadedMarginNotesForChapterId = chapterId;
      })
      .catch(function () {
        listElement.innerHTML = '<div class="bookwriter-margin-notes-empty">Couldn\u2019t load notes — try again.</div>';
      });
  }

  function toggleMarginNotes() {
    var wasOpen = document.body.classList.contains('bookwriter-margin-notes-open');
    document.body.classList.toggle('bookwriter-margin-notes-open');
    if (!wasOpen) loadMarginNotesForActiveChapter();
  }
  window.toggleMarginNotes = toggleMarginNotes;

  function submitMarginNote() {
    var chapterId = activeMarginNoteChapterId();
    var inputElement = document.getElementById('bookwriter-margin-notes-input');
    if (!chapterId || !inputElement) return;
    var noteText = (inputElement.value || '').trim();
    if (!noteText) return;
    window.bookwriter.apiPost('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/margin-note/create/', { note_text: noteText })
      .then(function (data) {
        var listElement = document.getElementById('bookwriter-margin-notes-list');
        if (!listElement) return;
        var emptyEl = listElement.querySelector('.bookwriter-margin-notes-empty');
        if (emptyEl) emptyEl.parentNode.removeChild(emptyEl);
        listElement.appendChild(renderMarginNoteRow(data.margin_note || {}));
        inputElement.value = '';
      })
      .catch(function () { /* leave input populated so user can retry */ });
  }
  window.submitMarginNote = submitMarginNote;

  // Invalidate cache when chapter rail click switches chapters.
  document.querySelectorAll('#chapters .bookwriter-chapter[data-chapter-id]').forEach(function (chapterRow) {
    chapterRow.addEventListener('click', function () {
      loadedMarginNotesForChapterId = null;
      if (document.body.classList.contains('bookwriter-margin-notes-open')) {
        setTimeout(loadMarginNotesForActiveChapter, 50);
      }
    });
  });
})();

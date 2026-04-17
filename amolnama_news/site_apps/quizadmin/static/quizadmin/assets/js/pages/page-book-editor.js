/* Quiz Panel — book editor controller.
 *
 * Chapter sidebar drives chapter switching. The active chapter loads via
 * GET /mastermind/api/book/<id>/chapter/<id>/get-text/ and saves via
 * POST  /mastermind/api/book/<id>/chapter/<id>/save-text/. Auto-save fires
 * 3 seconds after the last keystroke (debounced) AND on blur, so the
 * author never has to click Save explicitly — but the Save button is also
 * present for explicit-save users.
 *
 * Publish + Archive use the book-level endpoints. Add Chapter posts to
 * /mastermind/api/book/<id>/chapter-add/ and prepends a button to the
 * sidebar without a full reload.
 */
(function () {
  'use strict';

  var rootElement = document.getElementById('quizadmin-book-editor');
  if (!rootElement) return;

  var bookId = parseInt(rootElement.dataset.bookId, 10);
  var bookStatus = rootElement.dataset.bookStatus || 'draft';

  var sidebarListElement = document.getElementById('quizadmin-book-editor-chapter-list');
  var emptyPaneElement = document.getElementById('quizadmin-book-editor-empty');
  var formElement = document.getElementById('quizadmin-book-editor-form');
  var activeChapterIdInput = document.getElementById('quizadmin-book-editor-active-chapter-id');
  var chapterNumberInput = document.getElementById('quizadmin-book-editor-chapter-number-input');
  var chapterTitleBnInput = document.getElementById('quizadmin-book-editor-chapter-title-bn-input');
  var chapterTitleEnInput = document.getElementById('quizadmin-book-editor-chapter-title-en-input');
  var chapterTextInput = document.getElementById('quizadmin-book-editor-text-input');
  var saveButton = document.getElementById('quizadmin-book-editor-save-button');
  var saveStatusEl = document.getElementById('quizadmin-book-editor-save-status');
  var inlineMessage = document.getElementById('quizadmin-book-editor-inline-message');
  var addChapterButton = document.getElementById('quizadmin-book-editor-add-chapter-button');
  var publishButton = document.getElementById('quizadmin-book-editor-publish-button');
  var archiveButton = document.getElementById('quizadmin-book-editor-archive-button');

  var autoSaveTimerHandle = null;
  var autoSaveDelayMs = 3000;
  var pendingSaveInFlight = false;

  function _setSaveStatus(text, tone) {
    if (!saveStatusEl) return;
    saveStatusEl.textContent = text || '';
    saveStatusEl.dataset.tone = tone || 'idle';
  }

  function _setInlineMessage(text, tone) {
    if (!inlineMessage) return;
    inlineMessage.textContent = text;
    inlineMessage.dataset.tone = tone || 'success';
    inlineMessage.hidden = !text;
  }

  function _showEditorEmpty() {
    if (formElement) formElement.hidden = true;
    if (emptyPaneElement) emptyPaneElement.hidden = false;
  }

  function _showEditorForm() {
    if (emptyPaneElement) emptyPaneElement.hidden = true;
    if (formElement) formElement.hidden = false;
  }

  function _markActiveChapterButton(chapterId) {
    var allButtons = sidebarListElement.querySelectorAll('.quizadmin-book-editor-chapter-button');
    allButtons.forEach(function (button) {
      var isActive = parseInt(button.dataset.chapterId, 10) === chapterId;
      button.classList.toggle('quizadmin-book-editor-chapter-button--active', isActive);
    });
  }

  // ----- Chapter switching -----------------------------------------
  async function _loadChapter(chapterId) {
    _setInlineMessage('', 'success');
    _setSaveStatus('Loading…', 'idle');
    try {
      var lookupResult = await window.quizadminGet(
        '/mastermind/api/book/' + bookId + '/chapter/' + chapterId + '/get-text/',
      );
      if (!lookupResult || lookupResult.error) {
        _setInlineMessage((lookupResult && lookupResult.error) || 'Load failed.', 'error');
        return;
      }
      activeChapterIdInput.value = String(chapterId);
      chapterNumberInput.value = String(lookupResult.chapter_number || 1);
      chapterTitleBnInput.value = lookupResult.chapter_title_bn || '';
      chapterTitleEnInput.value = lookupResult.chapter_title_en || '';
      chapterTextInput.value = lookupResult.chapter_text || '';
      _showEditorForm();
      _markActiveChapterButton(chapterId);
      _setSaveStatus('Loaded · ' + (lookupResult.word_count || 0) + ' words', 'idle');
    } catch (loadError) {
      _setInlineMessage(loadError.message || 'Load failed.', 'error');
    }
  }

  // ----- Save (manual + auto) --------------------------------------
  async function _saveActiveChapter() {
    var activeChapterId = parseInt(activeChapterIdInput.value, 10);
    if (!activeChapterId || pendingSaveInFlight) return;
    pendingSaveInFlight = true;
    _setSaveStatus('Saving…', 'in_progress');
    try {
      var chapterNumberValue = parseInt(chapterNumberInput.value, 10);
      var payload = {
        plain_text: chapterTextInput.value,
        chapter_title_bn: chapterTitleBnInput.value,
        chapter_title_en: chapterTitleEnInput.value,
        chapter_number: isNaN(chapterNumberValue) ? null : chapterNumberValue,
      };
      var saveResult = await window.quizadminPost(
        '/mastermind/api/book/' + bookId + '/chapter/' + activeChapterId + '/save-text/',
        payload,
      );
      if (saveResult && saveResult.success) {
        _setSaveStatus('Saved · ' + saveResult.chunk_count + ' chunks', 'success');
      } else {
        _setSaveStatus('Save failed', 'error');
        _setInlineMessage((saveResult && saveResult.error) || 'Save failed.', 'error');
      }
    } catch (saveError) {
      _setSaveStatus('Save failed', 'error');
      _setInlineMessage(saveError.message || 'Save failed.', 'error');
    } finally {
      pendingSaveInFlight = false;
    }
  }

  function _scheduleAutoSave() {
    if (!activeChapterIdInput.value) return;
    if (autoSaveTimerHandle) clearTimeout(autoSaveTimerHandle);
    _setSaveStatus('Pending save…', 'idle');
    autoSaveTimerHandle = setTimeout(_saveActiveChapter, autoSaveDelayMs);
  }

  // ----- Add chapter -----------------------------------------------
  async function _addChapter() {
    addChapterButton.disabled = true;
    var originalLabel = addChapterButton.textContent;
    addChapterButton.textContent = 'Adding…';
    try {
      var addResult = await window.quizadminPost(
        '/mastermind/api/book/' + bookId + '/chapter-add/',
        { chapter_title_bn: '', chapter_title_en: '' },
      );
      if (addResult && addResult.success) {
        // Append a sidebar button without a full page reload
        var chapterListItem = document.createElement('li');
        chapterListItem.innerHTML =
          '<button type="button" class="quizadmin-book-editor-chapter-button"' +
          ' id="quizadmin-book-editor-chapter-button-' + addResult.chapter_id + '"' +
          ' name="quizadmin_book_editor_chapter_button_' + addResult.chapter_id + '"' +
          ' data-chapter-id="' + addResult.chapter_id + '"' +
          ' data-chapter-number="' + addResult.chapter_number + '">' +
          '<span class="quizadmin-book-editor-chapter-number">' + addResult.chapter_number + '.</span>' +
          '<span class="quizadmin-book-editor-chapter-title">অধ্যায় ' + addResult.chapter_number + '</span>' +
          '</button>';
        sidebarListElement.appendChild(chapterListItem);
        // Auto-load the new chapter
        _loadChapter(addResult.chapter_id);
      } else {
        _setInlineMessage((addResult && addResult.error) || 'Add chapter failed.', 'error');
      }
    } catch (addChapterError) {
      _setInlineMessage(addChapterError.message || 'Add chapter failed.', 'error');
    } finally {
      addChapterButton.disabled = false;
      addChapterButton.textContent = originalLabel;
    }
  }

  // ----- Publish + Archive -----------------------------------------
  async function _publishBook() {
    if (publishButton.dataset.confirmed !== 'true') {
      publishButton.dataset.confirmed = 'true';
      publishButton.textContent = 'Confirm publish';
      setTimeout(function () {
        if (publishButton.dataset.confirmed === 'true') {
          delete publishButton.dataset.confirmed;
          publishButton.textContent = 'Publish book';
        }
      }, 3000);
      return;
    }
    publishButton.disabled = true;
    publishButton.textContent = 'Publishing…';
    try {
      var publishResult = await window.quizadminPost(
        '/mastermind/api/book/' + bookId + '/publish/', {},
      );
      if (publishResult && publishResult.success) {
        _setInlineMessage('Published — reloading…', 'success');
        setTimeout(function () { window.location.reload(); }, 600);
      } else {
        _setInlineMessage((publishResult && publishResult.error) || 'Publish failed.', 'error');
        publishButton.disabled = false;
        publishButton.textContent = 'Publish book';
      }
    } catch (publishError) {
      _setInlineMessage(publishError.message || 'Publish failed.', 'error');
      publishButton.disabled = false;
      publishButton.textContent = 'Publish book';
    }
  }

  async function _archiveBook() {
    if (archiveButton.dataset.confirmed !== 'true') {
      archiveButton.dataset.confirmed = 'true';
      archiveButton.textContent = 'Confirm archive';
      setTimeout(function () {
        if (archiveButton.dataset.confirmed === 'true') {
          delete archiveButton.dataset.confirmed;
          archiveButton.textContent = 'Archive book';
        }
      }, 3000);
      return;
    }
    archiveButton.disabled = true;
    try {
      var archiveResult = await window.quizadminPost(
        '/mastermind/api/book/' + bookId + '/archive/', {},
      );
      if (archiveResult && archiveResult.success) {
        _setInlineMessage('Archived.', 'success');
        setTimeout(function () { window.location.reload(); }, 600);
      } else {
        _setInlineMessage((archiveResult && archiveResult.error) || 'Archive failed.', 'error');
        archiveButton.disabled = false;
        archiveButton.textContent = 'Archive book';
      }
    } catch (archiveError) {
      _setInlineMessage(archiveError.message || 'Archive failed.', 'error');
      archiveButton.disabled = false;
      archiveButton.textContent = 'Archive book';
    }
  }

  // ----- Wire events -----------------------------------------------
  if (sidebarListElement) {
    sidebarListElement.addEventListener('click', function (clickEvent) {
      var chapterButton = clickEvent.target.closest('.quizadmin-book-editor-chapter-button');
      if (!chapterButton) return;
      var chapterIdToLoad = parseInt(chapterButton.dataset.chapterId, 10);
      if (chapterIdToLoad) _loadChapter(chapterIdToLoad);
    });
  }

  if (chapterTextInput) {
    chapterTextInput.addEventListener('input', _scheduleAutoSave);
    chapterTextInput.addEventListener('blur', _saveActiveChapter);
  }
  if (chapterTitleBnInput) chapterTitleBnInput.addEventListener('blur', _saveActiveChapter);
  if (chapterTitleEnInput) chapterTitleEnInput.addEventListener('blur', _saveActiveChapter);
  if (chapterNumberInput) chapterNumberInput.addEventListener('change', _saveActiveChapter);

  if (formElement) {
    formElement.addEventListener('submit', function (submitEvent) {
      submitEvent.preventDefault();
      _saveActiveChapter();
    });
  }

  if (addChapterButton) addChapterButton.addEventListener('click', _addChapter);
  if (publishButton) publishButton.addEventListener('click', _publishBook);
  if (archiveButton) archiveButton.addEventListener('click', _archiveBook);

  // ----- Bootstrap: auto-load first chapter if any -----------------
  var firstChapterButton = sidebarListElement
    ? sidebarListElement.querySelector('.quizadmin-book-editor-chapter-button')
    : null;
  if (firstChapterButton) {
    var firstChapterId = parseInt(firstChapterButton.dataset.chapterId, 10);
    if (firstChapterId) _loadChapter(firstChapterId);
  } else {
    _showEditorEmpty();
  }
})();

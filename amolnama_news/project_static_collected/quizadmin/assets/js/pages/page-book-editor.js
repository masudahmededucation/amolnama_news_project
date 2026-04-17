/* Quiz Panel — book editor controller v2.
 *
 * What this controller drives (from the v2 plan):
 *   - Chapter sidebar: switch / add / inline-rename / delete / move-up-down
 *   - Active chapter editor: textarea + auto-save (3s debounce + onblur)
 *   - Live word count + reading-time chip
 *   - Last-saved timestamp ("X sec/min ago", refreshed every 15s)
 *   - Right-side book metadata panel: cover URL preview + every CollBook field
 *   - "🤖 Generate quiz from this chapter" button
 *   - Publish/archive with confirm-tap pattern
 *   - "⛶ Focus mode" toggle (hides sidebar + metadata panel)
 *   - Mobile chapter drawer with backdrop + ESC + click-outside
 *
 * No console.* / no alert / no confirm. All errors surface inline.
 */
(function () {
  'use strict';

  var rootElement = document.getElementById('quizadmin-book-editor');
  if (!rootElement) return;

  var bookId = parseInt(rootElement.dataset.bookId, 10);
  var bookStatus = rootElement.dataset.bookStatus || 'draft';

  // ---------- DOM refs --------------------------------------------------
  var sidebarElement = document.getElementById('quizadmin-book-editor-sidebar');
  var sidebarListElement = document.getElementById('quizadmin-book-editor-chapter-list');
  var drawerToggleButton = document.getElementById('quizadmin-book-editor-drawer-toggle');
  var drawerBackdropElement = document.getElementById('quizadmin-book-editor-drawer-backdrop');
  var focusToggleButton = document.getElementById('quizadmin-book-editor-focus-toggle');

  var emptyPaneElement = document.getElementById('quizadmin-book-editor-empty');
  var formElement = document.getElementById('quizadmin-book-editor-form');
  var activeChapterIdInput = document.getElementById('quizadmin-book-editor-active-chapter-id');
  var chapterNumberInput = document.getElementById('quizadmin-book-editor-chapter-number-input');
  var chapterTitleBnInput = document.getElementById('quizadmin-book-editor-chapter-title-bn-input');
  var chapterTitleEnInput = document.getElementById('quizadmin-book-editor-chapter-title-en-input');
  var chapterTextInput = document.getElementById('quizadmin-book-editor-text-input');
  var saveButton = document.getElementById('quizadmin-book-editor-save-button');
  var saveStatusEl = document.getElementById('quizadmin-book-editor-save-status');
  var wordCountChip = document.getElementById('quizadmin-book-editor-word-count-chip');
  var aiGenButton = document.getElementById('quizadmin-book-editor-ai-gen-button');
  var inlineMessage = document.getElementById('quizadmin-book-editor-inline-message');
  var addChapterButton = document.getElementById('quizadmin-book-editor-add-chapter-button');
  var publishButton = document.getElementById('quizadmin-book-editor-publish-button');
  var archiveButton = document.getElementById('quizadmin-book-editor-archive-button');

  var metadataFormElement = document.getElementById('quizadmin-book-editor-metadata-form');
  var metadataSaveStatusEl = document.getElementById('quizadmin-book-editor-metadata-save-status');
  var coverPreviewElement = document.getElementById('quizadmin-book-editor-cover-preview');
  var coverImageElement = document.getElementById('quizadmin-book-editor-cover-image');
  var metadataInputs = {
    book_cover_image_url:   document.getElementById('quizadmin-book-editor-metadata-cover-input'),
    book_title_bn:          document.getElementById('quizadmin-book-editor-metadata-title-bn-input'),
    book_title_en:          document.getElementById('quizadmin-book-editor-metadata-title-en-input'),
    book_author_bn:         document.getElementById('quizadmin-book-editor-metadata-author-bn-input'),
    book_author_en:         document.getElementById('quizadmin-book-editor-metadata-author-en-input'),
    book_publisher_bn:      document.getElementById('quizadmin-book-editor-metadata-publisher-bn-input'),
    book_publisher_en:      document.getElementById('quizadmin-book-editor-metadata-publisher-en-input'),
    book_edition:           document.getElementById('quizadmin-book-editor-metadata-edition-input'),
    book_isbn:              document.getElementById('quizadmin-book-editor-metadata-isbn-input'),
    book_language_code:     document.getElementById('quizadmin-book-editor-metadata-language-input'),
    book_total_pages:       document.getElementById('quizadmin-book-editor-metadata-pages-input'),
    book_description:       document.getElementById('quizadmin-book-editor-metadata-description-input'),
  };

  // ---------- Internal state -------------------------------------------
  var autoSaveTimerHandle = null;
  var autoSaveDelayMs = 3000;
  var pendingSaveInFlight = false;
  var lastSavedTimestampMs = null;
  var lastSavedRefreshTimerHandle = null;

  var metadataAutoSaveTimerHandle = null;
  var metadataAutoSaveDelayMs = 1500;
  var metadataPendingSave = false;
  var metadataLastSavedTimestampMs = null;

  // ---------- Tiny helpers ---------------------------------------------
  function _escapeHtml(text) {
    var helperDiv = document.createElement('div');
    helperDiv.textContent = text == null ? '' : String(text);
    return helperDiv.innerHTML;
  }

  function _setSaveStatus(text, tone) {
    if (!saveStatusEl) return;
    saveStatusEl.textContent = text || '';
    saveStatusEl.dataset.tone = tone || 'idle';
  }

  function _setMetadataSaveStatus(text, tone) {
    if (!metadataSaveStatusEl) return;
    metadataSaveStatusEl.textContent = text || '';
    metadataSaveStatusEl.dataset.tone = tone || 'idle';
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

  // ---------- Word count + reading-time chip ---------------------------
  function _refreshWordCountChip() {
    if (!wordCountChip || !chapterTextInput) return;
    var rawText = chapterTextInput.value || '';
    var wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
    var readingMinutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / 200)) : 0;
    wordCountChip.textContent = wordCount + ' words · ≈ ' + readingMinutes + ' min';
  }

  // ---------- Last-saved timestamp -------------------------------------
  function _formatRelativeTime(timestampMs) {
    if (!timestampMs) return '';
    var elapsedSec = Math.floor((Date.now() - timestampMs) / 1000);
    if (elapsedSec < 5) return 'Just now';
    if (elapsedSec < 60) return elapsedSec + ' sec ago';
    var elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return elapsedMin + ' min ago';
    var elapsedHr = Math.floor(elapsedMin / 60);
    return elapsedHr + ' hr ago';
  }

  function _refreshLastSavedDisplay() {
    if (lastSavedTimestampMs && saveStatusEl && saveStatusEl.dataset.tone === 'success') {
      saveStatusEl.textContent = 'Saved · ' + _formatRelativeTime(lastSavedTimestampMs);
    }
    if (metadataLastSavedTimestampMs && metadataSaveStatusEl
        && metadataSaveStatusEl.dataset.tone === 'success') {
      metadataSaveStatusEl.textContent = 'Saved · ' + _formatRelativeTime(metadataLastSavedTimestampMs);
    }
  }

  if (lastSavedRefreshTimerHandle === null) {
    lastSavedRefreshTimerHandle = setInterval(_refreshLastSavedDisplay, 15000);
  }

  // ---------- Chapter switching ----------------------------------------
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
      _refreshWordCountChip();
      lastSavedTimestampMs = null;
      _setSaveStatus('Loaded · ' + (lookupResult.word_count || 0) + ' words', 'idle');
      _closeMobileDrawer();
    } catch (loadError) {
      _setInlineMessage(loadError.message || 'Load failed.', 'error');
    }
  }

  // ---------- Save (manual + auto) -------------------------------------
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
        lastSavedTimestampMs = Date.now();
        _setSaveStatus('Saved · Just now', 'success');
        // Sync the sidebar title in case it changed
        var sidebarTitleSpan = document.querySelector(
          '#quizadmin-book-editor-chapter-button-' + activeChapterId
            + ' .quizadmin-book-editor-chapter-title'
        );
        if (sidebarTitleSpan && chapterTitleBnInput.value) {
          sidebarTitleSpan.textContent = chapterTitleBnInput.value;
        }
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

  // ---------- Add chapter ----------------------------------------------
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
        var newChapterRow = _renderChapterRow(addResult.chapter_id, addResult.chapter_number, 'অধ্যায় ' + addResult.chapter_number);
        sidebarListElement.appendChild(newChapterRow);
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

  function _renderChapterRow(chapterId, chapterNumber, chapterTitleBn) {
    var row = document.createElement('li');
    row.className = 'quizadmin-book-editor-chapter-row';
    row.dataset.chapterId = String(chapterId);
    row.dataset.chapterNumber = String(chapterNumber);
    row.innerHTML =
      '<button type="button" class="quizadmin-book-editor-chapter-button"' +
      ' id="quizadmin-book-editor-chapter-button-' + chapterId + '"' +
      ' name="quizadmin_book_editor_chapter_button_' + chapterId + '"' +
      ' data-chapter-id="' + chapterId + '"' +
      ' data-chapter-number="' + chapterNumber + '">' +
      '<span class="quizadmin-book-editor-chapter-number">' + chapterNumber + '.</span>' +
      '<span class="quizadmin-book-editor-chapter-title">' + _escapeHtml(chapterTitleBn) + '</span>' +
      '</button>' +
      '<span class="quizadmin-book-editor-chapter-row-actions">' +
      '<button type="button" class="quizadmin-book-editor-chapter-row-action quizadmin-book-editor-chapter-move-up-button"' +
      ' id="quizadmin-book-editor-chapter-move-up-' + chapterId + '"' +
      ' name="quizadmin_book_editor_chapter_move_up_' + chapterId + '"' +
      ' data-chapter-id="' + chapterId + '" aria-label="Move chapter up" title="Move up">↑</button>' +
      '<button type="button" class="quizadmin-book-editor-chapter-row-action quizadmin-book-editor-chapter-move-down-button"' +
      ' id="quizadmin-book-editor-chapter-move-down-' + chapterId + '"' +
      ' name="quizadmin_book_editor_chapter_move_down_' + chapterId + '"' +
      ' data-chapter-id="' + chapterId + '" aria-label="Move chapter down" title="Move down">↓</button>' +
      '<button type="button" class="quizadmin-book-editor-chapter-row-action quizadmin-book-editor-chapter-delete-button"' +
      ' id="quizadmin-book-editor-chapter-delete-' + chapterId + '"' +
      ' name="quizadmin_book_editor_chapter_delete_' + chapterId + '"' +
      ' data-chapter-id="' + chapterId + '" aria-label="Delete chapter" title="Delete">×</button>' +
      '</span>';
    return row;
  }

  // ---------- Move chapter up / down -----------------------------------
  async function _moveChapter(chapterId, direction) {
    try {
      var moveResult = await window.quizadminPost(
        '/mastermind/api/book/' + bookId + '/chapter/' + chapterId + '/move/',
        { direction: direction },
      );
      if (moveResult && moveResult.success && moveResult.moved) {
        // Reload the page to reflect new ordering — simpler than client-side swap
        window.location.reload();
      } else if (moveResult && moveResult.success && !moveResult.moved) {
        _setInlineMessage('Already at the boundary.', 'success');
      } else {
        _setInlineMessage((moveResult && moveResult.error) || 'Move failed.', 'error');
      }
    } catch (moveError) {
      _setInlineMessage(moveError.message || 'Move failed.', 'error');
    }
  }

  // ---------- Delete chapter (confirm-tap pattern) ---------------------
  async function _deleteChapter(chapterId, deleteButtonElement) {
    if (deleteButtonElement.dataset.confirmed !== 'true') {
      deleteButtonElement.dataset.confirmed = 'true';
      deleteButtonElement.textContent = 'Confirm';
      deleteButtonElement.classList.add('quizadmin-book-editor-chapter-delete-confirm');
      setTimeout(function () {
        if (deleteButtonElement.dataset.confirmed === 'true') {
          deleteButtonElement.textContent = '×';
          delete deleteButtonElement.dataset.confirmed;
          deleteButtonElement.classList.remove('quizadmin-book-editor-chapter-delete-confirm');
        }
      }, 3000);
      return;
    }
    deleteButtonElement.disabled = true;
    try {
      var deleteResult = await window.quizadminPost(
        '/mastermind/api/book/' + bookId + '/chapter/' + chapterId + '/delete/', {},
      );
      if (deleteResult && deleteResult.success) {
        var chapterRow = deleteButtonElement.closest('.quizadmin-book-editor-chapter-row');
        if (chapterRow) chapterRow.remove();
        // If we just deleted the active chapter, clear the editor
        if (parseInt(activeChapterIdInput.value, 10) === chapterId) {
          activeChapterIdInput.value = '';
          _showEditorEmpty();
        }
        _setInlineMessage('Chapter deleted.', 'success');
      } else {
        _setInlineMessage((deleteResult && deleteResult.error) || 'Delete failed.', 'error');
        deleteButtonElement.disabled = false;
      }
    } catch (deleteError) {
      _setInlineMessage(deleteError.message || 'Delete failed.', 'error');
      deleteButtonElement.disabled = false;
    }
  }

  // ---------- Generate AI quiz from this chapter -----------------------
  async function _generateQuizFromChapter() {
    var activeChapterId = parseInt(activeChapterIdInput.value, 10);
    if (!activeChapterId) {
      _setInlineMessage('Pick a chapter first.', 'error');
      return;
    }
    if (aiGenButton.dataset.confirmed !== 'true') {
      aiGenButton.dataset.confirmed = 'true';
      aiGenButton.textContent = '✓ Confirm — generate?';
      setTimeout(function () {
        if (aiGenButton.dataset.confirmed === 'true') {
          delete aiGenButton.dataset.confirmed;
          aiGenButton.textContent = '🤖 Generate quiz from this chapter';
        }
      }, 3000);
      return;
    }
    aiGenButton.disabled = true;
    aiGenButton.textContent = 'Generating…';
    try {
      var generationResult = await window.quizadminPost(
        '/mastermind/api/book/' + bookId + '/generate/',
        {
          chapter_id: activeChapterId,
          questions_per_chunk: 3,
          prompt_template: 'mixed',
          topic_id: null,
        },
      );
      if (generationResult && generationResult.success) {
        _setInlineMessage(
          'Generation job started — open the AI Jobs tab or Review queue to see results.',
          'success',
        );
        aiGenButton.textContent = '✅ Job started';
        setTimeout(function () {
          aiGenButton.textContent = '🤖 Generate quiz from this chapter';
          aiGenButton.disabled = false;
          delete aiGenButton.dataset.confirmed;
        }, 4000);
      } else {
        _setInlineMessage((generationResult && generationResult.error) || 'Generation failed.', 'error');
        aiGenButton.disabled = false;
        aiGenButton.textContent = '🤖 Generate quiz from this chapter';
        delete aiGenButton.dataset.confirmed;
      }
    } catch (aiGenError) {
      _setInlineMessage(aiGenError.message || 'Generation failed.', 'error');
      aiGenButton.disabled = false;
      aiGenButton.textContent = '🤖 Generate quiz from this chapter';
      delete aiGenButton.dataset.confirmed;
    }
  }

  // ---------- Publish + Archive (confirm-tap) --------------------------
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

  // ---------- Book metadata save (debounced) ---------------------------
  function _scheduleMetadataSave() {
    if (metadataAutoSaveTimerHandle) clearTimeout(metadataAutoSaveTimerHandle);
    _setMetadataSaveStatus('Pending save…', 'idle');
    metadataAutoSaveTimerHandle = setTimeout(_saveBookMetadata, metadataAutoSaveDelayMs);
  }

  async function _saveBookMetadata() {
    if (metadataPendingSave) return;
    metadataPendingSave = true;
    _setMetadataSaveStatus('Saving…', 'in_progress');
    try {
      var payload = {};
      Object.keys(metadataInputs).forEach(function (fieldName) {
        var inputElement = metadataInputs[fieldName];
        if (inputElement) payload[fieldName] = inputElement.value;
      });
      var saveResult = await window.quizadminPost(
        '/mastermind/api/book/' + bookId + '/update-metadata/', payload,
      );
      if (saveResult && saveResult.success) {
        metadataLastSavedTimestampMs = Date.now();
        _setMetadataSaveStatus('Saved · Just now', 'success');
        _refreshCoverPreview();
      } else {
        _setMetadataSaveStatus('Save failed', 'error');
      }
    } catch (metadataSaveError) {
      _setMetadataSaveStatus('Save failed', 'error');
    } finally {
      metadataPendingSave = false;
    }
  }

  function _refreshCoverPreview() {
    if (!coverPreviewElement) return;
    var coverInput = metadataInputs.book_cover_image_url;
    if (!coverInput) return;
    var imageUrl = coverInput.value.trim();
    coverPreviewElement.innerHTML = '';
    if (imageUrl) {
      var imageElement = document.createElement('img');
      imageElement.id = 'quizadmin-book-editor-cover-image';
      imageElement.src = imageUrl;
      imageElement.alt = 'Book cover';
      imageElement.loading = 'lazy';
      imageElement.decoding = 'async';
      coverPreviewElement.appendChild(imageElement);
    } else {
      var placeholderSpan = document.createElement('span');
      placeholderSpan.className = 'quizadmin-book-editor-cover-placeholder';
      placeholderSpan.id = 'quizadmin-book-editor-cover-placeholder';
      placeholderSpan.setAttribute('aria-hidden', 'true');
      placeholderSpan.textContent = '📖';
      coverPreviewElement.appendChild(placeholderSpan);
    }
  }

  // ---------- Mobile chapter drawer -----------------------------------
  function _openMobileDrawer() {
    if (!sidebarElement) return;
    sidebarElement.classList.add('quizadmin-book-editor-sidebar--open');
    if (drawerBackdropElement) drawerBackdropElement.hidden = false;
    if (drawerToggleButton) drawerToggleButton.setAttribute('aria-expanded', 'true');
  }

  function _closeMobileDrawer() {
    if (!sidebarElement) return;
    sidebarElement.classList.remove('quizadmin-book-editor-sidebar--open');
    if (drawerBackdropElement) drawerBackdropElement.hidden = true;
    if (drawerToggleButton) drawerToggleButton.setAttribute('aria-expanded', 'false');
  }

  // ---------- Distraction-free / focus mode ---------------------------
  function _toggleFocusMode() {
    var isFocused = rootElement.classList.toggle('quizadmin-book-editor--focus');
    if (focusToggleButton) {
      focusToggleButton.setAttribute('aria-pressed', isFocused ? 'true' : 'false');
      focusToggleButton.textContent = isFocused ? '⛶ Exit focus' : '⛶ Focus mode';
    }
  }

  // ---------- Wire events ---------------------------------------------
  if (sidebarListElement) {
    sidebarListElement.addEventListener('click', function (clickEvent) {
      var deleteButton = clickEvent.target.closest('.quizadmin-book-editor-chapter-delete-button');
      if (deleteButton) {
        clickEvent.stopPropagation();
        var deleteChapterId = parseInt(deleteButton.dataset.chapterId, 10);
        if (deleteChapterId) _deleteChapter(deleteChapterId, deleteButton);
        return;
      }
      var moveUpButton = clickEvent.target.closest('.quizadmin-book-editor-chapter-move-up-button');
      if (moveUpButton) {
        clickEvent.stopPropagation();
        var moveUpChapterId = parseInt(moveUpButton.dataset.chapterId, 10);
        if (moveUpChapterId) _moveChapter(moveUpChapterId, 'up');
        return;
      }
      var moveDownButton = clickEvent.target.closest('.quizadmin-book-editor-chapter-move-down-button');
      if (moveDownButton) {
        clickEvent.stopPropagation();
        var moveDownChapterId = parseInt(moveDownButton.dataset.chapterId, 10);
        if (moveDownChapterId) _moveChapter(moveDownChapterId, 'down');
        return;
      }
      var chapterButton = clickEvent.target.closest('.quizadmin-book-editor-chapter-button');
      if (chapterButton) {
        var chapterIdToLoad = parseInt(chapterButton.dataset.chapterId, 10);
        if (chapterIdToLoad) _loadChapter(chapterIdToLoad);
      }
    });
  }

  if (chapterTextInput) {
    chapterTextInput.addEventListener('input', function () {
      _refreshWordCountChip();
      _scheduleAutoSave();
    });
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
  if (aiGenButton) aiGenButton.addEventListener('click', _generateQuizFromChapter);
  if (focusToggleButton) focusToggleButton.addEventListener('click', _toggleFocusMode);
  if (drawerToggleButton) {
    drawerToggleButton.addEventListener('click', function () {
      var isCurrentlyOpen = sidebarElement.classList.contains('quizadmin-book-editor-sidebar--open');
      if (isCurrentlyOpen) _closeMobileDrawer();
      else _openMobileDrawer();
    });
  }
  if (drawerBackdropElement) drawerBackdropElement.addEventListener('click', _closeMobileDrawer);
  document.addEventListener('keydown', function (keyboardEvent) {
    if (keyboardEvent.key === 'Escape') _closeMobileDrawer();
  });

  // Metadata panel: debounced save on every input change
  if (metadataFormElement) {
    metadataFormElement.addEventListener('input', _scheduleMetadataSave);
    metadataFormElement.addEventListener('change', _scheduleMetadataSave);
  }
  if (metadataInputs.book_cover_image_url) {
    metadataInputs.book_cover_image_url.addEventListener('blur', _refreshCoverPreview);
  }

  // ---------- Bootstrap: auto-load first chapter if any ---------------
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

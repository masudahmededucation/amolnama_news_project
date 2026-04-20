/* ================================================================
   কলম · Inkwell — page controller
   Standalone interactions for /bookwriter/. Vanilla JS, no deps.
   Sample data is rendered server-side; this file only wires
   the in-page behaviour: word counter, save chip, mode switch,
   focus mode, snapshots, sprint timer, beta share, drag-reorder,
   corkboard, bible, cover designer.
   ================================================================ */
(function () {
  'use strict';

  /* ========================================================
     LOCAL PERSISTENCE — last mode, chapter, scroll position
     --------------------------------------------------------
     Lightweight client-only state so a returning user lands
     back on the chapter / mode they left. Survives refreshes
     on the same browser; wiped on logout / cache clear.

     Phase 1B will mirror this to the DB (per-user) using the
     SAME keys, so the restore logic does not need to change
     when the backend lands — only the source becomes the
     server response with localStorage as a fast-path cache.

     Errors are swallowed: localStorage can throw in private
     browsing or when quota is full. Persistence is a nice-
     to-have, never a hard requirement. */
  var STATE_KEY = 'bookwriter:state:v1';

  function loadState() {
    try {
      var rawStoredStateJson = window.localStorage.getItem(STATE_KEY);
      return rawStoredStateJson ? JSON.parse(rawStoredStateJson) : null;
    } catch (e) { return null; }
  }

  function saveState(patch) {
    try {
      var current = loadState() || {};
      var next = Object.assign({}, current, patch);
      window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
    } catch (e) { /* quota / private mode — drop silently */ }
  }


  /* ========================================================
     LIVE WORD COUNT + SAVE CHIP (writer view)
     ======================================================== */
  var prose      = document.querySelector('.bookwriter-prose');
  var title      = document.querySelector('.bookwriter-chapter-title');
  var bigWord    = document.querySelectorAll('.bookwriter-num-big')[0];
  var ribbon     = document.querySelector('.bookwriter-focus-ribbon');
  var saveChip   = document.querySelector('.bookwriter-save-chip');
  var goalText   = document.querySelector('.bookwriter-goal-text .bookwriter-goal-num');

  var saveTimeout;

  function countWords(el) {
    if (!el) return 0;
    return (el.innerText.trim().match(/\S+/g) || []).length;
  }

  /* The daily word target lives on coll_book and is rendered into the
     right-rail card head. Read it from the goal-card label so the JS
     stays in sync with whatever the server sent without needing a
     separate data-attribute. Falls back to 500 to keep the demo lively
     for anonymous visitors. */
  function readDailyWordTarget() {
    var goalCardHead = document.querySelector('.bookwriter-card .bookwriter-card-head span:last-child');
    var defaultTarget = 500;
    if (!goalCardHead) return defaultTarget;
    var parsedTarget = parseInt((goalCardHead.textContent || '').replace(/[^0-9]/g, ''), 10);
    return (isFinite(parsedTarget) && parsedTarget > 0) ? parsedTarget : defaultTarget;
  }

  function refresh() {
    if (!prose) return;
    var wordCount = countWords(prose);

    // Focus ribbon: chapter number from the active rail row, words from
    // the live editor. Falls back to "iii" only on the anon demo.
    var activeChapterRailRow = document.querySelector('.bookwriter-chapter.active .bookwriter-ch-num');
    var activeChapterLabel = activeChapterRailRow
      ? activeChapterRailRow.innerText.replace(/\.$/, '').trim().toLowerCase()
      : 'iii';
    if (ribbon) ribbon.textContent = '⏳ chapter ' + activeChapterLabel + ' · ' + wordCount.toLocaleString() + ' words';

    if (bigWord)  bigWord.textContent = wordCount.toLocaleString();
    if (goalText) goalText.textContent = wordCount.toLocaleString();

    var ringStrokeCircle = document.querySelector('.bookwriter-ring circle:last-of-type');
    var ringPercentLabel = document.querySelector('.bookwriter-ring text');
    if (ringStrokeCircle && ringPercentLabel) {
      var dailyWordTarget = readDailyWordTarget();
      var goalProgressRatio  = Math.min(wordCount / dailyWordTarget, 1.5);
      var ringCircumference = 201;
      ringStrokeCircle.style.strokeDashoffset = ringCircumference - (ringCircumference * Math.min(goalProgressRatio, 1));
      ringPercentLabel.textContent = Math.round(goalProgressRatio * 100) + '%';
    }
  }

  /* Update the right-rail "Today's Session" + Daily Goal counters from
     the autosave response. Server returns today_words_written +
     current_streak_days; we mirror them into the DOM so the user
     watches the numbers tick up as they type. No-op when the
     elements don't exist (anon demo). */
  function updateWriterDashboardStats(todayWordsWritten, currentStreakDays) {
    if (typeof todayWordsWritten === 'number') {
      var todayWordsElement = document.getElementById('bookwriter-today-words');
      if (todayWordsElement) todayWordsElement.textContent = todayWordsWritten.toLocaleString();
      var goalWordsElement = document.getElementById('bookwriter-goal-words');
      if (goalWordsElement) goalWordsElement.textContent = todayWordsWritten.toLocaleString();
      // Recompute goal % against the same target the server sent.
      var ringPercentLabel = document.querySelector('.bookwriter-ring text');
      var ringStrokeCircle = document.querySelector('.bookwriter-ring circle:last-of-type');
      if (ringPercentLabel && ringStrokeCircle) {
        var dailyWordTarget = readDailyWordTarget();
        var goalProgressRatio = Math.min(todayWordsWritten / dailyWordTarget, 1.5);
        var ringCircumference = 201;
        ringStrokeCircle.style.strokeDashoffset = ringCircumference - (ringCircumference * Math.min(goalProgressRatio, 1));
        ringPercentLabel.textContent = Math.round(goalProgressRatio * 100) + '%';
      }
    }
    if (typeof currentStreakDays === 'number') {
      var currentStreakElement = document.getElementById('bookwriter-current-streak');
      if (currentStreakElement) {
        currentStreakElement.textContent = currentStreakDays + ' day' + (currentStreakDays === 1 ? '' : 's');
      }
    }
  }

  /* ========================================================
     AUTOSAVE — debounced POST to the chapter autosave endpoint
     --------------------------------------------------------
     `scheduleChapterAutosave()` shows the "saving…" chip
     immediately, then waits 800ms of typing-idle before firing the
     real fetch. Each call replaces the pending timer, so a fast
     typist only triggers one network round-trip per quiet pause.

     The endpoint is idempotent (replaces the chapter body in full)
     so a dropped request is harmless — the next save catches up
     with the latest text.

     If `prose.dataset.chapterId` is missing (anonymous visitor on
     the demo page, or any future chapter not provisioned in the
     DB) we skip the network call and just animate the chip so the
     marketing surface still feels alive. */
  var BOOKWRITER_AUTOSAVE_DEBOUNCE_MS = 800;

  function scheduleChapterAutosave() {
    if (!saveChip) return;
    saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--ochre);"></span>saving…';
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(performChapterAutosave, BOOKWRITER_AUTOSAVE_DEBOUNCE_MS);
  }

  function performChapterAutosave() {
    if (!prose) return;

    var chapterId = prose.dataset.chapterId;
    if (!chapterId) {
      // Anon / demo mode — no real DB chapter to write to.
      if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>saved to the shelf · just now';
      return;
    }

    window.bookwriter.apiPost('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/autosave/', { chapter_text_html: prose.innerHTML })
      .then(function (data) {
        if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>saved · just now';
        updateBookStatCounters(data.book_total_word_count, data.book_total_chapter_count);
        updateWriterDashboardStats(data.today_words_written, data.current_streak_days);
      })
      .catch(function () {
        // Network or server error. Keep the user's text in the editor
        // (browser still holds it). Next input event will retry.
        if (saveChip) {
          saveChip.innerHTML =
            '<span class="bookwriter-pulse" style="background:var(--accent);"></span>offline · will retry';
        }
      });
  }

  /* ========================================================
     TITLE AUTOSAVE — independent debounce, separate endpoint
     --------------------------------------------------------
     Body and title use separate debounce timers + separate
     endpoints so a fast typist editing the title doesn't
     constantly re-POST the entire chapter body, and vice
     versa. Both share the same save chip for visual feedback. */
  var titleSaveTimeout;

  function scheduleChapterTitleAutosave() {
    if (!saveChip) return;
    saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--ochre);"></span>saving title…';
    clearTimeout(titleSaveTimeout);
    titleSaveTimeout = setTimeout(performChapterTitleAutosave, BOOKWRITER_AUTOSAVE_DEBOUNCE_MS);
  }

  function performChapterTitleAutosave() {
    if (!prose || !title) return;
    var chapterId = prose.dataset.chapterId;
    if (!chapterId) {
      // Anon / demo — no DB chapter to save to.
      if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>title noted';
      return;
    }
    window.bookwriter.apiPost('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/title/', { chapter_title: title.innerText || '' })
      .then(function () {
        if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>title saved · just now';
        // Mirror the new title into the matching rail row + the breadcrumb
        // so the rest of the UI stays in sync without a full refresh.
        var activeRailRow = document.querySelector('.bookwriter-chapter.active .bookwriter-ch-title');
        if (activeRailRow) activeRailRow.textContent = title.innerText || 'Untitled';
      })
      .catch(function () {
        if (saveChip) {
          saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--accent);"></span>title offline · will retry';
        }
      });
  }

  if (prose) {
    prose.addEventListener('input', function () {
      refresh();
      scheduleChapterAutosave();
    });
  }
  if (title) {
    title.addEventListener('input', function () {
      refresh();
      scheduleChapterTitleAutosave();
    });
  }


  /* ========================================================
     BOOK-LEVEL AUTOSAVE — title + author display
     --------------------------------------------------------
     The right-rail book-info card is contenteditable for the
     owner. Both fields share one debounce timer + one POST
     because they target the same endpoint. Author display is
     stored without the leading "by " — we add/strip it at
     the UI boundary so the editable surface reads naturally.
     Skips real save when no #bookwriter-book-info exists
     (anon visitor on the demo). ======================================================== */
  var bookTitleSaveTimeout;
  var bookTitleElement   = document.getElementById('bookwriter-book-title');
  var bookAuthorElement  = document.getElementById('bookwriter-book-author');
  var bookInfoCardElement = document.getElementById('bookwriter-book-info');

  function scheduleBookMetadataAutosave() {
    if (!saveChip) return;
    saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--ochre);"></span>saving book…';
    clearTimeout(bookTitleSaveTimeout);
    bookTitleSaveTimeout = setTimeout(performBookMetadataAutosave, BOOKWRITER_AUTOSAVE_DEBOUNCE_MS);
  }

  function performBookMetadataAutosave() {
    if (!bookInfoCardElement) return;
    var bookId = bookInfoCardElement.dataset.bookId;
    if (!bookId) return;

    var bookTitleValue = bookTitleElement ? (bookTitleElement.innerText || '').trim() : '';
    var bookAuthorRawText = bookAuthorElement ? (bookAuthorElement.innerText || '').trim() : '';
    // Strip leading "by " so we store just the name.
    var bookAuthorValue = bookAuthorRawText.replace(/^by\s+/i, '').trim();

    window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(bookId) + '/title/', {
        book_title: bookTitleValue,
        book_author_display: bookAuthorValue,
      })
      .then(function () {
        if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>book saved';
        // Mirror the new title into the breadcrumb so the toolbar
        // stays in sync without a page reload.
        var crumbBookTitleElement = document.getElementById('bookwriter-crumb-book-title');
        if (crumbBookTitleElement) crumbBookTitleElement.textContent = bookTitleValue || 'Untitled Book';
      })
      .catch(function () {
        if (saveChip) {
          saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--accent);"></span>book offline · will retry';
        }
      });
  }

  if (bookTitleElement) {
    bookTitleElement.addEventListener('input', scheduleBookMetadataAutosave);
  }
  if (bookAuthorElement) {
    bookAuthorElement.addEventListener('input', scheduleBookMetadataAutosave);
  }


  /* ========================================================
     CHAPTER DELETE — soft delete (is_active = 0)
     --------------------------------------------------------
     Called from a delete affordance on each chapter row (added
     in buildChapterRailRow). Inline confirm uses the same chip
     so we don't introduce window.confirm(). On success, the
     row is removed from the DOM and the right-rail counters
     refresh from the server response.

     Edge case: if the user deletes the currently-active chapter,
     we click the first remaining row to keep the editor populated.
     If the LAST chapter gets deleted, the editor goes blank — the
     user should add a new chapter via the "+ new" button. ======================================================== */
  function deleteChapterById(chapterId, chapterRowElement) {
    if (!chapterId) return;
    window.bookwriter.apiDelete('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/delete/')
      .then(function (data) {
        var wasActive = chapterRowElement.classList.contains('bookwriter-active');
        chapterRowElement.parentNode.removeChild(chapterRowElement);
        renumberChapters();
        updateBookStatCounters(data.book_total_word_count, data.book_total_chapter_count);
        if (wasActive) {
          var nextActiveRow = document.querySelector('#chapters .bookwriter-chapter');
          if (nextActiveRow) {
            nextActiveRow.click();
          } else if (prose) {
            prose.innerHTML = '';
            if (title) title.innerText = '';
            if (prose.dataset) delete prose.dataset.chapterId;
          }
        }
        if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>chapter removed';
      })
      .catch(function () {
        if (saveChip) {
          saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--accent);"></span>delete failed';
        }
      });
  }
  window.deleteChapterById = deleteChapterById;


  /* ========================================================
     CHAPTER SWITCHING — real (DB) or demo (anon) branches
     --------------------------------------------------------
     A chapter row carries `data-chapter-id` only when it
     came from the server-side loop in the partial (i.e. the
     caller is logged in and the DB row exists). For those
     real rows, we GET the chapter from the API and replace
     the editor contents.

     For demo rows (anon visitor on the fiction teaser), we
     keep the original "swap title/crumb, blank-out prose"
     cosmetic behaviour so the marketing surface stays alive.

     Race-safety: before switching, flush any pending body /
     title save against the OLD chapter so we don't write the
     new prose to the old chapter id. The pending fetch (if
     any) closes over the old chapter_id at call time, so it
     will land on the correct row.
     ======================================================== */
  var initialPrimedChapterNum = '';
  var initialPrimedProseHtml = '';
  if (prose) {
    initialPrimedProseHtml = prose.innerHTML;
    var initialActiveChapterNumberElement = document.querySelector('.bookwriter-chapter.active .bookwriter-ch-num');
    if (initialActiveChapterNumberElement) {
      initialPrimedChapterNum = initialActiveChapterNumberElement.innerText.trim();
    }
  }

  function applyChapterPayloadToEditor(chapterPayload) {
    if (!chapterPayload) return;
    if (prose) {
      prose.dataset.chapterId = String(chapterPayload.id || '');
      prose.innerHTML = chapterPayload.html || '';
    }
    if (title) title.innerText = chapterPayload.title || '';
    var chapterLabelElement = document.querySelector('.bookwriter-chapter-label');
    // Prefer the ID-stamped crumb element added in Step 7 — falls back
    // to the older `.bookwriter-toolbar-crumb strong` selector for the anon demo.
    var crumbChapterElement = document.getElementById('bookwriter-crumb-chapter-label')
      || document.querySelector('.bookwriter-toolbar-crumb strong');
    if (chapterLabelElement) chapterLabelElement.innerText = 'Chapter ' + (chapterPayload.number || '');
    if (crumbChapterElement) crumbChapterElement.innerText = 'Chapter ' + (chapterPayload.number || '');
    refresh();
  }

  function switchToChapterFromRail(chapterRow) {
    document.querySelectorAll('.bookwriter-chapter').forEach(function (x) { x.classList.remove('bookwriter-active'); });
    chapterRow.classList.add('bookwriter-active');

    var realChapterId = chapterRow.dataset.chapterId;

    if (!realChapterId) {
      // ---------- DEMO BRANCH ----------
      var demoChapterTitle = chapterRow.querySelector('.bookwriter-ch-title') ? chapterRow.querySelector('.bookwriter-ch-title').innerText : '';
      var demoChapterNum = chapterRow.querySelector('.bookwriter-ch-num') ? chapterRow.querySelector('.bookwriter-ch-num').innerText.trim() : '';
      if (title) title.innerText = (demoChapterTitle === 'Untitled') ? '' : demoChapterTitle;
      var demoLabel = document.querySelector('.bookwriter-chapter-label');
      var demoCrumb = document.querySelector('.bookwriter-toolbar-crumb strong');
      if (demoLabel) demoLabel.innerText = 'Chapter ' + demoChapterNum.replace('.', '').trim();
      if (demoCrumb) demoCrumb.innerText = 'Chapter ' + demoChapterNum.replace('.', '').trim();
      if (prose) {
        prose.innerHTML = (demoChapterNum === initialPrimedChapterNum) ? initialPrimedProseHtml : '';
        refresh();
      }
      saveState({ chapterNum: demoChapterNum, manuscriptScrollY: 0 });
      return;
    }

    // ---------- REAL DB BRANCH ----------
    // Flush pending saves for the OLD chapter so they fire with the
    // OLD chapter_id (still on prose.dataset at this point).
    clearTimeout(saveTimeout);
    performChapterAutosave();
    clearTimeout(titleSaveTimeout);
    performChapterTitleAutosave();

    window.bookwriter.apiGet('/bookwriter/api/chapter/' + encodeURIComponent(realChapterId) + '/')
      .then(function (data) {
        applyChapterPayloadToEditor(data.chapter);
        if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>chapter loaded';
        saveState({ chapterNum: String((data.chapter || {}).number || ''), manuscriptScrollY: 0 });
      })
      .catch(function () {
        if (saveChip) {
          saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--accent);"></span>could not load chapter';
        }
      });
  }

  document.querySelectorAll('.bookwriter-chapter').forEach(function (chapterRow) {
    chapterRow.addEventListener('click', function () { switchToChapterFromRail(chapterRow); });
    attachChapterDeleteAffordance(chapterRow);
  });

  /* ========================================================
     ADD CHAPTER — POST to backend (real) or DOM-only (demo)
     --------------------------------------------------------
     Real branch: when `#chapters[data-book-id]` is present
     (logged-in user with a provisioned book), POST to the
     book/chapter create endpoint, then build a row from the
     server response and select it. The new chapter starts
     blank — the user's first keystroke triggers an autosave.

     Demo branch: anon visitor; just append a fake row so the
     marketing surface still feels interactive. ======================================================== */
  var ROMAN_NUMERAL_BY_INDEX = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];

  function attachChapterDeleteAffordance(chapterRowElement) {
    var realChapterId = chapterRowElement.dataset.chapterId;
    if (!realChapterId) return;
    if (chapterRowElement.querySelector('.bookwriter-chapter-delete-affordance')) return;

    var deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'bookwriter-chapter-delete-affordance';
    deleteButton.id = 'bookwriter-chapter-delete-' + realChapterId + '-button';
    deleteButton.name = 'bookwriter_chapter_delete_' + realChapterId + '_button';
    deleteButton.title = 'Remove chapter';
    deleteButton.setAttribute('aria-label', 'Remove chapter');
    deleteButton.textContent = '×';

    window.bookwriter.wireTwoClickConfirmDelete(deleteButton, {
      confirmingClass: 'bookwriter-confirming',
      initialTitle: 'Remove chapter',
      confirmingTitle: 'Click again to confirm',
      onConfirm: function () {
        deleteChapterById(realChapterId, chapterRowElement);
      },
    });

    chapterRowElement.appendChild(deleteButton);
  }

  function buildChapterRailRow(chapterId, chapterNumber, chapterTitle, chapterWordCount) {
    var rowElement = document.createElement('div');
    rowElement.className = 'bookwriter-chapter';
    rowElement.setAttribute('draggable', 'true');
    if (chapterId) rowElement.dataset.chapterId = String(chapterId);

    var numDiv = document.createElement('div');
    numDiv.className = 'bookwriter-ch-num';
    numDiv.textContent = (ROMAN_NUMERAL_BY_INDEX[chapterNumber - 1] || chapterNumber) + '.';

    var titleDiv = document.createElement('div');
    titleDiv.className = 'bookwriter-ch-title';
    // Use textContent (not innerHTML) so the title is treated as plain text —
    // the server already sanitized it on save, but defence-in-depth.
    titleDiv.textContent = chapterTitle || 'Untitled';

    var metaDiv = document.createElement('div');
    metaDiv.className = 'bookwriter-ch-meta';
    var metaSpan = document.createElement('span');
    var dotIcon = document.createElement('i');
    dotIcon.className = 'bookwriter-ch-dot ' + (chapterWordCount > 0 ? 'bookwriter-draft' : 'bookwriter-new');
    metaSpan.appendChild(dotIcon);
    metaSpan.appendChild(document.createTextNode((chapterWordCount || 0) + ' w'));
    metaDiv.appendChild(metaSpan);

    rowElement.appendChild(numDiv);
    rowElement.appendChild(titleDiv);
    rowElement.appendChild(metaDiv);

    rowElement.addEventListener('click', function () {
      switchToChapterFromRail(rowElement);
    });

    attachChapterDeleteAffordance(rowElement);
    return rowElement;
  }

  function addChapter() {
    var list = document.getElementById('chapters');
    if (!list) return;
    var bookId = list.dataset.bookId;

    // ---------- REAL DB BRANCH ----------
    if (bookId) {
      window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(bookId) + '/chapter/create/', {})
        .then(function (data) {
          var newChapter = data.chapter || {};
          var newRow = buildChapterRailRow(newChapter.id, newChapter.number, newChapter.title, newChapter.word_count);
          list.appendChild(newRow);
          newRow.click();
          newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          wireChapterDrag();
          updateBookStatCounters(data.book_total_word_count, data.book_total_chapter_count);
        })
        .catch(function () {
          if (saveChip) {
            saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--accent);"></span>could not create chapter';
          }
        });
      return;
    }

    // ---------- DEMO BRANCH ----------
    var demoCount = list.children.length + 1;
    var demoRow = document.createElement('div');
    demoRow.className = 'bookwriter-chapter';
    demoRow.setAttribute('draggable', 'true');
    demoRow.innerHTML =
      '<div class="bookwriter-ch-num">' + (ROMAN_NUMERAL_BY_INDEX[demoCount - 1] || demoCount) + '.</div>' +
      '<div class="bookwriter-ch-title">Untitled</div>' +
      '<div class="bookwriter-ch-meta"><span><i class="bookwriter-ch-dot bookwriter-new"></i>blank</span><span>just now</span></div>';
    list.appendChild(demoRow);
    demoRow.addEventListener('click', function () { switchToChapterFromRail(demoRow); });
    demoRow.click();
    demoRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    wireChapterDrag();
  }
  window.addChapter = addChapter;

  // window.publishFlow is defined further down — the real implementation
  // calls /api/chapter/<id>/publish/ and surfaces the public URL on the
  // button label. The earlier visual-only stub used to live here and
  // was deleted to avoid dead code.

  refresh();


  /* ========================================================
     MODE SWITCHING (5 modes — write / corkboard / bible / cover / gallery)
     ======================================================== */
  function setMode(mode) {
    var modes = ['write', 'corkboard', 'bible', 'cover', 'gallery'];
    modes.forEach(function (m) { document.body.classList.remove('mode-' + m); });
    if (mode !== 'write') document.body.classList.add('mode-' + mode);

    document.querySelectorAll('.bookwriter-mode-switch').forEach(function (modeSwitcherElement) {
      modeSwitcherElement.querySelectorAll('.bookwriter-mode-btn').forEach(function (modeButtonElement) {
        var onclickAttribute = modeButtonElement.getAttribute('onclick') || '';
        var setModeMatch = onclickAttribute.match(/setMode\('(\w+)'\)/);
        var buttonModeCode = setModeMatch ? setModeMatch[1] : null;
        modeButtonElement.classList.toggle('bookwriter-active', buttonModeCode === mode);
      });
    });

    saveState({ mode: mode });
  }
  window.setMode = setMode;


  /* ========================================================
     COVER DESIGNER
     ======================================================== */
  var cover     = document.getElementById('cover');
  var coverArt  = document.getElementById('coverArt');
  var cvTitle   = document.getElementById('cvTitle');
  var cvAuthor  = document.getElementById('cvAuthor');
  var inTitle   = document.getElementById('inTitle');
  var inSubtitle = document.getElementById('inSubtitle');
  var inAuthor  = document.getElementById('inAuthor');
  var titleSize = document.getElementById('titleSize');
  var tracking  = document.getElementById('tracking');
  var sizeVal   = document.getElementById('sizeVal');
  var trackVal  = document.getElementById('trackVal');

  var currentStyle   = 'classical';
  var currentPalette = { bg: '#f4ede0', fg: '#1a1612', accent: '#8b2a1f' };
  var currentBg      = 'solid';
  var zoom           = 100;

  if (inTitle) {
    inTitle.addEventListener('input', function () {
      if (cvTitle) cvTitle.innerText = inTitle.value || 'Untitled';
    });
  }
  if (inAuthor) {
    inAuthor.addEventListener('input', function () {
      if (cvAuthor) cvAuthor.innerText = inAuthor.value || 'Anonymous';
    });
  }
  if (inSubtitle) {
    inSubtitle.addEventListener('input', function () {
      var existing = document.querySelector('.bookwriter-cv-subtitle');
      if (inSubtitle.value.trim()) {
        if (existing) {
          existing.innerText = inSubtitle.value;
        } else if (cvTitle) {
          var subtitleElement = document.createElement('div');
          subtitleElement.className = 'bookwriter-cv-subtitle';
          subtitleElement.style.cssText = "font-family: 'EB Garamond', serif; font-style: italic; font-size: 14px; margin-top: 10px; opacity: 0.8;";
          subtitleElement.innerText = inSubtitle.value;
          cvTitle.insertAdjacentElement('afterend', subtitleElement);
        }
      } else if (existing) {
        existing.remove();
      }
    });
  }

  // Template switching
  document.querySelectorAll('.bookwriter-cover-template-tile').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-cover-template-tile').forEach(function (x) { x.classList.remove('bookwriter-active'); });
      t.classList.add('bookwriter-active');
      currentStyle = t.dataset.style;
      if (cover) cover.dataset.style = currentStyle;
      applyBackground();
    });
  });

  // Font switching
  document.querySelectorAll('#fontPick button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('#fontPick button').forEach(function (x) { x.classList.remove('bookwriter-active'); });
      b.classList.add('bookwriter-active');
      if (cover) {
        cover.classList.remove('bookwriter-font-serif', 'bookwriter-font-italic', 'bookwriter-font-body', 'bookwriter-font-mono');
        cover.classList.add('font-' + b.dataset.font);
      }
    });
  });

  if (titleSize) {
    titleSize.addEventListener('input', function () {
      if (cvTitle) cvTitle.style.fontSize = titleSize.value + 'px';
      if (sizeVal) sizeVal.textContent    = titleSize.value + 'pt';
    });
  }
  if (tracking) {
    tracking.addEventListener('input', function () {
      var letterSpacingEmValue = tracking.value / 100;
      if (cvTitle)  cvTitle.style.letterSpacing = letterSpacingEmValue + 'em';
      if (trackVal) trackVal.textContent = (tracking.value > 0 ? '+' : '') + tracking.value;
    });
  }

  // Palette switching
  document.querySelectorAll('.bookwriter-cover-palette-tile').forEach(function (p) {
    p.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-cover-palette-tile').forEach(function (x) { x.classList.remove('bookwriter-active'); });
      p.classList.add('bookwriter-active');
      currentPalette = {
        bg:     p.dataset.bg,
        fg:     p.dataset.fg,
        accent: p.dataset.accent
      };
      if (cover) cover.style.color = currentPalette.fg;
      applyBackground();
    });
  });

  // Background switching
  document.querySelectorAll('.bookwriter-bg-opt').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.bg === 'upload') {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function (e) {
          var file = e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            document.querySelectorAll('.bookwriter-bg-opt').forEach(function (x) { x.classList.remove('bookwriter-active'); });
            b.classList.add('bookwriter-active');
            currentBg = 'upload';
            if (cover)    cover.style.background    = 'url(' + ev.target.result + ') center/cover, ' + currentPalette.bg;
            if (coverArt) coverArt.style.background = 'linear-gradient(transparent 40%, rgba(0,0,0,0.55))';
          };
          reader.readAsDataURL(file);
        };
        input.click();
        return;
      }
      document.querySelectorAll('.bookwriter-bg-opt').forEach(function (x) { x.classList.remove('bookwriter-active'); });
      b.classList.add('bookwriter-active');
      currentBg = b.dataset.bg;
      applyBackground();
    });
  });

  function applyBackground() {
    if (!cover) return;
    cover.style.background = currentPalette.bg;
    if (coverArt) coverArt.style.background = '';

    if (currentStyle === 'photo' && coverArt) {
      cover.style.background = currentPalette.bg;
      coverArt.style.background =
        'linear-gradient(transparent 30%, rgba(0,0,0,0.55) 100%),' +
        'radial-gradient(ellipse at 30% 20%, ' + hexWithAlpha(currentPalette.accent, 0.3) + ', transparent 60%),' +
        'linear-gradient(165deg, ' + currentPalette.fg + ' 0%, ' + currentPalette.accent + ' 60%, ' + currentPalette.bg + ' 100%)';
      return;
    }

    switch (currentBg) {
      case 'solid':
        cover.style.background = currentPalette.bg;
        break;
      case 'grad-1':
        cover.style.background = 'linear-gradient(135deg, ' + currentPalette.bg + ', ' + currentPalette.accent + ')';
        break;
      case 'grad-2':
        cover.style.background = 'linear-gradient(165deg, ' + currentPalette.fg + ', ' + currentPalette.bg + ')';
        break;
      case 'grad-3':
        cover.style.background = 'linear-gradient(135deg, ' + currentPalette.fg + ', ' + shade(currentPalette.fg, 20) + ')';
        break;
      case 'noise':
        cover.style.background = currentPalette.bg;
        if (coverArt) {
          coverArt.style.background = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='3'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/></svg>\")";
          coverArt.style.mixBlendMode = 'multiply';
        }
        break;
      case 'dots':
        cover.style.background = 'radial-gradient(' + currentPalette.fg + ' 1.5px, transparent 1.5px) 0 0 / 18px 18px, ' + currentPalette.bg;
        break;
      case 'stripes':
        cover.style.background = 'repeating-linear-gradient(45deg, ' + currentPalette.accent + ', ' + currentPalette.accent + ' 6px, ' + currentPalette.bg + ' 6px, ' + currentPalette.bg + ' 18px)';
        break;
    }
  }

  function hexWithAlpha(hex, alpha) {
    var redChannel   = parseInt(hex.slice(1, 3), 16);
    var greenChannel = parseInt(hex.slice(3, 5), 16);
    var blueChannel  = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + redChannel + ',' + greenChannel + ',' + blueChannel + ',' + alpha + ')';
  }

  function shade(hex, amount) {
    var redChannel   = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    var greenChannel = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    var blueChannel  = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return 'rgb(' + redChannel + ',' + greenChannel + ',' + blueChannel + ')';
  }

  function zoomCover(delta) {
    if (!cover) return;
    zoom = Math.max(60, Math.min(160, zoom + delta));
    var zoomLabelElement = document.getElementById('zoomLabel');
    if (zoomLabelElement) zoomLabelElement.textContent = zoom + '%';
    cover.style.width = (340 * zoom / 100) + 'px';
  }
  window.zoomCover = zoomCover;

  function flipCover() {
    if (!cover) return;
    cover.style.transform = cover.style.transform.indexOf('rotateY(6deg)') !== -1
      ? 'perspective(2000px) rotateY(-6deg)'
      : 'perspective(2000px) rotateY(6deg)';
  }
  window.flipCover = flipCover;

  // window.setAsCover is defined further down — the real implementation
  // POSTs to /api/book/<id>/cover-design/save/ and reflects success on
  // the button label. The earlier visual-only stub was removed to avoid
  // dead code.

  document.querySelectorAll('.bookwriter-history-item').forEach(function (h) {
    h.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-history-item').forEach(function (x) { x.classList.remove('bookwriter-current'); });
      h.classList.add('bookwriter-current');
    });
  });


  /* ========================================================
     FOCUS MODE
     ======================================================== */
  var focusTitle   = document.getElementById('focusTitle');
  var focusText    = document.getElementById('focusText');
  var focusWordsEl = document.getElementById('focusWords');
  var focusTimeEl  = document.getElementById('focusTime');
  var focusStart   = 0;
  var focusTimer   = null;

  function enterFocus() {
    if (!focusTitle || !focusText) return;
    focusTitle.innerText = title ? (title.innerText || 'Untitled') : '';
    focusText.innerHTML  = prose ? prose.innerHTML : '';
    document.body.classList.add('bookwriter-focus-on');
    focusStart = Date.now();
    focusTimer = setInterval(updateFocusStats, 1000);
    updateFocusStats();
    setTimeout(function () { focusText.focus(); }, 100);
  }
  window.enterFocus = enterFocus;

  function exitFocus() {
    if (!focusTitle || !focusText) return;
    if (title) title.innerText = focusTitle.innerText;
    if (prose) prose.innerHTML = focusText.innerHTML;
    document.body.classList.remove('bookwriter-focus-on');
    clearInterval(focusTimer);
    refresh();
    scheduleChapterAutosave();
  }
  window.exitFocus = exitFocus;

  function updateFocusStats() {
    if (!focusText) return;
    var wordCount = (focusText.innerText.trim().match(/\S+/g) || []).length;
    if (focusWordsEl) focusWordsEl.textContent = wordCount.toLocaleString();
    if (focusTimeEl) {
      var elapsedSeconds = Math.floor((Date.now() - focusStart) / 1000);
      var minutesPart = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
      var secondsPart = String(elapsedSeconds % 60).padStart(2, '0');
      focusTimeEl.textContent = minutesPart + ':' + secondsPart;
    }
  }

  if (focusText) focusText.addEventListener('input', updateFocusStats);

  // ESC closes focus / modal / snapshots / sprint setup (in priority)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('bookwriter-focus-on'))             return exitFocus();
    if (document.body.classList.contains('bookwriter-modal-open'))           return closeShare();
    if (document.body.classList.contains('bookwriter-snapshots-open'))       return toggleSnapshots();
    if (document.body.classList.contains('bookwriter-sprint-setup-open'))    document.body.classList.remove('bookwriter-sprint-setup-open');
  });


  /* ========================================================
     SNAPSHOTS / VERSION HISTORY
     ======================================================== */
  /* When the user opens the snapshot panel for a real DB chapter,
     replace the hardcoded demo list with real history pulled from
     /api/chapter/<id>/snapshots/. The list is rebuilt on every open
     (cheap call, snapshots are short rows) so it always reflects
     the latest auto- and manual-snapshots. */
  function toggleSnapshots() {
    var wasClosed = !document.body.classList.contains('bookwriter-snapshots-open');
    document.body.classList.toggle('bookwriter-snapshots-open');
    if (wasClosed) loadSnapshotHistoryFromBackend();
  }
  window.toggleSnapshots = toggleSnapshots;

  function loadSnapshotHistoryFromBackend() {
    if (!prose) return;
    var chapterId = prose.dataset.chapterId;
    if (!chapterId) return;  // anon demo — keep hardcoded panel
    var snapshotListContainer = document.querySelector('.bookwriter-snapshot-list');
    if (!snapshotListContainer) return;

    window.bookwriter.apiGet('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/snapshots/')
      .then(function (data) {
        renderSnapshotHistoryRows(snapshotListContainer, data.snapshots || []);
      })
      .catch(function () { /* leave the existing rows in place */ });
  }

  function renderSnapshotHistoryRows(snapshotListContainer, snapshotRows) {
    snapshotListContainer.innerHTML = '';
    if (snapshotRows.length === 0) {
      var emptyStateRow = document.createElement('div');
      emptyStateRow.className = 'snap';
      var emptyLabel = document.createElement('div');
      emptyLabel.className = 'snap-label';
      emptyLabel.textContent = 'No snapshots yet — type to start writing, or click "Name this version" below.';
      emptyStateRow.appendChild(emptyLabel);
      snapshotListContainer.appendChild(emptyStateRow);
      return;
    }
    snapshotRows.forEach(function (snapshotRow, rowIndex) {
      var rowElement = document.createElement('div');
      rowElement.className = 'snap' + (rowIndex === 0 ? ' bookwriter-current' : '');
      rowElement.dataset.snapshotId = String(snapshotRow.id);

      var timeStampElement = document.createElement('div');
      timeStampElement.className = 'snap-time';
      timeStampElement.textContent = formatSnapshotTimestamp(snapshotRow.created_at);

      var labelElement = document.createElement('div');
      labelElement.className = 'snap-label';
      labelElement.textContent = snapshotRow.label
        || (snapshotRow.kind === 'manual' ? 'Named version' : 'Auto-saved');

      var metaElement = document.createElement('div');
      metaElement.className = 'snap-meta';
      metaElement.textContent = (snapshotRow.word_count || 0).toLocaleString() + ' words · ' + snapshotRow.kind;

      rowElement.appendChild(timeStampElement);
      rowElement.appendChild(labelElement);
      rowElement.appendChild(metaElement);

      if (snapshotRow.word_count_diff !== null && snapshotRow.word_count_diff !== undefined) {
        var diffElement = document.createElement('span');
        diffElement.className = 'snap-diff ' + (snapshotRow.word_count_diff >= 0 ? 'bookwriter-plus' : 'bookwriter-minus');
        var sign = snapshotRow.word_count_diff > 0 ? '+' : (snapshotRow.word_count_diff === 0 ? '±' : '−');
        diffElement.textContent = sign + Math.abs(snapshotRow.word_count_diff) + ' words';
        rowElement.appendChild(diffElement);
      }

      rowElement.addEventListener('click', function () {
        snapshotListContainer.querySelectorAll('.bookwriter-snapshot-row').forEach(function (otherRow) {
          otherRow.classList.remove('bookwriter-current');
        });
        rowElement.classList.add('bookwriter-current');
      });

      snapshotListContainer.appendChild(rowElement);
    });
  }

  function formatSnapshotTimestamp(isoTimestamp) {
    if (!isoTimestamp) return '';
    var asDate = new Date(isoTimestamp);
    if (isNaN(asDate.getTime())) return isoTimestamp;
    var hoursPart = String(asDate.getHours()).padStart(2, '0');
    var minutesPart = String(asDate.getMinutes()).padStart(2, '0');
    var dayMs = 24 * 60 * 60 * 1000;
    var startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    var deltaDays = Math.floor((startOfToday.getTime() - asDate.getTime()) / dayMs);
    if (deltaDays <= 0)  return 'Today · ' + hoursPart + ':' + minutesPart;
    if (deltaDays === 1) return 'Yesterday · ' + hoursPart + ':' + minutesPart;
    return deltaDays + ' days ago · ' + hoursPart + ':' + minutesPart;
  }

  /* Manual-snapshot create + revert wired to the existing
     snap-actions buttons. Selected row = .snap.current. */
  function createManualSnapshot() {
    if (!prose) return;
    var chapterId = prose.dataset.chapterId;
    if (!chapterId) return;
    var snapshotLabel = window.prompt
      ? null  // we deliberately do NOT use window.prompt — placeholder for future inline label input
      : null;
    window.bookwriter.apiPost('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/snapshot/', { snapshot_kind_code: 'manual', snapshot_label: snapshotLabel })
      .then(function () { loadSnapshotHistoryFromBackend(); })
      .catch(function () {
        if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--accent);"></span>snapshot failed';
      });
  }
  window.createManualSnapshot = createManualSnapshot;

  function revertToSelectedSnapshot() {
    if (!prose) return;
    var chapterId = prose.dataset.chapterId;
    if (!chapterId) return;
    var selectedSnapshotRow = document.querySelector('.bookwriter-snapshot-list .snap.current[data-snapshot-id]');
    if (!selectedSnapshotRow) return;
    var snapshotId = selectedSnapshotRow.dataset.snapshotId;
    window.bookwriter.apiPost('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/snapshot/' + encodeURIComponent(snapshotId) + '/revert/', {})
      .then(function (data) {
        if (data.chapter && prose) {
          prose.innerHTML = data.chapter.html || '';
          if (title) title.innerText = data.chapter.title || '';
          refresh();
        }
        updateBookStatCounters(data.book_total_word_count, data.book_total_chapter_count);
        document.body.classList.remove('bookwriter-snapshots-open');
        if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>reverted to snapshot';
      })
      .catch(function () {
        if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--accent);"></span>revert failed';
      });
  }
  window.revertToSelectedSnapshot = revertToSelectedSnapshot;


  /* ========================================================
     DRAG-REORDER CHAPTERS
     ======================================================== */
  var draggedEl = null;

  function wireChapterDrag() {
    document.querySelectorAll('.bookwriter-chapter[draggable="true"]').forEach(function (ch) {
      // Remove old listeners by cloning if already wired
      if (ch.dataset.dragWired === '1') return;
      ch.dataset.dragWired = '1';

      ch.addEventListener('dragstart', function (e) {
        draggedEl = ch;
        ch.classList.add('bookwriter-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      ch.addEventListener('dragend', function () {
        ch.classList.remove('bookwriter-dragging');
        document.querySelectorAll('.bookwriter-chapter').forEach(function (c) { c.classList.remove('bookwriter-drag-over'); });
      });

      ch.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (draggedEl !== ch) ch.classList.add('bookwriter-drag-over');
      });

      ch.addEventListener('dragleave', function () {
        ch.classList.remove('bookwriter-drag-over');
      });

      ch.addEventListener('drop', function (e) {
        e.preventDefault();
        if (draggedEl && draggedEl !== ch) {
          var parentList = ch.parentNode;
          var listItems  = Array.prototype.slice.call(parentList.children);
          var fromIndex = listItems.indexOf(draggedEl);
          var toIndex   = listItems.indexOf(ch);
          if (fromIndex < toIndex) parentList.insertBefore(draggedEl, ch.nextSibling);
          else                     parentList.insertBefore(draggedEl, ch);
          renumberChapters();
          persistChapterReorder();
        }
        ch.classList.remove('bookwriter-drag-over');
      });
    });
  }

  function renumberChapters() {
    var roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
    document.querySelectorAll('#chapters .bookwriter-chapter').forEach(function (chapterRow, rowIndex) {
      var chapterNumberElement = chapterRow.querySelector('.bookwriter-ch-num');
      if (chapterNumberElement) chapterNumberElement.innerText = (roman[rowIndex] || (rowIndex + 1)) + '.';
    });
  }

  /* Persist the new chapter order to the backend after a drag-drop.
     Only fires for real (DB-backed) books — anon demo skips. The
     endpoint validates that the id list matches current active
     chapters exactly, so partial reorders are rejected server-side. */
  function persistChapterReorder() {
    var chaptersListElement = document.getElementById('chapters');
    if (!chaptersListElement) return;
    var bookId = chaptersListElement.dataset.bookId;
    if (!bookId) return;

    var orderedChapterIds = [];
    chaptersListElement.querySelectorAll('.bookwriter-chapter').forEach(function (chapterRow) {
      var realChapterId = chapterRow.dataset.chapterId;
      if (realChapterId) orderedChapterIds.push(parseInt(realChapterId, 10));
    });
    if (orderedChapterIds.length === 0) return;

    window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(bookId) + '/chapters/reorder/', { chapter_ids: orderedChapterIds })
      .then(function () {
        if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>order saved';
      })
      .catch(function () {
        if (saveChip) {
          saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--accent);"></span>order save failed';
        }
      });
  }

  /* Update the right-rail "book stats" counters after any save that
     returned new totals. No-op on the anon demo (those elements only
     exist in the logged-in render). */
  function updateBookStatCounters(bookTotalWordCount, bookTotalChapterCount) {
    if (typeof bookTotalWordCount === 'number') {
      var wordCountElement = document.getElementById('bookwriter-book-word-count');
      if (wordCountElement) wordCountElement.textContent = bookTotalWordCount.toLocaleString();
    }
    if (typeof bookTotalChapterCount === 'number') {
      var chapterCountElement = document.getElementById('bookwriter-book-chapter-count');
      if (chapterCountElement) chapterCountElement.textContent = bookTotalChapterCount.toLocaleString();
    }
  }

  wireChapterDrag();


  /* ========================================================
     BIBLE — switching between entries / categories
     ======================================================== */
  document.querySelectorAll('.bookwriter-bible-item').forEach(function (item) {
    item.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-bible-item').forEach(function (x) { x.classList.remove('bookwriter-active'); });
      item.classList.add('bookwriter-active');

      var name   = item.querySelector('.bookwriter-b-name') ? item.querySelector('.bookwriter-b-name').innerText : '';
      var role   = item.querySelector('.bookwriter-b-role') ? item.querySelector('.bookwriter-b-role').innerText : '';
      var avatar = item.querySelector('.bookwriter-bible-avatar');
      var hero   = document.querySelector('.bookwriter-bible-hero');
      if (!hero) return;

      var heroH1   = hero.querySelector('h1');
      var heroRole = hero.querySelector('.bookwriter-role-edit');
      var portrait = hero.querySelector('.bookwriter-bible-portrait');
      if (heroH1)   heroH1.innerText   = name;
      if (heroRole) heroRole.innerText = role;
      if (portrait && avatar) {
        portrait.innerText = avatar.innerText;
        // Mirror the two custom-property hex values from the avatar to the
        // portrait. The CSS rule on .bookwriter-bible-avatar / -portrait
        // builds the actual gradient from these. Empty values let the CSS
        // fall back to the design tokens.
        var hex1 = avatar.style.getPropertyValue('--bookwriter-bible-avatar-hex-1');
        var hex2 = avatar.style.getPropertyValue('--bookwriter-bible-avatar-hex-2');
        portrait.style.setProperty('--bookwriter-bible-avatar-hex-1', hex1);
        portrait.style.setProperty('--bookwriter-bible-avatar-hex-2', hex2);
      }
    });
  });

  document.querySelectorAll('.bookwriter-bible-cat').forEach(function (cat) {
    cat.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-bible-cat').forEach(function (x) { x.classList.remove('bookwriter-active'); });
      cat.classList.add('bookwriter-active');
    });
  });


  /* ========================================================
     SPRINT TIMER (Pomodoro)
     ======================================================== */
  var sprintDuration  = 25 * 60;
  var sprintRemaining = sprintDuration;
  var sprintInterval  = null;
  var sprintPaused    = false;

  function openSprintSetup() {
    document.body.classList.toggle('bookwriter-sprint-setup-open');
  }
  window.openSprintSetup = openSprintSetup;

  document.querySelectorAll('.bookwriter-sprint-opt').forEach(function (opt) {
    opt.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-sprint-opt').forEach(function (x) { x.classList.remove('bookwriter-active'); });
      opt.classList.add('bookwriter-active');
      sprintDuration = parseInt(opt.dataset.min, 10) * 60;
    });
  });

  /* Sprint persistence — POST /api/sprint/start/ on begin and
     POST /api/sprint/<id>/finish/ on end. Both are best-effort: if
     the server is unreachable, the visual timer still works locally,
     and the row simply doesn't get logged. The active sprint row id
     + word-count-at-start are kept in module-scoped variables so the
     finish call can compute words_added and the actual seconds. */
  var activeSprintSessionId = null;
  var sprintWordCountAtStart = 0;

  function startSprint() {
    document.body.classList.remove('bookwriter-sprint-setup-open');
    document.body.classList.add('bookwriter-sprint-on');
    sprintRemaining = sprintDuration;
    sprintPaused    = false;
    sprintWordCountAtStart = countWords(prose);
    var pauseBtn = document.getElementById('sprintPause');
    if (pauseBtn) pauseBtn.innerText = 'pause';
    renderSprint();
    clearInterval(sprintInterval);
    sprintInterval = setInterval(function () {
      if (!sprintPaused) {
        sprintRemaining--;
        renderSprint();
        if (sprintRemaining <= 0) {
          clearInterval(sprintInterval);
          var clock = document.getElementById('sprintClock');
          if (clock) clock.innerText = 'Done!';
          setTimeout(function () { endSprint(true); }, 3000);
        }
      }
    }, 1000);

    // Best-effort backend logging — don't gate the timer on it.
    var chaptersList = document.getElementById('chapters');
    var bookId = chaptersList ? chaptersList.dataset.bookId : null;
    var chapterIdString = prose ? prose.dataset.chapterId : null;
    if (!bookId) return;
    window.bookwriter.apiPost('/bookwriter/api/sprint/start/', {
      planned_minutes: Math.max(1, Math.round(sprintDuration / 60)),
      book_id: parseInt(bookId, 10),
      chapter_id: chapterIdString ? parseInt(chapterIdString, 10) : null,
    })
      .then(function (data) { activeSprintSessionId = data.sprint_session_id || null; })
      .catch(function () { activeSprintSessionId = null; });
  }
  window.startSprint = startSprint;

  function renderSprint() {
    var sprintClockElement = document.getElementById('sprintClock');
    if (!sprintClockElement) return;
    var minutesRemaining = Math.floor(sprintRemaining / 60);
    var secondsRemaining = sprintRemaining % 60;
    sprintClockElement.innerText = String(minutesRemaining).padStart(2, '0') + ':' + String(secondsRemaining).padStart(2, '0');
  }

  function pauseSprint() {
    sprintPaused = !sprintPaused;
    var pauseBtn = document.getElementById('sprintPause');
    if (pauseBtn) pauseBtn.innerText = sprintPaused ? 'resume' : 'pause';
  }
  window.pauseSprint = pauseSprint;

  function endSprint(naturalCompletion) {
    clearInterval(sprintInterval);
    document.body.classList.remove('bookwriter-sprint-on');

    // Finish the backend row if we managed to start one.
    if (!activeSprintSessionId) return;
    var sprintIdToFinish = activeSprintSessionId;
    activeSprintSessionId = null;
    var actualSeconds = Math.max(0, sprintDuration - Math.max(0, sprintRemaining));
    var wordsAdded = Math.max(0, countWords(prose) - sprintWordCountAtStart);
    window.bookwriter.apiPost('/bookwriter/api/sprint/' + encodeURIComponent(sprintIdToFinish) + '/finish/', {
        completed: !!naturalCompletion,
        actual_seconds: actualSeconds,
        words_added: wordsAdded,
      }).catch(function () { /* fire-and-forget — sprint already over for the user */ });
  }
  window.endSprint = function () { endSprint(false); };


  /* ========================================================
     BETA SHARE MODAL
     ======================================================== */
  function openShare()  { document.body.classList.add('bookwriter-modal-open'); }
  function closeShare() { document.body.classList.remove('bookwriter-modal-open'); }
  window.openShare  = openShare;
  window.closeShare = closeShare;

  function pickPerm(el) {
    document.querySelectorAll('.bookwriter-share-permission-tile').forEach(function (p) { p.classList.remove('bookwriter-active'); });
    el.classList.add('bookwriter-active');
  }
  window.pickPerm = pickPerm;

  function copyShareLink(btn) {
    var link = document.getElementById('shareLink');
    if (!link) return;
    link.select();
    try { navigator.clipboard.writeText(link.value); } catch (e) { /* clipboard blocked */ }
    var sourceBtn = btn || (typeof event !== 'undefined' ? event.target : null);
    if (!sourceBtn) return;
    var orig = sourceBtn.innerText;
    sourceBtn.innerText = 'Copied ✓';
    sourceBtn.style.background = 'var(--moss)';
    setTimeout(function () {
      sourceBtn.innerText = orig;
      sourceBtn.style.background = '';
    }, 1500);
  }
  window.copyShareLink = copyShareLink;

  function copyToClipboard(btn) {
    var input = btn.previousElementSibling;
    if (!input) return;
    try { navigator.clipboard.writeText(input.value); } catch (e) { /* clipboard blocked */ }
    var orig = btn.innerText;
    btn.innerText = 'copied ✓';
    setTimeout(function () { btn.innerText = orig; }, 1500);
  }
  window.copyToClipboard = copyToClipboard;


  /* ========================================================
     CORKBOARD — add card / inline-edit autosave / delete
     --------------------------------------------------------
     Every card is contenteditable on .bookwriter-card-title, .bookwriter-card-body,
     and .bookwriter-card-tag (data-card-field on each tells the autosave
     which DB column to write). Cards with data-plot-card-id are
     real DB rows; cards without it are anon-demo cosmetic.

     Save cadence mirrors the chapter autosave: 800ms debounce
     per card, idempotent endpoint, fail-soft on network error. ======================================================== */
  var PLOT_CARD_AUTOSAVE_DEBOUNCE_MS = 800;
  var plotCardSaveTimers = {};   // { plotCardId: timeoutHandle }

  function buildPlotCardSceneNumberLabel(sceneNumber) {
    var padded = String(sceneNumber || 1).padStart(2, '0');
    return 'Scene · ' + padded;
  }

  function buildPlotCardElement(plotCardId, sceneNumber, cardTitle, cardBody, cardTag) {
    var rowElement = document.createElement('div');
    rowElement.className = 'bookwriter-index-card';
    if (plotCardId) rowElement.dataset.plotCardId = String(plotCardId);

    var numElement = document.createElement('div');
    numElement.className = 'bookwriter-card-num';
    numElement.textContent = buildPlotCardSceneNumberLabel(sceneNumber);

    var titleElement = document.createElement('div');
    titleElement.className = 'bookwriter-card-title';
    titleElement.contentEditable = 'true';
    titleElement.spellcheck = false;
    titleElement.dataset.cardField = 'card_title';
    titleElement.textContent = cardTitle || '';

    var bodyElement = document.createElement('div');
    bodyElement.className = (cardBody && cardBody.trim()) ? 'bookwriter-card-body' : 'card-body card-body-placeholder';
    bodyElement.contentEditable = 'true';
    bodyElement.spellcheck = false;
    bodyElement.dataset.cardField = 'card_body';
    bodyElement.textContent = cardBody || 'Click to describe what happens…';

    var tagElement = document.createElement('div');
    tagElement.className = 'bookwriter-card-tag';
    tagElement.contentEditable = 'true';
    tagElement.spellcheck = false;
    tagElement.dataset.cardField = 'card_tag';
    tagElement.textContent = cardTag || 'unplaced';

    rowElement.appendChild(numElement);
    rowElement.appendChild(titleElement);
    rowElement.appendChild(bodyElement);
    rowElement.appendChild(tagElement);

    wirePlotCardEditing(rowElement);
    return rowElement;
  }

  function schedulePlotCardSave(rowElement, fieldName, fieldValue) {
    var plotCardId = rowElement.dataset.plotCardId;
    if (!plotCardId) return;  // anon demo card — no DB row
    if (plotCardSaveTimers[plotCardId]) clearTimeout(plotCardSaveTimers[plotCardId]);
    plotCardSaveTimers[plotCardId] = setTimeout(function () {
      var payload = {};
      payload[fieldName] = fieldValue;
      window.bookwriter.apiPost('/bookwriter/api/plot-card/' + encodeURIComponent(plotCardId) + '/save/', payload)
        .catch(function () { /* fire-and-forget; next keystroke retries */ });
    }, PLOT_CARD_AUTOSAVE_DEBOUNCE_MS);
  }

  function wirePlotCardEditing(rowElement) {
    if (rowElement.dataset.editingWired === '1') return;
    rowElement.dataset.editingWired = '1';

    rowElement.querySelectorAll('[data-card-field]').forEach(function (editableField) {
      editableField.addEventListener('input', function () {
        var fieldName = editableField.dataset.cardField;
        // Clear placeholder class once the user types in the body.
        if (fieldName === 'card_body') {
          editableField.classList.remove('bookwriter-card-body-placeholder');
        }
        schedulePlotCardSave(rowElement, fieldName, editableField.innerText || '');
      });
    });

    // Delete affordance — only for real DB cards.
    var realPlotCardId = rowElement.dataset.plotCardId;
    if (!realPlotCardId) return;
    if (rowElement.querySelector('.bookwriter-plot-card-delete-affordance')) return;

    var deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'bookwriter-plot-card-delete-affordance';
    deleteButton.id = 'bookwriter-plot-card-delete-' + realPlotCardId + '-button';
    deleteButton.name = 'bookwriter_plot_card_delete_' + realPlotCardId + '_button';
    deleteButton.title = 'Remove card';
    deleteButton.setAttribute('aria-label', 'Remove card');
    deleteButton.textContent = '×';

    window.bookwriter.wireTwoClickConfirmDelete(deleteButton, {
      confirmingClass: 'bookwriter-confirming',
      onConfirm: function () {
        window.bookwriter.apiDelete('/bookwriter/api/plot-card/' + encodeURIComponent(realPlotCardId) + '/delete/')
          .then(function () {
            rowElement.parentNode.removeChild(rowElement);
          })
          .catch(function () { /* leave the row in place */ });
      },
    });

    rowElement.appendChild(deleteButton);
  }

  function addIndexCard() {
    var corkboardElement = document.getElementById('corkboard');
    if (!corkboardElement) return;
    var chaptersList = document.getElementById('chapters');
    var bookId = chaptersList ? chaptersList.dataset.bookId : null;

    // ---------- REAL DB BRANCH ----------
    if (bookId) {
      window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(bookId) + '/plot-card/create/', {})
        .then(function (data) {
          var newCard = data.plot_card || {};
          var newRow = buildPlotCardElement(newCard.id, newCard.scene_number, newCard.title, newCard.body, newCard.tag);
          // Drop any "empty corkboard" placeholder before appending the real card.
          var emptyState = corkboardElement.querySelector('.bookwriter-index-card-empty-state');
          if (emptyState) emptyState.parentNode.removeChild(emptyState);
          corkboardElement.appendChild(newRow);
          newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          setTimeout(function () {
            var titleField = newRow.querySelector('.bookwriter-card-title');
            if (titleField) titleField.focus();
          }, 200);
        })
        .catch(function () { /* silent — user can click + new card again */ });
      return;
    }

    // ---------- ANON DEMO BRANCH ----------
    var nextSceneNumber = corkboardElement.children.length + 1;
    var demoRow = document.createElement('div');
    demoRow.className = 'bookwriter-index-card';
    demoRow.innerHTML =
      '<div class="bookwriter-card-num">' + buildPlotCardSceneNumberLabel(nextSceneNumber) + '</div>' +
      '<div class="bookwriter-card-title" contenteditable="true" spellcheck="false">New scene</div>' +
      '<div class="bookwriter-card-body bookwriter-card-body-placeholder" contenteditable="true" spellcheck="false">Click to describe what happens…</div>' +
      '<div class="bookwriter-card-tag" contenteditable="true" spellcheck="false">unplaced</div>';
    corkboardElement.appendChild(demoRow);
    demoRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(function () {
      var titleField = demoRow.querySelector('.bookwriter-card-title');
      if (titleField) titleField.focus();
    }, 200);
  }
  window.addIndexCard = addIndexCard;

  // Wire editing on every server-rendered plot card on first paint.
  document.querySelectorAll('#corkboard .bookwriter-index-card').forEach(wirePlotCardEditing);

  /* Plot card chapter promote — change handler delegated on #corkboard. */
  var corkboardForChapterSelect = document.getElementById('corkboard');
  if (corkboardForChapterSelect) {
    corkboardForChapterSelect.addEventListener('change', function (changeEvent) {
      var changedSelect = changeEvent.target;
      if (!changedSelect || !changedSelect.matches('.bookwriter-plot-card-chapter-select')) return;
      var targetPlotCardId = changedSelect.dataset.targetPlotCardId;
      if (!targetPlotCardId) return;
      var rawChapterId = changedSelect.value;
      var nextChapterIdValue = rawChapterId === '' ? null : parseInt(rawChapterId, 10);
      if (nextChapterIdValue !== null && Number.isNaN(nextChapterIdValue)) return;
      window.bookwriter.apiPost('/bookwriter/api/plot-card/' + encodeURIComponent(targetPlotCardId) + '/link-chapter/', { chapter_id: nextChapterIdValue })
        .then(function () {
          var cardElement = changedSelect.closest('.bookwriter-index-card');
          if (cardElement) cardElement.dataset.linkedChapterId = rawChapterId;
        })
        .catch(function () {
          // Revert select to the previous value
          var cardElement = changedSelect.closest('.bookwriter-index-card');
          if (cardElement && cardElement.dataset.linkedChapterId !== undefined) {
            changedSelect.value = cardElement.dataset.linkedChapterId || '';
          }
        });
    });
  }


  /* ========================================================
     BIBLE VIEW — worldbuilding notebook (Phase 1B Step 8)
     --------------------------------------------------------
     Three columns inside `.bible-view`:

       1. `.bible-rail`   — categories (server-rendered, click to filter
                             the middle list).
       2. `.bible-list`   — entry rows for the active category, +Add
                             button at the bottom.
       3. `.bible-detail` — the open entry, contenteditable name / role /
                             tags / biography / notes — debounced autosave
                             per field, mirrors the chapter pattern.

     Hydration: server renders ALL entries server-side (filtered to
     `display:none` on first paint based on active category) AND
     stashes the full set as JSON in `#bookwriter-bible-entries-data`
     so detail-pane swaps don't need a network round-trip.
  ======================================================== */
  var BIBLE_AUTOSAVE_DEBOUNCE_MS = 800;
  var bibleEntriesById = {};
  var bibleEntrySaveTimers = {};   // { bibleEntryId: timeoutHandle }
  var bibleViewElement = document.querySelector('.bookwriter-bible-view');
  var bibleBookId = bibleViewElement ? bibleViewElement.dataset.bookId : null;

  function loadBibleEntriesFromIsland() {
    var islandElement = document.getElementById('bookwriter-bible-entries-data');
    if (!islandElement) return;
    try {
      var entryRows = JSON.parse(islandElement.textContent);
      if (!Array.isArray(entryRows)) return;
      entryRows.forEach(function (entryRow) {
        bibleEntriesById[entryRow.bookwriter_bible_entry_id] = entryRow;
      });
    } catch (parseError) {
      // Malformed island — treat as empty, JS will still render the
      // server-rendered first entry but list-clicks won't swap.
    }
  }
  loadBibleEntriesFromIsland();

  function activeBibleCategoryCode() {
    var activeCategoryElement = document.querySelector('.bookwriter-bible-cats .bookwriter-bible-cat.active');
    return activeCategoryElement ? activeCategoryElement.dataset.cat : null;
  }

  function applyBibleCategoryFilter() {
    var activeCategory = activeBibleCategoryCode();
    document.querySelectorAll('.bookwriter-bible-list .bookwriter-bible-item').forEach(function (rowElement) {
      var rowCategory = rowElement.dataset.cat;
      var shouldShow = (!activeCategory) || (rowCategory === activeCategory);
      rowElement.hidden = !shouldShow;
    });
  }

  function refreshBibleCategoryCount(categoryCode, delta) {
    var countElement = document.querySelector('.bookwriter-bible-cat-count[data-cat-count="' + categoryCode + '"]');
    if (!countElement) return;
    var currentCount = parseInt(countElement.textContent.trim(), 10) || 0;
    var nextCount = Math.max(0, currentCount + delta);
    countElement.textContent = nextCount < 10 ? '0' + nextCount : String(nextCount);
  }

  function renderBibleDetailPane(entryRow) {
    var detailElement = document.getElementById('bookwriter-bible-detail');
    if (!detailElement || !entryRow) return;

    var avatarInitial = entryRow.entry_avatar_initial || (entryRow.entry_name || '?').slice(0, 1);
    var portraitGradient = (entryRow.entry_avatar_color_hex && entryRow.entry_avatar_color_hex_2)
      ? '--bookwriter-bible-avatar-hex-1:' + entryRow.entry_avatar_color_hex + ';--bookwriter-bible-avatar-hex-2:' + entryRow.entry_avatar_color_hex_2 + ';'
      : '';

    var imageUrlValue = entryRow.entry_image_url || '';
    var attributesJsonValue = entryRow.entry_attributes_json || '';
    detailElement.innerHTML =
      '<div class="bookwriter-bible-hero" data-bible-entry-id="' + entryRow.bookwriter_bible_entry_id + '">' +
        '<div class="bookwriter-bible-portrait" ' + (portraitGradient ? 'style="' + portraitGradient + '"' : '') + '>' + escapeHtml(avatarInitial) + '</div>' +
        '<div class="bookwriter-flex-fill">' +
          '<h1 contenteditable="true" spellcheck="false" data-bible-field="entry_name" data-placeholder="Entry name">' + escapeHtml(entryRow.entry_name || '') + '</h1>' +
          '<div class="bookwriter-role-edit" contenteditable="true" spellcheck="false" data-bible-field="entry_role" data-placeholder="role · context · age">' + escapeHtml(entryRow.entry_role || '') + '</div>' +
          '<div class="bookwriter-tags" contenteditable="true" spellcheck="false" data-bible-field="entry_tags_csv" data-placeholder="comma, separated, tags">' + escapeHtml(entryRow.entry_tags_csv || '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="bookwriter-bible-section">' +
        '<h3>Biography</h3>' +
        '<div contenteditable="true" spellcheck="false" data-bible-field="entry_biography" data-placeholder="Write a short biography…">' + escapeHtml(entryRow.entry_biography || '') + '</div>' +
      '</div>' +
      '<div class="bookwriter-bible-section">' +
        '<h3>Notes</h3>' +
        '<div contenteditable="true" spellcheck="false" data-bible-field="entry_notes" data-placeholder="Private notes only you see…">' + escapeHtml(entryRow.entry_notes || '') + '</div>' +
      '</div>' +
      '<div class="bookwriter-bible-section bookwriter-bible-image-section">' +
        '<h3>Portrait image URL</h3>' +
        '<input type="url" class="bookwriter-bible-image-url-input" id="bookwriter-bible-image-url-input" name="bookwriter_bible_image_url_input" placeholder="https://…" maxlength="1000" value="' + escapeHtml(imageUrlValue) + '" data-bible-field="entry_image_url">' +
        '<img class="bookwriter-bible-image-preview" id="bookwriter-bible-image-preview" src="' + escapeHtml(imageUrlValue) + '" alt="Portrait" loading="lazy" decoding="async"' + (imageUrlValue ? '' : ' hidden') + '>' +
      '</div>' +
      '<div class="bookwriter-bible-section bookwriter-bible-attributes-section">' +
        '<h3>Custom attributes</h3>' +
        '<div class="bookwriter-bible-attributes-list" id="bookwriter-bible-attributes-list"></div>' +
        '<button type="button" class="bookwriter-bible-attribute-add-button" id="bookwriter-bible-attribute-add-button" name="bookwriter_bible_attribute_add_button">+ Add attribute</button>' +
        '<input type="hidden" id="bookwriter-bible-entry-attributes-json" name="bookwriter_bible_entry_attributes_json" value="' + escapeHtml(attributesJsonValue) + '">' +
      '</div>';

    wireBibleDetailFieldAutosave(detailElement, entryRow.bookwriter_bible_entry_id);
  }

  function escapeHtml(rawValue) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(rawValue);
    return String(rawValue == null ? '' : rawValue)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function scheduleBibleEntrySave(bibleEntryId, fieldName, fieldValue) {
    if (!bibleEntryId) return;
    if (bibleEntrySaveTimers[bibleEntryId]) clearTimeout(bibleEntrySaveTimers[bibleEntryId]);
    bibleEntrySaveTimers[bibleEntryId] = setTimeout(function () {
      var payload = {};
      payload[fieldName] = fieldValue;
      window.bookwriter.apiPost('/bookwriter/api/bible-entry/' + encodeURIComponent(bibleEntryId) + '/save/', payload)
        .then(function () {
          // Cache + list-row mirror so the rail name updates without a refetch.
          var cachedEntry = bibleEntriesById[bibleEntryId];
          if (cachedEntry) cachedEntry[fieldName] = fieldValue;
          if (fieldName === 'entry_name' || fieldName === 'entry_role') {
            var listRow = document.querySelector('.bookwriter-bible-item[data-bible-entry-id="' + bibleEntryId + '"]');
            if (listRow) {
              if (fieldName === 'entry_name') {
                var nameElement = listRow.querySelector('.bookwriter-b-name');
                if (nameElement) nameElement.textContent = fieldValue || 'Untitled';
                var avatarElement = listRow.querySelector('.bookwriter-bible-avatar');
                if (avatarElement && !avatarElement.dataset.customInitial) {
                  avatarElement.textContent = (fieldValue || '?').slice(0, 1);
                }
              } else {
                var roleElement = listRow.querySelector('.bookwriter-b-role');
                if (roleElement) roleElement.textContent = fieldValue || '';
              }
            }
          }
        })
        .catch(function () { /* fire-and-forget; next keystroke retries */ });
    }, BIBLE_AUTOSAVE_DEBOUNCE_MS);
  }

  function wireBibleDetailFieldAutosave(detailElement, bibleEntryId) {
    detailElement.querySelectorAll('[data-bible-field]').forEach(function (editableField) {
      // <input> uses .value; contenteditable uses .innerText
      var isFormInput = editableField.tagName === 'INPUT' || editableField.tagName === 'TEXTAREA';
      var eventName = isFormInput ? 'input' : 'input';
      editableField.addEventListener(eventName, function () {
        var fieldValue = isFormInput ? (editableField.value || '') : (editableField.innerText || '');
        scheduleBibleEntrySave(bibleEntryId, editableField.dataset.bibleField, fieldValue);
        // Live-mirror image url into the preview img.
        if (editableField.dataset.bibleField === 'entry_image_url') {
          var preview = document.getElementById('bookwriter-bible-image-preview');
          if (preview) {
            if (fieldValue) {
              preview.src = fieldValue;
              preview.alt = 'Portrait';
              preview.hidden = false;
            } else {
              preview.src = '';
              preview.hidden = true;
            }
          }
        }
      });
    });
    wireBibleAttributesEditor(detailElement, bibleEntryId);
  }


  /* ========================================================
     BIBLE ATTRIBUTES KEY/VALUE EDITOR
     --------------------------------------------------------
     Hydrates the editor from the hidden entry_attributes_json
     input on first render. Each key/value row is a small form
     of [key input][value input][× remove]. Save fires on any
     input event, debounced at the bible save endpoint level.
  ======================================================== */
  function wireBibleAttributesEditor(detailElement, bibleEntryId) {
    var hiddenJsonField = detailElement.querySelector('#bookwriter-bible-entry-attributes-json');
    var listElement = detailElement.querySelector('#bookwriter-bible-attributes-list');
    var addButton = detailElement.querySelector('#bookwriter-bible-attribute-add-button');
    if (!hiddenJsonField || !listElement) return;

    function readAttributesObject() {
      var rawHiddenJsonValue = (hiddenJsonField.value || '').trim();
      if (!rawHiddenJsonValue) return {};
      try {
        var parsed = JSON.parse(rawHiddenJsonValue);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
      } catch (parseError) { return {}; }
    }

    function syncAttributesToServer() {
      var nextObject = {};
      listElement.querySelectorAll('.bookwriter-bible-attribute-row').forEach(function (row) {
        var keyInput = row.querySelector('.bookwriter-bible-attribute-key-input');
        var valueInput = row.querySelector('.bookwriter-bible-attribute-value-input');
        if (!keyInput || !valueInput) return;
        var keyText = (keyInput.value || '').trim();
        if (!keyText) return;
        nextObject[keyText] = (valueInput.value || '');
      });
      var serialized = Object.keys(nextObject).length === 0 ? '' : JSON.stringify(nextObject);
      hiddenJsonField.value = serialized;
      scheduleBibleEntrySave(bibleEntryId, 'entry_attributes_json', serialized);
    }

    function appendAttributeRow(keyText, valueText) {
      var rowElement = document.createElement('div');
      rowElement.className = 'bookwriter-bible-attribute-row';
      var keyInput = document.createElement('input');
      keyInput.type = 'text';
      keyInput.className = 'bookwriter-bible-attribute-key-input';
      keyInput.placeholder = 'Key';
      keyInput.maxLength = 80;
      keyInput.value = keyText || '';
      var valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.className = 'bookwriter-bible-attribute-value-input';
      valueInput.placeholder = 'Value';
      valueInput.maxLength = 500;
      valueInput.value = valueText == null ? '' : String(valueText);
      var removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'bookwriter-bible-attribute-remove-button';
      removeButton.title = 'Remove attribute';
      removeButton.setAttribute('aria-label', 'Remove attribute');
      removeButton.textContent = '\u00d7';
      var unique = String(Date.now()) + '-' + Math.floor(Math.random() * 1000);
      keyInput.id = 'bookwriter-bible-attribute-key-' + unique;
      keyInput.name = 'bookwriter_bible_attribute_key_' + unique;
      valueInput.id = 'bookwriter-bible-attribute-value-' + unique;
      valueInput.name = 'bookwriter_bible_attribute_value_' + unique;
      removeButton.id = 'bookwriter-bible-attribute-remove-' + unique + '-button';
      removeButton.name = 'bookwriter_bible_attribute_remove_' + unique + '_button';

      rowElement.appendChild(keyInput);
      rowElement.appendChild(valueInput);
      rowElement.appendChild(removeButton);

      keyInput.addEventListener('input', syncAttributesToServer);
      valueInput.addEventListener('input', syncAttributesToServer);
      removeButton.addEventListener('click', function () {
        rowElement.parentNode.removeChild(rowElement);
        syncAttributesToServer();
      });
      listElement.appendChild(rowElement);
      return keyInput;
    }

    // Hydrate from the saved JSON on first render.
    listElement.innerHTML = '';
    var attributesObject = readAttributesObject();
    Object.keys(attributesObject).forEach(function (key) {
      appendAttributeRow(key, attributesObject[key]);
    });

    if (addButton && !addButton.dataset.wired) {
      addButton.dataset.wired = '1';
      addButton.addEventListener('click', function () {
        var newRowKeyInput = appendAttributeRow('', '');
        if (newRowKeyInput) newRowKeyInput.focus();
      });
    }
  }

  function selectBibleEntry(rowElement) {
    document.querySelectorAll('.bookwriter-bible-list .bookwriter-bible-item').forEach(function (otherRow) {
      otherRow.classList.toggle('bookwriter-active', otherRow === rowElement);
    });
    var targetEntryId = rowElement.dataset.bibleEntryId;
    if (!targetEntryId) return;
    var entryRow = bibleEntriesById[targetEntryId];
    if (entryRow) renderBibleDetailPane(entryRow);
  }

  function wireBibleListRow(rowElement) {
    if (rowElement.dataset.wired === '1') return;
    rowElement.dataset.wired = '1';
    rowElement.addEventListener('click', function (clickEvent) {
      if (clickEvent.target && clickEvent.target.closest('.bookwriter-bible-item-delete-affordance')) return;
      selectBibleEntry(rowElement);
    });
    attachBibleEntryDeleteAffordance(rowElement);
  }

  function attachBibleEntryDeleteAffordance(rowElement) {
    var bibleEntryId = rowElement.dataset.bibleEntryId;
    if (!bibleEntryId) return;
    if (rowElement.querySelector('.bookwriter-bible-item-delete-affordance')) return;

    var deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'bookwriter-bible-item-delete-affordance';
    deleteButton.id = 'bookwriter-bible-entry-delete-' + bibleEntryId + '-button';
    deleteButton.name = 'bookwriter_bible_entry_delete_' + bibleEntryId + '_button';
    deleteButton.title = 'Remove entry';
    deleteButton.setAttribute('aria-label', 'Remove entry');
    deleteButton.textContent = '×';

    window.bookwriter.wireTwoClickConfirmDelete(deleteButton, {
      onConfirm: function () {
        window.bookwriter.apiDelete('/bookwriter/api/bible-entry/' + encodeURIComponent(bibleEntryId) + '/delete/')
          .then(function () {
            var deletedCategoryCode = rowElement.dataset.cat;
            var wasActive = rowElement.classList.contains('bookwriter-active');
            rowElement.parentNode.removeChild(rowElement);
            delete bibleEntriesById[bibleEntryId];
            refreshBibleCategoryCount(deletedCategoryCode, -1);
            if (wasActive) {
              var nextRow = document.querySelector('.bookwriter-bible-list .bookwriter-bible-item:not([hidden])');
              if (nextRow) selectBibleEntry(nextRow);
              else {
                var detailElement = document.getElementById('bookwriter-bible-detail');
                if (detailElement) {
                  detailElement.innerHTML =
                    '<div class="bookwriter-bible-detail-empty-state">' +
                      '<div class="bookwriter-bible-detail-empty-state-icon">📖</div>' +
                      '<div class="bookwriter-bible-detail-empty-state-title">Your worldbuilding starts here</div>' +
                      '<div class="bookwriter-bible-detail-empty-state-text">Add a character, location, object, research note, or piece of lore.</div>' +
                    '</div>';
                }
              }
            }
          })
          .catch(function () { /* leave the row in place */ });
      },
    });

    rowElement.appendChild(deleteButton);
  }

  function buildBibleListRow(entryRow) {
    var listElement = document.getElementById('bibleList');
    if (!listElement) return null;

    var rowElement = document.createElement('div');
    rowElement.className = 'bookwriter-bible-item';
    rowElement.dataset.bibleEntryId = String(entryRow.bookwriter_bible_entry_id);
    rowElement.dataset.cat = entryRow.bible_category_code;

    var avatarElement = document.createElement('div');
    avatarElement.className = 'bookwriter-bible-avatar';
    avatarElement.textContent = entryRow.entry_avatar_initial || (entryRow.entry_name || '?').slice(0, 1);
    if (entryRow.entry_avatar_color_hex && entryRow.entry_avatar_color_hex_2) {
      // Inject only the two hex data points; .bookwriter-bible-avatar CSS
      // composes the gradient + angle from these custom properties.
      avatarElement.style.setProperty('--bookwriter-bible-avatar-hex-1', entryRow.entry_avatar_color_hex);
      avatarElement.style.setProperty('--bookwriter-bible-avatar-hex-2', entryRow.entry_avatar_color_hex_2);
    }

    var labelWrapElement = document.createElement('div');
    var nameElement = document.createElement('div');
    nameElement.className = 'bookwriter-b-name';
    nameElement.textContent = entryRow.entry_name || 'Untitled';
    var roleElement = document.createElement('div');
    roleElement.className = 'bookwriter-b-role';
    roleElement.textContent = entryRow.entry_role || '';
    labelWrapElement.appendChild(nameElement);
    labelWrapElement.appendChild(roleElement);

    rowElement.appendChild(avatarElement);
    rowElement.appendChild(labelWrapElement);

    var addEntryButton = document.getElementById('bookwriter-bible-add-entry');
    if (addEntryButton && addEntryButton.parentNode === listElement) {
      listElement.insertBefore(rowElement, addEntryButton);
    } else {
      listElement.appendChild(rowElement);
    }

    var emptyStateElement = listElement.querySelector('.bookwriter-bible-list-empty-state');
    if (emptyStateElement) emptyStateElement.parentNode.removeChild(emptyStateElement);

    wireBibleListRow(rowElement);
    return rowElement;
  }

  function addBibleEntryForActiveCategory() {
    if (!bibleBookId) return;  // anon visitor — no DB writes
    var categoryCode = activeBibleCategoryCode();
    if (!categoryCode) return;

    window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(bibleBookId) + '/bible-entry/create/', { bible_category_code: categoryCode, entry_name: 'New entry' })
      .then(function (data) {
        var apiPayload = data.bible_entry || {};
        var newEntryRow = {
          bookwriter_bible_entry_id: apiPayload.id,
          bible_category_code: apiPayload.category_code,
          entry_name: apiPayload.name,
          entry_role: apiPayload.role || '',
          entry_avatar_initial: apiPayload.avatar_initial || '',
          entry_avatar_color_hex: apiPayload.avatar_color_hex || '',
          entry_avatar_color_hex_2: apiPayload.avatar_color_hex_2 || '',
          entry_biography: apiPayload.biography || '',
          entry_notes: apiPayload.notes || '',
          entry_tags_csv: apiPayload.tags_csv || '',
        };
        bibleEntriesById[newEntryRow.bookwriter_bible_entry_id] = newEntryRow;
        var listRow = buildBibleListRow(newEntryRow);
        refreshBibleCategoryCount(newEntryRow.bible_category_code, +1);
        if (listRow) {
          selectBibleEntry(listRow);
          listRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          setTimeout(function () {
            var nameField = document.querySelector('#bookwriter-bible-detail [data-bible-field="entry_name"]');
            if (nameField) nameField.focus();
          }, 200);
        }
      })
      .catch(function () { /* user can click + add entry again */ });
  }

  // Wire categories — click filters the list, swaps active class.
  document.querySelectorAll('.bookwriter-bible-cats .bookwriter-bible-cat').forEach(function (categoryRow) {
    categoryRow.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-bible-cats .bookwriter-bible-cat').forEach(function (otherCategory) {
        otherCategory.classList.toggle('bookwriter-active', otherCategory === categoryRow);
      });
      applyBibleCategoryFilter();
      // Auto-select the first visible entry in the new category, if any.
      var firstVisibleRow = document.querySelector('.bookwriter-bible-list .bookwriter-bible-item:not([hidden])');
      if (firstVisibleRow) selectBibleEntry(firstVisibleRow);
    });
  });

  // Wire all server-rendered list rows + apply initial category filter.
  document.querySelectorAll('.bookwriter-bible-list .bookwriter-bible-item').forEach(wireBibleListRow);
  applyBibleCategoryFilter();

  // Wire the server-rendered first entry's detail pane (so typing into
  // it autosaves immediately, before any list click).
  var initialDetailHero = document.querySelector('#bookwriter-bible-detail .bookwriter-bible-hero[data-bible-entry-id]');
  if (initialDetailHero) {
    var initialEntryId = initialDetailHero.dataset.bibleEntryId;
    wireBibleDetailFieldAutosave(document.getElementById('bookwriter-bible-detail'), initialEntryId);
  }

  var bibleAddEntryButton = document.getElementById('bookwriter-bible-add-entry');
  if (bibleAddEntryButton) bibleAddEntryButton.addEventListener('click', addBibleEntryForActiveCategory);


  /* ========================================================
     COVER DESIGNER — persist tile / size / spacing / palette
     --------------------------------------------------------
     Each control already has a click/input handler somewhere
     above that updates the live preview. This block adds an
     ADDITIONAL listener that pushes the change to the cover
     design endpoint (debounced 600ms per control). The tile
     `.tmpl` carries data-style which maps 1:1 to the seeded
     `cover_template_code`. Sliders persist on `change`
     (release) rather than `input` (every pixel) to avoid
     hammering the endpoint. Anonymous visitors are no-op'd
     because there's no book row to write against. ========== */
  var COVER_AUTOSAVE_DEBOUNCE_MS = 600;
  var coverAutosaveTimer;
  function persistCoverFieldsAfterDebounce(payload) {
    var chaptersListElement = document.getElementById('chapters');
    var coverBookId = chaptersListElement ? chaptersListElement.dataset.bookId : null;
    if (!coverBookId) return;
    if (coverAutosaveTimer) clearTimeout(coverAutosaveTimer);
    coverAutosaveTimer = setTimeout(function () {
      window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(coverBookId) + '/cover-design/save/', payload).catch(function () { /* silent retry on next interaction */ });
    }, COVER_AUTOSAVE_DEBOUNCE_MS);
  }

  document.querySelectorAll('#templates .bookwriter-cover-template-tile').forEach(function (tileElement) {
    tileElement.addEventListener('click', function () {
      var templateCode = tileElement.dataset.style || null;
      if (!templateCode) return;
      // Mirror "active" class swap so subsequent clicks reflect the
      // selection visually (the server-side initial paint was correct,
      // but later clicks need a JS sync).
      document.querySelectorAll('#templates .bookwriter-cover-template-tile').forEach(function (other) {
        other.classList.toggle('bookwriter-active', other === tileElement);
      });
      persistCoverFieldsAfterDebounce({ cover_template_code: templateCode });
    });
  });

  var titleSizeSlider = document.getElementById('titleSize');
  if (titleSizeSlider) {
    titleSizeSlider.addEventListener('change', function () {
      persistCoverFieldsAfterDebounce({ cover_title_size_pt: parseInt(titleSizeSlider.value, 10) });
    });
  }

  var letterSpacingSlider = document.getElementById('tracking');
  if (letterSpacingSlider) {
    letterSpacingSlider.addEventListener('change', function () {
      persistCoverFieldsAfterDebounce({ cover_letter_spacing_unit: parseInt(letterSpacingSlider.value, 10) });
    });
  }

  document.querySelectorAll('#palettes .bookwriter-cover-palette-tile').forEach(function (paletteTile) {
    paletteTile.addEventListener('click', function () {
      document.querySelectorAll('#palettes .bookwriter-cover-palette-tile').forEach(function (other) {
        other.classList.toggle('bookwriter-active', other === paletteTile);
      });
      persistCoverFieldsAfterDebounce({
        cover_palette_bg_hex_override:     paletteTile.dataset.bg     || null,
        cover_palette_fg_hex_override:     paletteTile.dataset.fg     || null,
        cover_palette_accent_hex_override: paletteTile.dataset.accent || null,
      });
    });
  });

  // Font picker — wire all 4 font buttons to swap active class + persist.
  document.querySelectorAll('#fontPick button[data-font]').forEach(function (fontButton) {
    fontButton.addEventListener('click', function () {
      var fontCode = fontButton.dataset.font || null;
      if (!fontCode) return;
      document.querySelectorAll('#fontPick button[data-font]').forEach(function (other) {
        other.classList.toggle('bookwriter-active', other === fontButton);
      });
      persistCoverFieldsAfterDebounce({ cover_font_code: fontCode });
    });
  });

  // Background grid — 8 preset backgrounds. Click swaps active class +
  // POSTs `cover_background_code`. The choice is persisted as an FK id
  // server-side via the ref dispatcher inside the cover save endpoint.
  document.querySelectorAll('#bookwriter-cover-background-grid .bookwriter-cover-background-button').forEach(function (backgroundButton) {
    backgroundButton.addEventListener('click', function () {
      var backgroundCode = backgroundButton.dataset.backgroundCode || null;
      if (!backgroundCode) return;
      document.querySelectorAll('#bookwriter-cover-background-grid .bookwriter-cover-background-button').forEach(function (other) {
        other.classList.toggle('bookwriter-active', other === backgroundButton);
      });
      persistCoverFieldsAfterDebounce({ cover_background_code: backgroundCode });
    });
  });

  // Override the visual-only `setAsCover` stub with a real save call.
  window.setAsCover = function () {
    var setCoverButton = document.querySelector('.bookwriter-set-as-cover');
    var setCoverButtonLabel = setCoverButton ? setCoverButton.querySelector('span') : null;
    var activeTemplateTile = document.querySelector('#templates .tmpl.active');
    var templateCode = activeTemplateTile ? (activeTemplateTile.dataset.style || null) : null;
    if (!templateCode) {
      if (setCoverButtonLabel) setCoverButtonLabel.innerText = 'Pick a template first';
      return;
    }
    var chaptersListElement = document.getElementById('chapters');
    var coverBookId = chaptersListElement ? chaptersListElement.dataset.bookId : null;
    if (!coverBookId) return;
    window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(coverBookId) + '/cover-design/save/', { cover_template_code: templateCode })
      .then(function () {
        if (setCoverButton) setCoverButton.style.background = 'var(--moss)';
        if (setCoverButtonLabel) setCoverButtonLabel.innerText = 'Cover saved to manuscript';
        setTimeout(function () {
          if (setCoverButton) setCoverButton.style.background = 'var(--ink)';
          if (setCoverButtonLabel) setCoverButtonLabel.innerText = 'Set as book cover';
        }, 2000);
      })
      .catch(function () {
        if (setCoverButtonLabel) setCoverButtonLabel.innerText = 'Save failed — try again';
      });
  };


  /* ========================================================
     BETA SHARE — mint share link + write to the modal input
     --------------------------------------------------------
     The share modal opens with a placeholder URL. On the
     first openShare() call (or copyShareLink click), we mint
     a new beta_share_link via the API and replace the input
     value with the real share URL. Subsequent opens reuse
     the same link. Anonymous visitors get a no-op (modal still
     opens but the input stays as the demo URL). ============== */
  var cachedBetaShareUrl = null;
  function ensureBetaShareLinkExists(callback) {
    if (cachedBetaShareUrl) { callback(cachedBetaShareUrl); return; }
    var chaptersListElement = document.getElementById('chapters');
    var betaBookId = chaptersListElement ? chaptersListElement.dataset.bookId : null;
    if (!betaBookId) { callback(null); return; }
    // If at least one server-rendered active share row already exists,
    // adopt the first row's URL rather than minting yet another link.
    var existingShareRow = document.querySelector('#bookwriter-active-beta-share-list .bookwriter-active-share-row');
    if (existingShareRow) {
      var token = (existingShareRow.dataset.shareToken)
        || (existingShareRow.querySelector('.bookwriter-reader-name') && existingShareRow.querySelector('.bookwriter-reader-name').textContent.replace(/^…\//, ''));
      if (token) {
        cachedBetaShareUrl = window.location.origin + '/bookwriter/beta/' + token + '/';
        callback(cachedBetaShareUrl);
        return;
      }
    }
    var activePermissionTile = document.querySelector('.perm.active');
    var permissionCode = (activePermissionTile && activePermissionTile.dataset.bookwriter-share-permission-tile) || 'read';
    window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(betaBookId) + '/beta-share/create/', { beta_permission_code: permissionCode })
      .then(function (data) {
        var newShare = data.beta_share_link || {};
        cachedBetaShareUrl = newShare.share_url || null;
        appendBetaShareRowToList(newShare);
        callback(cachedBetaShareUrl);
      })
      .catch(function () { callback(null); });
  }

  function appendBetaShareRowToList(newShare) {
    var listElement = document.getElementById('bookwriter-active-beta-share-list');
    if (!listElement || !newShare.id) return;
    var emptyState = listElement.querySelector('.bookwriter-active-share-empty');
    if (emptyState) emptyState.parentNode.removeChild(emptyState);

    var rowElement = document.createElement('div');
    rowElement.className = 'bookwriter-reader bookwriter-active-share-row';
    rowElement.dataset.betaShareLinkId = String(newShare.id);

    var avatarElement = document.createElement('div');
    avatarElement.className = 'bookwriter-reader-avatar';
    avatarElement.textContent = (newShare.permission_code || '?').slice(0, 1);

    var nameElement = document.createElement('div');
    nameElement.className = 'bookwriter-reader-name';
    nameElement.textContent = '…/' + (newShare.token || '').slice(0, 12);

    var permElement = document.createElement('div');
    permElement.className = 'bookwriter-reader-perm';
    permElement.textContent = newShare.permission_code || 'read';

    var revokeButton = document.createElement('button');
    revokeButton.type = 'button';
    revokeButton.className = 'bookwriter-reader-remove bookwriter-revoke-share-button';
    revokeButton.id = 'bookwriter-share-revoke-' + newShare.id + '-button';
    revokeButton.name = 'bookwriter_share_revoke_' + newShare.id + '_button';
    revokeButton.title = 'Revoke this link';
    revokeButton.textContent = '×';

    rowElement.appendChild(avatarElement);
    rowElement.appendChild(nameElement);
    rowElement.appendChild(permElement);
    rowElement.appendChild(revokeButton);
    listElement.appendChild(rowElement);

    wireBetaShareRevokeButton(revokeButton, rowElement);
  }

  function wireBetaShareRevokeButton(buttonElement, rowElement) {
    buttonElement.addEventListener('click', function () {
      var betaShareLinkId = rowElement.dataset.betaShareLinkId;
      if (!betaShareLinkId) return;
      window.bookwriter.apiPost('/bookwriter/api/beta-share/' + encodeURIComponent(betaShareLinkId) + '/revoke/', {})
        .then(function () {
          rowElement.parentNode.removeChild(rowElement);
          // If we just revoked the cached URL, drop the cache so the
          // next openShare() mints a fresh link.
          cachedBetaShareUrl = null;
        })
        .catch(function () { /* leave the row in place; user can retry */ });
    });
  }

  // Wire any server-rendered revoke buttons on first paint.
  document.querySelectorAll('#bookwriter-active-beta-share-list .bookwriter-active-share-row').forEach(function (rowElement) {
    var buttonElement = rowElement.querySelector('.bookwriter-revoke-share-button');
    if (buttonElement) wireBetaShareRevokeButton(buttonElement, rowElement);
  });


  // [extracted to modules/bookwriter-rail-pickers.js — chapter status, book metadata fields]


  // [extracted to modules/bookwriter-beta-reader-mgmt.js — invite / list / remove]

  // Wrap the existing openShare() so the modal lazy-mints a URL on open.
  var originalOpenShare = window.openShare;
  window.openShare = function () {
    if (typeof originalOpenShare === 'function') originalOpenShare();
    ensureBetaShareLinkExists(function (shareUrl) {
      var shareInput = document.getElementById('shareLink');
      if (shareInput && shareUrl) shareInput.value = shareUrl;
    });
  };

  // Wrap copyShareLink so a click ALSO ensures the link exists before
  // the user copies a stale demo URL.
  var originalCopyShareLink = window.copyShareLink;
  window.copyShareLink = function (sourceButtonElement) {
    ensureBetaShareLinkExists(function () {
      if (typeof originalCopyShareLink === 'function') originalCopyShareLink(sourceButtonElement);
    });
  };


  /* ========================================================
     PUBLISH — call /api/chapter/<id>/publish/ for active chapter
     --------------------------------------------------------
     Replaces the demo `publishFlow()` stub with a real API
     call. Reads the active chapter id from the rail, hits
     /publish/, then surfaces the resulting public_url on the
     button label. ========================================= */
  window.publishFlow = function () {
    var publishButton = document.querySelector('.bookwriter-publish');
    var publishButtonLabel = publishButton ? publishButton.querySelector('span') : null;
    var editorElement = document.querySelector('.bookwriter-manuscript .editor[data-chapter-id]')
      || document.querySelector('[data-chapter-id]');
    var activeChapterId = editorElement ? editorElement.dataset.chapterId : null;
    if (!activeChapterId) {
      if (publishButtonLabel) publishButtonLabel.innerText = 'Pick a chapter first';
      return;
    }
    if (publishButton) publishButton.style.background = 'var(--moss)';
    if (publishButtonLabel) publishButtonLabel.innerText = 'Sending to the press…';
    window.bookwriter.apiPost('/bookwriter/api/chapter/' + encodeURIComponent(activeChapterId) + '/publish/', {})
      .then(function (data) {
        var publicUrl = (data.serial_release && data.serial_release.public_url) || null;
        if (publishButtonLabel) publishButtonLabel.innerText = publicUrl ? 'Published — open' : 'Published';
        if (publishButton) {
          publishButton.style.background = 'var(--accent)';
          if (publicUrl) publishButton.onclick = function () { window.open(publicUrl, '_blank', 'noopener'); };
        }
      })
      .catch(function () {
        if (publishButtonLabel) publishButtonLabel.innerText = 'Publish failed — try again';
        if (publishButton) publishButton.style.background = '';
      });
  };


  // [extracted to modules/bookwriter-margin-notes.js — toggle / load / add / resolve / delete]


  /* ========================================================
     PERSISTENCE — debounced scroll capture + restore on load
     --------------------------------------------------------
     Scroll: fires constantly, so debounce 250ms before write.
     Restore: deferred to next tick so the browser has finished
     laying out the wrapper / grid before we apply mode + scroll.
     Order matters — mode FIRST (changes which view is visible),
     chapter SECOND (changes prose content), scroll LAST. */
  var manuscript = document.querySelector('.bookwriter-manuscript');
  if (manuscript) {
    var scrollSaveTimer;
    manuscript.addEventListener('scroll', function () {
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(function () {
        saveState({ manuscriptScrollY: manuscript.scrollTop });
      }, 250);
    }, { passive: true });
  }

  function restoreState() {
    var savedState = loadState();
    if (!savedState) return;

    if (savedState.mode && ['write','corkboard','bible','cover','gallery'].indexOf(savedState.mode) !== -1) {
      setMode(savedState.mode);
    }

    if (savedState.chapterNum) {
      var matchingChapterRow = null;
      document.querySelectorAll('.bookwriter-chapter').forEach(function (chapterRow) {
        var chapterNumberElement = chapterRow.querySelector('.bookwriter-ch-num');
        if (chapterNumberElement && chapterNumberElement.innerText.trim() === savedState.chapterNum) matchingChapterRow = chapterRow;
      });
      if (matchingChapterRow && !matchingChapterRow.classList.contains('bookwriter-active')) matchingChapterRow.click();
    }

    if (manuscript && typeof savedState.manuscriptScrollY === 'number' && savedState.manuscriptScrollY > 0) {
      manuscript.scrollTop = savedState.manuscriptScrollY;
    }
  }

  setTimeout(restoreState, 0);

})();

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
     EMBEDDED-WRAPPER HEIGHT — `--bookwriter-header-offset` is now
     declarative.
     --------------------------------------------------------
     Previously this block measured `.bookwriter-embedded-wrapper`'s
     distance from document top via `getBoundingClientRect()` and
     wrote it into `--bookwriter-header-offset` so sticky rails could
     compute against the chrome height. The measurement landed at
     ~301px on this page (header + breadcrumb + mode tabs combined),
     which then sticky-pinned the inkwell rail at viewport y=301
     (mid-screen) — the user reported "rail in the middle".
     The CSS now uses `var(--bookwriter-header-offset, 0px)` as the
     fallback (was 64px), and no JS sets the variable. Effective
     offset is always 0px — sticky rails pin at viewport top, the
     embedded-wrapper height calc subtracts 0, no chrome compensation
     happens. This is gold-standard professional CSS: declarative
     fallback, no runtime measurement, no flakiness across reloads.
     If a future design needs a non-zero offset it should be set
     declaratively in CSS (e.g. `:root { --bookwriter-header-offset:
     56px }`), never re-introduced as a JS measurement.
     ======================================================== */

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
    } catch (error) { return null; }
  }

  function saveState(patch) {
    try {
      var current = loadState() || {};
      var next = Object.assign({}, current, patch);
      window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
    } catch (error) { /* quota / private mode — drop silently */ }
  }


  /* Scrub any legacy collapse keys / body classes from earlier
     experiments so the layout can never be left in a stuck hidden
     state if the user lands on cached HTML/CSS. */
  try {
    var legacyCleanupState = loadState() || {};
    var legacyKeys = [
      'isLeftRailCollapsed', 'isRightDeskCollapsed',
      'isRailCollapsed', 'isDeskCollapsed',
      'railCollapsed', 'deskCollapsed'
    ];
    var hadLegacyKey = false;
    legacyKeys.forEach(function (legacyKey) {
      if (legacyKey in legacyCleanupState) { delete legacyCleanupState[legacyKey]; hadLegacyKey = true; }
    });
    if (hadLegacyKey) window.localStorage.setItem(STATE_KEY, JSON.stringify(legacyCleanupState));
  } catch (error) { /* private mode / quota — ignore */ }
  document.body.classList.remove(
    'bookwriter-app-is-left-rail-collapsed',
    'bookwriter-app-is-right-desk-collapsed',
    'bookwriter-app-is-rail-collapsed',
    'bookwriter-app-is-desk-collapsed'
  );


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
    var activeChapterRailRow = document.querySelector('.bookwriter-chapter-row-is-active .bookwriter-chapter-rail-row-number');
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

    var savedHtmlSnapshot = getProseInnerHtmlWithoutPageBreakOverlay(prose);
    window.bookwriter.apiPost('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/autosave/', { chapter_text_html: savedHtmlSnapshot })
      .then(function (data) {
        if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>saved · just now';
        updateBookStatCounters(data.book_total_word_count, data.book_total_chapter_count);
        updateWriterDashboardStats(data.today_words_written, data.current_streak_days);
        // Mirror the saved body into the chapter cache so a SWR
        // re-open doesn't paint stale (older) HTML over the live one.
        var existingCachedPayload = chapterPayloadCacheById && chapterPayloadCacheById[chapterId];
        if (existingCachedPayload) {
          existingCachedPayload.html = savedHtmlSnapshot;
          existingCachedPayload.word_count = (data && data.chapter_word_count) || existingCachedPayload.word_count;
        }
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
    // Capture the title text AND the matching rail row NOW. Reading
    // them inside the .then() is wrong: a chapter switch in between
    // (which clears the editor and changes which rail row is active)
    // would make the .then() write '' into the WRONG rail row, leaving
    // the just-saved chapter showing "Untitled Chapter" in the rail
    // even though its DB row has the real title. Bug reported as
    // "click chapter 2, sidebar says Untitled but it has a title".
    var titleTextSnapshot = title.innerText || '';
    var railTitleElementSnapshot = document.querySelector(
      '#chapters .bookwriter-chapter[data-chapter-id="' + chapterId + '"] .bookwriter-chapter-rail-row-title'
    );
    window.bookwriter.apiPost('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/title/', { chapter_title: titleTextSnapshot })
      .then(function () {
        if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>title saved · just now';
        if (railTitleElementSnapshot) {
          railTitleElementSnapshot.textContent = titleTextSnapshot || 'Untitled Chapter';
        }
        // Mirror into the chapter cache so a SWR re-open shows the
        // freshly-typed title, not the previously-cached one.
        var existingCachedPayload = chapterPayloadCacheById && chapterPayloadCacheById[chapterId];
        if (existingCachedPayload) existingCachedPayload.title = titleTextSnapshot;
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

  /* PDF export — toolbar button navigates to the server endpoint
     which streams back the PDF as an attachment. window.location =
     URL is the simplest way to trigger a native browser download
     for a GET endpoint; no fetch / blob / object-URL juggling. */
  var exportPdfButtonElement = document.getElementById('bookwriter-tool-export-pdf-button');
  if (exportPdfButtonElement) {
    exportPdfButtonElement.addEventListener('click', function (clickEvent) {
      clickEvent.preventDefault();
      var bookIdForPdfExport = exportPdfButtonElement.getAttribute('data-bookwriter-book-id');
      if (!bookIdForPdfExport) return;
      window.location = '/bookwriter/api/book/' + encodeURIComponent(bookIdForPdfExport) + '/export/pdf/';
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
        var wasActive = chapterRowElement.classList.contains('bookwriter-chapter-row-is-active');
        chapterRowElement.parentNode.removeChild(chapterRowElement);
        renumberChapters();
        updateBookStatCounters(data.book_total_word_count, data.book_total_chapter_count);
        if (wasActive) {
          var nextActiveRow = document.querySelector('#chapters .bookwriter-chapter');
          if (nextActiveRow) {
            nextActiveRow.click();
          } else if (prose) {
            prose.innerHTML = '';
            ensureProseHasParagraphContainer(prose);
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
    var initialActiveChapterNumberElement = document.querySelector('.bookwriter-chapter-row-is-active .bookwriter-chapter-rail-row-number');
    if (initialActiveChapterNumberElement) {
      initialPrimedChapterNum = initialActiveChapterNumberElement.innerText.trim();
    }
  }

  /* Read prose innerHTML EXCLUDING the page-break overlay.
     The overlay (.bookwriter-page-break-overlay) is a JS-managed UI
     decoration that bookwriter-page-breaks.js injects INSIDE the
     contenteditable prose because position:absolute needs the prose
     as its containing block. But it MUST NOT be persisted to
     chapter_text_html — otherwise its child markup ("page break"
     labels, page-number pills "1, 2, 3") shows up as visible text in
     PDF export, public reader, and any future consumer that renders
     the saved HTML. Clone-and-strip: live prose stays intact (editor
     UI unchanged), the snapshot we send to the server has no overlay. */
  function getProseInnerHtmlWithoutPageBreakOverlay(proseElement) {
    if (!proseElement) return '';
    var proseClone = proseElement.cloneNode(true);
    var clonedOverlays = proseClone.querySelectorAll('.bookwriter-page-break-overlay');
    for (var overlayIndex = 0; overlayIndex < clonedOverlays.length; overlayIndex++) {
      clonedOverlays[overlayIndex].parentNode.removeChild(clonedOverlays[overlayIndex]);
    }
    return proseClone.innerHTML;
  }

  /* Empty-contenteditable cursor-trap fix.
     A contenteditable="true" div with NO <p>/<br> children — only an
     absolutely-positioned, contenteditable="false" page-break overlay —
     gives Chromium nowhere in the layout flow to draw the caret. Symptom
     stack on a brand-new / freshly-emptied chapter:
       (a) clicking the prose page shows no visible cursor,
       (b) typed characters never appear,
       (c) BanglaInput suggestion dropdown anchors to {0,0,0,0} caret rect
           and parks itself on the page-number pill.
     One placeholder <p><br></p> at the front of prose gives the caret a
     real text container and resolves all three. Idempotent: skipped if
     prose already has a <p>. Inserted at the front so the page-break
     overlay (always last child) keeps its expected position. */
  function ensureProseHasParagraphContainer(proseElement) {
    if (!proseElement) return false;
    for (var childIndex = 0; childIndex < proseElement.children.length; childIndex++) {
      if (proseElement.children[childIndex].tagName === 'P') return false;
    }
    var placeholderParagraph = document.createElement('p');
    placeholderParagraph.appendChild(document.createElement('br'));
    proseElement.insertBefore(placeholderParagraph, proseElement.firstChild);
    return true;
  }

  /* Move focus into the prose AND collapse the selection to the start of
     the first <p>. Used after applying a freshly-created or just-loaded
     empty chapter so the writer can start typing immediately without an
     extra click. Caret-placement uses Range.selectNodeContents + collapse
     because contenteditable.focus() alone in Chromium often leaves the
     selection unset and the cursor invisible. */
  function focusProseAndPlaceCaretAtFirstParagraph(proseElement) {
    if (!proseElement) return;
    var firstParagraph = proseElement.querySelector('p');
    if (!firstParagraph) return;
    proseElement.focus();
    var browserSelection = window.getSelection();
    if (!browserSelection) return;
    var caretRange = document.createRange();
    caretRange.selectNodeContents(firstParagraph);
    caretRange.collapse(true);
    browserSelection.removeAllRanges();
    browserSelection.addRange(caretRange);
  }

  function applyChapterPayloadToEditor(chapterPayload) {
    if (!chapterPayload) return;
    if (prose) {
      prose.dataset.chapterId = String(chapterPayload.id || '');
      prose.innerHTML = chapterPayload.html || '';
      var paragraphPlaceholderInjected = ensureProseHasParagraphContainer(prose);
      /* Page-break overlay (visual A4 markers) needs to recompute
         after the prose innerHTML is replaced wholesale — the
         per-element ResizeObserver should fire too, but a manual
         nudge guarantees the markers update in the same paint
         frame the new content lands in. */
      if (window.bookwriterPageBreaks && window.bookwriterPageBreaks.refresh) {
        window.bookwriterPageBreaks.refresh();
      }
      /* If the chapter was empty (we had to inject the placeholder),
         move the caret into the new <p> so the writer can type
         immediately — saves a click, removes the "I clicked but
         nothing happened" feeling for new-chapter creation. */
      if (paragraphPlaceholderInjected) {
        focusProseAndPlaceCaretAtFirstParagraph(prose);
      }
    }
    // Reset the manuscript scroll to the top of the new chapter.
    // Without this, the scrollbar keeps the previous chapter's
    // scrollTop, which on a SHORTER new chapter looks like the
    // bottom border / page is cut off and the editor "won't
    // scroll" — there's nothing to scroll to because the viewport
    // is parked beyond the new content's height. Reported as
    // "only chapter 1 shows borders, others are cut off at the
    // bottom and won't scroll".
    var manuscriptScrollableElement = document.querySelector('.bookwriter-manuscript');
    if (manuscriptScrollableElement) manuscriptScrollableElement.scrollTop = 0;
    if (title) title.innerText = chapterPayload.title || '';
    var chapterLabelElement = document.querySelector('.bookwriter-chapter-label');
    // Prefer the ID-stamped crumb element added in Step 7 — falls back
    // to the older `.bookwriter-toolbar-crumb strong` selector for the anon demo.
    var crumbChapterElement = document.getElementById('bookwriter-crumb-chapter-label')
      || document.querySelector('.bookwriter-toolbar-crumb strong');
    if (chapterLabelElement) chapterLabelElement.innerText = 'Chapter ' + (chapterPayload.number || '');
    if (crumbChapterElement) crumbChapterElement.innerText = 'Chapter ' + (chapterPayload.number || '');
    // Resync the matching rail row's title from the DB payload — if a
    // previous title-autosave race wrote 'Untitled Chapter' into the
    // wrong row, opening that chapter now corrects it from the source
    // of truth.
    if (chapterPayload.id) {
      var matchingRailTitleElement = document.querySelector(
        '#chapters .bookwriter-chapter[data-chapter-id="' + chapterPayload.id + '"] .bookwriter-chapter-rail-row-title'
      );
      if (matchingRailTitleElement) {
        matchingRailTitleElement.textContent = chapterPayload.title || 'Untitled Chapter';
      }
    }
    refresh();
  }

  function switchToChapterFromRail(chapterRow) {
    document.querySelectorAll('.bookwriter-chapter').forEach(function (chapterRowElement) { chapterRowElement.classList.remove('bookwriter-chapter-row-is-active'); });
    chapterRow.classList.add('bookwriter-chapter-row-is-active');

    var realChapterId = chapterRow.dataset.chapterId;

    if (!realChapterId) {
      // ---------- DEMO BRANCH ----------
      var demoChapterTitle = chapterRow.querySelector('.bookwriter-chapter-rail-row-title') ? chapterRow.querySelector('.bookwriter-chapter-rail-row-title').innerText : '';
      var demoChapterNum = chapterRow.querySelector('.bookwriter-chapter-rail-row-number') ? chapterRow.querySelector('.bookwriter-chapter-rail-row-number').innerText.trim() : '';
      if (title) title.innerText = (demoChapterTitle === 'Untitled') ? '' : demoChapterTitle;
      var demoLabel = document.querySelector('.bookwriter-chapter-label');
      var demoCrumb = document.querySelector('.bookwriter-toolbar-crumb strong');
      if (demoLabel) demoLabel.innerText = 'Chapter ' + demoChapterNum.replace('.', '').trim();
      if (demoCrumb) demoCrumb.innerText = 'Chapter ' + demoChapterNum.replace('.', '').trim();
      if (prose) {
        prose.innerHTML = (demoChapterNum === initialPrimedChapterNum) ? initialPrimedProseHtml : '';
        ensureProseHasParagraphContainer(prose);
        refresh();
      }
      saveState({ chapterId: chapterRow.dataset.chapterId || null, chapterNum: demoChapterNum, manuscriptScrollY: 0 });
      return;
    }

    // ---------- REAL DB BRANCH ----------
    // Flush pending saves for the OLD chapter so they fire with the
    // OLD chapter_id (still on prose.dataset at this point).
    clearTimeout(saveTimeout);
    performChapterAutosave();
    clearTimeout(titleSaveTimeout);
    performChapterTitleAutosave();

    var cachedChapterPayload = chapterPayloadCacheById[realChapterId];

    if (cachedChapterPayload) {
      // INSTANT path — render from cache, then revalidate in the
      // background (stale-while-revalidate). Editor never blanks for
      // a re-visit; freshly loaded data updates seamlessly when it
      // arrives. This is the perceived-speed win the user asked for.
      applyChapterPayloadToEditor(cachedChapterPayload);
      saveState({ chapterId: cachedChapterPayload.id, chapterNum: String(cachedChapterPayload.number || ''), manuscriptScrollY: 0 });
      fetchAndCacheChapter(realChapterId).then(function (freshChapterPayload) {
        if (!freshChapterPayload) return;
        // Only repaint if the user is STILL on this chapter and the
        // server data is materially different — otherwise the silent
        // refresh is invisible.
        if (prose && prose.dataset.chapterId === String(freshChapterPayload.id)) {
          var titleChanged = (title && title.innerText !== (freshChapterPayload.title || ''));
          var bodyChanged  = (prose.innerHTML !== (freshChapterPayload.html || ''));
          if (titleChanged || bodyChanged) {
            applyChapterPayloadToEditor(freshChapterPayload);
          }
        }
      });
      return;
    }

    // COLD path — first time this chapter is opened in the session.
    // Clear the editor IMMEDIATELY so the user never briefly sees the
    // PREVIOUS chapter's title/body while the new one is being
    // fetched. Reset chapterId too so a stray autosave can't PATCH
    // the wrong chapter mid-switch. Show a skeleton band so the
    // blank state feels intentional, not broken.
    if (title) title.innerText = '';
    if (prose) {
      prose.innerHTML = '';
      ensureProseHasParagraphContainer(prose);
      delete prose.dataset.chapterId;
    }
    var stageWhileLoading = document.querySelector('.bookwriter-stage');
    if (stageWhileLoading) stageWhileLoading.classList.add('bookwriter-stage-is-loading');

    fetchAndCacheChapter(realChapterId)
      .then(function (chapterPayload) {
        if (chapterPayload) {
          applyChapterPayloadToEditor(chapterPayload);
          if (saveChip) saveChip.innerHTML = '<span class="bookwriter-pulse"></span>chapter loaded';
          saveState({ chapterId: chapterPayload.id, chapterNum: String(chapterPayload.number || ''), manuscriptScrollY: 0 });
        } else if (saveChip) {
          saveChip.innerHTML = '<span class="bookwriter-pulse" style="background:var(--accent);"></span>could not load chapter';
        }
      })
      .then(function () {
        if (stageWhileLoading) stageWhileLoading.classList.remove('bookwriter-stage-is-loading');
      });
  }

  /* ========================================================
     CHAPTER PAYLOAD CACHE
     --------------------------------------------------------
     Map of chapter_id -> last-loaded payload. Lets re-opens
     render instantly while a background fetch revalidates.
     In-flight fetches are deduped via the inflight map so
     hover-prefetch + click on the same chapter only hits the
     server once. Cache entries are refreshed on every fetch
     and on title/body autosave (via cacheChapterPayload), so
     it never goes stale relative to what the user sees.
     ======================================================== */
  var chapterPayloadCacheById = {};
  var chapterPayloadInflightById = {};

  function cacheChapterPayload(chapterPayload) {
    if (chapterPayload && chapterPayload.id) {
      chapterPayloadCacheById[String(chapterPayload.id)] = chapterPayload;
    }
  }

  function fetchAndCacheChapter(chapterId) {
    var key = String(chapterId);
    if (chapterPayloadInflightById[key]) return chapterPayloadInflightById[key];
    var pendingFetchPromise = window.bookwriter.apiGet(
      '/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/'
    ).then(function (data) {
      var loadedChapterPayload = (data && data.chapter) ? data.chapter : null;
      if (loadedChapterPayload) cacheChapterPayload(loadedChapterPayload);
      return loadedChapterPayload;
    }).catch(function () {
      return null;
    }).then(function (chapterPayloadOrNull) {
      delete chapterPayloadInflightById[key];
      return chapterPayloadOrNull;
    });
    chapterPayloadInflightById[key] = pendingFetchPromise;
    return pendingFetchPromise;
  }

  /* Hover prefetch — pointerenter on a rail row starts the GET so
     that by the time the user clicks, the response is usually back.
     Combined with the SWR cache above, click → instant render in
     virtually every case. mouseenter only fires on devices with a
     pointer; touch devices fall through to the cold path. */
  var chaptersListForHoverPrefetch = document.getElementById('chapters');
  if (chaptersListForHoverPrefetch) {
    chaptersListForHoverPrefetch.addEventListener('mouseenter', function (hoverEvent) {
      var hoveredRailRow = hoverEvent.target.closest && hoverEvent.target.closest('.bookwriter-chapter[data-chapter-id]');
      if (!hoveredRailRow) return;
      var hoveredChapterId = hoveredRailRow.dataset.chapterId;
      if (!hoveredChapterId) return;
      if (chapterPayloadCacheById[hoveredChapterId]) return;
      if (chapterPayloadInflightById[hoveredChapterId]) return;
      fetchAndCacheChapter(hoveredChapterId);
    }, true);
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
      confirmingClass: 'bookwriter-chapter-delete-affordance-is-confirming',
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
    numDiv.className = 'bookwriter-chapter-rail-row-number';
    // Arabic numerals everywhere — server template renders chapter_number
    // as arabic too (1., 2., 3.). Roman was inconsistent (only 1–20 had
    // mappings, 21+ silently fell back to arabic) and didn't match the
    // initial server-rendered list, so the rail flipped between the two
    // schemes depending on whether you reloaded vs reordered.
    numDiv.textContent = chapterNumber + '.';

    var titleDiv = document.createElement('div');
    titleDiv.className = 'bookwriter-chapter-rail-row-title';
    // Use textContent (not innerHTML) so the title is treated as plain text —
    // the server already sanitized it on save, but defence-in-depth.
    titleDiv.textContent = chapterTitle || 'Untitled Chapter';

    var metaDiv = document.createElement('div');
    metaDiv.className = 'bookwriter-chapter-rail-row-metadata';
    var metaSpan = document.createElement('span');
    var dotIcon = document.createElement('i');
    dotIcon.className = 'bookwriter-chapter-rail-row-status-dot ' + (chapterWordCount > 0 ? 'bookwriter-chapter-rail-row-status-dot-state-draft' : 'bookwriter-chapter-rail-row-status-dot-state-new');
    metaSpan.appendChild(dotIcon);
    metaSpan.appendChild(document.createTextNode((chapterWordCount || 0) + ' w'));
    metaDiv.appendChild(metaSpan);

    rowElement.appendChild(numDiv);
    rowElement.appendChild(titleDiv);
    rowElement.appendChild(metaDiv);

    // Clone the status / visibility picker row from any existing chapter row
    // so the new row matches the server-rendered shape. Without this, freshly
    // created chapters render without the Stage / Visibility selects until
    // the user reloads the page (the original bug). Skip silently if no
    // existing row to clone from (truly first chapter — user reload picks
    // them up).
    if (chapterId) {
      var pickerRowDonor = document.querySelector(
        '#chapters .bookwriter-chapter[data-chapter-id] .bookwriter-chapter-status-picker-row'
      );
      if (pickerRowDonor) {
        var pickerRowClone = pickerRowDonor.cloneNode(true);
        var newChapterIdString = String(chapterId);
        // Rewrite every id / name / data-target-chapter-id reference in the
        // clone so the new selects bind to the new chapter, not the donor's.
        pickerRowClone.querySelectorAll('[id], [name], [for], [data-target-chapter-id]').forEach(function (descendantElement) {
          if (descendantElement.id) {
            descendantElement.id = descendantElement.id.replace(
              /(bookwriter-chapter-)\d+(-)/,
              '$1' + newChapterIdString + '$2'
            );
          }
          if (descendantElement.getAttribute('name')) {
            descendantElement.setAttribute(
              'name',
              descendantElement.getAttribute('name').replace(
                /(bookwriter_chapter_)\d+(_)/,
                '$1' + newChapterIdString + '$2'
              )
            );
          }
          if (descendantElement.getAttribute('for')) {
            descendantElement.setAttribute(
              'for',
              descendantElement.getAttribute('for').replace(
                /(bookwriter-chapter-)\d+(-)/,
                '$1' + newChapterIdString + '$2'
              )
            );
          }
          if (descendantElement.dataset.targetChapterId) {
            descendantElement.dataset.targetChapterId = newChapterIdString;
          }
        });
        // Each select should land on the DB defaults for a fresh chapter
        // (first option in each list). The change-handler on the rail will
        // POST any user-driven change.
        pickerRowClone.querySelectorAll('select').forEach(function (selectElement) {
          if (selectElement.options.length > 0) {
            selectElement.selectedIndex = 0;
          }
        });
        rowElement.appendChild(pickerRowClone);
      }
    }

    rowElement.addEventListener('click', function () {
      switchToChapterFromRail(rowElement);
    });

    attachChapterDeleteAffordance(rowElement);
    return rowElement;
  }

  // Guard against double-clicks creating two chapters (the user reported
  // "double vision — chapter appears twice"). True while a create call
  // is in flight so a second + new click is a no-op until the first
  // finishes (success or failure).
  var addChapterInFlight = false;

  function addChapter() {
    if (addChapterInFlight) return;
    var list = document.getElementById('chapters');
    if (!list) return;
    var bookId = list.dataset.bookId;

    // ---------- REAL DB BRANCH ----------
    if (bookId) {
      addChapterInFlight = true;
      // Clear the editor IMMEDIATELY so the user doesn't briefly see the
      // PREVIOUS chapter's title/body while the new chapter is being
      // created — that was the "opens with default name of existing
      // chapter" bug. Empty the title and prose, drop the chapterId so
      // any stray autosave knows it has nothing to PATCH.
      if (title) title.innerText = '';
      if (prose) {
        prose.innerHTML = '';
        ensureProseHasParagraphContainer(prose);
        delete prose.dataset.chapterId;
      }
      window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(bookId) + '/chapter/create/', {})
        .then(function (data) {
          var newChapter = data.chapter || {};
          var newRow = buildChapterRailRow(newChapter.id, newChapter.number, newChapter.title, newChapter.word_count);
          // Always append at the end — server gives the new chapter the
          // highest sort_order so it belongs at the bottom of the rail.
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
        })
        .then(function () { addChapterInFlight = false; });
      return;
    }

    // ---------- DEMO BRANCH ----------
    var demoCount = list.children.length + 1;
    var demoRow = document.createElement('div');
    demoRow.className = 'bookwriter-chapter';
    demoRow.setAttribute('draggable', 'true');
    demoRow.innerHTML =
      '<div class="bookwriter-chapter-rail-row-number">' + demoCount + '.</div>' +
      '<div class="bookwriter-chapter-rail-row-title">Untitled Chapter</div>' +
      '<div class="bookwriter-chapter-rail-row-metadata"><span><i class="bookwriter-chapter-rail-row-status-dot bookwriter-chapter-rail-row-status-dot-state-new"></i>blank</span><span>just now</span></div>';
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
    modes.forEach(function (modeCode) { document.body.classList.remove('bookwriter-mode-' + modeCode); });
    if (mode !== 'write') document.body.classList.add('bookwriter-mode-' + mode);

    document.querySelectorAll('.bookwriter-mode-switch').forEach(function (modeSwitcherElement) {
      modeSwitcherElement.querySelectorAll('.bookwriter-mode-btn').forEach(function (modeButtonElement) {
        var onclickAttribute = modeButtonElement.getAttribute('onclick') || '';
        var setModeMatch = onclickAttribute.match(/setMode\('(\w+)'\)/);
        var buttonModeCode = setModeMatch ? setModeMatch[1] : null;
        modeButtonElement.classList.toggle('bookwriter-mode-btn-is-active', buttonModeCode === mode);
      });
    });

    saveState({ mode: mode });
  }
  window.setMode = setMode;


  /* INLINE FORMATTING TOOLBAR — extracted to
     modules/bookwriter-formatting-toolbar.js (loaded as a defer
     script in inkwell.html / inkwell_embedded.html). Self-contained
     mousedown handler with no shared state with this IIFE, so the
     module can boot independently. */


  /* ========================================================
     COVER DESIGNER
     ======================================================== */
  /* COVER DESIGNER — extracted to
     modules/bookwriter-cover-designer.js. Owns the cover surface
     element refs, template/font/palette/background tiles, sliders,
     live-preview paint, colour helpers, zoom/flip controls, and the
     debounced POST to /api/book/<id>/cover-design/save/. The
     previous duplicate-listener pattern (one handler for preview,
     a second for persist on the same element) was collapsed into
     single handlers in the module. The three globals the inline
     onclick attributes call (zoom/flip/save-as-cover) are exposed
     from inside the module. */

  document.querySelectorAll('.bookwriter-history-item').forEach(function (historyItemElement) {
    historyItemElement.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-history-item').forEach(function (otherHistoryItemElement) { otherHistoryItemElement.classList.remove('bookwriter-history-item-is-current'); });
      historyItemElement.classList.add('bookwriter-history-item-is-current');
    });
  });


  /* ========================================================
     FOCUS MODE
     ======================================================== */
  var focusTitle   = document.getElementById('focusTitle');
  var focusText    = document.getElementById('focusText');
  var focusWordsElement = document.getElementById('focusWords');
  var focusTimeElement  = document.getElementById('focusTime');
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
    if (focusWordsElement) focusWordsElement.textContent = wordCount.toLocaleString();
    if (focusTimeElement) {
      var elapsedSeconds = Math.floor((Date.now() - focusStart) / 1000);
      var minutesPart = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
      var secondsPart = String(elapsedSeconds % 60).padStart(2, '0');
      focusTimeElement.textContent = minutesPart + ':' + secondsPart;
    }
  }

  if (focusText) focusText.addEventListener('input', updateFocusStats);

  // ESC closes focus / modal / snapshots / sprint setup (in priority)
  document.addEventListener('keydown', function (keydownEvent) {
    if (keydownEvent.key !== 'Escape') return;
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

  /* Slide-out drawer for the rarely-edited book metadata fields
     (status / daily target / manuscript target / synopsis). The
     fields live in #bookwriter-book-settings-panel; their autosave
     wiring is attached by bookwriter-rail-pickers.js via event
     delegation on .bookwriter-book-metadata-fields, which works
     unchanged because we only MOVED the element into the drawer
     (same DOM node, same listeners). */
  function toggleBookSettings() {
    document.body.classList.toggle('bookwriter-book-settings-open');
  }
  window.toggleBookSettings = toggleBookSettings;

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
      emptyStateRow.className = 'bookwriter-snapshot-row';
      var emptyLabel = document.createElement('div');
      emptyLabel.className = 'bookwriter-snapshot-label';
      emptyLabel.textContent = 'No snapshots yet — type to start writing, or click "Name this version" below.';
      emptyStateRow.appendChild(emptyLabel);
      snapshotListContainer.appendChild(emptyStateRow);
      return;
    }
    snapshotRows.forEach(function (snapshotRow, rowIndex) {
      var rowElement = document.createElement('div');
      rowElement.className = 'bookwriter-snapshot-row' + (rowIndex === 0 ? ' bookwriter-snapshot-row-is-current' : '');
      rowElement.dataset.snapshotId = String(snapshotRow.id);

      var timeStampElement = document.createElement('div');
      timeStampElement.className = 'bookwriter-snapshot-time';
      timeStampElement.textContent = formatSnapshotTimestamp(snapshotRow.created_at);

      var labelElement = document.createElement('div');
      labelElement.className = 'bookwriter-snapshot-label';
      labelElement.textContent = snapshotRow.label
        || (snapshotRow.kind === 'manual' ? 'Named version' : 'Auto-saved');

      var metaElement = document.createElement('div');
      metaElement.className = 'bookwriter-snapshot-meta';
      metaElement.textContent = (snapshotRow.word_count || 0).toLocaleString() + ' words · ' + snapshotRow.kind;

      rowElement.appendChild(timeStampElement);
      rowElement.appendChild(labelElement);
      rowElement.appendChild(metaElement);

      if (snapshotRow.word_count_diff !== null && snapshotRow.word_count_diff !== undefined) {
        var diffElement = document.createElement('span');
        diffElement.className = 'bookwriter-snapshot-diff ' + (snapshotRow.word_count_diff >= 0 ? 'bookwriter-plus' : 'bookwriter-minus');
        var sign = snapshotRow.word_count_diff > 0 ? '+' : (snapshotRow.word_count_diff === 0 ? '±' : '−');
        diffElement.textContent = sign + Math.abs(snapshotRow.word_count_diff) + ' words';
        rowElement.appendChild(diffElement);
      }

      rowElement.addEventListener('click', function () {
        snapshotListContainer.querySelectorAll('.bookwriter-snapshot-row').forEach(function (otherRow) {
          otherRow.classList.remove('bookwriter-snapshot-row-is-current');
        });
        rowElement.classList.add('bookwriter-snapshot-row-is-current');
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
    var selectedSnapshotRow = document.querySelector('.bookwriter-snapshot-list .bookwriter-snapshot-row-is-current[data-snapshot-id]');
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
  var draggedChapterRowElement = null;

  function wireChapterDrag() {
    document.querySelectorAll('.bookwriter-chapter[draggable="true"]').forEach(function (chapterRowElement) {
      // Remove old listeners by cloning if already wired
      if (chapterRowElement.dataset.dragWired === '1') return;
      chapterRowElement.dataset.dragWired = '1';

      chapterRowElement.addEventListener('dragstart', function (dragStartEvent) {
        draggedChapterRowElement = chapterRowElement;
        chapterRowElement.classList.add('bookwriter-dragging');
        dragStartEvent.dataTransfer.effectAllowed = 'move';
      });

      chapterRowElement.addEventListener('dragend', function () {
        chapterRowElement.classList.remove('bookwriter-dragging');
        document.querySelectorAll('.bookwriter-chapter').forEach(function (otherChapterRowElement) { otherChapterRowElement.classList.remove('bookwriter-drag-over'); });
      });

      chapterRowElement.addEventListener('dragover', function (dragOverEvent) {
        dragOverEvent.preventDefault();
        if (draggedChapterRowElement !== chapterRowElement) chapterRowElement.classList.add('bookwriter-drag-over');
      });

      chapterRowElement.addEventListener('dragleave', function () {
        chapterRowElement.classList.remove('bookwriter-drag-over');
      });

      chapterRowElement.addEventListener('drop', function (dropEvent) {
        dropEvent.preventDefault();
        if (draggedChapterRowElement && draggedChapterRowElement !== chapterRowElement) {
          var parentChaptersListElement = chapterRowElement.parentNode;
          var siblingChapterRowElements = Array.prototype.slice.call(parentChaptersListElement.children);
          var draggedFromIndex = siblingChapterRowElements.indexOf(draggedChapterRowElement);
          var droppedAtIndex   = siblingChapterRowElements.indexOf(chapterRowElement);
          if (draggedFromIndex < droppedAtIndex) parentChaptersListElement.insertBefore(draggedChapterRowElement, chapterRowElement.nextSibling);
          else                                    parentChaptersListElement.insertBefore(draggedChapterRowElement, chapterRowElement);
          renumberChapters();
          persistChapterReorder();
        }
        chapterRowElement.classList.remove('bookwriter-drag-over');
      });
    });
  }

  function renumberChapters() {
    var activeChapterArabicNumber = null;
    document.querySelectorAll('#chapters .bookwriter-chapter').forEach(function (chapterRow, rowIndex) {
      var newArabicNumber = rowIndex + 1;
      var chapterNumberElement = chapterRow.querySelector('.bookwriter-chapter-rail-row-number');
      // Arabic — matches the server-rendered chapter_number ("1.", "2.", "3.").
      if (chapterNumberElement) chapterNumberElement.innerText = newArabicNumber + '.';
      if (chapterRow.classList.contains('bookwriter-chapter-row-is-active')) {
        activeChapterArabicNumber = newArabicNumber;
      }
    });
    // Reflect the active chapter's NEW number in the editor crumb so
    // "Chapter X" stays in sync with the rail. Without this the crumb
    // keeps the pre-reorder number until the user clicks the row again.
    if (activeChapterArabicNumber !== null) {
      var crumbChapterElement = document.getElementById('bookwriter-crumb-chapter-label');
      var legacyCrumbElement = document.querySelector('.bookwriter-toolbar-crumb strong');
      var chapterLabelElement = document.querySelector('.bookwriter-chapter-label');
      if (crumbChapterElement)  crumbChapterElement.innerText  = 'Chapter ' + activeChapterArabicNumber;
      if (legacyCrumbElement && legacyCrumbElement !== crumbChapterElement) {
        legacyCrumbElement.innerText = 'Chapter ' + activeChapterArabicNumber;
      }
      if (chapterLabelElement) chapterLabelElement.innerText = 'Chapter ' + activeChapterArabicNumber;
    }
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
      document.querySelectorAll('.bookwriter-bible-item').forEach(function (otherBibleItemElement) { otherBibleItemElement.classList.remove('bookwriter-bible-item-is-selected'); });
      item.classList.add('bookwriter-bible-item-is-selected');

      var name   = item.querySelector('.bookwriter-bible-character-name') ? item.querySelector('.bookwriter-bible-character-name').innerText : '';
      var role   = item.querySelector('.bookwriter-bible-character-role') ? item.querySelector('.bookwriter-bible-character-role').innerText : '';
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

  document.querySelectorAll('.bookwriter-bible-category').forEach(function (categoryRowElement) {
    categoryRowElement.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-bible-category').forEach(function (otherBibleCategoryElement) { otherBibleCategoryElement.classList.remove('bookwriter-bible-category-is-selected'); });
      categoryRowElement.classList.add('bookwriter-bible-category-is-selected');
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
      document.querySelectorAll('.bookwriter-sprint-opt').forEach(function (otherSprintOptionElement) { otherSprintOptionElement.classList.remove('bookwriter-sprint-opt-is-selected'); });
      opt.classList.add('bookwriter-sprint-opt-is-selected');
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

  function pickPermission(clickedPermissionTileElement) {
    document.querySelectorAll('.bookwriter-share-permission-tile').forEach(function (sharePermissionTileElement) { sharePermissionTileElement.classList.remove('bookwriter-share-permission-tile-is-selected'); });
    clickedPermissionTileElement.classList.add('bookwriter-share-permission-tile-is-selected');
  }
  window.pickPermission = pickPermission;

  function copyShareLink(btn) {
    var link = document.getElementById('shareLink');
    if (!link) return;
    link.select();
    try { navigator.clipboard.writeText(link.value); } catch (error) { /* clipboard blocked */ }
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
    try { navigator.clipboard.writeText(input.value); } catch (error) { /* clipboard blocked */ }
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
      confirmingClass: 'bookwriter-plot-card-delete-affordance-is-confirming',
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
    var activeCategoryElement = document.querySelector('.bookwriter-bible-categories .bookwriter-bible-category-is-selected');
    return activeCategoryElement ? activeCategoryElement.dataset.categoryCode : null;
  }

  function applyBibleCategoryFilter() {
    var activeCategory = activeBibleCategoryCode();
    document.querySelectorAll('.bookwriter-bible-list .bookwriter-bible-item').forEach(function (rowElement) {
      var rowCategory = rowElement.dataset.categoryCode;
      var shouldShow = (!activeCategory) || (rowCategory === activeCategory);
      rowElement.hidden = !shouldShow;
    });
  }

  function refreshBibleCategoryCount(categoryCode, delta) {
    var countElement = document.querySelector('.bookwriter-bible-category-count[data-category-entry-count="' + categoryCode + '"]');
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
                var nameElement = listRow.querySelector('.bookwriter-bible-character-name');
                if (nameElement) nameElement.textContent = fieldValue || 'Untitled';
                var avatarElement = listRow.querySelector('.bookwriter-bible-avatar');
                if (avatarElement && !avatarElement.dataset.customInitial) {
                  avatarElement.textContent = (fieldValue || '?').slice(0, 1);
                }
              } else {
                var roleElement = listRow.querySelector('.bookwriter-bible-character-role');
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
      otherRow.classList.toggle('bookwriter-bible-item-is-selected', otherRow === rowElement);
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
            var deletedCategoryCode = rowElement.dataset.categoryCode;
            var wasActive = rowElement.classList.contains('bookwriter-bible-item-is-selected');
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
    rowElement.dataset.categoryCode = entryRow.bible_category_code;

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
    nameElement.className = 'bookwriter-bible-character-name';
    nameElement.textContent = entryRow.entry_name || 'Untitled';
    var roleElement = document.createElement('div');
    roleElement.className = 'bookwriter-bible-character-role';
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
  document.querySelectorAll('.bookwriter-bible-categories .bookwriter-bible-category').forEach(function (categoryRow) {
    categoryRow.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-bible-categories .bookwriter-bible-category').forEach(function (otherCategory) {
        otherCategory.classList.toggle('bookwriter-bible-category-is-selected', otherCategory === categoryRow);
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


  /* COVER DESIGNER PERSISTENCE — also extracted to
     modules/bookwriter-cover-designer.js (single click handlers
     do preview + debounced POST in one shot, so the UI section
     and the persist section are merged in the module). */


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
    var activePermissionTile = document.querySelector('.bookwriter-share-permission-tile-is-selected');
    var permissionCode = (activePermissionTile && activePermissionTile.dataset.permissionCode) || 'read';
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

    var permissionElement = document.createElement('div');
    permissionElement.className = 'bookwriter-reader-permission';
    permissionElement.textContent = newShare.permission_code || 'read';

    var revokeButton = document.createElement('button');
    revokeButton.type = 'button';
    revokeButton.className = 'bookwriter-reader-remove bookwriter-revoke-share-button';
    revokeButton.id = 'bookwriter-share-revoke-' + newShare.id + '-button';
    revokeButton.name = 'bookwriter_share_revoke_' + newShare.id + '_button';
    revokeButton.title = 'Revoke this link';
    revokeButton.textContent = '×';

    rowElement.appendChild(avatarElement);
    rowElement.appendChild(nameElement);
    rowElement.appendChild(permissionElement);
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


  // [extracted to modules/bookwriter-beta-reader-management.js — invite / list / remove]

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
    var editorElement = document.querySelector('.bookwriter-manuscript .bookwriter-prose[data-chapter-id]')
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

    // Prefer the stable chapter_id when present (immune to renumbering
    // after reorders and to "1" vs "1." display mismatches). Fall back
    // to the legacy chapterNum lookup so users with old localStorage
    // entries don't get stranded.
    var savedChapterIdString = savedState.chapterId ? String(savedState.chapterId) : '';
    var matchingChapterRow = null;
    if (savedChapterIdString) {
      matchingChapterRow = document.querySelector(
        '#chapters .bookwriter-chapter[data-chapter-id="' + savedChapterIdString + '"]'
      );
    } else if (savedState.chapterNum) {
      var savedChapterNumNormalised = String(savedState.chapterNum).replace(/\.$/, '');
      document.querySelectorAll('.bookwriter-chapter').forEach(function (chapterRow) {
        var chapterNumberElement = chapterRow.querySelector('.bookwriter-chapter-rail-row-number');
        var renderedChapterNumber = chapterNumberElement ? chapterNumberElement.innerText.trim().replace(/\.$/, '') : '';
        if (renderedChapterNumber === savedChapterNumNormalised) matchingChapterRow = chapterRow;
      });
    }
    if (matchingChapterRow && !matchingChapterRow.classList.contains('bookwriter-chapter-row-is-active')) matchingChapterRow.click();

    if (manuscript && typeof savedState.manuscriptScrollY === 'number' && savedState.manuscriptScrollY > 0) {
      manuscript.scrollTop = savedState.manuscriptScrollY;
    }
  }

  setTimeout(restoreState, 0);

})();

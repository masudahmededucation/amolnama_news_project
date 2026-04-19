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
      var raw = window.localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
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
  var prose      = document.querySelector('.prose');
  var title      = document.querySelector('.chapter-title');
  var bigWord    = document.querySelectorAll('.num-big')[0];
  var ribbon     = document.querySelector('.focus-ribbon');
  var saveChip   = document.querySelector('.save-chip');
  var goalText   = document.querySelector('.goal-text .num');

  var saveTimeout;

  function countWords(el) {
    if (!el) return 0;
    return (el.innerText.trim().match(/\S+/g) || []).length;
  }

  function refresh() {
    if (!prose) return;
    var wordCount = countWords(prose);
    if (ribbon)   ribbon.textContent  = '⏳ chapter iii · ' + wordCount.toLocaleString() + ' words';
    if (bigWord)  bigWord.textContent = wordCount.toLocaleString();
    if (goalText) goalText.textContent = wordCount.toLocaleString();

    var ringStrokeCircle = document.querySelector('.ring circle:last-of-type');
    var ringPercentLabel = document.querySelector('.ring text');
    if (ringStrokeCircle && ringPercentLabel) {
      var goalProgressRatio  = Math.min(wordCount / 500, 1.5);
      var ringCircumference = 201;
      ringStrokeCircle.style.strokeDashoffset = ringCircumference - (ringCircumference * Math.min(goalProgressRatio, 1));
      ringPercentLabel.textContent = Math.round(goalProgressRatio * 100) + '%';
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
    saveChip.innerHTML = '<span class="pulse" style="background:var(--ochre);"></span>saving…';
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(performChapterAutosave, BOOKWRITER_AUTOSAVE_DEBOUNCE_MS);
  }

  function performChapterAutosave() {
    if (!prose) return;

    var chapterId = prose.dataset.chapterId;
    if (!chapterId) {
      // Anon / demo mode — no real DB chapter to write to.
      if (saveChip) saveChip.innerHTML = '<span class="pulse"></span>saved to the shelf · just now';
      return;
    }

    var csrfToken = (typeof window.getCsrfTokenValue === 'function')
      ? window.getCsrfTokenValue()
      : '';

    fetch('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/autosave/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      body: JSON.stringify({ chapter_text_html: prose.innerHTML }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function () {
        if (saveChip) saveChip.innerHTML = '<span class="pulse"></span>saved · just now';
      })
      .catch(function () {
        // Network or server error. Keep the user's text in the editor
        // (browser still holds it). Next input event will retry.
        if (saveChip) {
          saveChip.innerHTML =
            '<span class="pulse" style="background:var(--accent);"></span>offline · will retry';
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
    saveChip.innerHTML = '<span class="pulse" style="background:var(--ochre);"></span>saving title…';
    clearTimeout(titleSaveTimeout);
    titleSaveTimeout = setTimeout(performChapterTitleAutosave, BOOKWRITER_AUTOSAVE_DEBOUNCE_MS);
  }

  function performChapterTitleAutosave() {
    if (!prose || !title) return;
    var chapterId = prose.dataset.chapterId;
    if (!chapterId) {
      // Anon / demo — no DB chapter to save to.
      if (saveChip) saveChip.innerHTML = '<span class="pulse"></span>title noted';
      return;
    }
    var csrfToken = (typeof window.getCsrfTokenValue === 'function') ? window.getCsrfTokenValue() : '';
    fetch('/bookwriter/api/chapter/' + encodeURIComponent(chapterId) + '/title/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      body: JSON.stringify({ chapter_title: title.innerText || '' }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function () {
        if (saveChip) saveChip.innerHTML = '<span class="pulse"></span>title saved · just now';
        // Mirror the new title into the matching rail row + the breadcrumb
        // so the rest of the UI stays in sync without a full refresh.
        var activeRailRow = document.querySelector('.chapter.active .ch-title');
        if (activeRailRow) activeRailRow.textContent = title.innerText || 'Untitled';
      })
      .catch(function () {
        if (saveChip) {
          saveChip.innerHTML = '<span class="pulse" style="background:var(--accent);"></span>title offline · will retry';
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
    var initialActiveChapterNumberElement = document.querySelector('.chapter.active .ch-num');
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
    var label = document.querySelector('.chapter-label');
    var crumb = document.querySelector('.crumb strong');
    if (label) label.innerText = 'Chapter ' + (chapterPayload.number || '');
    if (crumb) crumb.innerText = 'Chapter ' + (chapterPayload.number || '');
    refresh();
  }

  function switchToChapterFromRail(chapterRow) {
    document.querySelectorAll('.chapter').forEach(function (x) { x.classList.remove('active'); });
    chapterRow.classList.add('active');

    var realChapterId = chapterRow.dataset.chapterId;

    if (!realChapterId) {
      // ---------- DEMO BRANCH ----------
      var demoChapterTitle = chapterRow.querySelector('.ch-title') ? chapterRow.querySelector('.ch-title').innerText : '';
      var demoChapterNum = chapterRow.querySelector('.ch-num') ? chapterRow.querySelector('.ch-num').innerText.trim() : '';
      if (title) title.innerText = (demoChapterTitle === 'Untitled') ? '' : demoChapterTitle;
      var demoLabel = document.querySelector('.chapter-label');
      var demoCrumb = document.querySelector('.crumb strong');
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

    fetch('/bookwriter/api/chapter/' + encodeURIComponent(realChapterId) + '/', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        applyChapterPayloadToEditor(data.chapter);
        if (saveChip) saveChip.innerHTML = '<span class="pulse"></span>chapter loaded';
        saveState({ chapterNum: String((data.chapter || {}).number || ''), manuscriptScrollY: 0 });
      })
      .catch(function () {
        if (saveChip) {
          saveChip.innerHTML = '<span class="pulse" style="background:var(--accent);"></span>could not load chapter';
        }
      });
  }

  document.querySelectorAll('.chapter').forEach(function (c) {
    c.addEventListener('click', function () { switchToChapterFromRail(c); });
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

  function buildChapterRailRow(chapterId, chapterNumber, chapterTitle, chapterWordCount) {
    var rowElement = document.createElement('div');
    rowElement.className = 'chapter';
    rowElement.setAttribute('draggable', 'true');
    if (chapterId) rowElement.dataset.chapterId = String(chapterId);

    var numDiv = document.createElement('div');
    numDiv.className = 'ch-num';
    numDiv.textContent = (ROMAN_NUMERAL_BY_INDEX[chapterNumber - 1] || chapterNumber) + '.';

    var titleDiv = document.createElement('div');
    titleDiv.className = 'ch-title';
    // Use textContent (not innerHTML) so the title is treated as plain text —
    // the server already sanitized it on save, but defence-in-depth.
    titleDiv.textContent = chapterTitle || 'Untitled';

    var metaDiv = document.createElement('div');
    metaDiv.className = 'ch-meta';
    var metaSpan = document.createElement('span');
    var dotIcon = document.createElement('i');
    dotIcon.className = 'ch-dot ' + (chapterWordCount > 0 ? 'draft' : 'new');
    metaSpan.appendChild(dotIcon);
    metaSpan.appendChild(document.createTextNode((chapterWordCount || 0) + ' w'));
    metaDiv.appendChild(metaSpan);

    rowElement.appendChild(numDiv);
    rowElement.appendChild(titleDiv);
    rowElement.appendChild(metaDiv);

    rowElement.addEventListener('click', function () {
      switchToChapterFromRail(rowElement);
    });

    return rowElement;
  }

  function addChapter() {
    var list = document.getElementById('chapters');
    if (!list) return;
    var bookId = list.dataset.bookId;

    // ---------- REAL DB BRANCH ----------
    if (bookId) {
      var csrfToken = (typeof window.getCsrfTokenValue === 'function') ? window.getCsrfTokenValue() : '';
      fetch('/bookwriter/api/book/' + encodeURIComponent(bookId) + '/chapter/create/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: '{}',
      })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (data) {
          var newChapter = data.chapter || {};
          var newRow = buildChapterRailRow(newChapter.id, newChapter.number, newChapter.title, newChapter.word_count);
          list.appendChild(newRow);
          newRow.click();
          newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          wireChapterDrag();
        })
        .catch(function () {
          if (saveChip) {
            saveChip.innerHTML = '<span class="pulse" style="background:var(--accent);"></span>could not create chapter';
          }
        });
      return;
    }

    // ---------- DEMO BRANCH ----------
    var demoCount = list.children.length + 1;
    var demoRow = document.createElement('div');
    demoRow.className = 'chapter';
    demoRow.setAttribute('draggable', 'true');
    demoRow.innerHTML =
      '<div class="ch-num">' + (ROMAN_NUMERAL_BY_INDEX[demoCount - 1] || demoCount) + '.</div>' +
      '<div class="ch-title">Untitled</div>' +
      '<div class="ch-meta"><span><i class="ch-dot new"></i>blank</span><span>just now</span></div>';
    list.appendChild(demoRow);
    demoRow.addEventListener('click', function () { switchToChapterFromRail(demoRow); });
    demoRow.click();
    demoRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    wireChapterDrag();
  }
  window.addChapter = addChapter;

  function publishFlow() {
    var publishButton = document.querySelector('.publish');
    if (!publishButton) return;
    publishButton.style.background = 'var(--moss)';
    var publishButtonLabel = publishButton.querySelector('span');
    if (publishButtonLabel) publishButtonLabel.innerText = 'Sending to the press…';
    setTimeout(function () {
      if (publishButtonLabel) publishButtonLabel.innerText = 'Published — view link';
      publishButton.style.background = 'var(--accent)';
    }, 1400);
  }
  window.publishFlow = publishFlow;

  refresh();


  /* ========================================================
     MODE SWITCHING (5 modes — write / corkboard / bible / cover / gallery)
     ======================================================== */
  function setMode(mode) {
    var modes = ['write', 'corkboard', 'bible', 'cover', 'gallery'];
    modes.forEach(function (m) { document.body.classList.remove('mode-' + m); });
    if (mode !== 'write') document.body.classList.add('mode-' + mode);

    document.querySelectorAll('.mode-switch').forEach(function (switcher) {
      switcher.querySelectorAll('.mode-btn').forEach(function (btn) {
        var onclick = btn.getAttribute('onclick') || '';
        var match   = onclick.match(/setMode\('(\w+)'\)/);
        var btnMode = match ? match[1] : null;
        btn.classList.toggle('active', btnMode === mode);
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
      var existing = document.querySelector('.cv-subtitle');
      if (inSubtitle.value.trim()) {
        if (existing) {
          existing.innerText = inSubtitle.value;
        } else if (cvTitle) {
          var sub = document.createElement('div');
          sub.className = 'cv-subtitle';
          sub.style.cssText = "font-family: 'EB Garamond', serif; font-style: italic; font-size: 14px; margin-top: 10px; opacity: 0.8;";
          sub.innerText = inSubtitle.value;
          cvTitle.insertAdjacentElement('afterend', sub);
        }
      } else if (existing) {
        existing.remove();
      }
    });
  }

  // Template switching
  document.querySelectorAll('.tmpl').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.tmpl').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      currentStyle = t.dataset.style;
      if (cover) cover.dataset.style = currentStyle;
      applyBackground();
    });
  });

  // Font switching
  document.querySelectorAll('#fontPick button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('#fontPick button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      if (cover) {
        cover.classList.remove('font-serif', 'font-italic', 'font-body', 'font-mono');
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
      var val = tracking.value / 100;
      if (cvTitle)  cvTitle.style.letterSpacing = val + 'em';
      if (trackVal) trackVal.textContent = (tracking.value > 0 ? '+' : '') + tracking.value;
    });
  }

  // Palette switching
  document.querySelectorAll('.pal').forEach(function (p) {
    p.addEventListener('click', function () {
      document.querySelectorAll('.pal').forEach(function (x) { x.classList.remove('active'); });
      p.classList.add('active');
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
  document.querySelectorAll('.bg-opt').forEach(function (b) {
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
            document.querySelectorAll('.bg-opt').forEach(function (x) { x.classList.remove('active'); });
            b.classList.add('active');
            currentBg = 'upload';
            if (cover)    cover.style.background    = 'url(' + ev.target.result + ') center/cover, ' + currentPalette.bg;
            if (coverArt) coverArt.style.background = 'linear-gradient(transparent 40%, rgba(0,0,0,0.55))';
          };
          reader.readAsDataURL(file);
        };
        input.click();
        return;
      }
      document.querySelectorAll('.bg-opt').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
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

  function setAsCover() {
    var setCoverButton = document.querySelector('.set-as-cover');
    if (!setCoverButton) return;
    setCoverButton.style.background = 'var(--moss)';
    var setCoverButtonLabel = setCoverButton.querySelector('span');
    if (setCoverButtonLabel) setCoverButtonLabel.innerText = 'Cover saved to manuscript';
    setTimeout(function () {
      setCoverButton.style.background = 'var(--ink)';
      if (setCoverButtonLabel) setCoverButtonLabel.innerText = 'Set as book cover';
    }, 2000);
  }
  window.setAsCover = setAsCover;

  document.querySelectorAll('.history-item').forEach(function (h) {
    h.addEventListener('click', function () {
      document.querySelectorAll('.history-item').forEach(function (x) { x.classList.remove('current'); });
      h.classList.add('current');
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
    document.body.classList.add('focus-on');
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
    document.body.classList.remove('focus-on');
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
    if (document.body.classList.contains('focus-on'))             return exitFocus();
    if (document.body.classList.contains('modal-open'))           return closeShare();
    if (document.body.classList.contains('snapshots-open'))       return toggleSnapshots();
    if (document.body.classList.contains('sprint-setup-open'))    document.body.classList.remove('sprint-setup-open');
  });


  /* ========================================================
     SNAPSHOTS / VERSION HISTORY
     ======================================================== */
  function toggleSnapshots() {
    document.body.classList.toggle('snapshots-open');
  }
  window.toggleSnapshots = toggleSnapshots;

  document.querySelectorAll('.snap').forEach(function (s) {
    s.addEventListener('click', function () {
      document.querySelectorAll('.snap').forEach(function (x) { x.classList.remove('current'); });
      s.classList.add('current');
    });
  });


  /* ========================================================
     DRAG-REORDER CHAPTERS
     ======================================================== */
  var draggedEl = null;

  function wireChapterDrag() {
    document.querySelectorAll('.chapter[draggable="true"]').forEach(function (ch) {
      // Remove old listeners by cloning if already wired
      if (ch.dataset.dragWired === '1') return;
      ch.dataset.dragWired = '1';

      ch.addEventListener('dragstart', function (e) {
        draggedEl = ch;
        ch.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      ch.addEventListener('dragend', function () {
        ch.classList.remove('dragging');
        document.querySelectorAll('.chapter').forEach(function (c) { c.classList.remove('drag-over'); });
      });

      ch.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (draggedEl !== ch) ch.classList.add('drag-over');
      });

      ch.addEventListener('dragleave', function () {
        ch.classList.remove('drag-over');
      });

      ch.addEventListener('drop', function (e) {
        e.preventDefault();
        if (draggedEl && draggedEl !== ch) {
          var parent = ch.parentNode;
          var items  = Array.prototype.slice.call(parent.children);
          var fromIdx = items.indexOf(draggedEl);
          var toIdx   = items.indexOf(ch);
          if (fromIdx < toIdx) parent.insertBefore(draggedEl, ch.nextSibling);
          else                 parent.insertBefore(draggedEl, ch);
          renumberChapters();
        }
        ch.classList.remove('drag-over');
      });
    });
  }

  function renumberChapters() {
    var roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
    document.querySelectorAll('#chapters .chapter').forEach(function (ch, i) {
      var num = ch.querySelector('.ch-num');
      if (num) num.innerText = (roman[i] || (i + 1)) + '.';
    });
  }

  wireChapterDrag();


  /* ========================================================
     BIBLE — switching between entries / categories
     ======================================================== */
  document.querySelectorAll('.bible-item').forEach(function (item) {
    item.addEventListener('click', function () {
      document.querySelectorAll('.bible-item').forEach(function (x) { x.classList.remove('active'); });
      item.classList.add('active');

      var name   = item.querySelector('.b-name') ? item.querySelector('.b-name').innerText : '';
      var role   = item.querySelector('.b-role') ? item.querySelector('.b-role').innerText : '';
      var avatar = item.querySelector('.bible-avatar');
      var hero   = document.querySelector('.bible-hero');
      if (!hero) return;

      var heroH1   = hero.querySelector('h1');
      var heroRole = hero.querySelector('.role-edit');
      var portrait = hero.querySelector('.bible-portrait');
      if (heroH1)   heroH1.innerText   = name;
      if (heroRole) heroRole.innerText = role;
      if (portrait && avatar) {
        portrait.innerText = avatar.innerText;
        portrait.style.background = avatar.style.background || 'linear-gradient(135deg, var(--ochre), var(--accent))';
      }
    });
  });

  document.querySelectorAll('.bible-cat').forEach(function (cat) {
    cat.addEventListener('click', function () {
      document.querySelectorAll('.bible-cat').forEach(function (x) { x.classList.remove('active'); });
      cat.classList.add('active');
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
    document.body.classList.toggle('sprint-setup-open');
  }
  window.openSprintSetup = openSprintSetup;

  document.querySelectorAll('.sprint-opt').forEach(function (opt) {
    opt.addEventListener('click', function () {
      document.querySelectorAll('.sprint-opt').forEach(function (x) { x.classList.remove('active'); });
      opt.classList.add('active');
      sprintDuration = parseInt(opt.dataset.min, 10) * 60;
    });
  });

  function startSprint() {
    document.body.classList.remove('sprint-setup-open');
    document.body.classList.add('sprint-on');
    sprintRemaining = sprintDuration;
    sprintPaused    = false;
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
          setTimeout(endSprint, 3000);
        }
      }
    }, 1000);
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

  function endSprint() {
    clearInterval(sprintInterval);
    document.body.classList.remove('sprint-on');
  }
  window.endSprint = endSprint;


  /* ========================================================
     BETA SHARE MODAL
     ======================================================== */
  function openShare()  { document.body.classList.add('modal-open'); }
  function closeShare() { document.body.classList.remove('modal-open'); }
  window.openShare  = openShare;
  window.closeShare = closeShare;

  function pickPerm(el) {
    document.querySelectorAll('.perm').forEach(function (p) { p.classList.remove('active'); });
    el.classList.add('active');
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
     CORKBOARD — add new card
     ======================================================== */
  function addIndexCard() {
    var corkboardElement = document.getElementById('corkboard');
    if (!corkboardElement) return;
    var nextSceneNumber = corkboardElement.children.length + 1;
    var indexCardElement = document.createElement('div');
    indexCardElement.className = 'index-card';
    indexCardElement.innerHTML =
      '<div class="card-num">Scene · ' + String(nextSceneNumber).padStart(2, '0') + '</div>' +
      '<div class="card-title" contenteditable="true" spellcheck="false">New scene</div>' +
      '<div class="card-body" contenteditable="true" spellcheck="false" style="color:var(--ink-whisper);">Click to describe what happens…</div>' +
      '<div class="card-tag">unplaced</div>';
    corkboardElement.appendChild(indexCardElement);
    indexCardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(function () {
      var indexCardTitleElement = indexCardElement.querySelector('.card-title');
      if (indexCardTitleElement) indexCardTitleElement.focus();
    }, 200);
  }
  window.addIndexCard = addIndexCard;


  /* ========================================================
     PERSISTENCE — debounced scroll capture + restore on load
     --------------------------------------------------------
     Scroll: fires constantly, so debounce 250ms before write.
     Restore: deferred to next tick so the browser has finished
     laying out the wrapper / grid before we apply mode + scroll.
     Order matters — mode FIRST (changes which view is visible),
     chapter SECOND (changes prose content), scroll LAST. */
  var manuscript = document.querySelector('.manuscript');
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
      document.querySelectorAll('.chapter').forEach(function (chapterRow) {
        var chapterNumberElement = chapterRow.querySelector('.ch-num');
        if (chapterNumberElement && chapterNumberElement.innerText.trim() === savedState.chapterNum) matchingChapterRow = chapterRow;
      });
      if (matchingChapterRow && !matchingChapterRow.classList.contains('active')) matchingChapterRow.click();
    }

    if (manuscript && typeof savedState.manuscriptScrollY === 'number' && savedState.manuscriptScrollY > 0) {
      manuscript.scrollTop = savedState.manuscriptScrollY;
    }
  }

  setTimeout(restoreState, 0);

})();

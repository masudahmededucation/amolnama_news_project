/* Mastermind public book reader v2.
 *
 * Features:
 *   - Chapter switching via TOC (lazy fetch from /public-text/)
 *   - 3 font sizes (small / medium / large) via [data-reader-font-size]
 *   - 3 themes (light / sepia / dark) via [data-reader-theme]
 *   - Reading progress bar (% of chapters complete)
 *   - Sticky chapter header on scroll
 *   - Prev/next chapter buttons + ← → keyboard arrows
 *   - localStorage persistence for font + theme choices
 *   - Mobile TOC drawer with backdrop + ESC + click-outside
 *
 * No console.* / no alert / no confirm. Reader is anonymous-readable —
 * the JS only fetches /public-text/ which 404s on unpublished books.
 */
(function () {
  'use strict';

  var rootElement = document.getElementById('mastermind-book-reader');
  if (!rootElement) return;
  var bookId = parseInt(rootElement.dataset.bookId, 10);

  var sidebarElement = document.getElementById('mastermind-book-reader-sidebar');
  var tocListElement = document.getElementById('mastermind-book-reader-toc');
  var drawerToggleButton = document.getElementById('mastermind-book-reader-toc-toggle');
  var drawerBackdropElement = document.getElementById('mastermind-book-reader-drawer-backdrop');
  var readerPaneElement = document.getElementById('mastermind-book-reader-pane');
  var stickyHeaderElement = document.getElementById('mastermind-book-reader-sticky-header');
  var stickyHeaderTextElement = document.getElementById('mastermind-book-reader-sticky-header-text');
  var prevChapterButton = document.getElementById('mastermind-book-reader-prev-chapter-button');
  var nextChapterButton = document.getElementById('mastermind-book-reader-next-chapter-button');
  var progressFillElement = document.getElementById('mastermind-book-reader-progress-fill');
  var progressWrapElement = document.getElementById('mastermind-book-reader-progress-wrap');
  var fontDecreaseButton = document.getElementById('mastermind-book-reader-font-decrease');
  var fontIncreaseButton = document.getElementById('mastermind-book-reader-font-increase');
  var themeButtons = document.querySelectorAll('.mastermind-book-reader-theme-button');

  if (!tocListElement || !readerPaneElement) return;

  // ---------- Helpers ---------------------------------------------------
  function _escapeHtml(text) {
    var helperDiv = document.createElement('div');
    helperDiv.textContent = text == null ? '' : String(text);
    return helperDiv.innerHTML;
  }

  function _renderChapterText(plainText) {
    if (!plainText) {
      readerPaneElement.innerHTML = '<p class="mastermind-book-reader-empty">এই অধ্যায়ে এখনো কোনো লেখা নেই।</p>';
      return;
    }
    var paragraphChunks = plainText.split(/\n\s*\n/);
    var paragraphHtml = paragraphChunks
      .map(function (rawParagraph) {
        var trimmed = rawParagraph.trim();
        if (!trimmed) return '';
        return '<p class="mastermind-book-reader-paragraph">' + _escapeHtml(trimmed) + '</p>';
      })
      .filter(function (htmlPiece) { return htmlPiece.length > 0; })
      .join('');
    readerPaneElement.innerHTML = paragraphHtml ||
      '<p class="mastermind-book-reader-empty">এই অধ্যায়ে এখনো কোনো লেখা নেই।</p>';
  }

  function _markActiveTocLink(chapterId) {
    var allTocLinks = tocListElement.querySelectorAll('.mastermind-book-reader-toc-link');
    allTocLinks.forEach(function (linkButton) {
      var isActive = parseInt(linkButton.dataset.chapterId, 10) === chapterId;
      linkButton.classList.toggle('mastermind-book-reader-toc-link--active', isActive);
    });
  }

  function _allTocLinks() {
    return tocListElement.querySelectorAll('.mastermind-book-reader-toc-link');
  }

  function _activeChapterIndex() {
    var allTocLinks = _allTocLinks();
    for (var index = 0; index < allTocLinks.length; index++) {
      if (allTocLinks[index].classList.contains('mastermind-book-reader-toc-link--active')) {
        return index;
      }
    }
    return 0;
  }

  function _updateProgressBar() {
    if (!progressFillElement || !progressWrapElement) return;
    var allTocLinks = _allTocLinks();
    var totalChapterCount = allTocLinks.length;
    if (totalChapterCount === 0) return;
    var activeIndex = _activeChapterIndex();
    var completedPercent = Math.round(((activeIndex + 1) / totalChapterCount) * 100);
    progressFillElement.style.width = completedPercent + '%';
    progressWrapElement.setAttribute('aria-valuenow', String(completedPercent));
  }

  function _updateStickyHeader(chapterTitleText) {
    if (!stickyHeaderElement || !stickyHeaderTextElement) return;
    stickyHeaderTextElement.textContent = chapterTitleText || '';
  }

  function _updateNavButtons() {
    if (!prevChapterButton || !nextChapterButton) return;
    var allTocLinks = _allTocLinks();
    var activeIndex = _activeChapterIndex();
    prevChapterButton.disabled = activeIndex <= 0;
    nextChapterButton.disabled = activeIndex >= allTocLinks.length - 1;
  }

  // ---------- Chapter loading ------------------------------------------
  async function _loadChapter(chapterId) {
    _markActiveTocLink(chapterId);
    readerPaneElement.setAttribute('aria-busy', 'true');

    // Update title + progress + nav from the active TOC link (cheap)
    var activeTocLink = tocListElement.querySelector(
      '.mastermind-book-reader-toc-link--active'
    );
    if (activeTocLink) {
      var titleSpan = activeTocLink.querySelector('.mastermind-book-reader-toc-text');
      _updateStickyHeader(titleSpan ? titleSpan.textContent : '');
    }
    _updateProgressBar();
    _updateNavButtons();
    _closeMobileDrawer();

    try {
      var lookupResponse = await fetch(
        '/mastermind/api/book/' + bookId + '/chapter/' + chapterId + '/public-text/',
        { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } },
      );
      if (!lookupResponse.ok) {
        readerPaneElement.innerHTML = '<p class="mastermind-book-reader-empty">এই অধ্যায়টি পড়া যাচ্ছে না।</p>';
        return;
      }
      var chapterPayload = await lookupResponse.json();
      _renderChapterText(chapterPayload.chapter_text || '');
      // Scroll the reader pane back to top so the new chapter starts cleanly
      readerPaneElement.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (loadError) {
      readerPaneElement.innerHTML = '<p class="mastermind-book-reader-empty">নেটওয়ার্ক ত্রুটি — পরে আবার চেষ্টা করুন।</p>';
    } finally {
      readerPaneElement.setAttribute('aria-busy', 'false');
    }
  }

  function _loadChapterByIndex(index) {
    var allTocLinks = _allTocLinks();
    if (index < 0 || index >= allTocLinks.length) return;
    var targetChapterId = parseInt(allTocLinks[index].dataset.chapterId, 10);
    if (targetChapterId) _loadChapter(targetChapterId);
  }

  // ---------- Font size cycler -----------------------------------------
  var FONT_SIZE_VALUES = ['small', 'medium', 'large'];

  function _currentFontSizeIndex() {
    var currentValue = rootElement.dataset.readerFontSize || 'medium';
    var foundIndex = FONT_SIZE_VALUES.indexOf(currentValue);
    return foundIndex === -1 ? 1 : foundIndex;
  }

  function _setFontSize(value) {
    if (FONT_SIZE_VALUES.indexOf(value) === -1) return;
    rootElement.dataset.readerFontSize = value;
    try {
      if (window.localStorage) localStorage.setItem('reader_font_size', value);
    } catch (storageBlockedError) { /* private mode */ }
  }

  function _decreaseFontSize() {
    var nextIndex = Math.max(0, _currentFontSizeIndex() - 1);
    _setFontSize(FONT_SIZE_VALUES[nextIndex]);
  }

  function _increaseFontSize() {
    var nextIndex = Math.min(FONT_SIZE_VALUES.length - 1, _currentFontSizeIndex() + 1);
    _setFontSize(FONT_SIZE_VALUES[nextIndex]);
  }

  // ---------- Theme switcher -------------------------------------------
  var THEME_VALUES = ['light', 'sepia', 'dark'];

  function _setTheme(themeValue) {
    if (THEME_VALUES.indexOf(themeValue) === -1) return;
    rootElement.dataset.readerTheme = themeValue;
    try {
      if (window.localStorage) localStorage.setItem('reader_theme', themeValue);
    } catch (storageBlockedError) { /* private mode */ }
    themeButtons.forEach(function (themeButton) {
      var isPressed = themeButton.dataset.themeValue === themeValue;
      themeButton.setAttribute('aria-pressed', isPressed ? 'true' : 'false');
    });
  }

  // ---------- Mobile TOC drawer ----------------------------------------
  function _openMobileDrawer() {
    if (!sidebarElement) return;
    sidebarElement.classList.add('mastermind-book-reader-sidebar--open');
    if (drawerBackdropElement) drawerBackdropElement.hidden = false;
    if (drawerToggleButton) drawerToggleButton.setAttribute('aria-expanded', 'true');
  }

  function _closeMobileDrawer() {
    if (!sidebarElement) return;
    sidebarElement.classList.remove('mastermind-book-reader-sidebar--open');
    if (drawerBackdropElement) drawerBackdropElement.hidden = true;
    if (drawerToggleButton) drawerToggleButton.setAttribute('aria-expanded', 'false');
  }

  // ---------- Sticky header on scroll ---------------------------------
  function _updateStickyHeaderVisibility() {
    if (!stickyHeaderElement || !readerPaneElement) return;
    var paneRect = readerPaneElement.getBoundingClientRect();
    // Show sticky header once the user has scrolled past the original h1
    stickyHeaderElement.hidden = paneRect.top > 80;
  }

  // ---------- Wire events ---------------------------------------------
  tocListElement.addEventListener('click', function (clickEvent) {
    var clickedLink = clickEvent.target.closest('.mastermind-book-reader-toc-link');
    if (!clickedLink) return;
    var clickedChapterId = parseInt(clickedLink.dataset.chapterId, 10);
    if (clickedChapterId) _loadChapter(clickedChapterId);
  });

  if (prevChapterButton) {
    prevChapterButton.addEventListener('click', function () {
      _loadChapterByIndex(_activeChapterIndex() - 1);
    });
  }
  if (nextChapterButton) {
    nextChapterButton.addEventListener('click', function () {
      _loadChapterByIndex(_activeChapterIndex() + 1);
    });
  }

  if (fontDecreaseButton) fontDecreaseButton.addEventListener('click', _decreaseFontSize);
  if (fontIncreaseButton) fontIncreaseButton.addEventListener('click', _increaseFontSize);

  themeButtons.forEach(function (themeButton) {
    themeButton.addEventListener('click', function () {
      _setTheme(themeButton.dataset.themeValue);
    });
  });

  if (drawerToggleButton) {
    drawerToggleButton.addEventListener('click', function () {
      var isOpen = sidebarElement && sidebarElement.classList.contains('mastermind-book-reader-sidebar--open');
      if (isOpen) _closeMobileDrawer();
      else _openMobileDrawer();
    });
  }
  if (drawerBackdropElement) drawerBackdropElement.addEventListener('click', _closeMobileDrawer);

  document.addEventListener('keydown', function (keyboardEvent) {
    var activeTagName = (document.activeElement && document.activeElement.tagName) || '';
    if (activeTagName === 'INPUT' || activeTagName === 'TEXTAREA' || activeTagName === 'SELECT') return;
    if (keyboardEvent.key === 'ArrowLeft') {
      keyboardEvent.preventDefault();
      _loadChapterByIndex(_activeChapterIndex() - 1);
    } else if (keyboardEvent.key === 'ArrowRight') {
      keyboardEvent.preventDefault();
      _loadChapterByIndex(_activeChapterIndex() + 1);
    } else if (keyboardEvent.key === 'Escape') {
      _closeMobileDrawer();
    }
  });

  window.addEventListener('scroll', _updateStickyHeaderVisibility, { passive: true });

  // ---------- Bootstrap: restore font + theme from localStorage --------
  try {
    if (window.localStorage) {
      var savedFontSize = localStorage.getItem('reader_font_size');
      if (savedFontSize) _setFontSize(savedFontSize);
      var savedTheme = localStorage.getItem('reader_theme');
      if (savedTheme) _setTheme(savedTheme);
    }
  } catch (storageBlockedError) { /* private mode */ }

  // Initial sticky-header text + progress + nav state
  var firstActiveTocLink = tocListElement.querySelector('.mastermind-book-reader-toc-link--active');
  if (firstActiveTocLink) {
    var firstTitleSpan = firstActiveTocLink.querySelector('.mastermind-book-reader-toc-text');
    _updateStickyHeader(firstTitleSpan ? firstTitleSpan.textContent : '');
  }
  _updateProgressBar();
  _updateNavButtons();
})();

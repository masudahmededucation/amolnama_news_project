/* Mastermind public book reader — chapter switching.
 *
 * The first chapter is rendered server-side for fast initial paint.
 * When the user clicks a TOC entry, this controller fetches the chapter
 * text via the public-readable get-text endpoint (book is published →
 * staff/owner check still passes for any logged-in user; for anonymous
 * users it would 403 — TODO v2 add a public endpoint that doesn't require
 * the staff/owner check for status='published' books).
 *
 * For v1 the public reader works for logged-in users. Anonymous users see
 * the first chapter only.
 */
(function () {
  'use strict';

  var rootElement = document.getElementById('mastermind-book-reader');
  if (!rootElement) return;
  var bookId = parseInt(rootElement.dataset.bookId, 10);

  var tocListElement = document.getElementById('mastermind-book-reader-toc');
  var readerPaneElement = document.getElementById('mastermind-book-reader-pane');
  if (!tocListElement || !readerPaneElement) return;

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
    // Split on blank-line paragraph boundaries; escape every paragraph.
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

  async function _loadChapter(chapterId) {
    _markActiveTocLink(chapterId);
    readerPaneElement.setAttribute('aria-busy', 'true');
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
      readerPaneElement.scrollTop = 0;
    } catch (loadError) {
      readerPaneElement.innerHTML = '<p class="mastermind-book-reader-empty">নেটওয়ার্ক ত্রুটি — পরে আবার চেষ্টা করুন।</p>';
    } finally {
      readerPaneElement.setAttribute('aria-busy', 'false');
    }
  }

  tocListElement.addEventListener('click', function (clickEvent) {
    var clickedLink = clickEvent.target.closest('.mastermind-book-reader-toc-link');
    if (!clickedLink) return;
    var clickedChapterId = parseInt(clickedLink.dataset.chapterId, 10);
    if (clickedChapterId) _loadChapter(clickedChapterId);
  });
})();

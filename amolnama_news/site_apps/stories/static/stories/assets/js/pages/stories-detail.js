/* stories-detail.js — Story detail page interactions (view tracking, page nav, actions-bar init). */
(function () {
  'use strict';

  const storyDetailElement = document.querySelector('.stories-detail');
  if (!storyDetailElement) return;
  const storyId = storyDetailElement.getAttribute('data-story-id');

  /* ---- View count on page load ---- */
  if (storyId) {
    fetch('/stories-for-kids/api/' + storyId + '/view/', {
      method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
    }).catch(function (viewIncrementError) { console.error('story view increment failed', viewIncrementError); });
  }

  /* ---- Init shared actions bar (like + bookmark + share) ---- */
  if (window.actionsBar && typeof window.actionsBar.init === 'function') {
    window.actionsBar.init({
      buildLikeApiUrl: function (entityId) { return '/stories-for-kids/api/' + entityId + '/like/'; },
    });
  }

  /* ---- Page navigation (paginated reader) ---- */
  let currentPage = 1;
  const allPages = document.querySelectorAll('.stories-detail-page');
  const totalPages = allPages.length;
  const prevButton = document.getElementById('stories-detail-page-previous-button');
  const nextButton = document.getElementById('stories-detail-page-next-button');
  const pageCounter = document.getElementById('stories-detail-page-counter');

  function showPage(pageNumber) {
    for (let pageIndex = 0; pageIndex < allPages.length; pageIndex++) {
      allPages[pageIndex].hidden = (pageIndex + 1 !== pageNumber);
    }
    currentPage = pageNumber;
    if (pageCounter) pageCounter.textContent = 'পাতা ' + currentPage + ' / ' + totalPages;
    if (prevButton) prevButton.disabled = (currentPage <= 1);
    if (nextButton) nextButton.disabled = (currentPage >= totalPages);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (prevButton) {
    prevButton.addEventListener('click', function () {
      if (currentPage > 1) showPage(currentPage - 1);
    });
  }
  if (nextButton) {
    nextButton.addEventListener('click', function () {
      if (currentPage < totalPages) showPage(currentPage + 1);
    });
  }
})();

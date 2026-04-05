/* stories-detail.js — Story detail page interactions (like, bookmark, view, pagination). */
(function () {
  'use strict';


  const storyDetailElement = document.querySelector('.stories-detail');
  if (!storyDetailElement) return;
  const storyId = storyDetailElement.getAttribute('data-story-id');

  /* ---- View count on page load ---- */
  if (storyId) {
    fetch('/stories-for-kids/api/' + storyId + '/view/', {
      method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
    }).catch(function () { /* non-critical */ });
  }

  /* ---- Page navigation ---- */
  let currentPage = 1;
  const allPages = document.querySelectorAll('.stories-detail-page');
  const totalPages = allPages.length;
  const prevButton = document.getElementById('stories-detail-page-prev-button');
  const nextButton = document.getElementById('stories-detail-page-next-button');
  const pageCounter = document.getElementById('stories-detail-page-counter');

  function showPage(pageNumber) {
    for (let pageIndex = 0; pageIndex < allPages.length; pageIndex++) {
      allPages[pageIndex].style.display = (pageIndex + 1 === pageNumber) ? 'block' : 'none';
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

  /* ---- Single delegated click handler ---- */
  document.addEventListener('click', function (event) {
    const target = event.target;

    /* Like toggle */
    const likeButton = target.closest('.stories-detail-like-button');
    if (likeButton) {
      event.preventDefault();
      const likeStoryId = likeButton.getAttribute('data-story-id');
      if (!likeStoryId) return;

      const likeIcon = likeButton.querySelector('.stories-detail-action-icon');
      const likeCount = likeButton.querySelector('.stories-detail-like-count');
      const wasLiked = likeButton.classList.contains('stories-detail-like-button-active');
      const currentCount = parseInt(likeCount ? likeCount.textContent : '0', 10) || 0;

      if (wasLiked) {
        likeButton.classList.remove('stories-detail-like-button-active');
        if (likeIcon) likeIcon.textContent = '🤍';
        if (likeCount) likeCount.textContent = Math.max(0, currentCount - 1);
      } else {
        likeButton.classList.add('stories-detail-like-button-active');
        if (likeIcon) likeIcon.textContent = '❤️';
        if (likeCount) likeCount.textContent = currentCount + 1;
      }

      likeButton.style.transform = 'scale(1.15)';
      setTimeout(function () { likeButton.style.transform = ''; }, 150);

      fetch('/stories-for-kids/api/' + likeStoryId + '/like/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success && likeCount) likeCount.textContent = data.like_count;
      })
      .catch(function (networkError) {
        if (wasLiked) { likeButton.classList.add('stories-detail-like-button-active'); if (likeIcon) likeIcon.textContent = '❤️'; }
        else { likeButton.classList.remove('stories-detail-like-button-active'); if (likeIcon) likeIcon.textContent = '🤍'; }
        if (likeCount) likeCount.textContent = currentCount;
      });
      return;
    }

    /* Bookmark toggle */
    const bookmarkButton = target.closest('.stories-detail-bookmark-button');
    if (bookmarkButton) {
      event.preventDefault();
      const bookmarkStoryId = bookmarkButton.getAttribute('data-story-id');
      if (!bookmarkStoryId) return;

      const bookmarkIcon = bookmarkButton.querySelector('.stories-detail-action-icon');
      const bookmarkCount = bookmarkButton.querySelector('.stories-detail-bookmark-count');
      const wasBookmarked = bookmarkButton.classList.contains('stories-detail-bookmark-button-active');
      const currentBookmarkCount = parseInt(bookmarkCount ? bookmarkCount.textContent : '0', 10) || 0;

      if (wasBookmarked) {
        bookmarkButton.classList.remove('stories-detail-bookmark-button-active');
        if (bookmarkIcon) bookmarkIcon.textContent = '📑';
        if (bookmarkCount) bookmarkCount.textContent = Math.max(0, currentBookmarkCount - 1);
      } else {
        bookmarkButton.classList.add('stories-detail-bookmark-button-active');
        if (bookmarkIcon) bookmarkIcon.textContent = '🔖';
        if (bookmarkCount) bookmarkCount.textContent = currentBookmarkCount + 1;
      }

      bookmarkButton.style.transform = 'scale(1.15)';
      setTimeout(function () { bookmarkButton.style.transform = ''; }, 150);

      fetch('/stories-for-kids/api/' + bookmarkStoryId + '/bookmark/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success && bookmarkCount) bookmarkCount.textContent = data.bookmark_count;
      })
      .catch(function (networkError) {
        if (wasBookmarked) { bookmarkButton.classList.add('stories-detail-bookmark-button-active'); if (bookmarkIcon) bookmarkIcon.textContent = '🔖'; }
        else { bookmarkButton.classList.remove('stories-detail-bookmark-button-active'); if (bookmarkIcon) bookmarkIcon.textContent = '📑'; }
        if (bookmarkCount) bookmarkCount.textContent = currentBookmarkCount;
      });
      return;
    }
  });
})();

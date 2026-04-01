/* stories-detail.js — Story detail page interactions (like, bookmark, view, pagination). */
(function () {
  'use strict';

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  var storyDetailElement = document.querySelector('.stories-detail');
  if (!storyDetailElement) return;
  var storyId = storyDetailElement.getAttribute('data-story-id');

  /* ---- View count on page load ---- */
  if (storyId) {
    fetch('/stories-for-kids/api/' + storyId + '/view/', {
      method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
    }).catch(function () { /* non-critical */ });
  }

  /* ---- Page navigation ---- */
  var currentPage = 1;
  var allPages = document.querySelectorAll('.stories-detail-page');
  var totalPages = allPages.length;
  var prevButton = document.getElementById('stories-detail-page-prev-button');
  var nextButton = document.getElementById('stories-detail-page-next-button');
  var pageCounter = document.getElementById('stories-detail-page-counter');

  function showPage(pageNumber) {
    for (var pageIndex = 0; pageIndex < allPages.length; pageIndex++) {
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
    var target = event.target;

    /* Like toggle */
    var likeButton = target.closest('.stories-detail-like-button');
    if (likeButton) {
      event.preventDefault();
      var likeStoryId = likeButton.getAttribute('data-story-id');
      if (!likeStoryId) return;

      var likeIcon = likeButton.querySelector('.stories-detail-action-icon');
      var likeCount = likeButton.querySelector('.stories-detail-like-count');
      var wasLiked = likeButton.classList.contains('stories-detail-like-button-active');
      var currentCount = parseInt(likeCount ? likeCount.textContent : '0', 10) || 0;

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
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success && likeCount) likeCount.textContent = data.like_count;
      })
      .catch(function (networkError) {
        console.error('Like toggle failed:', networkError);
        if (wasLiked) { likeButton.classList.add('stories-detail-like-button-active'); if (likeIcon) likeIcon.textContent = '❤️'; }
        else { likeButton.classList.remove('stories-detail-like-button-active'); if (likeIcon) likeIcon.textContent = '🤍'; }
        if (likeCount) likeCount.textContent = currentCount;
      });
      return;
    }

    /* Bookmark toggle */
    var bookmarkButton = target.closest('.stories-detail-bookmark-button');
    if (bookmarkButton) {
      event.preventDefault();
      var bookmarkStoryId = bookmarkButton.getAttribute('data-story-id');
      if (!bookmarkStoryId) return;

      var bookmarkIcon = bookmarkButton.querySelector('.stories-detail-action-icon');
      var bookmarkCount = bookmarkButton.querySelector('.stories-detail-bookmark-count');
      var wasBookmarked = bookmarkButton.classList.contains('stories-detail-bookmark-button-active');
      var currentBookmarkCount = parseInt(bookmarkCount ? bookmarkCount.textContent : '0', 10) || 0;

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
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success && bookmarkCount) bookmarkCount.textContent = data.bookmark_count;
      })
      .catch(function (networkError) {
        console.error('Bookmark toggle failed:', networkError);
        if (wasBookmarked) { bookmarkButton.classList.add('stories-detail-bookmark-button-active'); if (bookmarkIcon) bookmarkIcon.textContent = '🔖'; }
        else { bookmarkButton.classList.remove('stories-detail-bookmark-button-active'); if (bookmarkIcon) bookmarkIcon.textContent = '📑'; }
        if (bookmarkCount) bookmarkCount.textContent = currentBookmarkCount;
      });
      return;
    }
  });
})();

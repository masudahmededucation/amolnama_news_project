/* art-detail.js — Art detail page interactions (like, bookmark, view, lightbox). */
(function () {
  'use strict';

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  var artDetailElement = document.querySelector('.art-detail');
  if (!artDetailElement) return;
  var artworkId = artDetailElement.getAttribute('data-artwork-id');

  /* ---- View count on page load ---- */
  if (artworkId) {
    fetch('/art-and-craft/api/' + artworkId + '/view/', {
      method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
    }).catch(function () { /* non-critical */ });
  }

  /* ---- Photo lightbox ---- */
  var galleryItems = document.querySelectorAll('.art-detail-gallery-item');
  for (var galleryIndex = 0; galleryIndex < galleryItems.length; galleryIndex++) {
    galleryItems[galleryIndex].addEventListener('click', function () {
      var photoUrl = this.getAttribute('data-photo-url');
      if (photoUrl && window.photoLightbox) {
        var allPhotos = [];
        var clickedIndex = 0;
        var allItems = document.querySelectorAll('.art-detail-gallery-item[data-photo-url]');
        for (var itemIndex = 0; itemIndex < allItems.length; itemIndex++) {
          allPhotos.push({ url: allItems[itemIndex].getAttribute('data-photo-url'), caption: '' });
          if (allItems[itemIndex] === this) clickedIndex = itemIndex;
        }
        window.photoLightbox.open(allPhotos, clickedIndex);
      }
    });
  }

  /* ---- Single delegated click handler ---- */
  document.addEventListener('click', function (event) {
    var target = event.target;

    /* Like toggle */
    var likeButton = target.closest('.art-detail-like-button');
    if (likeButton) {
      event.preventDefault();
      var likeArtworkId = likeButton.getAttribute('data-artwork-id');
      if (!likeArtworkId) return;

      /* Optimistic UI */
      var likeIcon = likeButton.querySelector('.art-detail-action-icon');
      var likeCount = likeButton.querySelector('.art-detail-like-count');
      var wasLiked = likeButton.classList.contains('art-detail-like-button-active');
      var currentCount = parseInt(likeCount ? likeCount.textContent : '0', 10) || 0;

      if (wasLiked) {
        likeButton.classList.remove('art-detail-like-button-active');
        if (likeIcon) likeIcon.textContent = '🤍';
        if (likeCount) likeCount.textContent = Math.max(0, currentCount - 1);
      } else {
        likeButton.classList.add('art-detail-like-button-active');
        if (likeIcon) likeIcon.textContent = '❤️';
        if (likeCount) likeCount.textContent = currentCount + 1;
      }

      likeButton.style.transform = 'scale(1.15)';
      setTimeout(function () { likeButton.style.transform = ''; }, 150);

      fetch('/art-and-craft/api/' + likeArtworkId + '/like/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success && likeCount) likeCount.textContent = data.like_count;
      })
      .catch(function (networkError) {
        console.error('Like toggle failed:', networkError);
        /* Revert */
        if (wasLiked) {
          likeButton.classList.add('art-detail-like-button-active');
          if (likeIcon) likeIcon.textContent = '❤️';
        } else {
          likeButton.classList.remove('art-detail-like-button-active');
          if (likeIcon) likeIcon.textContent = '🤍';
        }
        if (likeCount) likeCount.textContent = currentCount;
      });
      return;
    }

    /* Bookmark toggle */
    var bookmarkButton = target.closest('.art-detail-bookmark-button');
    if (bookmarkButton) {
      event.preventDefault();
      var bookmarkArtworkId = bookmarkButton.getAttribute('data-artwork-id');
      if (!bookmarkArtworkId) return;

      var bookmarkIcon = bookmarkButton.querySelector('.art-detail-action-icon');
      var bookmarkCount = bookmarkButton.querySelector('.art-detail-bookmark-count');
      var wasBookmarked = bookmarkButton.classList.contains('art-detail-bookmark-button-active');
      var currentBookmarkCount = parseInt(bookmarkCount ? bookmarkCount.textContent : '0', 10) || 0;

      if (wasBookmarked) {
        bookmarkButton.classList.remove('art-detail-bookmark-button-active');
        if (bookmarkIcon) bookmarkIcon.textContent = '📑';
        if (bookmarkCount) bookmarkCount.textContent = Math.max(0, currentBookmarkCount - 1);
      } else {
        bookmarkButton.classList.add('art-detail-bookmark-button-active');
        if (bookmarkIcon) bookmarkIcon.textContent = '🔖';
        if (bookmarkCount) bookmarkCount.textContent = currentBookmarkCount + 1;
      }

      bookmarkButton.style.transform = 'scale(1.15)';
      setTimeout(function () { bookmarkButton.style.transform = ''; }, 150);

      fetch('/art-and-craft/api/' + bookmarkArtworkId + '/bookmark/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success && bookmarkCount) bookmarkCount.textContent = data.bookmark_count;
      })
      .catch(function (networkError) {
        console.error('Bookmark toggle failed:', networkError);
        if (wasBookmarked) {
          bookmarkButton.classList.add('art-detail-bookmark-button-active');
          if (bookmarkIcon) bookmarkIcon.textContent = '🔖';
        } else {
          bookmarkButton.classList.remove('art-detail-bookmark-button-active');
          if (bookmarkIcon) bookmarkIcon.textContent = '📑';
        }
        if (bookmarkCount) bookmarkCount.textContent = currentBookmarkCount;
      });
      return;
    }
  });
})();

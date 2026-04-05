/* art-detail.js — Art detail page interactions (like, bookmark, view, lightbox). */
(function () {
  'use strict';


  const artDetailElement = document.querySelector('.art-detail');
  if (!artDetailElement) return;
  const artworkId = artDetailElement.getAttribute('data-artwork-id');

  /* ---- View count on page load ---- */
  if (artworkId) {
    fetch('/art-and-craft/api/' + artworkId + '/view/', {
      method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
    }).catch(function () { /* non-critical */ });
  }

  /* ---- Photo lightbox ---- */
  const galleryItems = document.querySelectorAll('.art-detail-gallery-item');
  for (let galleryIndex = 0; galleryIndex < galleryItems.length; galleryIndex++) {
    galleryItems[galleryIndex].addEventListener('click', function () {
      const photoUrl = this.getAttribute('data-photo-url');
      if (photoUrl && window.photoLightbox) {
        const allPhotos = [];
        let clickedIndex = 0;
        const allItems = document.querySelectorAll('.art-detail-gallery-item[data-photo-url]');
        for (let itemIndex = 0; itemIndex < allItems.length; itemIndex++) {
          allPhotos.push({ url: allItems[itemIndex].getAttribute('data-photo-url'), caption: '' });
          if (allItems[itemIndex] === this) clickedIndex = itemIndex;
        }
        window.photoLightbox.open(allPhotos, clickedIndex);
      }
    });
  }

  /* ---- Single delegated click handler ---- */
  document.addEventListener('click', function (event) {
    const target = event.target;

    /* Like toggle */
    const likeButton = target.closest('.art-detail-like-button');
    if (likeButton) {
      event.preventDefault();
      const likeArtworkId = likeButton.getAttribute('data-artwork-id');
      if (!likeArtworkId) return;

      /* Optimistic UI */
      const likeIcon = likeButton.querySelector('.art-detail-action-icon');
      const likeCount = likeButton.querySelector('.art-detail-like-count');
      const wasLiked = likeButton.classList.contains('art-detail-like-button-active');
      const currentCount = parseInt(likeCount ? likeCount.textContent : '0', 10) || 0;

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
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success && likeCount) likeCount.textContent = data.like_count;
      })
      .catch(function (networkError) {
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
    const bookmarkButton = target.closest('.art-detail-bookmark-button');
    if (bookmarkButton) {
      event.preventDefault();
      const bookmarkArtworkId = bookmarkButton.getAttribute('data-artwork-id');
      if (!bookmarkArtworkId) return;

      const bookmarkIcon = bookmarkButton.querySelector('.art-detail-action-icon');
      const bookmarkCount = bookmarkButton.querySelector('.art-detail-bookmark-count');
      const wasBookmarked = bookmarkButton.classList.contains('art-detail-bookmark-button-active');
      const currentBookmarkCount = parseInt(bookmarkCount ? bookmarkCount.textContent : '0', 10) || 0;

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
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success && bookmarkCount) bookmarkCount.textContent = data.bookmark_count;
      })
      .catch(function (networkError) {
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

/* art-detail.js — Art detail page interactions (view tracking, lightbox, actions-bar init). */
(function () {
  'use strict';

  const artDetailElement = document.querySelector('.art-detail');
  if (!artDetailElement) return;
  const artworkId = artDetailElement.getAttribute('data-artwork-id');

  /* ---- View count on page load ---- */
  if (artworkId) {
    fetch('/art-and-craft/api/' + artworkId + '/view/', {
      method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
    }).catch(function (viewIncrementError) {
      console.error('art view increment failed', viewIncrementError);
    });
  }

  /* ---- Init shared actions bar (like + bookmark + share) ---- */
  if (window.actionsBar && typeof window.actionsBar.init === 'function') {
    window.actionsBar.init({
      buildLikeApiUrl: function (entityId) { return '/art-and-craft/api/' + entityId + '/like/'; },
    });
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
})();

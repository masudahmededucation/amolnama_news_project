/**
 * photo-lightbox.js — Shared photo lightbox component.
 *
 * Usage:
 *   window.photoLightbox.init({
 *     thumbSelector: '.my-photo-thumb[data-photo-url]',
 *     gridSelector: '#my-photo-grid',
 *     excludeSelectors: ['.my-edit-button', '.my-delete-button'],
 *   });
 *
 *   // Or open programmatically:
 *   window.photoLightbox.open(index);
 *
 * HTML dependency: include core/components/photo-lightbox.html
 * CSS dependency: core/assets/css/components/photo-lightbox.css
 *
 * Thumb elements must have:
 *   data-photo-url   — full image URL
 *   data-photo-caption — optional caption text
 */
(function () {
  'use strict';

  var lightboxElement = document.getElementById('photo-lightbox');
  var lightboxImageElement = document.getElementById('photo-lightbox-image');
  var lightboxCaptionElement = document.getElementById('photo-lightbox-caption');
  var lightboxCounterElement = document.getElementById('photo-lightbox-counter');
  var currentPhotoIndex = 0;
  var thumbSelector = '';
  var gridElement = null;
  var excludeSelectors = [];

  function getPhotoThumbs() {
    if (gridElement) return gridElement.querySelectorAll(thumbSelector);
    return document.querySelectorAll(thumbSelector);
  }

  function openLightbox(index) {
    var thumbs = getPhotoThumbs();
    if (!thumbs.length || !lightboxElement) return;
    currentPhotoIndex = index;
    showCurrentPhoto();
    lightboxElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxElement) return;
    lightboxElement.style.display = 'none';
    document.body.style.overflow = '';
  }

  function showCurrentPhoto() {
    var thumbs = getPhotoThumbs();
    if (!thumbs.length) return;
    var thumbElement = thumbs[currentPhotoIndex];
    lightboxImageElement.src = thumbElement.getAttribute('data-photo-url');
    lightboxCaptionElement.textContent = thumbElement.getAttribute('data-photo-caption') || '';
    lightboxCounterElement.textContent = (currentPhotoIndex + 1) + ' / ' + thumbs.length;
  }

  function showNextPhoto() {
    var thumbs = getPhotoThumbs();
    currentPhotoIndex = (currentPhotoIndex + 1) % thumbs.length;
    showCurrentPhoto();
  }

  function showPreviousPhoto() {
    var thumbs = getPhotoThumbs();
    currentPhotoIndex = (currentPhotoIndex - 1 + thumbs.length) % thumbs.length;
    showCurrentPhoto();
  }

  /* ---- Event listeners ---- */

  if (lightboxElement) {
    var closeButton = document.getElementById('photo-lightbox-close-button');
    var overlayElement = document.getElementById('photo-lightbox-overlay');
    var previousButton = document.getElementById('photo-lightbox-previous-button');
    var nextButton = document.getElementById('photo-lightbox-next-button');

    if (closeButton) closeButton.addEventListener('click', closeLightbox);
    if (overlayElement) overlayElement.addEventListener('click', closeLightbox);
    if (previousButton) previousButton.addEventListener('click', showPreviousPhoto);
    if (nextButton) nextButton.addEventListener('click', showNextPhoto);

    /* Keyboard navigation */
    document.addEventListener('keydown', function (event) {
      if (lightboxElement.style.display === 'none') return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') showPreviousPhoto();
      if (event.key === 'ArrowRight') showNextPhoto();
    });
  }

  /* ---- Init — bind click handlers to photo grid ---- */

  function initLightbox(config) {
    thumbSelector = config.thumbSelector || '[data-photo-url]';
    excludeSelectors = config.excludeSelectors || [];

    if (config.gridSelector) {
      gridElement = document.querySelector(config.gridSelector);
    }

    /* Delegated click on the grid or document */
    var clickTarget = gridElement || document;
    clickTarget.addEventListener('click', function (event) {
      /* Skip excluded elements (edit/delete/cover buttons) */
      for (var excludeIndex = 0; excludeIndex < excludeSelectors.length; excludeIndex++) {
        if (event.target.closest(excludeSelectors[excludeIndex])) return;
      }

      var thumbElement = event.target.closest(thumbSelector);
      if (!thumbElement) return;

      /* Find index among all thumbs */
      var allThumbs = getPhotoThumbs();
      for (var thumbIndex = 0; thumbIndex < allThumbs.length; thumbIndex++) {
        if (allThumbs[thumbIndex] === thumbElement) {
          openLightbox(thumbIndex);
          return;
        }
      }
    });
  }

  /* ---- Public API ---- */
  window.photoLightbox = {
    init: initLightbox,
    open: openLightbox,
    close: closeLightbox,
  };
})();

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

  const lightboxElement = document.getElementById('photo-lightbox');
  const lightboxImageElement = document.getElementById('photo-lightbox-image');
  const lightboxCaptionElement = document.getElementById('photo-lightbox-caption');
  const lightboxCounterElement = document.getElementById('photo-lightbox-counter');
  let currentPhotoIndex = 0;
  let thumbSelector = '';
  let gridElement = null;
  let excludeSelectors = [];
  let directPhotoUrls = [];
  let onViewCallback = null;

  function getPhotoThumbs() {
    if (gridElement) return gridElement.querySelectorAll(thumbSelector);
    return document.querySelectorAll(thumbSelector);
  }

  function openLightbox(index) {
    let thumbs = getPhotoThumbs();
    if (!thumbs.length || !lightboxElement) return;
    directPhotoUrls = [];
    currentPhotoIndex = index;
    showCurrentPhoto();
    lightboxElement.hidden = false;
    document.body.style.overflow = 'hidden';
    if (onViewCallback) onViewCallback(index);
  }

  /**
   * Open lightbox with a direct array of photo URLs (no DOM thumbs needed).
   * Used by post feed, or any caller that builds URLs dynamically.
   * @param {string[]} urls — array of image URLs
   * @param {number} startIndex — which photo to show first
   * @param {Function} [onView] — optional callback(index) fired on each photo shown
   */
  function openLightboxWithUrls(urls, startIndex, onView) {
    if (!urls.length || !lightboxElement) return;
    directPhotoUrls = urls;
    currentPhotoIndex = startIndex || 0;
    onViewCallback = onView || null;
    showCurrentPhoto();
    lightboxElement.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxElement) return;
    lightboxElement.hidden = true;
    document.body.style.overflow = '';
    directPhotoUrls = [];
    onViewCallback = null;
  }

  function showCurrentPhoto() {
    if (directPhotoUrls.length) {
      lightboxImageElement.src = directPhotoUrls[currentPhotoIndex];
      lightboxCaptionElement.textContent = '';
      lightboxCounterElement.textContent = (currentPhotoIndex + 1) + ' / ' + directPhotoUrls.length;
      if (onViewCallback) onViewCallback(currentPhotoIndex);
      return;
    }
    let thumbs = getPhotoThumbs();
    if (!thumbs.length) return;
    let thumbElement = thumbs[currentPhotoIndex];
    lightboxImageElement.src = thumbElement.getAttribute('data-photo-url');
    lightboxCaptionElement.textContent = thumbElement.getAttribute('data-photo-caption') || '';
    lightboxCounterElement.textContent = (currentPhotoIndex + 1) + ' / ' + thumbs.length;
  }

  function getPhotoCount() {
    return directPhotoUrls.length || getPhotoThumbs().length;
  }

  function showNextPhoto() {
    let count = getPhotoCount();
    if (!count) return;
    currentPhotoIndex = (currentPhotoIndex + 1) % count;
    showCurrentPhoto();
  }

  function showPreviousPhoto() {
    let count = getPhotoCount();
    if (!count) return;
    currentPhotoIndex = (currentPhotoIndex - 1 + count) % count;
    showCurrentPhoto();
  }

  /* ---- Event listeners ---- */

  if (lightboxElement) {
    const closeButton = document.getElementById('photo-lightbox-close-button');
    const overlayElement = document.getElementById('photo-lightbox-overlay');
    const previousButton = document.getElementById('photo-lightbox-previous-button');
    const nextButton = document.getElementById('photo-lightbox-next-button');

    if (closeButton) closeButton.addEventListener('click', closeLightbox);
    if (overlayElement) overlayElement.addEventListener('click', closeLightbox);
    if (previousButton) previousButton.addEventListener('click', showPreviousPhoto);
    if (nextButton) nextButton.addEventListener('click', showNextPhoto);

    /* Keyboard navigation */
    document.addEventListener('keydown', function (event) {
      if (lightboxElement.hidden) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') showPreviousPhoto();
      if (event.key === 'ArrowRight') showNextPhoto();
    });
  }

  /* ---- Init — bind click handlers to photo grid ---- */

  function initLightbox(config) {
    thumbSelector = config.thumbSelector || '[data-photo-url]';
    excludeSelectors = config.excludeSelectors || [];
    onViewCallback = config.onView || null;

    if (config.gridSelector) {
      gridElement = document.querySelector(config.gridSelector);
    }

    /* Delegated click on the grid or document */
    const clickTarget = gridElement || document;
    clickTarget.addEventListener('click', function (event) {
      /* Skip excluded elements (edit/delete/cover buttons) */
      for (let excludeIndex = 0; excludeIndex < excludeSelectors.length; excludeIndex++) {
        if (event.target.closest(excludeSelectors[excludeIndex])) return;
      }

      const thumbElement = event.target.closest(thumbSelector);
      if (!thumbElement) return;

      /* Find index among all thumbs */
      const allThumbs = getPhotoThumbs();
      for (let thumbIndex = 0; thumbIndex < allThumbs.length; thumbIndex++) {
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
    openWithUrls: openLightboxWithUrls,
    close: closeLightbox,
  };
})();

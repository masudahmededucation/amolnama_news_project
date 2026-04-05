/**
 * virtual-scroll.js — DOM recycling for infinite scroll feeds.
 *
 * Keeps only ~30 real post cards in DOM at a time.
 * Cards far above viewport get replaced with height-preserving placeholders.
 * Cards are restored from cache when user scrolls back up.
 *
 * Usage:
 *   window.virtualScroll.init({
 *     cardSelector: '.post-card',
 *     feedSelector: '#post-feed',
 *     bufferSize: 2000,
 *   });
 *
 * Works with any infinite scroll that appends HTML to the feed container.
 */
(function () {
  'use strict';

  const cardCache = new Map();
  let feedElement = null;
  let cardSelector = '.post-card';
  let bufferSize = 2000;
  let recycleObserver = null;
  let restoreObserver = null;

  function getCardId(cardElement) {
    return cardElement.getAttribute('data-post-id') || cardElement.id || null;
  }

  /**
   * Replace a real card with a height-preserving placeholder.
   */
  function recycleCard(cardElement) {
    const cardId = getCardId(cardElement);
    if (!cardId) return;

    const cardHeight = cardElement.offsetHeight;
    cardCache.set(cardId, cardElement.outerHTML);

    const placeholder = document.createElement('div');
    placeholder.className = 'post-card-placeholder';
    placeholder.setAttribute('data-post-id', cardId);
    placeholder.style.height = cardHeight + 'px';

    cardElement.replaceWith(placeholder);

    if (recycleObserver) recycleObserver.unobserve(cardElement);
    if (restoreObserver) restoreObserver.observe(placeholder);
  }

  /**
   * Restore a placeholder back to a real card from cache.
   */
  function restoreCard(placeholderElement) {
    const cardId = placeholderElement.getAttribute('data-post-id');
    if (!cardId || !cardCache.has(cardId)) return;

    const cachedHtml = cardCache.get(cardId);
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = cachedHtml;
    const restoredCard = tempContainer.firstElementChild;

    if (!restoredCard) return;

    placeholderElement.replaceWith(restoredCard);
    cardCache.delete(cardId);

    if (restoreObserver) restoreObserver.unobserve(placeholderElement);
    if (recycleObserver) recycleObserver.observe(restoredCard);

    /* Re-observe videos for autoplay */
    const videos = restoredCard.querySelectorAll('.post-card-media-video-full');
    if (videos.length && window.postVideoAutoPlayObserver) {
      videos.forEach(function (videoElement) {
        window.postVideoAutoPlayObserver.observe(videoElement);
      });
    }
  }

  function initVirtualScroll(config) {
    cardSelector = config.cardSelector || '.post-card';
    feedElement = document.querySelector(config.feedSelector || '#post-feed');
    bufferSize = config.bufferSize || 2000;

    if (!feedElement) return;

    /* Observer for recycling: cards that leave the large buffer get recycled */
    recycleObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          /* Only recycle cards ABOVE the viewport (user scrolled past them) */
          const cardRect = entry.boundingClientRect;
          if (cardRect.bottom < 0) {
            recycleCard(entry.target);
          }
        }
      });
    }, { rootMargin: bufferSize + 'px 0px ' + bufferSize + 'px 0px' });

    /* Observer for restoring: placeholders entering the buffer get restored */
    restoreObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          restoreCard(entry.target);
        }
      });
    }, { rootMargin: bufferSize + 'px 0px ' + bufferSize + 'px 0px' });

    /* Observe all existing cards */
    const existingCards = feedElement.querySelectorAll(cardSelector);
    existingCards.forEach(function (cardElement) {
      recycleObserver.observe(cardElement);
    });

    /* Watch for new cards added by infinite scroll */
    const feedMutationObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1 && node.matches && node.matches(cardSelector)) {
            recycleObserver.observe(node);
          }
        });
      });
    });

    feedMutationObserver.observe(feedElement, { childList: true });
  }

  window.virtualScroll = {
    init: initVirtualScroll,
  };
})();

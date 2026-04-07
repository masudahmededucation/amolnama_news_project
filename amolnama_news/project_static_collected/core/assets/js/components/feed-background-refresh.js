/**
 * feed-background-refresh.js — Silent background feed refresh.
 *
 * When page loads with cached feed (data-feed-cached="true"), fetches fresh
 * feed data in background and silently prepends new posts above viewport.
 * User doesn't notice — new posts appear when they scroll back to top.
 * Shows subtle pill if 5+ new posts arrived.
 */
(function () {
  'use strict';

  var feedContainer = document.getElementById('pulse-feed');
  if (!feedContainer) return;
  if (feedContainer.getAttribute('data-feed-cached') !== 'true') return;

  // Collect existing post IDs from cached feed
  var existingPostIds = new Set();
  var existingCards = feedContainer.querySelectorAll('[data-post-id]');
  for (var cardIndex = 0; cardIndex < existingCards.length; cardIndex++) {
    existingPostIds.add(existingCards[cardIndex].getAttribute('data-post-id'));
  }

  // Fetch fresh feed in background (bypass cache with ?fresh=1)
  var currentTab = new URLSearchParams(window.location.search).get('tab') || 'for_you';
  var currentCategory = new URLSearchParams(window.location.search).get('category') || '';
  var freshUrl = '/newsengine/api/feed/?fresh=1&page=1&page_size=20';
  if (currentTab !== 'for_you') freshUrl += '&tab=' + currentTab;
  if (currentCategory) freshUrl += '&category=' + currentCategory;

  fetch(freshUrl, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRFToken': window.getCsrfTokenValue ? window.getCsrfTokenValue() : '',
    },
  })
  .then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  })
  .then(function (data) {
    if (!data.success || !data.items || data.items.length === 0) return;

    // Find new items not in the cached set
    var newItemsHtml = '';
    var newItemCount = 0;
    for (var itemIndex = 0; itemIndex < data.items.length; itemIndex++) {
      var freshItem = data.items[itemIndex];
      var freshPostId = freshItem.post_id ? String(freshItem.post_id) : null;

      // Only prepend if this post wasn't in the cached feed
      if (freshPostId && !existingPostIds.has(freshPostId)) {
        newItemsHtml += freshItem.html;
        newItemCount++;
      }
    }

    if (newItemCount === 0) return;

    // Silently prepend above viewport — user doesn't see this
    var temporaryContainer = document.createElement('div');
    temporaryContainer.innerHTML = newItemsHtml;

    // Insert at the very top of feed container
    var firstChild = feedContainer.firstChild;
    while (temporaryContainer.firstChild) {
      feedContainer.insertBefore(temporaryContainer.firstChild, firstChild);
    }

    // Show pill if 5+ new posts (subtle nudge, not disruptive)
    if (newItemCount >= 5) {
      var newPostsPill = document.getElementById('feed-new-posts-pill');
      if (newPostsPill) {
        newPostsPill.hidden = false;
        newPostsPill.addEventListener('click', function () {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          newPostsPill.hidden = true;
        });
      }
    }
  })
  .catch(function (refreshError) {
    console.error('Feed background refresh failed:', refreshError);
  });
})();

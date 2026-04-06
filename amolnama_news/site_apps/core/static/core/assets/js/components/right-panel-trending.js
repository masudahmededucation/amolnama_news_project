/* right-panel-trending.js — Fetch and render trending hashtags + posts in the right panel.
   Loaded globally via base.html. Populates #right-panel-trending-list. */
(function () {
  'use strict';

  const trendingListElement = document.getElementById('right-panel-trending-list');
  if (!trendingListElement) return;

  /* ---- Fetch trending hashtags ---- */
  fetch('/newsengine/api/hashtags/trending/')
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      if (!data.success || !data.hashtags || data.hashtags.length === 0) return;

      let hashtagHtml = '<div class="right-panel-trending-hashtags">';
      for (let hashtagIndex = 0; hashtagIndex < data.hashtags.length && hashtagIndex < 8; hashtagIndex++) {
        let hashtag = data.hashtags[hashtagIndex];
        hashtagHtml += '<a href="/search/?hashtag=' + encodeURIComponent(hashtag.hashtag_text) + '" class="right-panel-trending-hashtag-item">'
          + '<span class="right-panel-trending-hashtag-text">#' + escapeHtml(hashtag.hashtag_text) + '</span>'
          + '<span class="right-panel-trending-hashtag-count">' + escapeHtml(String(hashtag.post_count)) + ' পোস্ট</span>'
          + '</a>';
      }
      hashtagHtml += '</div>';

      trendingListElement.innerHTML = hashtagHtml;
    })
    .catch(function () { /* trending fetch failed — keep placeholder */ });
})();

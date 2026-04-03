/* search-home.js — live cross-app search with 300ms debounce */
(function () {
  'use strict';

  var searchInput = document.getElementById('search-page-input');
  var resultsContainer = document.getElementById('search-page-results');
  if (!searchInput || !resultsContainer) return;

  var debounceTimer = null;

  function performSearch(query) {
    if (!query || query.length < 2) {
      resultsContainer.innerHTML = '<div class="search-page-empty"><p>কিছু লিখুন — সকল কন্টেন্ট থেকে খুঁজে দেবো</p></div>';
      return;
    }

    resultsContainer.innerHTML = '<div class="search-page-results-loading">অনুসন্ধান হচ্ছে...</div>';

    fetch('/search/api/search/?q=' + encodeURIComponent(query))
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success || data.results.length === 0) {
          resultsContainer.innerHTML = '<div class="search-page-no-results">কোনো ফলাফল পাওয়া যায়নি — "' + query + '"</div>';
          return;
        }

        var html = '';
        if (data.hashtag && data.hashtag_post_count) {
          html += '<div class="search-page-hashtag-stats">';
          html += '<span class="search-page-hashtag-name">#' + data.hashtag + '</span>';
          html += '<span class="search-page-hashtag-count">' + data.hashtag_post_count + ' টি পোস্ট';
          if (data.hashtag_user_count) html += ' · ' + data.hashtag_user_count + ' জন ব্যবহারকারী';
          html += '</span></div>';
        }
        html += '<div class="search-page-results-count">' + data.total + ' টি ফলাফল পাওয়া গেছে</div>';

        data.results.forEach(function (result) {
          html += '<a href="' + result.url + '" class="search-result-item">';
          html += '<span class="search-result-badge search-result-badge-' + result.content_type_color + '">' + result.content_type_label + '</span>';
          html += '<span class="search-result-title">' + result.title + '</span>';
          html += '<span class="search-result-date">' + result.date + '</span>';
          html += '</a>';
        });

        resultsContainer.innerHTML = html;
      })
      .catch(function () {
        resultsContainer.innerHTML = '<div class="search-page-no-results">অনুসন্ধান ব্যর্থ হয়েছে</div>';
      });
  }

  searchInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      performSearch(searchInput.value.trim());
    }, 300);
  });

  /* Auto-search if query is pre-filled (from URL param) */
  if (searchInput.value.trim().length >= 2) {
    performSearch(searchInput.value.trim());
  }

  /* Focus input on page load */
  searchInput.focus();
})();

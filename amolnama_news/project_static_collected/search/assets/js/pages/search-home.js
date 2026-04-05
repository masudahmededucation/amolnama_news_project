/* search-home.js — toggle between post feed and search results */
(function () {
  'use strict';

  const searchInput = document.getElementById('search-page-input');
  const searchButton = document.getElementById('search-page-button');
  const feedContainer = document.getElementById('search-feed-container');
  const resultsContainer = document.getElementById('search-page-results');
  if (!searchInput || !feedContainer || !resultsContainer) return;

  let debounceTimer = null;
  let lastSearchedQuery = '';


  function cleanQuery(raw) {
    return raw.replace(/\s+/g, ' ').trim();
  }

  function showFeed() {
    feedContainer.classList.remove('display-hidden');
    resultsContainer.classList.add('display-hidden');
  }

  function showResults() {
    feedContainer.classList.add('display-hidden');
    resultsContainer.classList.remove('display-hidden');
  }

  function performSearch(query) {
    query = cleanQuery(query);
    if (!query || query.length < 2) {
      showFeed();
      lastSearchedQuery = '';
      return;
    }

    if (query === lastSearchedQuery) return;
    lastSearchedQuery = query;

    showResults();
    resultsContainer.innerHTML = '<div class="search-page-results-loading">অনুসন্ধান হচ্ছে...</div>';

    fetch('/search/api/search/?q=' + encodeURIComponent(query))
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (!data.success || data.results.length === 0) {
          resultsContainer.innerHTML = '<div class="search-page-no-results">কোনো ফলাফল পাওয়া যায়নি — "' + escapeHtml(query) + '"</div>';
          return;
        }

        let html = '';
        if (data.hashtag && data.hashtag_post_count) {
          html += '<div class="search-page-hashtag-stats">';
          html += '<span class="search-page-hashtag-name">#' + escapeHtml(data.hashtag) + '</span>';
          html += '<span class="search-page-hashtag-count">' + data.hashtag_post_count + ' টি পোস্ট';
          if (data.hashtag_user_count) html += ' · ' + data.hashtag_user_count + ' জন ব্যবহারকারী';
          html += '</span></div>';
        }
        html += '<div class="search-page-results-count">' + data.total + ' টি ফলাফল পাওয়া গেছে</div>';

        data.results.forEach(function (result) {
          html += '<a href="' + escapeHtml(result.url) + '" class="search-result-item">';
          html += '<span class="search-result-badge search-result-badge-' + escapeHtml(result.content_type_color) + '">' + escapeHtml(result.content_type_label) + '</span>';
          html += '<span class="search-result-title">' + escapeHtml(result.title) + '</span>';
          html += '<span class="search-result-date">' + escapeHtml(result.date) + '</span>';
          html += '</a>';
        });

        resultsContainer.innerHTML = html;
      })
      .catch(function () {
        resultsContainer.innerHTML = '<div class="search-page-no-results">অনুসন্ধান ব্যর্থ হয়েছে। আবার চেষ্টা করুন।</div>';
      });
  }

  /* Debounced search on typing */
  searchInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      performSearch(searchInput.value);
    }, 300);
  });

  /* Search button click */
  if (searchButton) {
    searchButton.addEventListener('click', function () {
      clearTimeout(debounceTimer);
      lastSearchedQuery = '';
      performSearch(searchInput.value);
    });
  }

  /* Enter key triggers search immediately */
  searchInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      clearTimeout(debounceTimer);
      lastSearchedQuery = '';
      performSearch(searchInput.value);
    }
  });

  /* Auto-search if query is pre-filled (from URL param) */
  if (cleanQuery(searchInput.value).length >= 2) {
    performSearch(searchInput.value);
  }

  searchInput.focus();
})();

/**
 * related-content-loader.js — Lazy-loads related content on cache miss.
 *
 * When page renders with empty related content (cache miss), this script
 * fetches from the API endpoint and populates the section.
 * If cache was warm, the section is already rendered server-side — this does nothing.
 */
(function () {
  'use strict';

  var relatedContentSection = document.getElementById('related-content-section');
  if (!relatedContentSection) return;

  // If section already has items (cache hit), nothing to do
  if (!relatedContentSection.hidden) return;

  var apiUrl = relatedContentSection.getAttribute('data-api-url');
  if (!apiUrl) return;

  // Fetch related content from newsengine API
  fetch(apiUrl, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  .then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  })
  .then(function (data) {
    if (!data.success || !data.items || data.items.length === 0) return;

    var relatedContentList = document.getElementById('related-content-list');
    if (!relatedContentList) return;

    // Build HTML for each related item (escapeHtml to prevent XSS)
    var relatedContentHtml = '';
    for (var itemIndex = 0; itemIndex < data.items.length; itemIndex++) {
      var relatedItem = data.items[itemIndex];
      relatedContentHtml += '<a href="' + window.escapeHtml(relatedItem.url) + '" class="related-content-item">';
      relatedContentHtml += '<span class="related-content-item-type">' + window.escapeHtml(relatedItem.content_type_label) + '</span>';
      relatedContentHtml += '<span class="related-content-item-title">' + window.escapeHtml(relatedItem.title) + '</span>';
      if (relatedItem.author_name) {
        relatedContentHtml += '<span class="related-content-item-author">— ' + window.escapeHtml(relatedItem.author_name) + '</span>';
      }
      relatedContentHtml += '</a>';
    }

    relatedContentList.innerHTML = relatedContentHtml;
    relatedContentSection.hidden = false;
  })
  .catch(function (relatedContentLoadError) {
    console.error('Related content load failed:', relatedContentLoadError);
  });
})();

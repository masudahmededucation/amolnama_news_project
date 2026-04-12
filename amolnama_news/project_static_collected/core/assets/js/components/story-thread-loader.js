/**
 * Story Thread Loader — fetches articles in a story thread and renders them.
 *
 * Looks for .story-thread-section elements with data-thread-id.
 * Calls /newsengine/api/story-thread/<id>/articles/ to get the list.
 * Renders each article as a clickable row inside .story-thread-list.
 */
(function () {
  'use strict';

  var sections = document.querySelectorAll('.story-thread-section[data-thread-id]');
  if (!sections.length) return;

  sections.forEach(function (section) {
    var threadId = section.getAttribute('data-thread-id');
    var excludeEntryId = section.getAttribute('data-exclude-entry-id');
    var listContainer = section.querySelector('.story-thread-list');
    if (!threadId || !listContainer) return;

    var apiUrl = '/newsengine/api/story-thread/' + threadId + '/articles/';
    if (excludeEntryId) {
      apiUrl += '?exclude=' + excludeEntryId;
    }

    fetch(apiUrl, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data.success || !data.articles || !data.articles.length) {
          section.hidden = true;
          return;
        }

        var html = '';
        data.articles.forEach(function (article) {
          var title = article.headline_bn || article.headline_en || '';
          var dateText = '';
          if (article.created_at) {
            try {
              var date = new Date(article.created_at);
              dateText = date.toLocaleDateString('bn-BD', {
                day: 'numeric', month: 'short',
              });
            } catch (dateError) {
              dateText = '';
            }
          }
          html += '<a href="' + (article.url || '#') + '" class="story-thread-item">'
            + '<span class="story-thread-item-title">' + _escapeHtml(title) + '</span>'
            + (dateText ? '<span class="story-thread-item-date">' + dateText + '</span>' : '')
            + '</a>';
        });

        listContainer.innerHTML = html;
      })
      .catch(function () {
        section.hidden = true;
      });
  });

  function _escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();

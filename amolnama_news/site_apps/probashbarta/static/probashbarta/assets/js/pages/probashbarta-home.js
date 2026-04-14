/**
 * probashbarta-home.js — Probash Barta landing page interactions.
 *
 * Dual filter: topic pills + region pills (client-side filtering).
 */
(function () {
  'use strict';

  var topicFilterContainer = document.getElementById('probashbarta-filter-topic');
  var regionFilterContainer = document.getElementById('probashbarta-filter-region');
  var entryGrid = document.getElementById('probashbarta-entry-grid');

  if (!entryGrid) return;

  var activeTopicFilter = '';
  var activeRegionFilter = '';

  function applyFilters() {
    var allCards = entryGrid.querySelectorAll('.probashbarta-entry-card');
    var visibleCount = 0;

    for (var cardIndex = 0; cardIndex < allCards.length; cardIndex++) {
      var card = allCards[cardIndex];
      var cardTopic = card.getAttribute('data-topic') || '';
      var cardRegion = card.getAttribute('data-region') || '';
      var topicMatch = !activeTopicFilter || cardTopic === activeTopicFilter;
      var regionMatch = !activeRegionFilter || cardRegion === activeRegionFilter;
      card.hidden = !(topicMatch && regionMatch);
      if (topicMatch && regionMatch) visibleCount++;
    }

    var emptyState = entryGrid.querySelector('.probashbarta-empty-state');
    if (emptyState) emptyState.hidden = visibleCount > 0;
  }

  function handlePillClick(container, filterAttribute, callback) {
    if (!container) return;
    container.addEventListener('click', function (event) {
      var pill = event.target.closest('.probashbarta-filter-pill');
      if (!pill) return;

      var allPills = container.querySelectorAll('.probashbarta-filter-pill');
      for (var pillIndex = 0; pillIndex < allPills.length; pillIndex++) {
        allPills[pillIndex].classList.remove('probashbarta-filter-pill--active');
      }
      pill.classList.add('probashbarta-filter-pill--active');

      callback(pill.getAttribute(filterAttribute) || '');
      applyFilters();
    });
  }

  handlePillClick(topicFilterContainer, 'data-topic', function (value) {
    activeTopicFilter = value;
  });

  handlePillClick(regionFilterContainer, 'data-region', function (value) {
    activeRegionFilter = value;
  });
})();

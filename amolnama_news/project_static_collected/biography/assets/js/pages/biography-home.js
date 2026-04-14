/**
 * biography-home.js — Campus Life landing page interactions.
 *
 * Features:
 *   - Category filter pills (client-side filtering)
 *   - Load more (future: paginated fetch)
 */
(function () {
  'use strict';

  /* ── Category filter pills ── */
  var filterPillsContainer = document.getElementById('biography-filter-pills');
  var entryGrid = document.getElementById('biography-entry-grid');

  if (filterPillsContainer && entryGrid) {
    filterPillsContainer.addEventListener('click', function (event) {
      var pill = event.target.closest('.biography-filter-pill');
      if (!pill) return;

      /* Update active pill */
      var allPills = filterPillsContainer.querySelectorAll('.biography-filter-pill');
      for (var pillIndex = 0; pillIndex < allPills.length; pillIndex++) {
        allPills[pillIndex].classList.remove('biography-filter-pill--active');
      }
      pill.classList.add('biography-filter-pill--active');

      /* Filter cards */
      var selectedCategory = pill.getAttribute('data-category');
      var allCards = entryGrid.querySelectorAll('.biography-entry-card');
      var visibleCount = 0;

      for (var cardIndex = 0; cardIndex < allCards.length; cardIndex++) {
        var card = allCards[cardIndex];
        var cardCategory = card.getAttribute('data-category');
        var isMatch = !selectedCategory || cardCategory === selectedCategory;
        card.hidden = !isMatch;
        if (isMatch) visibleCount++;
      }

      /* Show/hide empty state */
      var emptyState = entryGrid.querySelector('.biography-empty-state');
      if (emptyState) {
        emptyState.hidden = visibleCount > 0;
      }
    });
  }
})();

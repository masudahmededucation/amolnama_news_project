/* stories-landing.js — Init filter pills for stories page. */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof window.filterPillsInit !== 'function') return;
  window.filterPillsInit({
    groups: [
      { pillsId: 'stories-age-filter', dataAttribute: 'age', crumbLabel: 'বয়স' },
      { pillsId: 'stories-category-filter', dataAttribute: 'category', crumbLabel: 'ধরন' },
    ],
    cardSelector: '.stories-card',
    crumbsContainerId: 'stories-filter-crumbs',
    emptyContainerId: 'stories-filter-empty',
    emptyMessage: 'এই ধরনের কোনো গল্প নেই',
  });
});

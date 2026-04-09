/* art-landing.js — Init filter pills for art gallery page. */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof window.filterPillsInit !== 'function') return;
  window.filterPillsInit({
    groups: [
      { pillsId: 'art-category-filter', dataAttribute: 'category', crumbLabel: 'বিভাগ' },
      { pillsId: 'art-medium-filter', dataAttribute: 'medium', crumbLabel: 'মাধ্যম' },
    ],
    cardSelector: '.art-gallery-card',
    crumbsContainerId: 'art-filter-crumbs',
    emptyContainerId: 'art-filter-empty',
    emptyMessage: 'এই ধরনের কোনো শিল্পকর্ম নেই',
  });
});

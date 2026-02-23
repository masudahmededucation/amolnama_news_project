/**
 * news-searchable-dropdown.js
 * Initialises Tom Select on the district and category dropdowns to make them searchable.
 * Fires native 'change' on the underlying <select> so cascade JS still works.
 */
(function () {
  if (typeof TomSelect === 'undefined') return;

  var districtSelect = document.getElementById('news-district-id');
  if (districtSelect) new TomSelect(districtSelect, {
    placeholder: 'জেলা খুঁজুন...',
    sortField: { field: 'text', direction: 'asc' }
  });

  /* Category — search text + aliases for transliteration support */
  var categorySelect = document.getElementById('news-category-id');
  if (categorySelect) new TomSelect(categorySelect, {
    placeholder: 'খবরের ধরন নির্বাচন করুন...',
    sortField: { field: 'text', direction: 'asc' },
    searchField: ['text', 'aliases']
  });
})();

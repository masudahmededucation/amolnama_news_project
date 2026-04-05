/**
 * news-tag-search.js
 * Searchable input that searches ALL tags across all categories.
 * Uses the embedded JSON in #all-tags-data (no API call needed).
 * Adds tags via window.newshubTags API so they integrate with the existing chip system.
 *
 * DOM dependencies:
 *   #tag-search-input   — text input for searching
 *   #tag-search-results — <ul> for search results dropdown
 *   #all-tags-data      — embedded JSON with all tags
 *
 * Requires: news-category-tag-cascade.js (must load first for window.newshubTags)
 */
(function () {
  const api = window.newshubTags;
  if (!api) return;

  const input = document.getElementById('tag-search-input');
  const resultsList = document.getElementById('tag-search-results');
  const allTagsEl = document.getElementById('all-tags-data');
  if (!input || !resultsList || !allTagsEl) return;

  const MAX_RESULTS = 10;
  let allTags = [];

  /* Parse embedded JSON */
  try {
    allTags = JSON.parse(allTagsEl.textContent);
  } catch (e) { return; }

  /* ---- escapeHtml() — prevent XSS in tag names ---- */

  /* ---- search() — filter tags by query, return top matches ---- */
  function search(query) {
    if (!query || query.length < 1) return [];

    let q = query.toLowerCase();
    let results = [];

    for (let i = 0; i < allTags.length; i++) {
      let tag = allTags[i];
      /* Skip already-selected tags */
      if (api.isSelected(String(tag.id))) continue;

      const bnMatch = tag.name_bn && tag.name_bn.indexOf(q) !== -1;
      const enMatch = tag.name_en && tag.name_en.toLowerCase().indexOf(q) !== -1;
      const aliasMatch = tag.aliases && tag.aliases.toLowerCase().indexOf(q) !== -1;

      if (bnMatch || enMatch || aliasMatch) {
        results.push(tag);
        if (results.length >= MAX_RESULTS) break;
      }
    }
    return results;
  }

  /* ---- renderResults() — show matching tags as clickable items ---- */
  function renderResults(results) {
    if (results.length === 0) {
      resultsList.style.display = 'none';
      resultsList.innerHTML = '';
      return;
    }

    let html = '';
    for (let i = 0; i < results.length; i++) {
      let tag = results[i];
      let label = escapeHtml(tag.name_bn);
      if (tag.name_en) label += ' (' + escapeHtml(tag.name_en) + ')';
      html += '<li class="tag-search-item" data-tag-idx="' + i + '">' + label + '</li>';
    }
    resultsList.innerHTML = html;
    resultsList.style.display = 'block';

    /* Store results for click handler */
    resultsList._results = results;
  }

  /* ---- Input event — search as user types ---- */
  input.addEventListener('input', function () {
    let results = search(input.value.trim());
    renderResults(results);
  });

  /* ---- autoSelectCategory() — set category dropdown when tag is picked ---- */
  function autoSelectCategory(categoryId) {
    if (!categoryId) return;
    const categorySelect = document.getElementById('news-category-id');
    if (!categorySelect) return;

    /* Only auto-select if no category is currently chosen */
    if (categorySelect.value) return;

    categorySelect.value = String(categoryId);

    /* If Tom Select is wrapping the dropdown, sync it */
    if (categorySelect.tomselect) {
      categorySelect.tomselect.setValue(String(categoryId), true);
    }

    /* Fire change event so the tag cascade loads available tags for this category */
    categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ---- Click result — add tag ---- */
  resultsList.addEventListener('click', function (e) {
    const item = e.target.closest('.tag-search-item');
    if (!item) return;

    const idx = parseInt(item.getAttribute('data-tag-idx'), 10);
    let results = resultsList._results;
    if (!results || !results[idx]) return;

    const tag = results[idx];
    api.add(tag);
    api.save();
    api.render();

    /* Auto-select the tag's category if none is chosen */
    autoSelectCategory(tag.cat_id);

    /* Clear search and hide results */
    input.value = '';
    resultsList.style.display = 'none';
    resultsList.innerHTML = '';
  });

  /* ---- Hide results when clicking outside ---- */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.tag-search-wrapper')) {
      resultsList.style.display = 'none';
    }
  });

  /* ---- Show results again when input is focused with text ---- */
  input.addEventListener('focus', function () {
    const q = input.value.trim();
    if (q) {
      const results = search(q);
      renderResults(results);
    }
  });
})();

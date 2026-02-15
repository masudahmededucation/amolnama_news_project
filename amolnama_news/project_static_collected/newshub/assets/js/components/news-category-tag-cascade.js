/**
 * news-category-tag-cascade.js
 *
 * Tag selection with chips — click a tag to add, click X to remove.
 * Selected tags persist across category changes AND page refreshes (localStorage).
 * On category change: fetches available tags via API, hides already-selected ones.
 * Hidden inputs (name="tag_ids") are created for each selected tag.
 *
 * Exposes window.newshubTags API for other scripts (e.g. news-auto-tag.js).
 *
 * DOM dependencies:
 *   #news-category-id    — hidden input set by category radio widget
 *   #selected-tags-area  — container for selected tag chips
 *   #tag-available-list  — <ul> for available tags per category
 *   #initial-selected-tags — optional JSON block for POST re-render
 *
 * localStorage key: newshub_draft_tags
 */
(function () {
  var categorySelect = document.getElementById('news-category-id');
  var availableList = document.getElementById('tag-available-list');
  var selectedArea = document.getElementById('selected-tags-area');

  if (!categorySelect || !availableList || !selectedArea) return;

  var STORAGE_KEY = 'newshub_draft_tags';
  var MAX_BOX_SIZE = 6;   // max tags per box — larger groups get split
  var MERGE_THRESHOLD = 2; // groups with ≤2 tags get combined with others

  /* ---- State ---- */
  var selectedTags = {};       // { id: { id, name_bn, name_en, group_code } }
  var currentAvailable = [];   // tags from the latest category API fetch
  var removedByUser = {};      // { id: true } — manually removed, skip auto-re-add

  /* ---- escapeHtml() — prevent XSS in tag names ---- */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---- tagLabel() — formatted display: "বাংলা (English)" ---- */
  function tagLabel(tag) {
    var label = escapeHtml(tag.name_bn);
    if (tag.name_en) label += ' (' + escapeHtml(tag.name_en) + ')';
    return label;
  }

  /* ---- saveTags() — persist selectedTags to localStorage ---- */
  function saveTags() {
    var data = [];
    Object.keys(selectedTags).forEach(function (id) {
      data.push(selectedTags[id]);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /* ---- loadTags() — restore selectedTags from localStorage ---- */
  function loadTags() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(function (tag) {
          selectedTags[String(tag.id)] = tag;
        });
      }
    } catch (e) { /* ignore parse errors */ }
  }

  /* ---- clearTagStorage() — remove localStorage key ---- */
  function clearTagStorage() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /* ---- Clear saved tags on form success (but keep initializing event listeners) ---- */
  var isSuccessPage = !!document.querySelector('.form-message-success');
  if (isSuccessPage) {
    clearTagStorage();
  }

  /* ---- renderSelected() — chips + hidden inputs for form submission ---- */
  function renderSelected() {
    var ids = Object.keys(selectedTags);
    if (ids.length === 0) {
      selectedArea.style.display = 'none';
      selectedArea.innerHTML = '';
      return;
    }
    selectedArea.style.display = '';
    var html = '';
    ids.forEach(function (id) {
      var tag = selectedTags[id];
      html += '<input type="hidden" name="tag_ids" value="' + id + '">';
      html += '<span class="selected-tag-chip" data-tag-id="' + id + '">'
        + tagLabel(tag)
        + '<button type="button" class="selected-tag-remove" data-tag-id="' + id + '">&times;</button>'
        + '</span>';
    });
    /* "Remove All" button — always shown when any tags are selected */
    html += '<button type="button" class="selected-tag-clear-all">'
      + '\u09B8\u09AC \u09AE\u09C1\u099B\u09C1\u09A8 (Clear All) &times;'
      + '</button>';
    selectedArea.innerHTML = html;
  }

  /* ---- renderAvailable() — available tags grouped by group_code ---- */
  function renderAvailable() {
    var available = currentAvailable.filter(function (tag) {
      return !(String(tag.id) in selectedTags);
    });

    if (currentAvailable.length === 0) {
      availableList.innerHTML = '<li class="tag-hint">\u098F\u0987 \u0995\u09CD\u09AF\u09BE\u099F\u09BE\u0997\u09B0\u09BF\u09A4\u09C7 \u0995\u09CB\u09A8\u09CB \u099F\u09CD\u09AF\u09BE\u0997 \u09A8\u09C7\u0987</li>';
      return;
    }
    if (available.length === 0) {
      availableList.innerHTML = '<li class="tag-hint">\u09B8\u09AC \u099F\u09CD\u09AF\u09BE\u0997 \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7</li>';
      return;
    }

    /* Group tags by group_code (preserve API order) */
    var groups = {};
    var groupOrder = [];
    available.forEach(function (tag) {
      var code = tag.group_code || '_other';
      if (!(code in groups)) {
        groups[code] = [];
        groupOrder.push(code);
      }
      groups[code].push(tag);
    });

    /* Merge small groups (≤ MERGE_THRESHOLD) into a pool,
       then chunk everything into boxes of MAX_BOX_SIZE */
    var bigGroups = [];
    var smallPool = [];
    groupOrder.forEach(function (code) {
      if (groups[code].length > MERGE_THRESHOLD) {
        bigGroups.push(groups[code]);
      } else {
        smallPool = smallPool.concat(groups[code]);
      }
    });

    /* Split big groups and the merged pool into chunks of MAX_BOX_SIZE */
    var boxes = [];
    function chunkIntoBoxes(tags) {
      for (var i = 0; i < tags.length; i += MAX_BOX_SIZE) {
        boxes.push(tags.slice(i, i + MAX_BOX_SIZE));
      }
    }
    bigGroups.forEach(function (g) { chunkIntoBoxes(g); });
    if (smallPool.length > 0) { chunkIntoBoxes(smallPool); }

    /* Render each box as a <li class="tag-group-box"> */
    var html = '';
    boxes.forEach(function (boxTags) {
      html += '<li class="tag-group-box">';
      boxTags.forEach(function (tag) {
        html += '<span class="tag-available-item" data-tag-id="' + tag.id + '">'
          + tagLabel(tag) + '</span>';
      });
      html += '</li>';
    });
    availableList.innerHTML = html;
  }

  /* ---- Click: add tag from available list ---- */
  availableList.addEventListener('click', function (e) {
    var item = e.target.closest('.tag-available-item');
    if (!item) return;
    var id = item.getAttribute('data-tag-id');
    var tag = currentAvailable.find(function (t) { return String(t.id) === id; });
    if (!tag) return;
    delete removedByUser[id];
    selectedTags[id] = tag;
    saveTags();
    renderSelected();
    renderAvailable();
  });

  /* ---- Click: remove single tag from chip ---- */
  selectedArea.addEventListener('click', function (e) {
    /* Clear All button */
    if (e.target.closest('.selected-tag-clear-all')) {
      Object.keys(selectedTags).forEach(function (id) {
        removedByUser[id] = true;
      });
      selectedTags = {};
      saveTags();
      renderSelected();
      renderAvailable();
      return;
    }

    /* Single tag remove button */
    var btn = e.target.closest('.selected-tag-remove');
    if (!btn) return;
    var id = btn.getAttribute('data-tag-id');
    delete selectedTags[id];
    removedByUser[id] = true;
    saveTags();
    renderSelected();
    renderAvailable();
  });

  var DEFAULT_CATEGORY_ID = 12;  // Crime (অপরাধ) — shown when no category selected

  /* ---- fetchCategoryTags() — load tags for a given category ID ---- */
  function fetchCategoryTags(categoryId) {
    availableList.innerHTML = '<li class="tag-hint">\u099F\u09CD\u09AF\u09BE\u0997 \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7...</li>';

    fetch('/newshub/api/tags/' + categoryId + '/')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        currentAvailable = data.tags || [];
        renderAvailable();
      })
      .catch(function () {
        currentAvailable = [];
        availableList.innerHTML = '<li class="tag-hint">\u099F\u09CD\u09AF\u09BE\u0997 \u09B2\u09CB\u09A1 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5</li>';
      });
  }

  /* ---- Category change → fetch tags via API ---- */
  categorySelect.addEventListener('change', function () {
    var categoryId = categorySelect.value;
    fetchCategoryTags(categoryId || DEFAULT_CATEGORY_ID);
  });

  /* ========== Initialize ========== */

  /* 1. Restore from localStorage (survives page refresh / login round-trip) */
  if (!isSuccessPage) loadTags();

  /* 2. Merge with server-rendered JSON (POST re-render with validation errors) */
  var initialEl = document.getElementById('initial-selected-tags');
  if (initialEl) {
    try {
      var text = initialEl.textContent.replace(/,\s*]/, ']');
      var parsed = JSON.parse(text);
      parsed.forEach(function (tag) {
        selectedTags[String(tag.id)] = tag;
      });
    } catch (e) { /* ignore parse errors */ }
  }

  renderSelected();

  /* 3. Load default tags — use selected category, or crime (default) */
  fetchCategoryTags(categorySelect.value || DEFAULT_CATEGORY_ID);

  /* ========== Public API for other scripts (e.g. news-auto-tag.js) ========== */
  window.newshubTags = {
    /** add(tag) — add a tag { id, name_bn, name_en }. Returns true if added, false if already present. */
    add: function (tag) {
      var id = String(tag.id);
      if (id in selectedTags) return false;
      selectedTags[id] = tag;
      return true;
    },
    /** isSelected(id) — check if tag is currently selected */
    isSelected: function (id) { return String(id) in selectedTags; },
    /** isRemovedByUser(id) — check if tag was manually removed (auto-tag should skip) */
    isRemovedByUser: function (id) { return String(id) in removedByUser; },
    /** save() — persist current selection to localStorage */
    save: saveTags,
    /** render() — re-render chips + available list */
    render: function () { renderSelected(); renderAvailable(); },
    /** clearAll() — remove all tags + reset removedByUser, persist + re-render */
    clearAll: function () {
      selectedTags = {};
      removedByUser = {};
      currentAvailable = [];
      saveTags();
      renderSelected();
      fetchCategoryTags(categorySelect.value || DEFAULT_CATEGORY_ID);
    }
  };
})();

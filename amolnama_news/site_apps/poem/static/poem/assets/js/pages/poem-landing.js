/**
 * poem-landing.js — Filter, search, and infinite-scroll for poem landing page.
 */
(function () {
  "use strict";

  const grid = document.getElementById("poemCardGrid");
  const loadMoreWrap = document.getElementById("poemLoadMore");
  const loadMoreBtn = document.getElementById("poemLoadMoreBtn");
  const pillContainer = document.getElementById("poemFilterPills");
  const searchInput = document.getElementById("poemSearchInput");

  if (!grid) return;

  const typeTabs = document.getElementById("poemTypeTabs");
  const crumbsWrap = document.getElementById("poemFilterCrumbs");
  const crumbsChips = document.getElementById("poemFilterChips");
  const crumbsClearAll = document.getElementById("poemFilterClearAll");

  let currentPage = 1;
  let currentCategory = "";
  let currentCategoryName = "";
  let currentType = "";
  let currentTypeName = "";
  let currentQuery = "";
  let loading = false;
  let searchTimer = null;

  /* ── Type tabs (সব / কবিতা / গানের কথা) ── */
  if (typeTabs) {
    typeTabs.addEventListener("click", function (e) {
      const tab = e.target.closest(".poem-type-tab");
      if (!tab) return;

      typeTabs.querySelectorAll(".poem-type-tab").forEach(function (t) {
        t.classList.remove("poem-type-tab--active");
      });
      tab.classList.add("poem-type-tab--active");

      currentType = tab.dataset.type || "";
      currentTypeName = currentType ? tab.textContent.trim() : "";
      currentPage = 1;
      updateCrumbs();
      fetchPoems(true);
    });
  }

  /* ── Category pills ── */
  if (pillContainer) {
    pillContainer.addEventListener("click", function (e) {
      const pill = e.target.closest(".poem-filter-pill");
      if (!pill) return;

      pillContainer.querySelectorAll(".poem-filter-pill").forEach(function (p) {
        p.classList.remove("poem-filter-pill--active");
      });
      pill.classList.add("poem-filter-pill--active");

      currentCategory = pill.dataset.category || "";
      currentCategoryName = currentCategory ? pill.textContent.trim() : "";
      currentPage = 1;
      updateCrumbs();
      fetchPoems(true);
    });
  }

  /* ── Filter breadcrumbs ── */
  function updateCrumbs() {
    if (!crumbsWrap) return;
    var chips = [];

    if (currentType) {
      chips.push({ label: currentTypeName, action: "clear-type" });
    }
    if (currentCategory) {
      chips.push({ label: currentCategoryName, action: "clear-category" });
    }
    if (currentQuery) {
      chips.push({ label: '"' + currentQuery + '"', action: "clear-search" });
    }

    if (chips.length === 0) {
      crumbsWrap.style.display = "none";
      return;
    }

    crumbsWrap.style.display = "flex";
    crumbsChips.innerHTML = chips.map(function (c) {
      return '<span class="poem-filter-chip">' + c.label +
        ' <button class="poem-filter-chip-remove" data-action="' + c.action + '">✕</button></span>';
    }).join("");

    crumbsChips.querySelectorAll(".poem-filter-chip-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var action = btn.getAttribute("data-action");
        if (action === "clear-type") {
          currentType = "";
          currentTypeName = "";
          if (typeTabs) {
            typeTabs.querySelectorAll(".poem-type-tab").forEach(function (t) { t.classList.remove("poem-type-tab--active"); });
            typeTabs.querySelector('[data-type=""]').classList.add("poem-type-tab--active");
          }
        } else if (action === "clear-category") {
          currentCategory = "";
          currentCategoryName = "";
          if (pillContainer) {
            pillContainer.querySelectorAll(".poem-filter-pill").forEach(function (p) { p.classList.remove("poem-filter-pill--active"); });
            pillContainer.querySelector('[data-category=""]').classList.add("poem-filter-pill--active");
          }
        } else if (action === "clear-search") {
          currentQuery = "";
          if (searchInput) searchInput.value = "";
        }
        currentPage = 1;
        updateCrumbs();
        fetchPoems(true);
      });
    });
  }

  if (crumbsClearAll) {
    crumbsClearAll.addEventListener("click", function () {
      currentType = ""; currentTypeName = "";
      currentCategory = ""; currentCategoryName = "";
      currentQuery = "";
      if (searchInput) searchInput.value = "";
      if (typeTabs) {
        typeTabs.querySelectorAll(".poem-type-tab").forEach(function (t) { t.classList.remove("poem-type-tab--active"); });
        typeTabs.querySelector('[data-type=""]').classList.add("poem-type-tab--active");
      }
      if (pillContainer) {
        pillContainer.querySelectorAll(".poem-filter-pill").forEach(function (p) { p.classList.remove("poem-filter-pill--active"); });
        pillContainer.querySelector('[data-category=""]').classList.add("poem-filter-pill--active");
      }
      currentPage = 1;
      updateCrumbs();
      fetchPoems(true);
    });
  }

  /* ── Search with BanglaInput transliteration ── */
  if (searchInput) {
    if (typeof BanglaInput !== "undefined") {
      BanglaInput.attach(searchInput);
    }

    // Transliteration pick triggers search
    searchInput.addEventListener("bangla-input-change", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        currentQuery = searchInput.value.trim();
        currentPage = 1;
        updateCrumbs();
        fetchPoems(true);
      }, 300);
    });

    // Regular typing (Bengali direct input or paste)
    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        currentQuery = searchInput.value.trim();
        currentPage = 1;
        updateCrumbs();
        fetchPoems(true);
      }, 500);
    });
  }

  /* ── Load More ── */
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", function () {
      currentPage++;
      fetchPoems(false);
    });
  }

  /* ── Fetch poems from API ── */
  function fetchPoems(replace) {
    if (loading) return;
    loading = true;

    if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = "লোড হচ্ছে... (Loading...)";
    }

    var params = new URLSearchParams();
    params.set("page", currentPage);
    if (currentType) params.set("type", currentType);
    if (currentCategory) params.set("category", currentCategory);
    if (currentQuery) params.set("q", currentQuery);

    fetch("/poem/api/poems/?" + params.toString())
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (replace) {
          grid.innerHTML = "";
        }

        if (data.poems.length === 0 && replace) {
          grid.innerHTML =
            '<div class="poem-empty-state">' +
            "<p>কোনো কবিতা পাওয়া যায়নি।</p>" +
            "<p>No poems found.</p>" +
            "</div>";
        }

        data.poems.forEach(function (poem) {
          grid.insertAdjacentHTML("beforeend", buildCard(poem));
        });

        if (loadMoreWrap) {
          loadMoreWrap.style.display = data.has_next ? "" : "none";
        }
        if (loadMoreBtn) {
          loadMoreBtn.disabled = false;
          loadMoreBtn.textContent = "আরও দেখুন (Load More)";
        }

        loading = false;
      })
      .catch(function () {
        loading = false;
        if (loadMoreBtn) {
          loadMoreBtn.disabled = false;
          loadMoreBtn.textContent = "আরও দেখুন (Load More)";
        }
      });
  }

  /* ── Build card HTML (mirrors poem-card.html) ── */
  function buildCard(poem) {
    var title = escHtml(poem.display_title);
    var preview = escHtml(poem.body_preview);
    var cat = escHtml(poem.category_name);
    var author = escHtml(poem.author_display_name);
    var lang = escHtml((poem.language || "bn").toUpperCase());

    return (
      '<a href="/poem/' + poem.id + '/" class="poem-card">' +
        '<div class="poem-card-body">' +
          '<div class="poem-card-header">' +
            '<span class="poem-card-category-badge">' + cat + "</span>" +
            '<span class="poem-card-lang">' + lang + "</span>" +
          "</div>" +
          '<h3 class="poem-card-title">' + title + "</h3>" +
          '<p class="poem-card-preview">' + preview + "</p>" +
        "</div>" +
        '<div class="poem-card-footer">' +
          '<span class="poem-card-author">' + author + "</span>" +
          '<div class="poem-card-stats">' +
            '<span class="poem-card-stat">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
              poem.like_count +
            "</span>" +
            '<span class="poem-card-time">' + escHtml(poem.time_ago) + "</span>" +
          "</div>" +
        "</div>" +
      "</a>"
    );
  }

  function escHtml(str) {
    if (!str) return "";
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }
})();

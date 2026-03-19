/* Travel Hub — filter, search, load more */
(function () {
  "use strict";

  const grid = document.getElementById("thDestGrid");
  const searchInput = document.getElementById("thSearchInput");
  const pillsContainer = document.getElementById("thFilterPills");
  const loadMoreBtn = document.getElementById("thLoadMoreBtn");

  if (!grid) return;

  let currentPage = 1;
  let currentCategory = "";
  let currentQuery = "";
  let loading = false;

  // Filter pills
  if (pillsContainer) {
    pillsContainer.addEventListener("click", (e) => {
      const pill = e.target.closest(".th-filter-pill");
      if (!pill) return;
      pillsContainer.querySelectorAll(".th-filter-pill").forEach((p) => p.classList.remove("th-filter-pill--active"));
      pill.classList.add("th-filter-pill--active");
      currentCategory = pill.dataset.category || "";
      currentPage = 1;
      fetchDestinations(true);
    });
  }

  // Search
  let searchTimer;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        currentQuery = searchInput.value.trim();
        currentPage = 1;
        fetchDestinations(true);
      }, 350);
    });
  }

  // Load more
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      currentPage++;
      fetchDestinations(false);
    });
  }

  async function fetchDestinations(replace) {
    if (loading) return;
    loading = true;

    const params = new URLSearchParams({ page: currentPage });
    if (currentCategory) params.set("category", currentCategory);
    if (currentQuery) params.set("q", currentQuery);

    try {
      const res = await fetch(`/bangladesh/api/destinations/?${params}`);
      const data = await res.json();

      if (replace) grid.innerHTML = "";

      if (data.destinations.length === 0 && replace) {
        grid.innerHTML = `<div class="th-empty-state"><p>কোনো দর্শনীয় স্থান পাওয়া যায়নি</p><p>No destinations found</p></div>`;
      }

      data.destinations.forEach((d) => {
        const card = document.createElement("a");
        card.href = `/bangladesh/travel/${d.id}/`;
        card.className = "th-dest-card";
        const imgHtml = d.cover_image
          ? `<div class="th-dest-card-img" style="background-image:url('${d.cover_image}');"></div>`
          : `<div class="th-dest-card-img th-dest-card-img--placeholder"><span>📍</span></div>`;
        card.innerHTML = `
          ${imgHtml}
          <div class="th-dest-card-body">
            <div class="th-dest-card-meta">
              <span class="th-dest-card-category">${d.category_name_bn}</span>
              ${d.is_featured ? '<span class="th-dest-card-featured">⭐ বৈশিষ্ট্যযুক্ত</span>' : ""}
            </div>
            <h3 class="th-dest-card-title">${d.name_bn}</h3>
            <p class="th-dest-card-desc">${d.short_desc_bn || d.short_desc_en || ""}</p>
            <div class="th-dest-card-footer">
              ${d.avg_rating ? `<span class="th-dest-card-rating">★ ${d.avg_rating}</span>` : ""}
              <span class="th-dest-card-views">👁 ${d.view_count}</span>
              <span class="th-dest-card-time">${d.time_ago}</span>
            </div>
          </div>`;
        grid.appendChild(card);
      });

      const loadMoreWrap = document.getElementById("thLoadMore");
      if (loadMoreWrap) loadMoreWrap.style.display = data.has_next ? "" : "none";
    } catch (err) {
      console.error("Failed to load destinations:", err);
    } finally {
      loading = false;
    }
  }
})();

/* Beauty of Bangladesh — filter, search, load more */
(function () {
  "use strict";

  const gallery = document.getElementById("bhGallery");
  const searchInput = document.getElementById("bhSearchInput");
  const pillsContainer = document.getElementById("bhFilterPills");
  const loadMoreBtn = document.getElementById("bhLoadMoreBtn");

  if (!gallery) return;

  let currentPage = 1;
  let currentCategory = "";
  let currentType = "";
  let currentQuery = "";
  let loading = false;

  // Filter pills
  if (pillsContainer) {
    pillsContainer.addEventListener("click", (e) => {
      const pill = e.target.closest(".bh-filter-pill");
      if (!pill) return;
      pillsContainer.querySelectorAll(".bh-filter-pill").forEach((p) => p.classList.remove("bh-filter-pill--active"));
      pill.classList.add("bh-filter-pill--active");

      if (pill.dataset.type) {
        currentType = pill.dataset.type;
        currentCategory = "";
      } else {
        currentCategory = pill.dataset.category || "";
        currentType = "";
      }
      currentPage = 1;
      fetchMedia(true);
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
        fetchMedia(true);
      }, 350);
    });
  }

  // Load more
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      currentPage++;
      fetchMedia(false);
    });
  }

  async function fetchMedia(replace) {
    if (loading) return;
    loading = true;

    const params = new URLSearchParams({ page: currentPage });
    if (currentCategory) params.set("category", currentCategory);
    if (currentType) params.set("type", currentType);
    if (currentQuery) params.set("q", currentQuery);

    try {
      const res = await fetch(`/bangladesh/api/media/?${params}`);
      const data = await res.json();

      if (replace) gallery.innerHTML = "";

      if (data.entries.length === 0 && replace) {
        gallery.innerHTML = `<div class="bh-empty-state"><p>কোনো ছবি বা ভিডিও পাওয়া যায়নি</p><p>No media found</p></div>`;
      }

      data.entries.forEach((e) => {
        const card = document.createElement("div");
        card.className = "bh-card";
        card.dataset.id = e.id;
        const videoBadge = e.media_type === "video" ? '<span class="bh-card-video-badge">▶ ভিডিও</span>' : "";
        card.innerHTML = `
          <div class="bh-card-img" style="background-image:url('${e.thumbnail_url}');">
            ${videoBadge}
          </div>
          <div class="bh-card-body">
            <h3 class="bh-card-title">${e.display_title}</h3>
            <div class="bh-card-meta">
              <span class="bh-card-category">${e.category_name_bn}</span>
              ${e.location_bn ? `<span class="bh-card-location">📍 ${e.location_bn}</span>` : ""}
            </div>
            <div class="bh-card-footer">
              <span class="bh-card-stat">❤️ ${e.like_count}</span>
              <span class="bh-card-stat">👁 ${e.view_count}</span>
              <span class="bh-card-time">${e.time_ago}</span>
            </div>
          </div>`;
        gallery.appendChild(card);
      });

      const loadMoreWrap = document.getElementById("bhLoadMore");
      if (loadMoreWrap) loadMoreWrap.style.display = data.has_next ? "" : "none";
    } catch (err) {
      console.error("Failed to load media:", err);
    } finally {
      loading = false;
    }
  }
})();

/* Beauty of Bangladesh — filter, search, load more */
(function () {
  "use strict";

  const mediaGallery = document.getElementById("beauty-hub-gallery");
  const searchInput = document.getElementById("beauty-hub-search-input");
  const filterPillsContainer = document.getElementById("beauty-hub-filter-pills");
  const loadMoreButton = document.getElementById("beauty-hub-load-more-button");

  if (!mediaGallery) return;

  let currentPage = 1;
  let currentCategory = "";
  let currentType = "";
  let currentQuery = "";
  let isLoading = false;

  // Filter pills
  if (filterPillsContainer) {
    filterPillsContainer.addEventListener("click", (event) => {
      let pill = event.target.closest(".beauty-hub-filter-pill");
      if (!pill) return;
      filterPillsContainer.querySelectorAll(".beauty-hub-filter-pill").forEach((pillElement) => pillElement.classList.remove("beauty-hub-filter-pill--active"));
      pill.classList.add("beauty-hub-filter-pill--active");

      if (pill.dataset.type) {
        currentType = pill.dataset.type;
        currentCategory = "";
      } else {
        currentCategory = pill.dataset.category || "";
        currentType = "";
      }
      currentPage = 1;
      fetchMediaEntries(true);
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
        fetchMediaEntries(true);
      }, 350);
    });
  }

  // Load more
  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", () => {
      currentPage++;
      fetchMediaEntries(false);
    });
  }

  async function fetchMediaEntries(replaceExisting) {
    if (isLoading) return;
    isLoading = true;

    const params = new URLSearchParams({ page: currentPage });
    if (currentCategory) params.set("category", currentCategory);
    if (currentType) params.set("type", currentType);
    if (currentQuery) params.set("q", currentQuery);

    try {
      const response = await fetch(`/bangladesh-tourist-destinations/api/media/?${params}`);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();

      if (replaceExisting) mediaGallery.innerHTML = "";

      if (data.entries.length === 0 && replaceExisting) {
        mediaGallery.innerHTML = `<div class="beauty-hub-empty-state"><p>কোনো ছবি বা ভিডিও পাওয়া যায়নি</p><p>No media found</p></div>`;
      }

      data.entries.forEach((entry) => {
        const card = document.createElement("div");
        card.className = "beauty-hub-card";
        card.dataset.id = entry.id;
        const videoBadge = entry.media_type === "video" ? '<span class="beauty-hub-card-video-badge">▶ ভিডিও</span>' : "";
        card.innerHTML = `
          <div class="beauty-hub-card-img" style="background-image:url('${escapeHtml(entry.thumbnail_url)}');">
            ${videoBadge}
          </div>
          <div class="beauty-hub-card-body">
            <h3 class="beauty-hub-card-title">${escapeHtml(entry.display_title)}</h3>
            <div class="beauty-hub-card-meta">
              <span class="beauty-hub-card-category">${escapeHtml(entry.category_name_bn)}</span>
              ${entry.location_bn ? `<span class="beauty-hub-card-location">📍 ${escapeHtml(entry.location_bn)}</span>` : ""}
            </div>
            <div class="beauty-hub-card-footer">
              <span class="beauty-hub-card-stat">❤️ ${escapeHtml(String(entry.like_count))}</span>
              <span class="beauty-hub-card-stat">👁 ${escapeHtml(String(entry.view_count))}</span>
              <span class="beauty-hub-card-time">${escapeHtml(entry.time_ago)}</span>
            </div>
          </div>`;
        mediaGallery.appendChild(card);
      });

      const loadMoreWrapper = document.getElementById("beauty-hub-load-more");
      if (loadMoreWrapper) loadMoreWrapper.hidden = !data.has_next;
    } catch (error) {
      console.error('beauty-hub: failed to load media entries', error);
    } finally {
      isLoading = false;
    }
  }
})();

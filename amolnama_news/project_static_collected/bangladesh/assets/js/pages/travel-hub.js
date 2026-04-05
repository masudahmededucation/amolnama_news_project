/* Travel Hub — filter, search, load more */
(function () {
  "use strict";

  const destinationGrid = document.getElementById("travel-hub-destination-grid");
  const searchInput = document.getElementById("travel-hub-search-input");
  const filterPillsContainer = document.getElementById("travel-hub-filter-pills");
  const loadMoreButton = document.getElementById("travel-hub-load-more-button");

  if (!destinationGrid) return;

  let currentPage = 1;
  let currentCategory = "";
  let currentQuery = "";
  let isLoading = false;

  // Filter pills
  if (filterPillsContainer) {
    filterPillsContainer.addEventListener("click", (e) => {
      let pill = e.target.closest(".travel-hub-filter-pill");
      if (!pill) return;
      filterPillsContainer.querySelectorAll(".travel-hub-filter-pill").forEach((p) => p.classList.remove("travel-hub-filter-pill--active"));
      pill.classList.add("travel-hub-filter-pill--active");
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
  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", () => {
      currentPage++;
      fetchDestinations(false);
    });
  }

  async function fetchDestinations(replaceExisting) {
    if (isLoading) return;
    isLoading = true;

    const params = new URLSearchParams({ page: currentPage });
    if (currentCategory) params.set("category", currentCategory);
    if (currentQuery) params.set("q", currentQuery);

    try {
      const response = await fetch(`/bangladesh-tourist-destinations/api/destinations/?${params}`);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();

      if (replaceExisting) destinationGrid.innerHTML = "";

      if (data.destinations.length === 0 && replaceExisting) {
        destinationGrid.innerHTML = `<div class="travel-hub-empty-state"><p>কোনো দর্শনীয় স্থান পাওয়া যায়নি</p><p>No destinations found</p></div>`;
      }

      data.destinations.forEach((destination) => {
        const card = document.createElement("a");
        card.href = destination.slug ? `/bangladesh-tourist-destinations/travel/${destination.slug}/` : `/bangladesh-tourist-destinations/travel/id/${destination.id}/`;
        card.className = "travel-hub-destination-card";
        const imageHtml = destination.cover_image
          ? `<div class="travel-hub-destination-card-img" style="background-image:url('${escapeHtml(destination.cover_image)}');"></div>`
          : `<div class="travel-hub-destination-card-img travel-hub-destination-card-img--placeholder"><span>📍</span></div>`;
        card.innerHTML = `
          ${imageHtml}
          <div class="travel-hub-destination-card-body">
            <div class="travel-hub-destination-card-meta">
              <span class="travel-hub-destination-card-category">${escapeHtml(destination.category_name_bn)}</span>
              ${destination.is_featured ? '<span class="travel-hub-destination-card-featured">⭐ বৈশিষ্ট্যযুক্ত</span>' : ""}
            </div>
            <h3 class="travel-hub-destination-card-title">${escapeHtml(destination.name_bn)}</h3>
            <p class="travel-hub-destination-card-desc">${escapeHtml(destination.short_desc_bn || destination.short_desc_en || "")}</p>
            <div class="travel-hub-destination-card-footer">
              ${destination.avg_rating ? `<span class="travel-hub-destination-card-rating">★ ${escapeHtml(String(destination.avg_rating))}</span>` : ""}
              <span class="travel-hub-destination-card-views">👁 ${escapeHtml(String(destination.view_count))}</span>
              <span class="travel-hub-destination-card-time">${escapeHtml(destination.time_ago)}</span>
            </div>
          </div>`;
        destinationGrid.appendChild(card);
      });

      const loadMoreWrapper = document.getElementById("travel-hub-load-more");
      if (loadMoreWrapper) loadMoreWrapper.classList.toggle("display-hidden", !data.has_next);
    } catch (error) {
    } finally {
      isLoading = false;
    }
  }
})();

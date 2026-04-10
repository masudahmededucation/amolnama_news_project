/**
 * poem-detail.js — Collapsible sections + actions-bar init.
 * Like + share are handled by the shared actions-bar component.
 */
(function () {
  "use strict";

  /* ── Collapsible sections ── */
  document.querySelectorAll(".poem-detail-section-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const targetId = btn.getAttribute("data-toggle");
      let content = document.getElementById(targetId);
      if (!content) return;

      let open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", !open);
      content.classList.toggle("poem-detail-section-content--open", !open);
    });
  });

  /* ── Init shared actions bar (like + share) ── */
  if (window.actionsBar && typeof window.actionsBar.init === "function") {
    window.actionsBar.init({
      buildLikeApiUrl: function (entityId) {
        return "/bangla-kobita-gaan/api/poems/" + entityId + "/like/";
      },
    });
  }
})();

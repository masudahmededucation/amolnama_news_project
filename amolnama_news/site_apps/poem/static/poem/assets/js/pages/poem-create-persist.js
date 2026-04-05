/**
 * poem-create-persist.js — Auto-save draft to localStorage, restore on load.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "poem_draft";
  let badge = document.getElementById("poemDraftBadge");
  const form = document.getElementById("poemCreateForm");
  if (!form) return;

  const fieldIds = [
    "poem-author-name",
    "poem-category",
    "poem-title-bn", "poem-title-en",
    "poem-body-bn", "poem-body-en",
    "poem-backstory-bn", "poem-backstory-en",
    "poem-interpretation-bn", "poem-interpretation-en",
    "poem-audio-url",
    "poem-audio-reciter-name",
    "poem-audio-description",
  ];

  let saveTimer = null;

  /* ── Restore draft on load ── */
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      let data = JSON.parse(saved);
      fieldIds.forEach(function (id) {
        let el = document.getElementById(id);
        if (el && data[id] !== undefined && data[id] !== null) {
          el.value = data[id];
          // Trigger input event for preview + counters
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      showBadge();
    }
  } catch (e) {}

  /* ── Auto-save on input ── */
  fieldIds.forEach(function (id) {
    let el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", scheduleSave);
    el.addEventListener("change", scheduleSave);
  });

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 800);
  }

  function saveDraft() {
    const data = {};
    fieldIds.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) data[id] = el.value;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      showBadge();
    } catch (e) {}
  }

  /* ── Clear draft on successful submit ── */
  form.addEventListener("submit", function () {
    clearTimeout(saveTimer);
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  });

  function showBadge() {
    if (badge) badge.classList.add("poem-create-draft-badge--visible");
    setTimeout(function () {
      if (badge) badge.classList.remove("poem-create-draft-badge--visible");
    }, 2000);
  }
})();

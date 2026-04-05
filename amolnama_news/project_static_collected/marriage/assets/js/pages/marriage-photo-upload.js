/* ============================================================
   Marriage Photo Upload — instant preview per section
   Max 5 photos per section. Client-side only (stored in memory).
   ============================================================ */
(function() {
  "use strict";

  const MAX_PER_SECTION = 5;
  const photoStore = {}; // { section: [{ file, url }] }

  // Section IDs mapped to grid element IDs
  const SECTIONS = {
    first_meet:        "photos-first-meet",
    gaye_holud:        "photos-gaye-holud",
    bor_jatra:         "photos-bor-jatra",
    wedding_ceremony:  "photos-wedding-ceremony",
    bou_bhat:          "photos-bou-bhat",
    other:             "photos-other",
  };

  // Initialize store
  for (const key in SECTIONS) {
    photoStore[key] = [];
  }

  // Listen for file inputs
  document.querySelectorAll(".marriage-photo-input").forEach(function(input) {
    input.addEventListener("change", function() {
      const section = this.getAttribute("data-section");
      if (!section || !SECTIONS[section]) return;

      const files = Array.prototype.slice.call(this.files);
      let store = photoStore[section];
      const remaining = MAX_PER_SECTION - store.length;

      if (remaining <= 0) {
        const warningElement = document.getElementById('photo-upload-warning');
        if (warningElement) { warningElement.textContent = "সর্বোচ্চ " + MAX_PER_SECTION + "টি ছবি আপলোড করা যাবে এই বিভাগে"; warningElement.classList.remove('display-hidden'); setTimeout(function () { warningElement.classList.add('display-hidden'); }, 4000); }
        this.value = "";
        return;
      }

      const toAdd = files.slice(0, remaining);
      for (let i = 0; i < toAdd.length; i++) {
        const file = toAdd[i];
        if (!file.type.startsWith("image/")) continue;
        store.push({
          file: file,
          url: URL.createObjectURL(file),
        });
      }

      this.value = "";
      renderSection(section);
    });
  });

  function renderSection(section) {
    const gridEl = document.getElementById(SECTIONS[section]);
    if (!gridEl) return;

    const store = photoStore[section];
    gridEl.innerHTML = "";

    for (let i = 0; i < store.length; i++) {
      const thumb = document.createElement("div");
      thumb.className = "marriage-photo-thumb";

      const img = document.createElement("img");
      img.src = store[i].url;
      img.alt = "Photo " + (i + 1);
      thumb.appendChild(img);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "marriage-photo-thumb-remove";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("data-section", section);
      removeBtn.setAttribute("data-index", i);
      removeBtn.addEventListener("click", function() {
        const s = this.getAttribute("data-section");
        const idx = parseInt(this.getAttribute("data-index"));
        URL.revokeObjectURL(photoStore[s][idx].url);
        photoStore[s].splice(idx, 1);
        renderSection(s);
      });
      thumb.appendChild(removeBtn);

      gridEl.appendChild(thumb);
    }
  }

  // Expose for external access (e.g. form submission)
  window.marriagePhotos = {
    getStore: function() { return photoStore; },
    getFiles: function(section) {
      return photoStore[section] ? photoStore[section].map(function(p) { return p.file; }) : [];
    },
    getAllFiles: function() {
      const all = [];
      for (const key in photoStore) {
        for (let i = 0; i < photoStore[key].length; i++) {
          all.push({ section: key, file: photoStore[key][i].file });
        }
      }
      return all;
    },
  };
})();

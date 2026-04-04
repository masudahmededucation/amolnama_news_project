/* ============================================================
   Marriage Photo Upload — instant preview per section
   Max 5 photos per section. Client-side only (stored in memory).
   ============================================================ */
(function() {
  "use strict";

  var MAX_PER_SECTION = 5;
  var photoStore = {}; // { section: [{ file, url }] }

  // Section IDs mapped to grid element IDs
  var SECTIONS = {
    first_meet:        "photos-first-meet",
    gaye_holud:        "photos-gaye-holud",
    bor_jatra:         "photos-bor-jatra",
    wedding_ceremony:  "photos-wedding-ceremony",
    bou_bhat:          "photos-bou-bhat",
    other:             "photos-other",
  };

  // Initialize store
  for (var key in SECTIONS) {
    photoStore[key] = [];
  }

  // Listen for file inputs
  document.querySelectorAll(".marriage-photo-input").forEach(function(input) {
    input.addEventListener("change", function() {
      var section = this.getAttribute("data-section");
      if (!section || !SECTIONS[section]) return;

      var files = Array.prototype.slice.call(this.files);
      var store = photoStore[section];
      var remaining = MAX_PER_SECTION - store.length;

      if (remaining <= 0) {
        var warningElement = document.getElementById('photo-upload-warning');
        if (warningElement) { warningElement.textContent = "সর্বোচ্চ " + MAX_PER_SECTION + "টি ছবি আপলোড করা যাবে এই বিভাগে"; warningElement.style.display = 'block'; setTimeout(function () { warningElement.style.display = 'none'; }, 4000); }
        this.value = "";
        return;
      }

      var toAdd = files.slice(0, remaining);
      for (var i = 0; i < toAdd.length; i++) {
        var file = toAdd[i];
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
    var gridEl = document.getElementById(SECTIONS[section]);
    if (!gridEl) return;

    var store = photoStore[section];
    gridEl.innerHTML = "";

    for (var i = 0; i < store.length; i++) {
      var thumb = document.createElement("div");
      thumb.className = "marriage-photo-thumb";

      var img = document.createElement("img");
      img.src = store[i].url;
      img.alt = "Photo " + (i + 1);
      thumb.appendChild(img);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "marriage-photo-thumb-remove";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("data-section", section);
      removeBtn.setAttribute("data-index", i);
      removeBtn.addEventListener("click", function() {
        var s = this.getAttribute("data-section");
        var idx = parseInt(this.getAttribute("data-index"));
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
      var all = [];
      for (var key in photoStore) {
        for (var i = 0; i < photoStore[key].length; i++) {
          all.push({ section: key, file: photoStore[key][i].file });
        }
      }
      return all;
    },
  };
})();

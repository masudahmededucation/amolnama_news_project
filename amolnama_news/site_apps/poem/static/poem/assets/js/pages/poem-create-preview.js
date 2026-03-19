/**
 * poem-create-preview.js — Live preview panel updates.
 */
(function () {
  "use strict";

  var previewTitle = document.getElementById("previewTitle");
  var previewAuthor = document.getElementById("previewAuthor");
  var previewBody = document.getElementById("previewBody");
  var previewBackstory = document.getElementById("previewBackstory");
  var previewBackstoryWrap = document.getElementById("previewBackstoryWrap");
  var previewInterpretation = document.getElementById("previewInterpretation");
  var previewInterpretationWrap = document.getElementById("previewInterpretationWrap");

  if (!previewTitle) return;

  var fields = [
    "poem-author-name",
    "poem-title-bn", "poem-title-en",
    "poem-body-bn", "poem-body-en",
    "poem-backstory-bn", "poem-backstory-en",
    "poem-interpretation-bn", "poem-interpretation-en",
  ];

  fields.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", updatePreview);
  });

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function updatePreview() {
    var title = val("poem-title-bn") || val("poem-title-en") || "";
    previewTitle.textContent = title || "শিরোনামহীন";

    var author = val("poem-author-name");
    if (previewAuthor) {
      previewAuthor.textContent = author ? "— " + author : "";
      previewAuthor.style.display = author ? "" : "none";
    }

    var body = val("poem-body-bn") || val("poem-body-en") || "";
    if (body) {
      previewBody.textContent = body;
      previewBody.classList.remove("poem-create-preview-empty");
    } else {
      previewBody.innerHTML = '<span class="poem-create-preview-empty">কবিতা লিখতে শুরু করুন...</span>';
    }

    var backstory = val("poem-backstory-bn") || val("poem-backstory-en") || "";
    if (backstory) {
      previewBackstory.textContent = backstory;
      previewBackstoryWrap.style.display = "";
    } else {
      previewBackstoryWrap.style.display = "none";
    }

    var interpretation = val("poem-interpretation-bn") || val("poem-interpretation-en") || "";
    if (interpretation) {
      previewInterpretation.textContent = interpretation;
      previewInterpretationWrap.style.display = "";
    } else {
      previewInterpretationWrap.style.display = "none";
    }
  }

  // Initial render
  updatePreview();
})();

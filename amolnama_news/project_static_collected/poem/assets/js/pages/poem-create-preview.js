/**
 * poem-create-preview.js — Live preview panel updates.
 */
(function () {
  "use strict";

  const previewTitle = document.getElementById("previewTitle");
  const previewAuthor = document.getElementById("previewAuthor");
  const previewBody = document.getElementById("previewBody");
  const previewBackstory = document.getElementById("previewBackstory");
  const previewBackstoryWrap = document.getElementById("previewBackstoryWrap");
  const previewInterpretation = document.getElementById("previewInterpretation");
  const previewInterpretationWrap = document.getElementById("previewInterpretationWrap");

  if (!previewTitle) return;

  const fields = [
    "poem-author-name",
    "poem-title-bn", "poem-title-en",
    "poem-body-bn", "poem-body-en",
    "poem-backstory-bn", "poem-backstory-en",
    "poem-interpretation-bn", "poem-interpretation-en",
  ];

  fields.forEach(function (id) {
    let el = document.getElementById(id);
    if (el) el.addEventListener("input", updatePreview);
  });

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function updatePreview() {
    const title = val("poem-title-bn") || val("poem-title-en") || "";
    previewTitle.textContent = title || "শিরোনামহীন";

    const author = val("poem-author-name");
    if (previewAuthor) {
      previewAuthor.textContent = author ? "— " + author : "";
      previewAuthor.classList.toggle("display-hidden", !author);
    }

    const body = val("poem-body-bn") || val("poem-body-en") || "";
    if (body) {
      previewBody.textContent = body;
      previewBody.classList.remove("poem-create-preview-empty");
    } else {
      previewBody.innerHTML = '<span class="poem-create-preview-empty">কবিতা লিখতে শুরু করুন...</span>';
    }

    const backstory = val("poem-backstory-bn") || val("poem-backstory-en") || "";
    if (backstory) {
      previewBackstory.textContent = backstory;
      previewBackstoryWrap.classList.remove("display-hidden");
    } else {
      previewBackstoryWrap.classList.add("display-hidden");
    }

    const interpretation = val("poem-interpretation-bn") || val("poem-interpretation-en") || "";
    if (interpretation) {
      previewInterpretation.textContent = interpretation;
      previewInterpretationWrap.classList.remove("display-hidden");
    } else {
      previewInterpretationWrap.classList.add("display-hidden");
    }
  }

  // Initial render
  updatePreview();
})();

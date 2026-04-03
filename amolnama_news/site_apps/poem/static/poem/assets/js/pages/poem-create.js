/**
 * poem-create.js — Language toggle, validation, AJAX submit.
 */
(function () {
  "use strict";
  var getCsrf = window.getCsrfTokenValue;

  // Update labels based on ?type=song
  var urlParams = new URLSearchParams(window.location.search);
  var pageType = urlParams.get("type") || "poem";

  if (pageType === "song") {
    document.title = "গানের কথা লিখুন · Amolnama News";

    // Update both visible text AND data-bn/data-en attributes
    var swaps = {
      "poemCreateTitle":       { bn: "গানের কথা লিখুন", en: "Write Song Lyrics" },
      "labelAuthor":           { bn: "গীতিকার / শিল্পীর নাম *", en: "Lyricist / Artist Name *" },
      "labelTitleBn":          { bn: "গানের নাম *", en: "Song Title *" },
      "labelBodyBn":           { bn: "গানের কথা *", en: "Song Lyrics *" },
      "labelBackstoryBn":      { bn: "গানের পেছনের গল্প (ঐচ্ছিক)", en: "Story Behind the Song (optional)" },
      "labelInterpretationBn": { bn: "গীতিকারের ভাবনা (ঐচ্ছিক)", en: "Lyricist's Interpretation (optional)" },
      "labelAudioUrl":         { bn: "গানের লিংক (ঐচ্ছিক)", en: "Song URL (optional)" },
      "labelReciter":          { bn: "শিল্পীর নাম (ঐচ্ছিক)", en: "Singer Name (optional)" },
      "labelAudioDesc":        { bn: "গানের বিবরণ (ঐচ্ছিক)", en: "Song Description (optional)" },
      "hintAuthor":            { bn: "গীতিকার বা শিল্পীর নাম", en: "Lyricist or artist name" },
      "hintAudioUrl":          { bn: "YouTube, SoundCloud বা গানের লিংক", en: "YouTube, SoundCloud, or song link" },
      "poem-submit-button":    { bn: "প্রকাশ করুন", en: "Publish" },
      "poemDraftBadge":        { bn: "খসড়া সংরক্ষিত", en: "Draft saved" },
    };

    for (var id in swaps) {
      var el = document.getElementById(id);
      if (el) {
        el.setAttribute("data-bn", swaps[id].bn);
        el.setAttribute("data-en", swaps[id].en);
        el.textContent = swaps[id].bn; // default to BN
      }
    }

    // Placeholders
    var placeholders = {
      "poem-author-name":         "যেমন: জেমস, আইয়ুব বাচ্চু, নচিকেতা, রবীন্দ্রনাথ...",
      "poem-title-bn":            "যেমন: চোখে চোখে, হাওয়া, তুমি আমার...",
      "poem-body-bn":             "এখানে গানের কথা লিখুন...",
      "poem-backstory-bn":        "এই গান লেখার পেছনের গল্প বা অনুপ্রেরণা...",
      "poem-interpretation-bn":   "গীতিকার কী বোঝাতে চেয়েছেন...",
      "poem-audio-reciter-name":  "যেমন: জেমস, হৈমন্তী শুক্লা, শ্রাবণ্য...",
      "poem-audio-description":   "যেমন: জেমসের কণ্ঠে গান...",
    };

    for (var pid in placeholders) {
      var pel = document.getElementById(pid);
      if (pel) pel.placeholder = placeholders[pid];
    }

    var emptyEl = document.querySelector(".poem-create-preview-empty");
    if (emptyEl) emptyEl.textContent = "গানের কথা লিখতে শুরু করুন...";
  }

  var form = document.getElementById("poemCreateForm");
  var submitButton = document.getElementById("poem-submit-button");
  var errorBox = document.getElementById("poemCreateError");
  if (!form) return;

  var currentLang = "bn";

  /* ── Language toggle — uses universal body[data-lang] system ── */
  document.querySelectorAll(".poem-create-lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".poem-create-lang-btn").forEach(function (b) {
        b.classList.remove("poem-create-lang-btn--active");
      });
      btn.classList.add("poem-create-lang-btn--active");
      currentLang = btn.dataset.lang;
      // Set body data-lang — CSS handles visibility of .lang-field-bn / .lang-field-en
      document.body.setAttribute("data-lang", currentLang);
      // Sync header toggle
      var headerRadio = document.querySelector('input[name="form_lang"][value="' + currentLang + '"]');
      if (headerRadio) headerRadio.checked = true;
    });
  });

  // Sync poem toggle with header toggle
  document.querySelectorAll('input[name="form_lang"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      currentLang = this.value;
      document.querySelectorAll(".poem-create-lang-btn").forEach(function (b) {
        b.classList.toggle("poem-create-lang-btn--active", b.dataset.lang === currentLang);
      });
    });
  });

  /* ── Character/line counters ── */
  var bodyBn = document.getElementById("poem-body-bn");
  var bodyEn = document.getElementById("poem-body-en");
  var counterBn = document.getElementById("poemBodyBnCounter");
  var counterEn = document.getElementById("poemBodyEnCounter");

  function updateCounter(textarea, counter, lang) {
    if (!textarea || !counter) return;
    var val = textarea.value;
    var lines = val ? val.split("\n").length : 0;
    var chars = val.length;
    if (lang === "bn") {
      counter.textContent = lines + " লাইন | " + chars + " অক্ষর";
    } else {
      counter.textContent = lines + " lines | " + chars + " chars";
    }
  }

  if (bodyBn) bodyBn.addEventListener("input", function () { updateCounter(bodyBn, counterBn, "bn"); });
  if (bodyEn) bodyEn.addEventListener("input", function () { updateCounter(bodyEn, counterEn, "en"); });

  /* ── Show error ── */
  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.classList.add("poem-create-error--visible");
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function hideError() {
    if (!errorBox) return;
    errorBox.classList.remove("poem-create-error--visible");
  }

  /* ── CSRF ── */

  /* ── Submit ── */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError();

    var authorName = (document.getElementById("poem-author-name").value || "").trim();
    var titleBn = (document.getElementById("poem-title-bn").value || "").trim();
    var titleEn = (document.getElementById("poem-title-en").value || "").trim();
    var bodyBnVal = (document.getElementById("poem-body-bn").value || "").trim();
    var bodyEnVal = (document.getElementById("poem-body-en").value || "").trim();
    var category = document.getElementById("poem-category").value;

    if (!authorName) {
      showError("লেখকের নাম আবশ্যক (Writer's name is required)");
      return;
    }
    if (!titleBn && !titleEn) {
      showError("শিরোনাম আবশ্যক (Title is required)");
      return;
    }
    if (!bodyBnVal && !bodyEnVal) {
      showError("কবিতা লিখুন (Poem body is required)");
      return;
    }
    if (!category) {
      showError("ধরন বাছাই করুন (Category is required)");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "প্রকাশ হচ্ছে... (Publishing...)";

    // Read type from URL query param (?type=poem or ?type=song)
    var urlParams = new URLSearchParams(window.location.search);
    var poemType = urlParams.get("type") || "poem";

    var payload = {
      poem_type_code: poemType,
      poem_author_display_name: authorName,
      poem_language: currentLang,
      poem_title_bn: titleBn || null,
      poem_title_en: titleEn || null,
      poem_body_bn: bodyBnVal || null,
      poem_body_en: bodyEnVal || null,
      poem_backstory_bn: (document.getElementById("poem-backstory-bn").value || "").trim() || null,
      poem_backstory_en: (document.getElementById("poem-backstory-en").value || "").trim() || null,
      poem_interpretation_bn: (document.getElementById("poem-interpretation-bn").value || "").trim() || null,
      poem_interpretation_en: (document.getElementById("poem-interpretation-en").value || "").trim() || null,
      poem_audio_url: (document.getElementById("poem-audio-url").value || "").trim() || null,
      poem_audio_reciter_name: (document.getElementById("poem-audio-reciter-name").value || "").trim() || null,
      poem_audio_description: (document.getElementById("poem-audio-description").value || "").trim() || null,
      link_poem_category_id: parseInt(category, 10),
    };

    fetch("/bangla-kobita-gaan/api/poems/create/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCsrf(),
      },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        if (!r.ok) {
          return r.text().then(function (txt) {
            try { return JSON.parse(txt); } catch (e) {
              throw new Error("Server " + r.status);
            }
          });
        }
        return r.json();
      })
      .then(function (data) {
        if (data.success) {
          // Clear draft
          try { localStorage.removeItem("poem_draft"); } catch (e) {}
          window.location.href = data.poem_url || "/bangla-kobita-gaan/id/" + data.poem_id + "/";
        } else {
          showError(data.error || "কিছু ভুল হয়েছে (Something went wrong)");
          submitButton.disabled = false;
          submitButton.textContent = "প্রকাশ করুন (Publish)";
        }
      })
      .catch(function (err) {
        showError(err.message || "সার্ভারে সমস্যা হয়েছে (Server error)");
        submitButton.disabled = false;
        submitButton.textContent = "প্রকাশ করুন (Publish)";
      });
  });
})();

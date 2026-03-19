/**
 * poem-edit.js — Language toggle, validation, AJAX submit for editing.
 */
(function () {
  "use strict";

  var form = document.getElementById("poemEditForm");
  var submitBtn = document.getElementById("poemSubmitBtn");
  var errorBox = document.getElementById("poemCreateError");
  if (!form) return;

  var poemId = form.dataset.poemId;
  var currentLang = document.querySelector(".poem-create-lang-btn--active");
  currentLang = currentLang ? currentLang.dataset.lang : "bn";

  /* ── Language toggle ── */
  document.querySelectorAll(".poem-create-lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".poem-create-lang-btn").forEach(function (b) {
        b.classList.remove("poem-create-lang-btn--active");
      });
      btn.classList.add("poem-create-lang-btn--active");

      currentLang = btn.dataset.lang;

      document.querySelectorAll(".poem-create-field-bn").forEach(function (el) {
        el.classList.toggle("poem-create-hidden", currentLang !== "bn");
      });
      document.querySelectorAll(".poem-create-field-en").forEach(function (el) {
        el.classList.toggle("poem-create-hidden", currentLang !== "en");
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

  if (bodyBn) {
    bodyBn.addEventListener("input", function () { updateCounter(bodyBn, counterBn, "bn"); });
    updateCounter(bodyBn, counterBn, "bn");
  }
  if (bodyEn) {
    bodyEn.addEventListener("input", function () { updateCounter(bodyEn, counterEn, "en"); });
    updateCounter(bodyEn, counterEn, "en");
  }

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
  function getCsrf() {
    var cookie = document.cookie.match(/csrftoken=([^;]+)/);
    return cookie ? cookie[1] : "";
  }

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

    submitBtn.disabled = true;
    submitBtn.textContent = "সংরক্ষণ হচ্ছে... (Saving...)";

    var payload = {
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

    fetch("/poem/api/poems/" + poemId + "/update/", {
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
          window.location.href = "/poem/" + poemId + "/";
        } else {
          showError(data.error || "কিছু ভুল হয়েছে (Something went wrong)");
          submitBtn.disabled = false;
          submitBtn.textContent = "সংরক্ষণ করুন (Save Changes)";
        }
      })
      .catch(function (err) {
        showError(err.message || "সার্ভারে সমস্যা হয়েছে (Server error)");
        submitBtn.disabled = false;
        submitBtn.textContent = "সংরক্ষণ করুন (Save Changes)";
      });
  });
})();

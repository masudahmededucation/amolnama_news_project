/**
 * poem-detail.js — Collapsible sections, like toggle, share button.
 */
(function () {
  "use strict";

  /* ── Collapsible sections ── */
  document.querySelectorAll(".poem-detail-section-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var targetId = btn.getAttribute("data-toggle");
      var content = document.getElementById(targetId);
      if (!content) return;

      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", !open);
      content.classList.toggle("poem-detail-section-content--open", !open);
    });
  });

  /* ── Like toggle ── */
  var likeBtn = document.getElementById("poemLikeBtn");
  var likeCount = document.getElementById("poemLikeCount");

  if (likeBtn) {
    likeBtn.addEventListener("click", function () {
      var poemId = likeBtn.dataset.poemId;
      var csrf = getCsrf();

      fetch("/bangla-kobita-gaan/api/poems/" + poemId + "/like/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrf,
        },
        credentials: "same-origin",
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.success) {
            if (data.error === "Login required") {
              /* Show friendly login prompt instead of redirecting */
              var loginMsg = document.getElementById("poem-login-prompt");
              if (!loginMsg) {
                loginMsg = document.createElement("div");
                loginMsg.id = "poem-login-prompt";
                loginMsg.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#fff3cd;color:#856404;padding:12px 24px;border-radius:8px;font-size:.9rem;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:9999;border:1px solid #ffc107;";
                loginMsg.innerHTML = 'লাইক করতে <a href="/account/login/?next=' + encodeURIComponent(window.location.pathname) + '" style="color:#0d6efd;text-decoration:underline;">লগইন করুন</a> (Please login to like)';
                document.body.appendChild(loginMsg);
                setTimeout(function() { loginMsg.remove(); }, 5000);
              }
            }
            return;
          }
          likeBtn.dataset.liked = data.liked ? "true" : "false";
          likeBtn.classList.toggle("poem-detail-action-btn--liked", data.liked);
          if (likeCount) likeCount.textContent = data.like_count;
        })
        .catch(function () {});
    });
  }

  /* ── Share button ── */
  var shareBtn = document.getElementById("poemShareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", function () {
      var url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: document.title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          shareBtn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' +
            " কপি হয়েছে!";
          setTimeout(function () {
            shareBtn.innerHTML =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
              " শেয়ার";
          }, 2000);
        });
      }
    });
  }

  /* ── CSRF helper ── */
  function getCsrf() {
    var cookie = document.cookie.match(/csrftoken=([^;]+)/);
    return cookie ? cookie[1] : "";
  }
})();

/* article-detail.js — Article view page interactions */
(function () {
  "use strict";

  /* ---- Inline message helper (no popups) ---- */
  function showInlineMessage(nearEl, text, isError) {
    /* Remove any existing message near this element */
    var existing = nearEl.parentNode.querySelector(".inline-msg");
    if (existing) existing.remove();

    var msg = document.createElement("div");
    msg.className = "inline-msg " + (isError ? "inline-msg-error" : "inline-msg-success");
    msg.textContent = text;
    nearEl.parentNode.insertBefore(msg, nearEl.nextSibling);

    /* Auto-remove after 5 seconds */
    setTimeout(function () { if (msg.parentNode) msg.remove(); }, 5000);
  }

  /* Share buttons (top + bottom) */
  var shareButtons = document.querySelectorAll("#article-share-btn, .article-share-btn-top");
  for (var i = 0; i < shareButtons.length; i++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var articleTitle = btn.getAttribute("data-title") || "";
        var articleUrl = window.location.href;
        if (navigator.share) {
          navigator.share({ title: articleTitle, url: articleUrl });
        } else {
          navigator.clipboard.writeText(articleUrl).then(function () {
            showInlineMessage(btn, "লিংক কপি হয়েছে!", false);
          });
        }
      });
    })(shareButtons[i]);
  }
  /* Comment submit */
  var commentSubmitButton = document.getElementById("article-comment-submit");
  var commentTextarea = document.getElementById("article-comment-text");

  if (commentSubmitButton && commentTextarea) {
    commentSubmitButton.addEventListener("click", function () {
      var commentText = commentTextarea.value.trim();
      if (!commentText) {
        commentTextarea.focus();
        return;
      }

      var articleId = commentSubmitButton.getAttribute("data-article-id");
      commentSubmitButton.disabled = true;
      commentSubmitButton.textContent = "জমা হচ্ছে...";

      function getCookie(name) {
        var cookieValue = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
        return cookieValue ? cookieValue.pop() : "";
      }

      fetch("/newshub/api/article/" + articleId + "/comment/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ comment_text: commentText }),
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            /* Add comment to list */
            var commentsList = document.querySelector(".article-comments-list");
            if (!commentsList) {
              commentsList = document.createElement("div");
              commentsList.className = "article-comments-list";
              var emptyMessage = document.querySelector(".article-comments p[style]");
              if (emptyMessage) emptyMessage.remove();
              document.querySelector(".article-comments").appendChild(commentsList);
            }
            var newComment = document.createElement("div");
            newComment.className = "article-comment-card";
            newComment.innerHTML =
              '<p class="article-comment-text">' + commentText.replace(/</g, "&lt;") + "</p>" +
              '<span class="article-comment-meta">এইমাত্র</span>';
            commentsList.appendChild(newComment);
            commentTextarea.value = "";

            /* Update comment count in heading */
            var commentHeading = document.querySelector(".article-comments .article-section-title");
            if (commentHeading) {
              var currentCount = parseInt(commentHeading.textContent.match(/\d+/) || "0", 10);
              commentHeading.innerHTML = '<span data-en="Comments">মন্তব্য</span> (' + (currentCount + 1) + ")";
            }
          } else {
            showInlineMessage(commentSubmitButton, data.error || "মন্তব্য জমা দিতে সমস্যা হয়েছে", true);
          }
          commentSubmitButton.disabled = false;
          commentSubmitButton.textContent = "💬 মন্তব্য করুন";
        })
        .catch(function () {
          showInlineMessage(commentSubmitButton, "নেটওয়ার্ক ত্রুটি", true);
          commentSubmitButton.disabled = false;
          commentSubmitButton.textContent = "💬 মন্তব্য করুন";
        });
    });
  }

  /* Publication status — toggle between badge and dropdown */
  var statusBadge = document.getElementById("article-status-badge");
  var statusEditBtn = document.getElementById("article-status-edit-btn");
  var statusSelect = document.getElementById("article-publication-status-select");

  if (statusEditBtn && statusSelect && statusBadge) {
    var originalStatusId = statusSelect.getAttribute("data-current");
    var isEditing = false;

    function showBadgeMode() {
      statusBadge.style.display = "";
      statusEditBtn.style.display = "";
      statusSelect.style.display = "none";
      isEditing = false;
    }

    function showDropdownMode() {
      statusBadge.style.display = "none";
      statusEditBtn.style.display = "none";
      statusSelect.style.display = "";
      statusSelect.focus();
      isEditing = true;
    }

    /* Click edit pencil → show dropdown */
    statusEditBtn.addEventListener("click", showDropdownMode);

    /* Click away from dropdown → revert to badge */
    statusSelect.addEventListener("blur", function () {
      setTimeout(showBadgeMode, 150);
    });

    /* On change → save new status */
    statusSelect.addEventListener("change", function () {
      var newStatusId = statusSelect.value;
      if (!newStatusId || newStatusId === originalStatusId) {
        showBadgeMode();
        return;
      }

      var entryId = statusSelect.getAttribute("data-entry-id");

      function getCookieValue(name) {
        var cookieMatch = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
        return cookieMatch ? cookieMatch.pop() : "";
      }

      fetch("/newshub/api/article/" + entryId + "/status/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookieValue("csrftoken"),
        },
        body: JSON.stringify({ status_id: parseInt(newStatusId, 10) }),
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            /* Update badge text and class */
            statusBadge.className = "article-status-badge " + data.new_status_code;
            statusBadge.textContent = data.new_status_icon + " " + data.new_status_name_bn;
            originalStatusId = newStatusId;
            showBadgeMode();
            showInlineMessage(statusSelect.parentNode, "স্থিতি পরিবর্তন হয়েছে", false);
          } else {
            showBadgeMode();
            showInlineMessage(statusSelect.parentNode, data.error || "স্থিতি পরিবর্তন করা যায়নি", true);
          }
        })
        .catch(function () {
          showBadgeMode();
          showInlineMessage(statusSelect.parentNode, "নেটওয়ার্ক ত্রুটি", true);
        });
    });
  }
})();

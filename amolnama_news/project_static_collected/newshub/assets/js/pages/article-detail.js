/* article-detail.js — Article view page interactions */
(function () {
  "use strict";

  /* Share button */
  var shareButton = document.getElementById("article-share-btn");
  if (shareButton) {
    shareButton.addEventListener("click", function () {
      var articleTitle = shareButton.getAttribute("data-title") || "";
      var articleUrl = window.location.href;

      if (navigator.share) {
        navigator.share({ title: articleTitle, url: articleUrl });
      } else {
        navigator.clipboard.writeText(articleUrl).then(function () {
          alert("লিংক কপি হয়েছে!");
        });
      }
    });
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
            alert(data.error || "মন্তব্য জমা দিতে সমস্যা হয়েছে");
          }
          commentSubmitButton.disabled = false;
          commentSubmitButton.textContent = "💬 মন্তব্য করুন";
        })
        .catch(function () {
          alert("নেটওয়ার্ক ত্রুটি");
          commentSubmitButton.disabled = false;
          commentSubmitButton.textContent = "💬 মন্তব্য করুন";
        });
    });
  }

  /* Publication status changer */
  var publicationStatusSelect = document.getElementById("article-publication-status-select");
  if (publicationStatusSelect) {
    var originalStatusId = publicationStatusSelect.getAttribute("data-current");
    publicationStatusSelect.addEventListener("change", function () {
      var newStatusId = publicationStatusSelect.value;
      if (newStatusId === originalStatusId) return;

      var entryId = publicationStatusSelect.getAttribute("data-entry-id");

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
            /* Update badge */
            var badge = document.querySelector(".article-publication-badge");
            if (badge) {
              badge.className = "article-publication-badge " + data.new_status_code;
              badge.textContent = data.new_status_icon + " " + data.new_status_name_bn;
            }
            originalStatusId = newStatusId;
          } else {
            alert(data.error || "স্থিতি পরিবর্তন করা যায়নি");
            publicationStatusSelect.value = originalStatusId;
          }
        })
        .catch(function () {
          alert("নেটওয়ার্ক ত্রুটি");
          publicationStatusSelect.value = originalStatusId;
        });
    });
  }
})();

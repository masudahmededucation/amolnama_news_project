/* article-detail.js — Article view page interactions */
(function () {
  "use strict";

  /* ---- Inline message helper (for non-photo features) ---- */
  function showInlineMessage(nearElement, text, isError) {
    const existing = nearElement.parentNode.querySelector(".inline-message");
    if (existing) existing.remove();

    const messageElement = document.createElement("div");
    messageElement.className = "inline-message " + (isError ? "inline-message-error" : "inline-message-success");
    messageElement.textContent = text;
    nearElement.parentNode.insertBefore(messageElement, nearElement.nextSibling);

    setTimeout(function () { if (messageElement.parentNode) messageElement.remove(); }, 5000);
  }

  /* ---- Shared actions bar init (like + share) ---- */
  if (typeof window.actionsBar !== 'undefined') {
    window.actionsBar.init({
      buildLikeApiUrl: function (entityId) {
        return '/newshub/api/article/' + entityId + '/like/';
      },
    });
  }

  /* ---- Shared photo card init (cover, like, view, edit, delete) ---- */
  if (typeof window.photoCard !== 'undefined') {
    window.photoCard.init({
      cardSelector: '.photo-card',
      imageSelector: '.photo-card-image',
      idAttribute: 'data-photo-id',
      parentIdAttribute: 'data-parent-id',
      heroElementId: 'article-detail-hero',
      buildApiUrl: function (parentId, photoId, action) {
        return '/newshub/api/article/' + parentId + '/photo/' + photoId + '/' + action + '/';
      },
      onDeleteCard: function () {
        /* Clean up empty groups after card deletion */
        const allPhotoGrids = document.querySelectorAll('.photo-card-grid');
        for (let gridIndex = 0; gridIndex < allPhotoGrids.length; gridIndex++) {
          if (allPhotoGrids[gridIndex].querySelectorAll('.photo-card').length === 0) {
            const groupElement = allPhotoGrids[gridIndex].closest('.article-detail-photo-group');
            if (groupElement) groupElement.remove();
          }
        }
        /* If all groups gone, remove the entire section */
        const photosSection = document.querySelector('.article-detail-photos');
        if (photosSection && photosSection.querySelectorAll('.photo-card').length === 0) {
          photosSection.remove();
        }
      },
    });
  }

  /* ---- Photo lightbox init (shared component) ---- */
  if (typeof window.photoLightbox !== 'undefined') {
    window.photoLightbox.init({
      thumbSelector: '.photo-card-image[data-photo-url]',
      excludeSelectors: [
        '.photo-card-set-cover-button',
        '.photo-card-edit-button',
        '.photo-card-delete-button',
        '.photo-card-like-button',
        '.photo-card-actions',
        '.photo-card-footer',
        '.photo-card-edit-form',
        '.photo-card-delete-confirm',
      ],
    });
  }

  /* ---- Comment submit ---- */
  const commentSubmitButton = document.getElementById("article-comment-submit");
  const commentTextarea = document.getElementById("article-comment-text");

  if (commentSubmitButton && commentTextarea) {
    commentSubmitButton.addEventListener("click", function () {
      const commentText = commentTextarea.value.trim();
      if (!commentText) {
        commentTextarea.focus();
        return;
      }

      const articleId = commentSubmitButton.getAttribute("data-article-id");
      commentSubmitButton.disabled = true;
      commentSubmitButton.textContent = "জমা হচ্ছে...";

      function getCookie(name) {
        const cookieValue = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
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
        .then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
        .then(function (data) {
          if (data.success) {
            let commentsList = document.querySelector(".article-comments-list");
            if (!commentsList) {
              commentsList = document.createElement("div");
              commentsList.className = "article-comments-list";
              const emptyMessage = document.querySelector(".article-comments p[style]");
              if (emptyMessage) emptyMessage.remove();
              document.querySelector(".article-comments").appendChild(commentsList);
            }
            const newComment = document.createElement("div");
            newComment.className = "article-comment-card";
            newComment.innerHTML =
              '<p class="article-comment-text">' + escapeHtml(commentText) + "</p>" +
              '<span class="article-comment-meta">এইমাত্র</span>';
            commentsList.appendChild(newComment);
            commentTextarea.value = "";

            const commentHeading = document.querySelector(".article-comments .article-section-title");
            if (commentHeading) {
              const currentCount = parseInt(commentHeading.textContent.match(/\d+/) || "0", 10);
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

  /* ---- Publication status — toggle between badge and dropdown ---- */
  const statusBadge = document.getElementById("article-status-badge");
  const statusEditBtn = document.getElementById("article-status-edit-button");
  const statusSelect = document.getElementById("article-publication-status-select");

  if (statusEditBtn && statusSelect && statusBadge) {
    let originalStatusId = statusSelect.getAttribute("data-current");
    let isEditing = false;

    function showBadgeMode() {
      statusBadge.hidden = false;
      statusEditBtn.hidden = false;
      statusSelect.hidden = true;
      isEditing = false;
    }

    function showDropdownMode() {
      statusBadge.hidden = true;
      statusEditBtn.hidden = true;
      statusSelect.hidden = false;
      statusSelect.focus();
      isEditing = true;
    }

    statusEditBtn.addEventListener("click", showDropdownMode);
    statusSelect.addEventListener("blur", function () {
      setTimeout(showBadgeMode, 150);
    });

    statusSelect.addEventListener("change", function () {
      const newStatusId = statusSelect.value;
      if (!newStatusId || newStatusId === originalStatusId) {
        showBadgeMode();
        return;
      }

      const entryId = statusSelect.getAttribute("data-entry-id");

      function getCookieValue(name) {
        const cookieMatch = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
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
        .then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
        .then(function (data) {
          if (data.success) {
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

/* Per-quiz discussion thread.
   Looks for #quizadmin-quiz-comments[data-quiz-id]; if absent, no-ops.
   Loads comments, posts new ones, supports reply / like / delete. */
(function () {
  'use strict';

  var container = document.getElementById('quizadmin-quiz-comments');
  if (!container) return;

  var quizId = container.dataset.quizId;
  var listElement = document.getElementById('quizadmin-quiz-comments-list');
  var topForm = document.getElementById('quizadmin-quiz-comment-form');
  var topTextarea = document.getElementById('quizadmin-quiz-comment-textarea');
  var topMessage = document.getElementById('quizadmin-quiz-comment-form-message');
  var topSubmit = document.getElementById('quizadmin-quiz-comment-form-submit');

  function _escapeHtml(text) {
    var node = document.createElement('div');
    node.textContent = text || '';
    return node.innerHTML;
  }

  function _formatTimestamp(isoString) {
    if (!isoString) return '';
    var date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }

  function _renderComment(comment) {
    var pinnedClass = comment.is_pinned ? ' quizadmin-quiz-comment-pinned' : '';
    var pinnedBadge = comment.is_pinned ? '<span class="quizadmin-quiz-comment-pinned-badge">pinned</span>' : '';
    var likedClass = comment.viewer_has_liked ? ' quizadmin-quiz-comment-action-button-liked' : '';
    var likeLabel = '♥ ' + (comment.reaction_count || 0);
    var deleteButton = '<button type="button" class="quizadmin-quiz-comment-action-button quizadmin-quiz-comment-delete-button" data-comment-id="' + comment.mastermind_coll_quiz_comment_id + '">Delete</button>';
    var replyButton = comment.link_parent_comment_id
      ? ''  // don't allow replying to a reply (single nesting depth)
      : '<button type="button" class="quizadmin-quiz-comment-action-button quizadmin-quiz-comment-reply-button" data-comment-id="' + comment.mastermind_coll_quiz_comment_id + '">Reply</button>';

    var repliesHtml = '';
    if (comment.replies && comment.replies.length) {
      repliesHtml = '<div class="quizadmin-quiz-comment-replies">' +
        comment.replies.map(_renderComment).join('') +
        '</div>';
    }

    return '<article class="quizadmin-quiz-comment' + pinnedClass + '" data-comment-id="' + comment.mastermind_coll_quiz_comment_id + '">' +
      '<header class="quizadmin-quiz-comment-meta">' +
        pinnedBadge +
        '<strong>' + _escapeHtml(comment.display_name || 'Anonymous') + '</strong>' +
        '<span>' + _formatTimestamp(comment.created_at) + '</span>' +
      '</header>' +
      '<div class="quizadmin-quiz-comment-body">' + (comment.comment_text_html || '') + '</div>' +
      '<div class="quizadmin-quiz-comment-actions">' +
        '<button type="button" class="quizadmin-quiz-comment-action-button quizadmin-quiz-comment-like-button' + likedClass + '" data-comment-id="' + comment.mastermind_coll_quiz_comment_id + '">' + likeLabel + '</button>' +
        replyButton +
        deleteButton +
      '</div>' +
      repliesHtml +
      '</article>';
  }

  async function _loadComments() {
    listElement.innerHTML = '<p class="quizadmin-quiz-comments-loading">Loading comments…</p>';
    try {
      var response = await fetch('/mastermind/api/quiz/' + quizId + '/comments/', {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      var data = await response.json();
      var comments = (data && data.comments) || [];
      if (!comments.length) {
        listElement.innerHTML = '<p class="quizadmin-quiz-comments-empty">No comments yet — be the first.</p>';
        return;
      }
      listElement.innerHTML = comments.map(_renderComment).join('');
    } catch (error) {
      listElement.innerHTML = '<p class="quizadmin-quiz-comments-empty">Failed to load comments.</p>';
    }
  }

  topForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    var text = topTextarea.value.trim();
    if (!text) return;
    topSubmit.disabled = true;
    var originalText = topSubmit.textContent;
    topSubmit.textContent = 'Posting…';
    topMessage.hidden = true;
    try {
      await window.quizadminPost(
        '/mastermind/api/quiz/' + quizId + '/comments/create/',
        { comment_text_html: text },
      );
      topTextarea.value = '';
      _loadComments();
    } catch (error) {
      window.quizadminShowInline(topMessage, error.message || 'Post failed.', 'error');
    } finally {
      topSubmit.disabled = false;
      topSubmit.textContent = originalText;
    }
  });

  // Delegate like / reply / delete clicks
  listElement.addEventListener('click', async function (event) {
    var likeButton = event.target.closest('.quizadmin-quiz-comment-like-button');
    if (likeButton) {
      var commentId = likeButton.dataset.commentId;
      try {
        var result = await window.quizadminPost(
          '/mastermind/api/quiz/comment/' + commentId + '/like/', {},
        );
        likeButton.textContent = '♥ ' + result.total_count;
        likeButton.classList.toggle('quizadmin-quiz-comment-action-button-liked', !!result.now_active);
      } catch (error) { /* leave button as-is */ }
      return;
    }

    var deleteButton = event.target.closest('.quizadmin-quiz-comment-delete-button');
    if (deleteButton) {
      if (deleteButton.dataset.confirmed !== 'true') {
        deleteButton.dataset.confirmed = 'true';
        deleteButton.textContent = 'Confirm delete';
        setTimeout(function () {
          if (deleteButton.dataset.confirmed === 'true') {
            delete deleteButton.dataset.confirmed;
            deleteButton.textContent = 'Delete';
          }
        }, 3000);
        return;
      }
      var commentId = deleteButton.dataset.commentId;
      try {
        await window.quizadminPost('/mastermind/api/quiz/comment/' + commentId + '/delete/', {});
        _loadComments();
      } catch (error) {
        deleteButton.disabled = false;
      }
      return;
    }

    var replyButton = event.target.closest('.quizadmin-quiz-comment-reply-button');
    if (replyButton) {
      var commentId = replyButton.dataset.commentId;
      var article = replyButton.closest('.quizadmin-quiz-comment');
      var existing = article.querySelector('.quizadmin-quiz-comment-reply-form');
      if (existing) { existing.remove(); return; }

      var replyForm = document.createElement('form');
      replyForm.className = 'quizadmin-quiz-comment-reply-form';
      replyForm.innerHTML =
        '<textarea class="quizadmin-quiz-comment-textarea" rows="2" maxlength="8000" placeholder="Write a reply…" required></textarea>' +
        '<button type="submit" class="quizadmin-form-submit">Reply</button>';
      article.appendChild(replyForm);
      var textarea = replyForm.querySelector('textarea');
      textarea.focus();

      replyForm.addEventListener('submit', async function (subEvent) {
        subEvent.preventDefault();
        var text = textarea.value.trim();
        if (!text) return;
        try {
          await window.quizadminPost(
            '/mastermind/api/quiz/' + quizId + '/comments/create/',
            { comment_text_html: text, parent_comment_id: parseInt(commentId, 10) },
          );
          _loadComments();
        } catch (error) { /* keep form open */ }
      });
    }
  });

  _loadComments();
})();

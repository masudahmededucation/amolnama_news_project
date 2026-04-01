/* debate-arena.js — Join side, post argument, reply (crossing-over), vote, live polling. */
(function () {
  'use strict';

  var arenaElement = document.getElementById('debate-arena');
  if (!arenaElement) return;

  var topicId = arenaElement.getAttribute('data-topic-id');
  var topicStatus = arenaElement.getAttribute('data-topic-status');
  var userSide = arenaElement.getAttribute('data-user-side');
  var minimumCharacterCount = parseInt(arenaElement.getAttribute('data-min-chars') || '60', 10);

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  function showInlineMessage(parentElement, message, messageType) {
    var existingMessage = parentElement.querySelector('.debate-arena-inline-message');
    if (existingMessage) existingMessage.remove();
    var messageElement = document.createElement('div');
    messageElement.className = 'debate-arena-inline-message debate-arena-inline-message-' + messageType;
    messageElement.textContent = message;
    parentElement.appendChild(messageElement);
    if (messageType === 'success') {
      setTimeout(function () { messageElement.remove(); }, 3000);
    }
  }

  /* ---- JOIN SIDE ---- */
  document.addEventListener('click', function (event) {
    var joinButton = event.target.closest('.debate-arena-join-button');
    if (joinButton) {
      var selectedSide = joinButton.getAttribute('data-side');
      joinButton.disabled = true;

      fetch('/debate/api/topic/' + topicId + '/join/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ team_side_code: selectedSide }),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          window.location.reload();
        } else {
          showInlineMessage(joinButton.parentElement, data.error, 'error');
          joinButton.disabled = false;
        }
      })
      .catch(function () {
        joinButton.disabled = false;
      });
      return;
    }

    /* ---- VOTE ---- */
    var voteButton = event.target.closest('.debate-argument-vote-button');
    if (voteButton) {
      var postId = voteButton.getAttribute('data-post-id');
      var voteValue = parseInt(voteButton.getAttribute('data-vote-value'), 10);

      fetch('/debate/api/vote/post/' + postId + '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ vote_value: voteValue }),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          /* Optimistic UI — update score count */
          var cardElement = voteButton.closest('.debate-argument-card, .debate-rebuttal-card');
          if (cardElement) {
            var scoreElement = cardElement.querySelector('.debate-argument-vote-count');
            if (scoreElement) {
              var currentScore = parseInt(scoreElement.textContent, 10) || 0;
              if (data.action === 'voted') {
                scoreElement.textContent = currentScore + voteValue;
              } else if (data.action === 'removed') {
                scoreElement.textContent = currentScore - voteValue;
              } else if (data.action === 'flipped') {
                scoreElement.textContent = currentScore + (voteValue * 2);
              }
            }
          }
        }
      })
      .catch(function () {});
      return;
    }

    /* ---- REPLY (open drawer) ---- */
    var replyButton = event.target.closest('.debate-argument-reply-button');
    if (replyButton) {
      var parentPostId = replyButton.getAttribute('data-post-id');
      var parentAuthorSide = replyButton.getAttribute('data-author-side');
      var parentCard = replyButton.closest('.debate-argument-card, .debate-rebuttal-card');
      var parentContent = parentCard ? parentCard.querySelector('.debate-argument-card-content, .debate-rebuttal-card-content') : null;

      var drawer = document.getElementById('debate-arena-reply-drawer');
      var drawerLabel = document.getElementById('debate-arena-reply-drawer-label');
      var drawerParent = document.getElementById('debate-arena-reply-drawer-parent');
      var drawerTextarea = document.getElementById('debate-arena-reply-drawer-textarea');
      var drawerSubmit = document.getElementById('debate-arena-reply-drawer-submit');

      /* Set crossing-over visual */
      var replySide = parentAuthorSide === 'blue' ? 'red' : 'blue';
      if (replySide === 'blue') {
        drawerTextarea.style.borderColor = '#93c5fd';
        drawerSubmit.style.background = '#2563eb';
        drawerLabel.textContent = '🔵 পক্ষে খণ্ডন দিন (Rebuttal to Against)';
      } else {
        drawerTextarea.style.borderColor = '#fca5a5';
        drawerSubmit.style.background = '#dc2626';
        drawerLabel.textContent = '🔴 বিপক্ষে খণ্ডন দিন (Rebuttal to Pro)';
      }

      drawerSubmit.setAttribute('data-parent-post-id', parentPostId);
      drawerParent.textContent = parentContent ? '↩ ' + parentContent.textContent.substring(0, 120) + '...' : '';
      drawerTextarea.value = '';
      drawer.classList.remove('debate-arena-reply-drawer-hidden');
      drawerTextarea.focus();
      return;
    }
  });

  /* ---- CLOSE REPLY DRAWER ---- */
  var replyDrawerCloseButton = document.getElementById('debate-arena-reply-drawer-close');
  if (replyDrawerCloseButton) {
    replyDrawerCloseButton.addEventListener('click', function () {
      document.getElementById('debate-arena-reply-drawer').classList.add('debate-arena-reply-drawer-hidden');
    });
  }

  /* ---- SUBMIT REPLY ---- */
  var replyDrawerSubmitButton = document.getElementById('debate-arena-reply-drawer-submit');
  if (replyDrawerSubmitButton) {
    replyDrawerSubmitButton.addEventListener('click', function () {
      var parentPostId = replyDrawerSubmitButton.getAttribute('data-parent-post-id');
      var textarea = document.getElementById('debate-arena-reply-drawer-textarea');
      var content = textarea.value.trim();

      if (!content || content.length < minimumCharacterCount) {
        showInlineMessage(textarea.parentElement, 'কমপক্ষে ' + minimumCharacterCount + ' অক্ষর প্রয়োজন', 'error');
        return;
      }

      replyDrawerSubmitButton.disabled = true;

      fetch('/debate/api/topic/' + topicId + '/reply/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ post_content: content, parent_post_id: parseInt(parentPostId, 10) }),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          window.location.reload();
        } else {
          showInlineMessage(textarea.parentElement, data.error, 'error');
          replyDrawerSubmitButton.disabled = false;
        }
      })
      .catch(function () {
        replyDrawerSubmitButton.disabled = false;
      });
    });
  }

  /* ---- SUBMIT NEW ARGUMENT (Blue or Red composer) ---- */
  function setupComposer(composerSide) {
    var submitButton = document.getElementById('debate-arena-composer-' + composerSide + '-submit');
    var textarea = document.getElementById('debate-arena-composer-' + composerSide + '-textarea');
    var charCountElement = document.getElementById('debate-arena-composer-' + composerSide + '-char-count');

    if (!submitButton || !textarea) return;

    textarea.addEventListener('input', function () {
      charCountElement.textContent = textarea.value.length;
    });

    submitButton.addEventListener('click', function () {
      var content = textarea.value.trim();
      if (!content || content.length < minimumCharacterCount) {
        showInlineMessage(submitButton.parentElement, 'কমপক্ষে ' + minimumCharacterCount + ' অক্ষর প্রয়োজন', 'error');
        return;
      }

      submitButton.disabled = true;

      fetch('/debate/api/topic/' + topicId + '/argument/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ post_content: content }),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          window.location.reload();
        } else {
          showInlineMessage(submitButton.parentElement, data.error, 'error');
          submitButton.disabled = false;
        }
      })
      .catch(function () {
        submitButton.disabled = false;
      });
    });
  }

  setupComposer('blue');
  setupComposer('red');

  /* ---- REPLY DRAWER CHAR COUNT ---- */
  var replyDrawerTextarea = document.getElementById('debate-arena-reply-drawer-textarea');
  var replyDrawerCharCount = document.getElementById('debate-arena-reply-drawer-char-count');
  if (replyDrawerTextarea && replyDrawerCharCount) {
    replyDrawerTextarea.addEventListener('input', function () {
      replyDrawerCharCount.textContent = replyDrawerTextarea.value.length;
    });
  }
})();

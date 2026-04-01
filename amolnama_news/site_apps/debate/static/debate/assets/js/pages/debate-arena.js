/* debate-arena.js — Join side, post argument, reply (crossing-over), vote, live polling. */
(function () {
  'use strict';

  var arenaElement = document.getElementById('debate-arena');
  if (!arenaElement) return;

  var topicId = arenaElement.getAttribute('data-topic-id');
  var topicStatus = arenaElement.getAttribute('data-topic-status');
  var userSide = arenaElement.getAttribute('data-user-side');

  /* ---- Rotating Placeholders — warn users with respect reminders ---- */
  var debatePlaceholderMessages = [
    'আপনারা এর পক্ষে বিপক্ষে যুক্তি দেখাবেন।',
    'সবাইকে সম্মান দিয়ে কথা বলুন।',
    'কোনো গালিগালাজ করবেন না।',
    'তথ্য ও যুক্তি দিয়ে আপনার মতামত প্রকাশ করুন।',
    'ব্যক্তি আক্রমণ নয়, যুক্তি দিন।',
    'প্রতিপক্ষের কথা মনোযোগ দিয়ে পড়ুন।',
    'ভিন্নমত মানেই শত্রু নয়।',
    'আপনার যুক্তিই আপনার শক্তি।',
    'সত্য ও ন্যায়ের পক্ষে দাঁড়ান।',
    'গঠনমূলক সমালোচনা করুন, ধ্বংসাত্মক নয়।',
    'একটি ভালো যুক্তি হাজার গালির চেয়ে শক্তিশালী।',
    'আপনার লেখা অন্যকে চিন্তা করাবে — দায়িত্ব নিয়ে লিখুন।',
  ];

  function initRotatingPlaceholders() {
    var rotatingTextareas = document.querySelectorAll('[data-rotating-placeholder]');
    rotatingTextareas.forEach(function (textarea) {
      var randomIndex = Math.floor(Math.random() * debatePlaceholderMessages.length);
      textarea.placeholder = debatePlaceholderMessages[randomIndex];

      textarea.addEventListener('focus', function () {
        var nextIndex = Math.floor(Math.random() * debatePlaceholderMessages.length);
        textarea.placeholder = debatePlaceholderMessages[nextIndex];
      });
    });
  }

  initRotatingPlaceholders();
  var minimumCharacterCount = parseInt(arenaElement.getAttribute('data-min-chars') || '60', 10);

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  function scrollToAndHighlightPost(postId) {
    var postElement = document.getElementById('debate-argument-card-' + postId) ||
                      document.getElementById('debate-rebuttal-card-' + postId);
    if (postElement) {
      postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      postElement.style.transition = 'box-shadow .3s, outline .3s';
      postElement.style.outline = '3px solid #fbbf24';
      postElement.style.boxShadow = '0 0 20px rgba(251,191,36,.4)';
      setTimeout(function () {
        postElement.style.outline = '';
        postElement.style.boxShadow = '';
      }, 3000);
    }
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
        drawerLabel.textContent = '🔵 পক্ষে উত্তর দিন (Reply to Against)';
      } else {
        drawerTextarea.style.borderColor = '#fca5a5';
        drawerSubmit.style.background = '#dc2626';
        drawerLabel.textContent = '🔴 বিপক্ষে উত্তর দিন (Reply to Pro)';
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
        } else if (data.duplicate && data.duplicate_post_id) {
          /* Duplicate found — auto-upvoted, scroll to existing post */
          showInlineMessage(submitButton.parentElement, data.error, 'success');
          textarea.value = '';
          submitButton.disabled = false;
          scrollToAndHighlightPost(data.duplicate_post_id);
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

  /* ---- SHARE — toggle dropdown, copy link, native share ---- */
  var shareToggleButton = document.getElementById('debate-arena-share-toggle');
  var shareDropdown = document.getElementById('debate-arena-share-dropdown');

  if (shareToggleButton && shareDropdown) {
    shareToggleButton.addEventListener('click', function (event) {
      event.stopPropagation();
      shareDropdown.classList.toggle('debate-arena-share-dropdown-open');
    });

    /* Close dropdown on outside click */
    document.addEventListener('click', function () {
      shareDropdown.classList.remove('debate-arena-share-dropdown-open');
    });

    /* Copy Link */
    var copyLinkButton = document.getElementById('debate-arena-share-copy-link');
    if (copyLinkButton) {
      copyLinkButton.addEventListener('click', function () {
        var debateUrl = window.location.origin + '/debate/topic/' + topicId + '/';
        navigator.clipboard.writeText(debateUrl).then(function () {
          copyLinkButton.textContent = '✓ Copied!';
          setTimeout(function () {
            copyLinkButton.innerHTML = '<svg class="debate-arena-share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Copy Link';
          }, 2000);
        });
        shareDropdown.classList.remove('debate-arena-share-dropdown-open');
      });
    }

    /* Native Share API */
    var nativeShareButton = document.getElementById('debate-arena-share-native');
    if (nativeShareButton) {
      if (navigator.share) {
        nativeShareButton.addEventListener('click', function () {
          navigator.share({
            title: document.querySelector('.debate-arena-topic-title').textContent,
            url: window.location.origin + '/debate/topic/' + topicId + '/',
          });
          shareDropdown.classList.remove('debate-arena-share-dropdown-open');
        });
      } else {
        nativeShareButton.style.display = 'none';
      }
    }
  }

  /* ---- PDF Download — server-side Edge headless, fetch once → preview + auto-download ---- */
  var downloadButton = document.getElementById('debate-arena-download-button');
  if (downloadButton) {
    downloadButton.addEventListener('click', function () {
      var originalText = downloadButton.textContent;
      downloadButton.textContent = '⏳ তৈরি হচ্ছে...';
      downloadButton.disabled = true;

      /* Build filename from topic title */
      var rawFilename = downloadButton.getAttribute('data-filename') || 'debate';
      var cleanedFilename = rawFilename.replace(/[?!।:;'"\/\\<>|*]/g, '').trim();
      var filenameWords = cleanedFilename.split(/\s+/).slice(0, 5).join(' ');
      if (filenameWords.length > 50) filenameWords = filenameWords.substring(0, 50).trim();
      var pdfFilename = filenameWords + '.pdf';

      /* Open preview window immediately (user gesture context — won't be blocked) */
      var previewWindow = window.open('', '_blank');
      if (previewWindow) {
        previewWindow.document.write('<html><head><title>' + pdfFilename + '</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:#666;"><p>⏳ PDF তৈরি হচ্ছে...</p></body></html>');
      }

      fetch('/debate/topic/' + topicId + '/download-pdf/')
        .then(function (response) {
          if (!response.ok) throw new Error('PDF generation failed');
          return response.blob();
        })
        .then(function (pdfBlob) {
          var blobUrl = URL.createObjectURL(pdfBlob);

          /* Update preview window with actual PDF */
          if (previewWindow && !previewWindow.closed) {
            previewWindow.location.href = blobUrl;
          }

          /* Auto-download with proper filename after a short delay */
          setTimeout(function () {
            var autoDownloadLink = document.createElement('a');
            autoDownloadLink.href = blobUrl;
            autoDownloadLink.download = pdfFilename;
            autoDownloadLink.style.display = 'none';
            document.body.appendChild(autoDownloadLink);
            autoDownloadLink.click();
            document.body.removeChild(autoDownloadLink);
          }, 1500);

          /* Clean up blob URL after a delay */
          setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 60000);

          downloadButton.textContent = originalText;
          downloadButton.disabled = false;
        })
        .catch(function () {
          if (previewWindow && !previewWindow.closed) previewWindow.close();
          showInlineMessage(downloadButton.parentElement, 'PDF তৈরি ব্যর্থ হয়েছে', 'error');
          downloadButton.textContent = originalText;
          downloadButton.disabled = false;
        });
    });
  }
})();

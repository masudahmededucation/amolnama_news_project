/* debate-arena.js — Join side, post argument, reply (crossing-over), vote, live polling. */
(function () {
  'use strict';


  var arenaElement = document.getElementById('debate-arena');
  if (!arenaElement) return;

  /* Force scroll to top on page load — prevent browser restoring bottom position */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

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

      var citationUrlInput = document.getElementById('debate-arena-composer-' + composerSide + '-citation-url');
      var citationTextInput = document.getElementById('debate-arena-composer-' + composerSide + '-citation-text');
      var citationSourceUrl = citationUrlInput ? citationUrlInput.value.trim() : '';
      var citationSourceText = citationTextInput ? citationTextInput.value.trim() : '';

      fetch('/debate/api/topic/' + topicId + '/argument/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ post_content: content, citation_source_url: citationSourceUrl, citation_source_text: citationSourceText }),
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

  /* ---- TOPIC EDIT — inline form for staff/creator ---- */
  var editButton = document.getElementById('debate-arena-edit-button');
  if (editButton) {
    editButton.addEventListener('click', function () {
      var existingForm = document.getElementById('debate-arena-edit-form');
      if (existingForm) { existingForm.remove(); return; }

      var header = document.getElementById('debate-arena-header');
      var form = document.createElement('div');
      form.className = 'debate-arena-edit-form';
      form.id = 'debate-arena-edit-form';

      /* Pre-populate from data attributes */
      var currentTitle = arenaElement.querySelector('.debate-arena-topic-title') ? arenaElement.querySelector('.debate-arena-topic-title').textContent.trim() : '';
      var currentDescription = arenaElement.getAttribute('data-topic-description') || '';
      var currentBlueLabel = arenaElement.getAttribute('data-blue-side-label') || '';
      var currentRedLabel = arenaElement.getAttribute('data-red-side-label') || '';
      var currentBlueVideo = arenaElement.getAttribute('data-blue-side-video-url') || '';
      var currentRedVideo = arenaElement.getAttribute('data-red-side-video-url') || '';
      var currentBlueImage = arenaElement.getAttribute('data-blue-side-image-url') || '';
      var currentRedImage = arenaElement.getAttribute('data-red-side-image-url') || '';

      form.innerHTML =
        '<label class="debate-arena-edit-form-label" for="debate-arena-edit-title">বিষয়</label>' +
        '<input type="text" class="debate-arena-edit-form-input" id="debate-arena-edit-title" name="debate_arena_edit_title" value="' + currentTitle.replace(/"/g, '&quot;') + '">' +
        '<label class="debate-arena-edit-form-label" for="debate-arena-edit-description">বিবরণ</label>' +
        '<textarea class="debate-arena-edit-form-textarea" id="debate-arena-edit-description" name="debate_arena_edit_description" rows="3">' + currentDescription + '</textarea>' +

        /* Team section */
        '<div class="debate-arena-edit-form-group" id="debate-arena-edit-form-group-teams">' +
        '<span class="debate-arena-edit-form-group-title" id="debate-arena-edit-form-group-title-teams">⚔️ টিম</span>' +
        '<label class="debate-arena-edit-form-label" for="debate-arena-edit-blue-label">🔵 Blue Team যুক্তি খন্ডন করবেন</label>' +
        '<input type="text" class="debate-arena-edit-form-input" id="debate-arena-edit-blue-label" name="debate_arena_edit_blue_label" value="' + currentBlueLabel.replace(/"/g, '&quot;') + '">' +
        '<label class="debate-arena-edit-form-label" for="debate-arena-edit-red-label">🔴 Red Team যুক্তি খন্ডন করবেন</label>' +
        '<input type="text" class="debate-arena-edit-form-input" id="debate-arena-edit-red-label" name="debate_arena_edit_red_label" value="' + currentRedLabel.replace(/"/g, '&quot;') + '">' +
        '</div>' +

        /* Media section — collapsible */
        '<div class="debate-arena-edit-form-group" id="debate-arena-edit-form-group-media">' +
        '<button type="button" class="debate-arena-edit-form-group-toggle" id="debate-arena-edit-form-media-toggle" name="debate_arena_edit_form_media_toggle">📎 মিডিয়া (ভিডিও ও ছবি)</button>' +
        '<div class="debate-arena-edit-form-group-content debate-arena-edit-form-group-content-hidden" id="debate-arena-edit-form-media-content">' +
        '<label class="debate-arena-edit-form-label" for="debate-arena-edit-blue-video">🔵 Blue Team ভিডিও URL</label>' +
        '<input type="url" class="debate-arena-edit-form-input" id="debate-arena-edit-blue-video" name="debate_arena_edit_blue_video" value="' + currentBlueVideo + '">' +
        '<label class="debate-arena-edit-form-label" for="debate-arena-edit-blue-image">🔵 Blue Team ছবি URL</label>' +
        '<input type="url" class="debate-arena-edit-form-input" id="debate-arena-edit-blue-image" name="debate_arena_edit_blue_image" value="' + currentBlueImage + '">' +
        '<label class="debate-arena-edit-form-label" for="debate-arena-edit-red-video">🔴 Red Team ভিডিও URL</label>' +
        '<input type="url" class="debate-arena-edit-form-input" id="debate-arena-edit-red-video" name="debate_arena_edit_red_video" value="' + currentRedVideo + '">' +
        '<label class="debate-arena-edit-form-label" for="debate-arena-edit-red-image">🔴 Red Team ছবি URL</label>' +
        '<input type="url" class="debate-arena-edit-form-input" id="debate-arena-edit-red-image" name="debate_arena_edit_red_image" value="' + currentRedImage + '">' +
        '</div>' +
        '</div>' +

        '<div class="debate-arena-edit-form-buttons">' +
        '<button type="button" class="debate-arena-edit-form-save" id="debate-arena-edit-save" name="debate_arena_edit_save">সংরক্ষণ করুন</button>' +
        '<button type="button" class="debate-arena-edit-form-cancel" id="debate-arena-edit-cancel" name="debate_arena_edit_cancel">বাতিল</button>' +
        '</div>';

      header.appendChild(form);

      /* Media group toggle */
      document.getElementById('debate-arena-edit-form-media-toggle').addEventListener('click', function () {
        document.getElementById('debate-arena-edit-form-media-content').classList.toggle('debate-arena-edit-form-group-content-hidden');
      });

      document.getElementById('debate-arena-edit-cancel').addEventListener('click', function () { form.remove(); });

      document.getElementById('debate-arena-edit-save').addEventListener('click', function () {
        var saveButton = document.getElementById('debate-arena-edit-save');
        saveButton.disabled = true;
        saveButton.textContent = '...';

        fetch('/debate/api/topic/' + topicId + '/edit/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
          body: JSON.stringify({
            topic_title: document.getElementById('debate-arena-edit-title').value.trim(),
            topic_description: document.getElementById('debate-arena-edit-description').value.trim(),
            blue_side_label: document.getElementById('debate-arena-edit-blue-label').value.trim(),
            red_side_label: document.getElementById('debate-arena-edit-red-label').value.trim(),
            blue_side_video_url: document.getElementById('debate-arena-edit-blue-video').value.trim(),
            red_side_video_url: document.getElementById('debate-arena-edit-red-video').value.trim(),
            blue_side_image_url: document.getElementById('debate-arena-edit-blue-image').value.trim(),
            red_side_image_url: document.getElementById('debate-arena-edit-red-image').value.trim(),
          }),
        })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            window.location.reload();
          } else {
            showInlineMessage(form, data.error, 'error');
            saveButton.disabled = false;
            saveButton.textContent = 'সংরক্ষণ করুন';
          }
        })
        .catch(function () {
          saveButton.disabled = false;
          saveButton.textContent = 'সংরক্ষণ করুন';
        });
      });
    });
  }

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
          var topicTitleElement = document.querySelector('.debate-arena-topic-title');
          navigator.share({
            title: topicTitleElement ? topicTitleElement.textContent : 'বিতর্ক',
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
      var previewWindow = window.open('about:blank', '_blank', 'noopener');
      if (previewWindow) {
        previewWindow.document.open();
        previewWindow.document.close();
        var loadingMessage = previewWindow.document.createElement('p');
        loadingMessage.textContent = '\u23F3 PDF \u09A4\u09C8\u09B0\u09BF \u09B9\u099A\u09CD\u099B\u09C7...';
        loadingMessage.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:#666;';
        previewWindow.document.body.appendChild(loadingMessage);
        previewWindow.document.title = escapeHtml(pdfFilename);
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
  /* ---- CITATION TOGGLE — show/hide citation fields in composer ---- */
  document.addEventListener('click', function (event) {
    var citationToggle = event.target.closest('.debate-arena-composer-citation-toggle');
    if (citationToggle) {
      var fieldsContainer = citationToggle.nextElementSibling;
      if (fieldsContainer) {
        fieldsContainer.classList.toggle('debate-arena-composer-citation-fields-hidden');
      }
      return;
    }

    /* ---- FACT-CHECK FLAG ---- */
    var factCheckButton = event.target.closest('.debate-argument-fact-check-button');
    if (factCheckButton) {
      var factCheckPostId = factCheckButton.getAttribute('data-post-id');
      factCheckButton.disabled = true;

      fetch('/debate/api/post/' + factCheckPostId + '/fact-check-flag/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({}),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          var countElement = factCheckButton.querySelector('.debate-argument-fact-check-count');
          if (countElement) countElement.textContent = data.fact_check_flag_count;
          if (data.is_fact_check_needed) {
            var cardElement = factCheckButton.closest('.debate-argument-card, .debate-rebuttal-card');
            if (cardElement && !cardElement.querySelector('.debate-argument-fact-check-badge')) {
              var badge = document.createElement('div');
              badge.className = 'debate-argument-fact-check-badge';
              badge.textContent = '⚠️ তথ্য যাচাই প্রয়োজন';
              cardElement.insertBefore(badge, cardElement.firstChild);
            }
          }
        }
        factCheckButton.disabled = false;
      })
      .catch(function () { factCheckButton.disabled = false; });
      return;
    }
  });

  /* ---- AUTO-REFRESH PASSION BOARD — poll every 30s, update bars without reload ---- */
  if (topicStatus === 'live') {
    var passionBoard = document.getElementById('debate-passion-board');
    if (passionBoard) {
      var refreshIntervalId = setInterval(function () {
        if (document.visibilityState === 'hidden') return;

        fetch('/debate/api/topic/' + topicId + '/boards/')
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (!data.success) return;
            /* Update passion bar values */
            var updateBar = function (selector, value) {
              var element = passionBoard.querySelector(selector);
              if (element) element.style.width = value + '%';
            };
            var updateText = function (selector, value) {
              var element = passionBoard.querySelector(selector);
              if (element) element.textContent = value;
            };

            if (data.blue_post_count !== undefined && data.red_post_count !== undefined) {
              var totalPosts = data.blue_post_count + data.red_post_count;
              if (totalPosts > 0) {
                updateBar('.debate-passion-bar-blue', Math.round(data.blue_post_count / totalPosts * 100));
                updateBar('.debate-passion-bar-red', Math.round(data.red_post_count / totalPosts * 100));
              }
            }
          })
          .catch(function () {});
      }, 30000);

      /* Stop polling when page is unloaded */
      window.addEventListener('beforeunload', function () { clearInterval(refreshIntervalId); });
    }
  }

  /* ---- LINK EMBED PREVIEW — detect URLs in arguments, fetch og:tags ---- */
  var argumentCards = document.querySelectorAll('.debate-argument-card-content, .debate-rebuttal-card-content');
  argumentCards.forEach(function (contentElement) {
    var textContent = contentElement.textContent || '';
    var urlMatches = textContent.match(/https?:\/\/[^\s]+/g);
    if (!urlMatches || urlMatches.length === 0) return;

    var embedContainer = contentElement.parentElement.querySelector('.debate-argument-link-embeds');
    if (!embedContainer) return;

    urlMatches.slice(0, 2).forEach(function (detectedUrl) {
      fetch('/newsengine/api/link-preview/?url=' + encodeURIComponent(detectedUrl))
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (!data.success || !data.title) return;

          var embedCard = document.createElement('a');
          embedCard.href = data.url;
          embedCard.target = '_blank';
          embedCard.rel = 'noopener';
          embedCard.className = 'debate-argument-link-embed-card';

          var embedHtml = '';
          if (data.image) {
            embedHtml += '<img src="' + data.image + '" alt="" class="debate-argument-link-embed-image" onerror="this.style.display=\'none\'">';
          }
          embedHtml += '<div class="debate-argument-link-embed-info">';
          embedHtml += '<span class="debate-argument-link-embed-title">' + data.title + '</span>';
          if (data.description) {
            embedHtml += '<span class="debate-argument-link-embed-description">' + data.description + '</span>';
          }
          embedHtml += '</div>';
          embedCard.innerHTML = embedHtml;
          embedContainer.appendChild(embedCard);
        })
        .catch(function () {});
    });
  });

  /* ---- AUDIENCE VOTING — spectators vote on which side is winning ---- */
  document.addEventListener('click', function (event) {
    var audienceVoteButton = event.target.closest('.debate-audience-vote-button');
    if (!audienceVoteButton) return;

    var voteSide = audienceVoteButton.getAttribute('data-vote-side');
    audienceVoteButton.disabled = true;

    fetch('/debate/api/topic/' + topicId + '/audience-vote/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({ vote_side: voteSide }),
    })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (data.success) {
        var blueCount = document.getElementById('debate-audience-vote-blue-count');
        var redCount = document.getElementById('debate-audience-vote-red-count');
        var totalElement = document.getElementById('debate-audience-vote-total');
        if (blueCount) blueCount.textContent = data.audience_blue_vote_count;
        if (redCount) redCount.textContent = data.audience_red_vote_count;

        var totalVotes = data.audience_blue_vote_count + data.audience_red_vote_count;
        if (totalElement) totalElement.textContent = totalVotes + ' জন ভোট দিয়েছেন';

        /* Update bar */
        var blueBar = document.getElementById('debate-audience-vote-bar-blue');
        var redBar = document.getElementById('debate-audience-vote-bar-red');
        if (blueBar && redBar && totalVotes > 0) {
          blueBar.style.width = Math.round(data.audience_blue_vote_count / totalVotes * 100) + '%';
          redBar.style.width = Math.round(data.audience_red_vote_count / totalVotes * 100) + '%';
        }

        /* Update total scores smoothly */
        var blueScoreElement = document.querySelector('.debate-passion-score-blue');
        var redScoreElement = document.querySelector('.debate-passion-score-red');
        if (blueScoreElement && data.blue_total_score !== undefined) {
          blueScoreElement.textContent = '🔵 ' + data.blue_total_score + ' পয়েন্ট';
        }
        if (redScoreElement && data.red_total_score !== undefined) {
          redScoreElement.textContent = '🔴 ' + data.red_total_score + ' পয়েন্ট';
        }

        /* Update winner banner */
        var winnerElements = document.querySelectorAll('.debate-passion-winner');
        winnerElements.forEach(function (element) { element.style.display = 'none'; });
        if (data.winning_side === 'blue') {
          var blueWinner = document.querySelector('.debate-passion-winner-blue');
          if (blueWinner) blueWinner.style.display = '';
        } else if (data.winning_side === 'red') {
          var redWinner = document.querySelector('.debate-passion-winner-red');
          if (redWinner) redWinner.style.display = '';
        } else {
          var tieWinner = document.querySelector('.debate-passion-winner-tie');
          if (tieWinner) tieWinner.style.display = '';
        }

        /* Tick circle — show on voted button, remove from other */
        var allVoteButtons = document.querySelectorAll('.debate-audience-vote-button');
        allVoteButtons.forEach(function (button) {
          var existingTick = button.querySelector('.debate-audience-vote-tick');
          if (existingTick) existingTick.remove();
          button.classList.remove('debate-audience-vote-button-voted');
        });

        if (data.action === 'voted' || data.action === 'flipped') {
          audienceVoteButton.classList.add('debate-audience-vote-button-voted');
          var tickElement = document.createElement('span');
          tickElement.className = 'debate-audience-vote-tick';
          tickElement.textContent = '✓';
          audienceVoteButton.appendChild(tickElement);
        }
      }
      audienceVoteButton.disabled = false;
    })
    .catch(function () { audienceVoteButton.disabled = false; });
  });

  /* ---- NOTIFICATION BELL — toggle dropdown, fetch notifications, mark read ---- */
  var notificationBell = document.getElementById('debate-arena-notification-bell');
  var notificationDropdown = document.getElementById('debate-arena-notification-dropdown');

  if (notificationBell && notificationDropdown) {
    notificationBell.addEventListener('click', function (event) {
      event.stopPropagation();
      var isHidden = notificationDropdown.classList.contains('debate-arena-notification-dropdown-hidden');

      if (isHidden) {
        /* Fetch and show notifications */
        notificationDropdown.innerHTML = '<div class="debate-arena-notification-empty">লোড হচ্ছে...</div>';
        notificationDropdown.classList.remove('debate-arena-notification-dropdown-hidden');

        fetch('/debate/api/notifications/')
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (!data.success || data.notifications.length === 0) {
              notificationDropdown.innerHTML = '<div class="debate-arena-notification-empty">কোনো বিজ্ঞপ্তি নেই</div>';
              return;
            }

            var html = '';
            data.notifications.forEach(function (notification) {
              var readClass = notification.is_read ? '' : ' debate-arena-notification-item-unread';
              html += '<div class="debate-arena-notification-item' + readClass + '">';
              html += '<div>' + escapeHtml(notification.message) + '</div>';
              html += '<div class="debate-arena-notification-item-time">' + escapeHtml(notification.created_at) + '</div>';
              html += '</div>';
            });

            if (data.unread_count > 0) {
              html += '<div class="debate-arena-notification-mark-read" id="debate-arena-notification-mark-read">সব পড়া হয়েছে</div>';
            }

            notificationDropdown.innerHTML = html;

            /* Mark read handler */
            var markReadButton = document.getElementById('debate-arena-notification-mark-read');
            if (markReadButton) {
              markReadButton.addEventListener('click', function () {
                fetch('/debate/api/notifications/mark-read/', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
                  body: JSON.stringify({}),
                }).then(function () {
                  var countBadge = document.getElementById('debate-arena-notification-count');
                  if (countBadge) countBadge.style.display = 'none';
                  notificationDropdown.classList.add('debate-arena-notification-dropdown-hidden');
                });
              });
            }
          })
          .catch(function () {
            notificationDropdown.innerHTML = '<div class="debate-arena-notification-empty">লোড ব্যর্থ</div>';
          });
      } else {
        notificationDropdown.classList.add('debate-arena-notification-dropdown-hidden');
      }
    });

    /* Close on outside click */
    document.addEventListener('click', function () {
      notificationDropdown.classList.add('debate-arena-notification-dropdown-hidden');
    });

    /* Poll for new notifications every 60s */
    setInterval(function () {
      if (document.visibilityState === 'hidden') return;
      fetch('/debate/api/notifications/')
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            var countBadge = document.getElementById('debate-arena-notification-count');
            if (countBadge && data.unread_count > 0) {
              countBadge.textContent = data.unread_count;
              countBadge.style.display = '';
            }
          }
        })
        .catch(function () {});
    }, 60000);
  }
})();

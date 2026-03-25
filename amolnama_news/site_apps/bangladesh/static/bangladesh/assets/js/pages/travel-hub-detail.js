/**
 * travel-hub-detail.js — Destination detail page interactions.
 * Photo upload/edit/delete, YouTube link add/edit/delete, reference link add/edit/delete.
 * Uploader attribution, inline edit forms, inline messages (no popups).
 */
(function () {
  'use strict';

  /* ========== Photo Lightbox ========== */
  var lightbox = document.getElementById('photo-lightbox');
  var lightboxImage = document.getElementById('photo-lightbox-image');
  var lightboxCaption = document.getElementById('photo-lightbox-caption');
  var lightboxCounter = document.getElementById('photo-lightbox-counter');
  var photoGrid = document.getElementById('travel-hub-detail-photo-grid');
  var currentPhotoIndex = 0;

  function getPhotoThumbs() {
    return photoGrid ? photoGrid.querySelectorAll('.travel-hub-detail-photo-thumb[data-photo-url]') : [];
  }

  function openLightbox(index) {
    var thumbs = getPhotoThumbs();
    if (!thumbs.length || !lightbox) return;
    currentPhotoIndex = index;
    showPhoto();
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    /* Track photo view */
    var thumb = thumbs[index];
    var photoId = thumb ? thumb.getAttribute('data-photo-id') : null;
    var destIdElement = document.querySelector('[data-dest-id]');
    var destId = destIdElement ? destIdElement.getAttribute('data-dest-id') : null;
    if (photoId && destId) {
      fetch('/bangladesh-tourist-destinations/api/destination/' + destId + '/photo/' + photoId + '/view/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfToken() },
      }).catch(function() {});
    }
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.style.display = 'none';
    document.body.style.overflow = '';
  }

  function showPhoto() {
    var thumbs = getPhotoThumbs();
    if (!thumbs.length) return;
    var thumb = thumbs[currentPhotoIndex];
    lightboxImage.src = thumb.getAttribute('data-photo-url');
    lightboxCaption.textContent = thumb.getAttribute('data-photo-caption') || '';
    lightboxCounter.textContent = (currentPhotoIndex + 1) + ' / ' + thumbs.length;
  }

  function nextPhoto() {
    var thumbs = getPhotoThumbs();
    currentPhotoIndex = (currentPhotoIndex + 1) % thumbs.length;
    showPhoto();
  }

  function previousPhoto() {
    var thumbs = getPhotoThumbs();
    currentPhotoIndex = (currentPhotoIndex - 1 + thumbs.length) % thumbs.length;
    showPhoto();
  }

  if (photoGrid) {
    photoGrid.addEventListener('click', function (event) {
      /* Don't open lightbox when clicking edit/delete/meta elements */
      if (event.target.closest('.travel-hub-detail-contribution-actions')) return;
      if (event.target.closest('.travel-hub-detail-contribution-edit-button')) return;
      if (event.target.closest('.travel-hub-detail-contribution-delete-button')) return;
      if (event.target.closest('.travel-hub-detail-contribution-edit-form')) return;
      if (event.target.closest('.travel-hub-detail-contribution-delete-confirm')) return;
      if (event.target.closest('.travel-hub-detail-contribution-meta')) return;

      var thumb = event.target.closest('.travel-hub-detail-photo-thumb[data-photo-url]');
      if (!thumb) return;
      var index = parseInt(thumb.getAttribute('data-photo-index'), 10) || 0;
      openLightbox(index);
    });
  }

  var lightboxCloseButton = document.getElementById('photo-lightbox-close-button');
  var lightboxOverlay = document.getElementById('photo-lightbox-overlay');
  var lightboxPreviousButton = document.getElementById('photo-lightbox-previous-button');
  var lightboxNextButton = document.getElementById('photo-lightbox-next-button');

  if (lightboxCloseButton) lightboxCloseButton.addEventListener('click', closeLightbox);
  if (lightboxOverlay) lightboxOverlay.addEventListener('click', closeLightbox);
  if (lightboxPreviousButton) lightboxPreviousButton.addEventListener('click', previousPhoto);
  if (lightboxNextButton) lightboxNextButton.addEventListener('click', nextPhoto);

  /* Keyboard navigation */
  document.addEventListener('keydown', function (event) {
    if (!lightbox || lightbox.style.display === 'none') return;
    if (event.key === 'Escape') closeLightbox();
    else if (event.key === 'ArrowRight') nextPhoto();
    else if (event.key === 'ArrowLeft') previousPhoto();
  });

  /* ========== Video view tracking — fire when video link is clicked ========== */
  document.addEventListener('click', function (event) {
    var videoThumb = event.target.closest('.travel-hub-detail-youtube-thumb');
    if (!videoThumb) return;
    var card = videoThumb.closest('.travel-hub-detail-youtube-card');
    if (!card) return;
    var videoLinkId = card.getAttribute('data-youtube-link-id');
    var destIdElement = card.getAttribute('data-dest-id') ? card : document.querySelector('[data-dest-id]');
    var destId = destIdElement ? destIdElement.getAttribute('data-dest-id') : null;
    if (videoLinkId && destId) {
      fetch('/bangladesh-tourist-destinations/api/destination/' + destId + '/video/' + videoLinkId + '/view/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfToken() },
      }).catch(function() {});
    }
  });

  /* ========== Share buttons ========== */
  var shareButtons = document.querySelectorAll('.travel-hub-detail-share-btn');
  for (var s = 0; s < shareButtons.length; s++) {
    (function (button) {
      button.addEventListener('click', function () {
        var title = button.getAttribute('data-title') || '';
        var url = window.location.href;
        if (navigator.share) {
          navigator.share({ title: title, url: url });
        } else {
          navigator.clipboard.writeText(url).then(function () {
            showInlineMessage(button.parentNode, 'লিংক কপি হয়েছে!', false);
          });
        }
      });
    })(shareButtons[s]);
  }

  /* ========== BanglaInput on all caption/title/description fields ========== */

  function attachBanglaInputToElement(element) {
    if (typeof BanglaInput === 'undefined') return false;
    if (element.getAttribute('data-bangla-attached')) return true;
    BanglaInput.attach(element);
    element.setAttribute('data-bangla-attached', '1');
    return true;
  }

  function attachBanglaInputToAllCaptionFields() {
    if (typeof BanglaInput === 'undefined') {
      /* BanglaInput not loaded yet — retry after all scripts load */
      setTimeout(attachBanglaInputToAllCaptionFields, 300);
      return;
    }
    var captionFields = document.querySelectorAll(
      '#travel-hub-detail-photo-caption, '
      + '#travel-hub-detail-youtube-title, '
      + '#travel-hub-detail-youtube-description, '
      + '#travel-hub-detail-link-title, '
      + '#travel-hub-detail-link-description-input, '
      + '#travel-hub-detail-review-title, '
      + '#travel-hub-detail-review-body'
    );
    for (var i = 0; i < captionFields.length; i++) {
      attachBanglaInputToElement(captionFields[i]);
    }
  }

  /* Attach after all scripts load (bangla-input.js loads after extra_js block) */
  attachBanglaInputToAllCaptionFields();

  /* ========== Helpers ========== */

  function getCsrfToken() {
    var match = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return match ? match.pop() : '';
  }

  function showInlineMessage(parent, text, isError) {
    var old = parent.querySelector('.travel-hub-detail-inline-msg');
    if (old) old.remove();
    var element = document.createElement('div');
    element.className = 'travel-hub-detail-inline-msg ' + (isError ? 'travel-hub-detail-inline-msg-error' : 'travel-hub-detail-inline-msg-success');
    element.textContent = text;
    parent.appendChild(element);
    setTimeout(function () { if (element.parentNode) element.remove(); }, 5000);
  }

  function reindexPhotoThumbs() {
    var thumbs = getPhotoThumbs();
    for (var i = 0; i < thumbs.length; i++) {
      thumbs[i].setAttribute('data-photo-index', i);
    }
  }

  /* ========== Photo Upload ========== */

  var photoUploadButton = document.getElementById('travel-hub-detail-photo-upload-button');
  if (photoUploadButton) {
    photoUploadButton.addEventListener('click', function () {
      var fileInput = document.getElementById('travel-hub-detail-photo-file');
      var captionInput = document.getElementById('travel-hub-detail-photo-caption');
      var destinationId = photoUploadButton.getAttribute('data-dest-id');

      if (!fileInput.files.length) {
        showInlineMessage(photoUploadButton.parentNode.parentNode, 'ছবি নির্বাচন করুন', true);
        return;
      }

      photoUploadButton.disabled = true;
      photoUploadButton.textContent = 'আপলোড হচ্ছে...';

      var formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('caption_bn', (captionInput.value || '').trim());

      fetch('/bangladesh-tourist-destinations/api/destination/' + destinationId + '/photo/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfToken() },
        body: formData,
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            var grid = document.getElementById('travel-hub-detail-photo-grid');
            if (!grid) {
              grid = document.createElement('div');
              grid.className = 'travel-hub-detail-photo-grid';
              grid.id = 'travel-hub-detail-photo-grid';
              var emptyMessage = document.querySelector('#travel-hub-detail-photos-section .travel-hub-detail-empty');
              if (emptyMessage) emptyMessage.remove();
              document.getElementById('travel-hub-detail-photos-section').querySelector('h3').after(grid);
            }
            var thumbElement = document.createElement('div');
            thumbElement.className = 'travel-hub-detail-photo-thumb';
            thumbElement.setAttribute('data-photo-url', data.photo_url);
            thumbElement.setAttribute('data-photo-caption', data.caption_bn || '');
            thumbElement.setAttribute('data-photo-id', data.photo_id);
            thumbElement.style.backgroundImage = "url('" + data.photo_url + "')";
            thumbElement.style.cursor = 'pointer';
            if (data.caption_bn) {
              var captionElement = document.createElement('span');
              captionElement.className = 'travel-hub-detail-photo-caption';
              captionElement.textContent = data.caption_bn;
              thumbElement.appendChild(captionElement);
            }
            grid.appendChild(thumbElement);
            reindexPhotoThumbs();
            fileInput.value = '';
            captionInput.value = '';
            showInlineMessage(photoUploadButton.parentNode.parentNode, 'ছবি আপলোড হয়েছে', false);
          } else {
            showInlineMessage(photoUploadButton.parentNode.parentNode, data.error || 'আপলোড ব্যর্থ', true);
          }
          photoUploadButton.disabled = false;
          photoUploadButton.textContent = '+ আপলোড 📷';
        })
        .catch(function () {
          showInlineMessage(photoUploadButton.parentNode.parentNode, 'নেটওয়ার্ক ত্রুটি', true);
          photoUploadButton.disabled = false;
          photoUploadButton.textContent = '+ আপলোড 📷';
        });
    });
  }

  /* ========== YouTube Link Add ========== */

  var youtubeAddButton = document.getElementById('travel-hub-detail-youtube-add-button');
  if (youtubeAddButton) {
    youtubeAddButton.addEventListener('click', function () {
      var urlInput = document.getElementById('travel-hub-detail-youtube-url');
      var titleInput = document.getElementById('travel-hub-detail-youtube-title');
      var descriptionInput = document.getElementById('travel-hub-detail-youtube-description');
      var destinationId = youtubeAddButton.getAttribute('data-dest-id');

      var url = (urlInput.value || '').trim();
      if (!url) {
        showInlineMessage(youtubeAddButton.parentNode.parentNode, 'YouTube লিংক দিন', true);
        return;
      }

      youtubeAddButton.disabled = true;
      youtubeAddButton.textContent = 'যোগ হচ্ছে...';

      fetch('/bangladesh-tourist-destinations/api/destination/' + destinationId + '/youtube/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({
          youtube_url: url,
          video_title_bn: (titleInput.value || '').trim(),
          description_bn: (descriptionInput.value || '').trim(),
        }),
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            var list = document.getElementById('travel-hub-detail-youtube-list');
            var emptyMessage = list.querySelector('.travel-hub-detail-empty');
            if (emptyMessage) emptyMessage.remove();

            var videoUrl = data.video_url || url;
            var card = document.createElement('div');
            card.className = 'travel-hub-detail-youtube-card';
            var html = '';
            if (data.thumbnail_url) {
              html += '<a href="' + videoUrl + '" target="_blank" rel="noopener" class="travel-hub-detail-youtube-thumb" style="background-image:url(\'' + data.thumbnail_url + '\');">';
              html += '<span class="travel-hub-detail-youtube-play">▶</span>';
              html += '</a>';
            } else {
              /* No thumbnail available — show platform icon placeholder */
              var platformIcon = data.platform === 'tiktok' ? '🎵' : data.platform === 'instagram' ? '📷' : data.platform === 'facebook' ? '📘' : '🎬';
              html += '<a href="' + videoUrl + '" target="_blank" rel="noopener" class="travel-hub-detail-youtube-thumb travel-hub-detail-youtube-thumb-placeholder">';
              html += '<span class="travel-hub-detail-youtube-play">' + platformIcon + '</span>';
              html += '</a>';
            }
            html += '<div class="travel-hub-detail-youtube-info">';
            if (data.video_title_bn) html += '<a href="' + videoUrl + '" target="_blank" rel="noopener" class="travel-hub-detail-youtube-title">' + data.video_title_bn + '</a>';
            html += '<div class="travel-hub-detail-contribution-meta">';
            html += '<span class="travel-hub-detail-contribution-uploader">আমি</span>';
            html += '<span class="travel-hub-detail-contribution-actions" data-type="youtube" data-id="' + data.link_id + '" data-dest-id="' + destinationId + '">';
            html += '<button type="button" class="travel-hub-detail-contribution-edit-button" title="সম্পাদনা">✎</button>';
            html += '<button type="button" class="travel-hub-detail-contribution-delete-button" title="মুছুন">✕</button>';
            html += '</span>';
            html += '</div>';
            html += '</div>';
            card.setAttribute('data-youtube-link-id', data.link_id);
            card.setAttribute('data-dest-id', destinationId);
            card.innerHTML = html;
            list.appendChild(card);

            urlInput.value = '';
            titleInput.value = '';
            descriptionInput.value = '';
            showInlineMessage(youtubeAddButton.parentNode.parentNode, 'ভিডিও যোগ হয়েছে', false);
          } else {
            showInlineMessage(youtubeAddButton.parentNode.parentNode, data.error || 'যোগ করা ব্যর্থ', true);
          }
          youtubeAddButton.disabled = false;
          youtubeAddButton.textContent = '+ যোগ করুন 🎬';
        })
        .catch(function () {
          showInlineMessage(youtubeAddButton.parentNode.parentNode, 'নেটওয়ার্ক ত্রুটি', true);
          youtubeAddButton.disabled = false;
          youtubeAddButton.textContent = '+ যোগ করুন 🎬';
        });
    });
  }

  /* ========== Reference Link Add ========== */

  var referenceLinkAddButton = document.getElementById('travel-hub-detail-link-add-button');
  if (referenceLinkAddButton) {
    referenceLinkAddButton.addEventListener('click', function () {
      var urlInput = document.getElementById('travel-hub-detail-link-url');
      var titleInput = document.getElementById('travel-hub-detail-link-title');
      var descriptionInput = document.getElementById('travel-hub-detail-link-description-input');
      var destinationId = referenceLinkAddButton.getAttribute('data-dest-id');

      var url = (urlInput.value || '').trim();
      if (!url) {
        showInlineMessage(referenceLinkAddButton.parentNode.parentNode, 'লিংক দিন', true);
        return;
      }

      referenceLinkAddButton.disabled = true;
      referenceLinkAddButton.textContent = 'যোগ হচ্ছে...';

      fetch('/bangladesh-tourist-destinations/api/destination/' + destinationId + '/link/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({
          reference_url: url,
          reference_title_bn: (titleInput.value || '').trim(),
          description_bn: (descriptionInput.value || '').trim(),
        }),
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            var list = document.getElementById('travel-hub-detail-links-list');
            var emptyMessage = list.querySelector('.travel-hub-detail-empty');
            if (emptyMessage) emptyMessage.remove();

            var card = document.createElement('div');
            card.className = 'travel-hub-detail-link-card';
            var linkElement = document.createElement('a');
            linkElement.className = 'travel-hub-detail-link-url';
            linkElement.href = url;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener';
            linkElement.textContent = data.reference_title_bn || url;
            card.appendChild(linkElement);

            if (descriptionInput.value.trim()) {
              var descriptionElement = document.createElement('span');
              descriptionElement.className = 'travel-hub-detail-link-desc';
              descriptionElement.textContent = descriptionInput.value.trim();
              card.appendChild(descriptionElement);
            }

            /* Add edit/delete buttons */
            var metaHtml = '<div class="travel-hub-detail-contribution-meta">'
              + '<span class="travel-hub-detail-contribution-uploader">আমি</span>'
              + '<span class="travel-hub-detail-contribution-actions" data-type="link" data-id="' + data.link_id + '" data-dest-id="' + destinationId + '">'
              + '<button type="button" class="travel-hub-detail-contribution-edit-button" title="সম্পাদনা">✎</button>'
              + '<button type="button" class="travel-hub-detail-contribution-delete-button" title="মুছুন">✕</button>'
              + '</span></div>';
            card.insertAdjacentHTML('beforeend', metaHtml);
            card.setAttribute('data-reference-link-id', data.link_id);
            card.setAttribute('data-dest-id', destinationId);
            list.appendChild(card);

            urlInput.value = '';
            titleInput.value = '';
            descriptionInput.value = '';
            showInlineMessage(referenceLinkAddButton.parentNode.parentNode, 'তথ্যসূত্র যোগ হয়েছে', false);
          } else {
            showInlineMessage(referenceLinkAddButton.parentNode.parentNode, data.error || 'যোগ করা ব্যর্থ', true);
          }
          referenceLinkAddButton.disabled = false;
          referenceLinkAddButton.textContent = '+ যোগ করুন 🔗';
        })
        .catch(function () {
          showInlineMessage(referenceLinkAddButton.parentNode.parentNode, 'নেটওয়ার্ক ত্রুটি', true);
          referenceLinkAddButton.disabled = false;
          referenceLinkAddButton.textContent = '+ যোগ করুন 🔗';
        });
    });
  }

  /* ========== Review Submit ========== */

  var reviewSubmitButton = document.getElementById('travel-hub-detail-review-submit-button');
  if (reviewSubmitButton) {
    reviewSubmitButton.addEventListener('click', function () {
      var ratingSelect = document.getElementById('travel-hub-detail-review-rating');
      var titleInput = document.getElementById('travel-hub-detail-review-title');
      var bodyInput = document.getElementById('travel-hub-detail-review-body');
      var visitedInput = document.getElementById('travel-hub-detail-review-visited-at');
      var destinationId = reviewSubmitButton.getAttribute('data-dest-id');
      var formContainer = document.getElementById('travel-hub-detail-review-form');

      var rating = ratingSelect.value;
      if (!rating) {
        showInlineMessage(formContainer, 'রেটিং দিন', true);
        return;
      }

      reviewSubmitButton.disabled = true;
      reviewSubmitButton.textContent = 'জমা হচ্ছে...';

      fetch('/bangladesh-tourist-destinations/api/destination/' + destinationId + '/review/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({
          rating_overall: parseInt(rating),
          review_title_bn: (titleInput.value || '').trim(),
          review_body_bn: (bodyInput.value || '').trim(),
          visited_at: visitedInput.value || null,
        }),
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            /* Add review card to the list */
            var section = document.querySelector('.travel-hub-detail-section:last-of-type');
            var emptyMessage = section.querySelector('.travel-hub-detail-empty');
            if (emptyMessage) emptyMessage.remove();

            var card = document.createElement('div');
            card.className = 'travel-hub-detail-card';
            var html = '<div class="travel-hub-detail-review-header">';
            html += '<span class="travel-hub-detail-stat-rating">★ ' + data.rating_overall + '/5</span>';
            if (data.review_title_bn) html += '<span class="travel-hub-detail-card-title">' + data.review_title_bn + '</span>';
            html += '</div>';
            if (data.review_body_bn) html += '<p class="travel-hub-detail-card-text">' + data.review_body_bn + '</p>';
            html += '<div class="travel-hub-detail-card-meta">👍 0 সহায়ক</div>';
            card.innerHTML = html;

            /* Insert before the form */
            formContainer.before(card);

            ratingSelect.value = '';
            titleInput.value = '';
            bodyInput.value = '';
            visitedInput.value = '';
            showInlineMessage(formContainer, 'রিভিউ যোগ হয়েছে, ধন্যবাদ!', false);
          } else {
            showInlineMessage(formContainer, data.error || 'রিভিউ জমা ব্যর্থ', true);
          }
          reviewSubmitButton.disabled = false;
          reviewSubmitButton.textContent = '+ রিভিউ দিন ⭐';
        })
        .catch(function () {
          showInlineMessage(formContainer, 'নেটওয়ার্ক ত্রুটি', true);
          reviewSubmitButton.disabled = false;
          reviewSubmitButton.textContent = '+ রিভিউ দিন ⭐';
        });
    });
  }

  /* ========== Contribution Edit / Delete (delegated) ========== */

  document.addEventListener('click', function (event) {
    var editButton = event.target.closest('.travel-hub-detail-contribution-edit-button');
    var deleteButton = event.target.closest('.travel-hub-detail-contribution-delete-button');

    if (editButton) {
      event.stopPropagation();
      handleContributionEdit(editButton);
    } else if (deleteButton) {
      event.stopPropagation();
      handleContributionDelete(deleteButton);
    }
  });

  function handleContributionEdit(button) {
    var actionsContainer = button.closest('.travel-hub-detail-contribution-actions');
    if (!actionsContainer) return;

    var contributionType = actionsContainer.getAttribute('data-type');
    var contributionId = actionsContainer.getAttribute('data-id');
    var destinationId = actionsContainer.getAttribute('data-dest-id');
    var parentCard = actionsContainer.closest('.travel-hub-detail-photo-thumb, .travel-hub-detail-youtube-card, .travel-hub-detail-link-card');
    if (!parentCard) return;

    /* For photos: place edit form AFTER the thumb (not inside) to avoid lightbox conflicts */
    var editFormContainer = (contributionType === 'photo') ? parentCard.parentNode : parentCard;

    /* Check if edit form already open */
    if (editFormContainer.querySelector('.travel-hub-detail-contribution-edit-form')) return;

    var editForm = document.createElement('div');
    editForm.className = 'travel-hub-detail-contribution-edit-form';
    editForm.setAttribute('data-for-card', contributionId);

    if (contributionType === 'photo') {
      var currentCaption = parentCard.getAttribute('data-photo-caption') || '';
      editForm.innerHTML = '<input type="text" class="travel-hub-detail-text-input" id="travel-hub-detail-edit-photo-caption-' + contributionId + '" name="travel-hub-detail-edit-photo-caption-' + contributionId + '" value="' + escapeAttribute(currentCaption) + '" placeholder="ক্যাপশন (Caption)" maxlength="500">'
        + '<button type="button" class="travel-hub-detail-contribution-save-button" data-type="photo" data-id="' + contributionId + '" data-dest-id="' + destinationId + '">সংরক্ষণ</button>'
        + '<button type="button" class="travel-hub-detail-contribution-cancel-button">বাতিল</button>';
    } else if (contributionType === 'youtube') {
      var currentTitle = '';
      var currentDescription = '';
      var titleElement = parentCard.querySelector('.travel-hub-detail-youtube-title');
      var descriptionElement = parentCard.querySelector('.travel-hub-detail-youtube-desc');
      if (titleElement) currentTitle = titleElement.textContent;
      if (descriptionElement) currentDescription = descriptionElement.textContent;
      editForm.innerHTML = '<input type="text" class="travel-hub-detail-text-input" id="travel-hub-detail-edit-youtube-title-' + contributionId + '" name="travel-hub-detail-edit-youtube-title-' + contributionId + '" value="' + escapeAttribute(currentTitle) + '" placeholder="শিরোনাম" maxlength="300">'
        + '<input type="text" class="travel-hub-detail-text-input" id="travel-hub-detail-edit-youtube-description-' + contributionId + '" name="travel-hub-detail-edit-youtube-description-' + contributionId + '" value="' + escapeAttribute(currentDescription) + '" placeholder="বর্ণনা" maxlength="1000">'
        + '<button type="button" class="travel-hub-detail-contribution-save-button" data-type="youtube" data-id="' + contributionId + '" data-dest-id="' + destinationId + '">সংরক্ষণ</button>'
        + '<button type="button" class="travel-hub-detail-contribution-cancel-button">বাতিল</button>';
    } else if (contributionType === 'link') {
      var currentLinkTitle = '';
      var currentLinkDescription = '';
      var linkTitleElement = parentCard.querySelector('.travel-hub-detail-link-url');
      var linkDescriptionElement = parentCard.querySelector('.travel-hub-detail-link-desc');
      if (linkTitleElement) currentLinkTitle = linkTitleElement.textContent;
      if (linkDescriptionElement) currentLinkDescription = linkDescriptionElement.textContent;
      editForm.innerHTML = '<input type="text" class="travel-hub-detail-text-input" id="travel-hub-detail-edit-link-title-' + contributionId + '" name="travel-hub-detail-edit-link-title-' + contributionId + '" value="' + escapeAttribute(currentLinkTitle) + '" placeholder="শিরোনাম" maxlength="300">'
        + '<input type="text" class="travel-hub-detail-text-input" id="travel-hub-detail-edit-link-description-' + contributionId + '" name="travel-hub-detail-edit-link-description-' + contributionId + '" value="' + escapeAttribute(currentLinkDescription) + '" placeholder="বর্ণনা" maxlength="1000">'
        + '<button type="button" class="travel-hub-detail-contribution-save-button" data-type="link" data-id="' + contributionId + '" data-dest-id="' + destinationId + '">সংরক্ষণ</button>'
        + '<button type="button" class="travel-hub-detail-contribution-cancel-button">বাতিল</button>';
    }

    if (contributionType === 'photo') {
      /* Place after the photo thumb, not inside it */
      parentCard.after(editForm);
    } else {
      parentCard.appendChild(editForm);
    }

    /* Attach BanglaInput to the new edit form inputs */
    var editInputs = editForm.querySelectorAll('input[type="text"]');
    for (var i = 0; i < editInputs.length; i++) {
      attachBanglaInputToElement(editInputs[i]);
    }
  }

  function handleContributionDelete(button) {
    var actionsContainer = button.closest('.travel-hub-detail-contribution-actions');
    if (!actionsContainer) return;

    var contributionType = actionsContainer.getAttribute('data-type');
    var contributionId = actionsContainer.getAttribute('data-id');
    var destinationId = actionsContainer.getAttribute('data-dest-id');
    var parentCard = actionsContainer.closest('.travel-hub-detail-photo-thumb, .travel-hub-detail-youtube-card, .travel-hub-detail-link-card');
    if (!parentCard) return;

    /* For photos: place confirm bar outside thumb to avoid lightbox conflict */
    var confirmContainer = (contributionType === 'photo') ? parentCard.parentNode : parentCard;

    /* Show inline confirmation instead of popup */
    if (confirmContainer.querySelector('.travel-hub-detail-contribution-delete-confirm')) return;

    var confirmBar = document.createElement('div');
    confirmBar.className = 'travel-hub-detail-contribution-delete-confirm';
    confirmBar.setAttribute('data-for-card', contributionId);
    confirmBar.innerHTML = '<span>মুছে ফেলতে চান?</span>'
      + '<button type="button" class="travel-hub-detail-contribution-confirm-yes-button" data-type="' + contributionType + '" data-id="' + contributionId + '" data-dest-id="' + destinationId + '">হ্যাঁ</button>'
      + '<button type="button" class="travel-hub-detail-contribution-confirm-no-button">না</button>';

    if (contributionType === 'photo') {
      parentCard.after(confirmBar);
    } else {
      parentCard.appendChild(confirmBar);
    }
  }

  /* Save edit */
  document.addEventListener('click', function (event) {
    var saveButton = event.target.closest('.travel-hub-detail-contribution-save-button');
    if (!saveButton) return;
    event.stopPropagation();

    var contributionType = saveButton.getAttribute('data-type');
    var contributionId = saveButton.getAttribute('data-id');
    var destinationId = saveButton.getAttribute('data-dest-id');
    var editForm = saveButton.closest('.travel-hub-detail-contribution-edit-form');
    /* For photos, the edit form is a sibling of the thumb — find the thumb by data-photo-id */
    var parentCard;
    if (contributionType === 'photo') {
      parentCard = document.querySelector('.travel-hub-detail-photo-thumb[data-photo-id="' + contributionId + '"]');
    } else {
      parentCard = editForm.parentNode;
    }
    var apiUrl = '';
    var payload = {};

    if (contributionType === 'photo') {
      apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/photo/' + contributionId + '/';
      var captionInput = editForm.querySelector('input');
      payload = { caption_bn: (captionInput.value || '').trim() };
    } else if (contributionType === 'youtube') {
      apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/youtube/' + contributionId + '/';
      var youtubeEditInputs = editForm.querySelectorAll('input');
      payload = {
        video_title_bn: (youtubeEditInputs[0].value || '').trim(),
        description_bn: (youtubeEditInputs[1].value || '').trim(),
      };
    } else if (contributionType === 'link') {
      apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/link/' + contributionId + '/';
      var referenceLinkEditInputs = editForm.querySelectorAll('input');
      payload = {
        reference_title_bn: (referenceLinkEditInputs[0].value || '').trim(),
        description_bn: (referenceLinkEditInputs[1].value || '').trim(),
      };
    }

    saveButton.disabled = true;
    saveButton.textContent = 'সংরক্ষণ হচ্ছে...';

    fetch(apiUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(payload),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          editForm.remove();
          /* Update displayed content */
          if (contributionType === 'photo') {
            parentCard.setAttribute('data-photo-caption', data.caption_bn || '');
            var captionSpan = parentCard.querySelector('.travel-hub-detail-photo-caption');
            if (data.caption_bn) {
              if (!captionSpan) {
                captionSpan = document.createElement('span');
                captionSpan.className = 'travel-hub-detail-photo-caption';
                /* Insert before the meta div */
                var metaDiv = parentCard.querySelector('.travel-hub-detail-contribution-meta');
                if (metaDiv) {
                  parentCard.insertBefore(captionSpan, metaDiv);
                } else {
                  parentCard.appendChild(captionSpan);
                }
              }
              captionSpan.textContent = data.caption_bn;
            } else if (captionSpan) {
              captionSpan.remove();
            }
          } else if (contributionType === 'youtube') {
            var youtubeTitle = parentCard.querySelector('.travel-hub-detail-youtube-title');
            var youtubeDescription = parentCard.querySelector('.travel-hub-detail-youtube-desc');
            if (youtubeTitle) youtubeTitle.textContent = data.video_title_bn || '';
            if (data.description_bn) {
              if (!youtubeDescription) {
                youtubeDescription = document.createElement('span');
                youtubeDescription.className = 'travel-hub-detail-youtube-desc';
                var youtubeInfo = parentCard.querySelector('.travel-hub-detail-youtube-info');
                var youtubeMeta = youtubeInfo.querySelector('.travel-hub-detail-contribution-meta');
                if (youtubeMeta) {
                  youtubeInfo.insertBefore(youtubeDescription, youtubeMeta);
                } else {
                  youtubeInfo.appendChild(youtubeDescription);
                }
              }
              youtubeDescription.textContent = data.description_bn;
            } else if (youtubeDescription) {
              youtubeDescription.remove();
            }
          } else if (contributionType === 'link') {
            var linkUrl = parentCard.querySelector('.travel-hub-detail-link-url');
            var linkDescription = parentCard.querySelector('.travel-hub-detail-link-desc');
            if (linkUrl && data.reference_title_bn) linkUrl.textContent = data.reference_title_bn;
            if (data.description_bn) {
              if (!linkDescription) {
                linkDescription = document.createElement('span');
                linkDescription.className = 'travel-hub-detail-link-desc';
                var linkMeta = parentCard.querySelector('.travel-hub-detail-contribution-meta');
                if (linkMeta) {
                  parentCard.insertBefore(linkDescription, linkMeta);
                } else {
                  parentCard.appendChild(linkDescription);
                }
              }
              linkDescription.textContent = data.description_bn;
            } else if (linkDescription) {
              linkDescription.remove();
            }
          }
          showInlineMessage(parentCard.closest('.travel-hub-detail-section'), 'সংরক্ষণ হয়েছে', false);
        } else {
          showInlineMessage(editForm, data.error || 'সংরক্ষণ ব্যর্থ', true);
          saveButton.disabled = false;
          saveButton.textContent = 'সংরক্ষণ';
        }
      })
      .catch(function () {
        showInlineMessage(editForm, 'নেটওয়ার্ক ত্রুটি', true);
        saveButton.disabled = false;
        saveButton.textContent = 'সংরক্ষণ';
      });
  });

  /* Cancel edit */
  document.addEventListener('click', function (event) {
    var cancelButton = event.target.closest('.travel-hub-detail-contribution-cancel-button');
    if (!cancelButton) return;
    event.stopPropagation();
    var editForm = cancelButton.closest('.travel-hub-detail-contribution-edit-form');
    if (editForm) editForm.remove();
  });

  /* Confirm delete — Yes */
  document.addEventListener('click', function (event) {
    var confirmYesButton = event.target.closest('.travel-hub-detail-contribution-confirm-yes-button');
    if (!confirmYesButton) return;
    event.stopPropagation();

    var contributionType = confirmYesButton.getAttribute('data-type');
    var contributionId = confirmYesButton.getAttribute('data-id');
    var destinationId = confirmYesButton.getAttribute('data-dest-id');
    var confirmBar = confirmYesButton.closest('.travel-hub-detail-contribution-delete-confirm');
    /* For photos, the confirm bar is a sibling of the thumb — find the thumb by data-photo-id */
    var parentCard;
    if (contributionType === 'photo') {
      parentCard = document.querySelector('.travel-hub-detail-photo-thumb[data-photo-id="' + contributionId + '"]');
    } else {
      parentCard = confirmBar.parentNode;
    }
    var section = (parentCard || confirmBar).closest('.travel-hub-detail-section');

    var apiUrl = '';
    if (contributionType === 'photo') {
      apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/photo/' + contributionId + '/delete/';
    } else if (contributionType === 'youtube') {
      apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/youtube/' + contributionId + '/delete/';
    } else if (contributionType === 'link') {
      apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/link/' + contributionId + '/delete/';
    }

    confirmYesButton.disabled = true;
    confirmYesButton.textContent = 'মুছা হচ্ছে...';

    fetch(apiUrl, {
      method: 'DELETE',
      headers: { 'X-CSRFToken': getCsrfToken() },
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          confirmBar.remove();
          if (parentCard) parentCard.remove();
          if (contributionType === 'photo') reindexPhotoThumbs();
          showInlineMessage(section, 'মুছে ফেলা হয়েছে', false);
        } else {
          showInlineMessage(confirmBar, data.error || 'মুছা ব্যর্থ', true);
          confirmYesButton.disabled = false;
          confirmYesButton.textContent = 'হ্যাঁ';
        }
      })
      .catch(function () {
        showInlineMessage(confirmBar, 'নেটওয়ার্ক ত্রুটি', true);
        confirmYesButton.disabled = false;
        confirmYesButton.textContent = 'হ্যাঁ';
      });
  });

  /* Confirm delete — No */
  document.addEventListener('click', function (event) {
    var confirmNoButton = event.target.closest('.travel-hub-detail-contribution-confirm-no-button');
    if (!confirmNoButton) return;
    event.stopPropagation();
    var confirmBar = confirmNoButton.closest('.travel-hub-detail-contribution-delete-confirm');
    if (confirmBar) confirmBar.remove();
  });

  function escapeAttribute(text) {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})();

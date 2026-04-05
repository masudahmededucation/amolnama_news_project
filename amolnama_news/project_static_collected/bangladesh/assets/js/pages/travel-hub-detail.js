/**
 * travel-hub-detail.js — Destination detail page interactions.
 * Photo upload/edit/delete, YouTube link add/edit/delete, reference link add/edit/delete.
 * Uploader attribution, inline edit forms, inline messages (no popups).
 */
(function () {
  'use strict';

  /* ========== Shared Actions Bar (like + share) ========== */
  if (typeof window.actionsBar !== 'undefined') {
    window.actionsBar.init({
      buildLikeApiUrl: function (entityId) {
        return '/bangladesh-tourist-destinations/api/destination/' + entityId + '/like/';
      },
    });
  }

  /* ========== Photo Lightbox (uses shared window.photoLightbox) ========== */
  if (typeof window.photoLightbox !== 'undefined') {
    window.photoLightbox.init({
      thumbSelector: '.travel-hub-detail-photo-thumb[data-photo-url]',
      gridSelector: '#travel-hub-detail-photo-grid',
      excludeSelectors: [
        '.travel-hub-detail-contribution-actions',
        '.travel-hub-detail-contribution-edit-button',
        '.travel-hub-detail-contribution-delete-button',
        '.travel-hub-detail-contribution-edit-form',
        '.travel-hub-detail-contribution-delete-confirm',
        '.travel-hub-detail-contribution-meta',
        '.travel-hub-detail-set-cover-button',
      ],
      onView: function (index) {
        const photoGrid = document.getElementById('travel-hub-detail-photo-grid');
        if (!photoGrid) return;
        const thumbs = photoGrid.querySelectorAll('.travel-hub-detail-photo-thumb[data-photo-url]');
        const thumb = thumbs[index];
        if (!thumb) return;
        const card = thumb.closest('.travel-hub-detail-media-card');
        const photoId = card ? card.getAttribute('data-photo-id') : null;
        const destId = card ? card.getAttribute('data-dest-id') : null;
        if (photoId && destId) {
          fetch('/bangladesh-tourist-destinations/api/destination/' + destId + '/photo/' + photoId + '/view/', {
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfTokenValue() },
          })
            .then(function () {
              const viewsElement = card.querySelector('.travel-hub-detail-media-card-views');
              if (viewsElement) {
                const currentCount = parseInt(viewsElement.textContent.replace(/[^0-9]/g, ''), 10) || 0;
                viewsElement.innerHTML = '👁️ <span class="travel-hub-detail-media-view-label">ভিউ</span> ' + (currentCount + 1);
              }
            })
            .catch(function () {});
        }
      },
    });
  }

  /* ========== Video view tracking — fire when video link is clicked ========== */
  document.addEventListener('click', function (event) {
    const videoThumb = event.target.closest('.travel-hub-detail-youtube-thumb');
    if (!videoThumb) return;
    let card = videoThumb.closest('.travel-hub-detail-youtube-card');
    if (!card) return;
    const videoLinkId = card.getAttribute('data-youtube-link-id');
    const destIdElement = card.getAttribute('data-dest-id') ? card : document.querySelector('[data-dest-id]');
    const destId = destIdElement ? destIdElement.getAttribute('data-dest-id') : null;
    if (videoLinkId && destId) {
      fetch('/bangladesh-tourist-destinations/api/destination/' + destId + '/video/' + videoLinkId + '/view/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
        .then(function () {
          const viewsElement = card.querySelector('.travel-hub-detail-media-card-views');
          if (viewsElement) {
            const currentCount = parseInt(viewsElement.textContent.replace(/[^0-9]/g, ''), 10) || 0;
            viewsElement.innerHTML = '👁️ <span class="travel-hub-detail-media-view-label">ভিউ</span> ' + (currentCount + 1);
          }
        })
        .catch(function() {});
    }
  });

  /* ========== Like toggle for photos and videos ========== */
  document.addEventListener('click', function (event) {
    const likeButton = event.target.closest('.travel-hub-detail-media-like-button');
    if (!likeButton) return;
    event.stopPropagation();

    const mediaType = likeButton.getAttribute('data-type');
    const mediaId = likeButton.getAttribute('data-id');
    let destinationId = likeButton.getAttribute('data-dest-id');
    if (!mediaType || !mediaId || !destinationId) return;

    let apiUrl = '';
    if (mediaType === 'photo') {
      apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/photo/' + mediaId + '/like/';
    } else if (mediaType === 'video') {
      apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/video/' + mediaId + '/like/';
    }
    if (!apiUrl) return;
    if (likeButton.disabled) return;

    likeButton.disabled = true;
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
    })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success) {
          const countElement = likeButton.querySelector('.travel-hub-detail-media-like-count');
          if (countElement) countElement.textContent = data.like_count;
          if (data.liked) {
            likeButton.classList.add('travel-hub-detail-media-like-button-active');
          } else {
            likeButton.classList.remove('travel-hub-detail-media-like-button-active');
          }
        }
        likeButton.disabled = false;
      })
      .catch(function() { likeButton.disabled = false; });
  });

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
    const captionFields = document.querySelectorAll(
      '#travel-hub-detail-photo-caption, '
      + '#travel-hub-detail-youtube-title, '
      + '#travel-hub-detail-youtube-description, '
      + '#travel-hub-detail-link-title, '
      + '#travel-hub-detail-link-description-input, '
      + '#travel-hub-detail-review-title, '
      + '#travel-hub-detail-review-body'
    );
    for (let i = 0; i < captionFields.length; i++) {
      attachBanglaInputToElement(captionFields[i]);
    }
  }

  /* Attach after all scripts load (bangla-input.js loads after extra_js block) */
  attachBanglaInputToAllCaptionFields();

  /* ========== Helpers ========== */


  function showInlineMessage(parent, text, isError) {
    const old = parent.querySelector('.travel-hub-detail-inline-message');
    if (old) old.remove();
    const element = document.createElement('div');
    element.className = 'travel-hub-detail-inline-message ' + (isError ? 'travel-hub-detail-inline-message-error' : 'travel-hub-detail-inline-message-success');
    element.textContent = text;
    parent.appendChild(element);
    setTimeout(function () { if (element.parentNode) element.remove(); }, 5000);
  }

  function reindexPhotoThumbs() {
    const thumbs = getPhotoThumbs();
    for (let i = 0; i < thumbs.length; i++) {
      thumbs[i].setAttribute('data-photo-index', i);
    }
  }

  /* ========== Photo Upload ========== */

  const photoUploadButton = document.getElementById('travel-hub-detail-photo-upload-button');
  if (photoUploadButton) {
    photoUploadButton.addEventListener('click', function () {
      const fileInput = document.getElementById('travel-hub-detail-photo-file');
      let captionInput = document.getElementById('travel-hub-detail-photo-caption');
      let destinationId = photoUploadButton.getAttribute('data-dest-id');

      if (!fileInput.files.length) {
        showInlineMessage(photoUploadButton.parentNode.parentNode, 'ছবি নির্বাচন করুন', true);
        return;
      }

      photoUploadButton.disabled = true;
      photoUploadButton.textContent = 'আপলোড হচ্ছে...';

      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('caption_bn', (captionInput.value || '').trim());

      fetch('/bangladesh-tourist-destinations/api/destination/' + destinationId + '/photo/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
        body: formData,
      })
        .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
        .then(function (data) {
          if (data.success) {
            let grid = document.getElementById('travel-hub-detail-photo-grid');
            if (!grid) {
              grid = document.createElement('div');
              grid.className = 'travel-hub-detail-media-grid';
              grid.id = 'travel-hub-detail-photo-grid';
              let emptyMessage = document.querySelector('#travel-hub-detail-photos-section .travel-hub-detail-empty');
              if (emptyMessage) emptyMessage.remove();
              document.getElementById('travel-hub-detail-photos-section').querySelector('h3').after(grid);
            }
            /* Build proper media card wrapper + photo thumb */
            let cardElement = document.createElement('div');
            cardElement.className = 'travel-hub-detail-media-card';
            cardElement.setAttribute('data-photo-id', data.photo_id);
            cardElement.setAttribute('data-dest-id', destinationId);

            cardElement.setAttribute('data-photo-url', data.photo_url);
            cardElement.setAttribute('data-photo-thumbnail-url', data.photo_thumbnail_url || data.photo_url);

            const thumbElement = document.createElement('div');
            thumbElement.className = 'travel-hub-detail-media-card-image travel-hub-detail-photo-thumb';
            thumbElement.setAttribute('data-photo-url', data.photo_url);
            thumbElement.setAttribute('data-photo-caption', data.caption_bn || '');
            thumbElement.style.backgroundImage = "url('" + data.photo_url + "')";
            thumbElement.style.cursor = 'pointer';
            cardElement.appendChild(thumbElement);

            /* Add set-cover button if user has edit permissions */
            if (document.querySelector('.travel-hub-detail-set-cover-button')) {
              const setCoverHtml = '<button type="button" class="travel-hub-detail-set-cover-button"'
                + ' id="travel-hub-detail-set-cover-' + data.photo_id + '"'
                + ' name="travel_hub_set_cover_' + data.photo_id + '"'
                + ' data-photo-id="' + data.photo_id + '"'
                + ' data-dest-id="' + destinationId + '">'
                + '<span class="travel-hub-detail-set-cover-label">' + COVER_LABEL_SET + '</span></button>';
              cardElement.insertAdjacentHTML('beforeend', setCoverHtml);
            }

            if (data.caption_bn) {
              let captionDiv = document.createElement('div');
              captionDiv.className = 'travel-hub-detail-media-card-caption';
              captionDiv.textContent = data.caption_bn;
              cardElement.appendChild(captionDiv);
            }

            /* Footer: like + views + uploader + edit/delete */
            const footerHtml = '<div class="travel-hub-detail-media-card-footer">'
              + '<div class="travel-hub-detail-media-card-stats">'
              + '<button type="button" class="travel-hub-detail-media-like-button" id="travel-hub-detail-photo-like-' + data.photo_id + '" name="travel_hub_photo_like_' + data.photo_id + '" data-type="photo" data-id="' + data.photo_id + '" data-dest-id="' + destinationId + '" title="পছন্দ (Like)">👍 <span class="travel-hub-detail-media-like-label">পছন্দ</span> <span class="travel-hub-detail-media-like-count">0</span></button>'
              + '<span class="travel-hub-detail-media-card-views">👁️ <span class="travel-hub-detail-media-view-label">ভিউ</span> 0</span>'
              + '</div>'
              + '<div class="travel-hub-detail-media-card-meta">'
              + '<span class="travel-hub-detail-media-card-uploader">আমি</span>'
              + '<span class="travel-hub-detail-media-card-time">এইমাত্র</span>'
              + '</div>'
              + '<div class="travel-hub-detail-media-card-actions">'
              + '<span class="travel-hub-detail-contribution-actions" data-type="photo" data-id="' + data.photo_id + '" data-dest-id="' + destinationId + '">'
              + '<button type="button" class="travel-hub-detail-contribution-edit-button" id="travel-hub-detail-photo-edit-' + data.photo_id + '" name="travel_hub_photo_edit_' + data.photo_id + '" title="ক্যাপশন সম্পাদনা">✎</button>'
              + '<button type="button" class="travel-hub-detail-contribution-delete-button" id="travel-hub-detail-photo-delete-' + data.photo_id + '" name="travel_hub_photo_delete_' + data.photo_id + '" title="মুছুন">✕</button>'
              + '</span></div></div>';
            cardElement.insertAdjacentHTML('beforeend', footerHtml);
            grid.appendChild(cardElement);
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

  const youtubeAddButton = document.getElementById('travel-hub-detail-youtube-add-button');
  if (youtubeAddButton) {
    youtubeAddButton.addEventListener('click', function () {
      let urlInput = document.getElementById('travel-hub-detail-youtube-url');
      let titleInput = document.getElementById('travel-hub-detail-youtube-title');
      let descriptionInput = document.getElementById('travel-hub-detail-youtube-description');
      let destinationId = youtubeAddButton.getAttribute('data-dest-id');

      let url = (urlInput.value || '').trim();
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
          'X-CSRFToken': getCsrfTokenValue(),
        },
        body: JSON.stringify({
          youtube_url: url,
          video_title_bn: (titleInput.value || '').trim(),
          description_bn: (descriptionInput.value || '').trim(),
        }),
      })
        .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
        .then(function (data) {
          if (data.success) {
            let list = document.getElementById('travel-hub-detail-youtube-list');
            let emptyMessage = list.querySelector('.travel-hub-detail-empty');
            if (emptyMessage) emptyMessage.remove();

            const videoUrl = data.video_url || url;
            let card = document.createElement('div');
            card.className = 'travel-hub-detail-youtube-card';
            let html = '';
            if (data.thumbnail_url) {
              html += '<a href="' + videoUrl + '" target="_blank" rel="noopener" class="travel-hub-detail-youtube-thumb" style="background-image:url(\'' + data.thumbnail_url + '\');">';
              html += '<span class="travel-hub-detail-youtube-play">▶</span>';
              html += '</a>';
            } else {
              /* No thumbnail available — show platform icon placeholder */
              const platformIcon = data.platform === 'tiktok' ? '🎵' : data.platform === 'instagram' ? '📷' : data.platform === 'facebook' ? '📘' : '🎬';
              html += '<a href="' + videoUrl + '" target="_blank" rel="noopener" class="travel-hub-detail-youtube-thumb travel-hub-detail-youtube-thumb-placeholder">';
              html += '<span class="travel-hub-detail-youtube-play">' + platformIcon + '</span>';
              html += '</a>';
            }
            html += '<div class="travel-hub-detail-youtube-info">';
            if (data.video_title_bn) html += '<a href="' + videoUrl + '" target="_blank" rel="noopener" class="travel-hub-detail-youtube-title">' + data.video_title_bn + '</a>';
            html += '<div class="travel-hub-detail-contribution-meta">';
            html += '<span class="travel-hub-detail-contribution-uploader">আমি</span>';
            html += '<span class="travel-hub-detail-contribution-actions" data-type="youtube" data-id="' + data.link_id + '" data-dest-id="' + destinationId + '">';
            html += '<button type="button" class="travel-hub-detail-contribution-edit-button" id="travel-hub-detail-youtube-edit-' + data.link_id + '" name="travel_hub_youtube_edit_' + data.link_id + '" title="সম্পাদনা">✎</button>';
            html += '<button type="button" class="travel-hub-detail-contribution-delete-button" id="travel-hub-detail-youtube-delete-' + data.link_id + '" name="travel_hub_youtube_delete_' + data.link_id + '" title="মুছুন">✕</button>';
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

  const referenceLinkAddButton = document.getElementById('travel-hub-detail-link-add-button');
  if (referenceLinkAddButton) {
    referenceLinkAddButton.addEventListener('click', function () {
      const urlInput = document.getElementById('travel-hub-detail-link-url');
      let titleInput = document.getElementById('travel-hub-detail-link-title');
      const descriptionInput = document.getElementById('travel-hub-detail-link-description-input');
      let destinationId = referenceLinkAddButton.getAttribute('data-dest-id');

      const url = (urlInput.value || '').trim();
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
          'X-CSRFToken': getCsrfTokenValue(),
        },
        body: JSON.stringify({
          reference_url: url,
          reference_title_bn: (titleInput.value || '').trim(),
          description_bn: (descriptionInput.value || '').trim(),
        }),
      })
        .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
        .then(function (data) {
          if (data.success) {
            const list = document.getElementById('travel-hub-detail-links-list');
            let emptyMessage = list.querySelector('.travel-hub-detail-empty');
            if (emptyMessage) emptyMessage.remove();

            let card = document.createElement('div');
            card.className = 'travel-hub-detail-link-card';
            const linkElement = document.createElement('a');
            linkElement.className = 'travel-hub-detail-link-url';
            linkElement.href = url;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener';
            linkElement.textContent = data.reference_title_bn || url;
            card.appendChild(linkElement);

            if (descriptionInput.value.trim()) {
              let descriptionElement = document.createElement('span');
              descriptionElement.className = 'travel-hub-detail-link-desc';
              descriptionElement.textContent = descriptionInput.value.trim();
              card.appendChild(descriptionElement);
            }

            /* Add edit/delete buttons */
            const metaHtml = '<div class="travel-hub-detail-contribution-meta">'
              + '<span class="travel-hub-detail-contribution-uploader">আমি</span>'
              + '<span class="travel-hub-detail-contribution-actions" data-type="link" data-id="' + data.link_id + '" data-dest-id="' + destinationId + '">'
              + '<button type="button" class="travel-hub-detail-contribution-edit-button" id="travel-hub-detail-link-edit-' + data.link_id + '" name="travel_hub_link_edit_' + data.link_id + '" title="সম্পাদনা">✎</button>'
              + '<button type="button" class="travel-hub-detail-contribution-delete-button" id="travel-hub-detail-link-delete-' + data.link_id + '" name="travel_hub_link_delete_' + data.link_id + '" title="মুছুন">✕</button>'
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

  const reviewSubmitButton = document.getElementById('travel-hub-detail-review-submit-button');
  if (reviewSubmitButton) {
    reviewSubmitButton.addEventListener('click', function () {
      const ratingSelect = document.getElementById('travel-hub-detail-review-rating');
      const titleInput = document.getElementById('travel-hub-detail-review-title');
      const bodyInput = document.getElementById('travel-hub-detail-review-body');
      const visitedInput = document.getElementById('travel-hub-detail-review-visited-at');
      let destinationId = reviewSubmitButton.getAttribute('data-dest-id');
      const formContainer = document.getElementById('travel-hub-detail-review-form');

      const rating = ratingSelect.value;
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
          'X-CSRFToken': getCsrfTokenValue(),
        },
        body: JSON.stringify({
          rating_overall: parseInt(rating),
          review_title_bn: (titleInput.value || '').trim(),
          review_body_bn: (bodyInput.value || '').trim(),
          visited_at: visitedInput.value || null,
        }),
      })
        .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
        .then(function (data) {
          if (data.success) {
            /* Add review card to the list */
            let section = document.querySelector('.travel-hub-detail-section:last-of-type');
            const emptyMessage = section.querySelector('.travel-hub-detail-empty');
            if (emptyMessage) emptyMessage.remove();

            const card = document.createElement('div');
            card.className = 'travel-hub-detail-card';
            let html = '<div class="travel-hub-detail-review-header">';
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
    const editButton = event.target.closest('.travel-hub-detail-contribution-edit-button');
    const deleteButton = event.target.closest('.travel-hub-detail-contribution-delete-button');

    if (editButton) {
      event.stopPropagation();
      handleContributionEdit(editButton);
    } else if (deleteButton) {
      event.stopPropagation();
      handleContributionDelete(deleteButton);
    }
  });

  function handleContributionEdit(button) {
    let actionsContainer = button.closest('.travel-hub-detail-contribution-actions');
    if (!actionsContainer) return;

    let contributionType = actionsContainer.getAttribute('data-type');
    let contributionId = actionsContainer.getAttribute('data-id');
    let destinationId = actionsContainer.getAttribute('data-dest-id');
    let parentCard = actionsContainer.closest('.travel-hub-detail-media-card, .travel-hub-detail-link-card');
    if (!parentCard) return;

    /* For photos: place edit form AFTER the thumb (not inside) to avoid lightbox conflicts */
    const editFormContainer = (contributionType === 'photo') ? parentCard.parentNode : parentCard;

    /* Check if edit form already open */
    if (editFormContainer.querySelector('.travel-hub-detail-contribution-edit-form')) return;

    let editForm = document.createElement('div');
    editForm.className = 'travel-hub-detail-contribution-edit-form';
    editForm.setAttribute('data-for-card', contributionId);

    if (contributionType === 'photo') {
      const currentCaption = parentCard.getAttribute('data-photo-caption') || '';
      editForm.innerHTML = '<input type="text" class="travel-hub-detail-text-input" id="travel-hub-detail-edit-photo-caption-' + contributionId + '" name="travel-hub-detail-edit-photo-caption-' + contributionId + '" value="' + escapeAttribute(currentCaption) + '" placeholder="ক্যাপশন (Caption)" maxlength="500">'
        + '<button type="button" class="travel-hub-detail-contribution-save-button" data-type="photo" data-id="' + contributionId + '" data-dest-id="' + destinationId + '">সংরক্ষণ</button>'
        + '<button type="button" class="travel-hub-detail-contribution-cancel-button">বাতিল</button>';
    } else if (contributionType === 'youtube') {
      let currentTitle = '';
      let currentDescription = '';
      const titleElement = parentCard.querySelector('.travel-hub-detail-youtube-title');
      const descriptionElement = parentCard.querySelector('.travel-hub-detail-youtube-desc');
      if (titleElement) currentTitle = titleElement.textContent;
      if (descriptionElement) currentDescription = descriptionElement.textContent;
      editForm.innerHTML = '<input type="text" class="travel-hub-detail-text-input" id="travel-hub-detail-edit-youtube-title-' + contributionId + '" name="travel-hub-detail-edit-youtube-title-' + contributionId + '" value="' + escapeAttribute(currentTitle) + '" placeholder="শিরোনাম" maxlength="300">'
        + '<input type="text" class="travel-hub-detail-text-input" id="travel-hub-detail-edit-youtube-description-' + contributionId + '" name="travel-hub-detail-edit-youtube-description-' + contributionId + '" value="' + escapeAttribute(currentDescription) + '" placeholder="বর্ণনা" maxlength="1000">'
        + '<button type="button" class="travel-hub-detail-contribution-save-button" data-type="youtube" data-id="' + contributionId + '" data-dest-id="' + destinationId + '">সংরক্ষণ</button>'
        + '<button type="button" class="travel-hub-detail-contribution-cancel-button">বাতিল</button>';
    } else if (contributionType === 'link') {
      let currentLinkTitle = '';
      let currentLinkDescription = '';
      const linkTitleElement = parentCard.querySelector('.travel-hub-detail-link-url');
      const linkDescriptionElement = parentCard.querySelector('.travel-hub-detail-link-desc');
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
    const editInputs = editForm.querySelectorAll('input[type="text"]');
    for (let i = 0; i < editInputs.length; i++) {
      attachBanglaInputToElement(editInputs[i]);
    }
  }

  function handleContributionDelete(button) {
    const actionsContainer = button.closest('.travel-hub-detail-contribution-actions');
    if (!actionsContainer) return;

    let contributionType = actionsContainer.getAttribute('data-type');
    let contributionId = actionsContainer.getAttribute('data-id');
    let destinationId = actionsContainer.getAttribute('data-dest-id');
    let parentCard = actionsContainer.closest('.travel-hub-detail-media-card, .travel-hub-detail-link-card');
    if (!parentCard) return;

    /* For photos: place confirm bar outside thumb to avoid lightbox conflict */
    const confirmContainer = (contributionType === 'photo') ? parentCard.parentNode : parentCard;

    /* Show inline confirmation instead of popup */
    if (confirmContainer.querySelector('.travel-hub-detail-contribution-delete-confirm')) return;

    let confirmBar = document.createElement('div');
    confirmBar.className = 'travel-hub-detail-contribution-delete-confirm';
    confirmBar.setAttribute('data-for-card', contributionId);
    confirmBar.innerHTML = '<span>মুছে ফেলতে চান?</span>'
      + '<button type="button" class="travel-hub-detail-contribution-confirm-yes-button" id="travel-hub-detail-confirm-delete-' + contributionType + '-' + contributionId + '" name="travel_hub_confirm_delete_' + contributionType + '_' + contributionId + '" data-type="' + contributionType + '" data-id="' + contributionId + '" data-dest-id="' + destinationId + '">হ্যাঁ</button>'
      + '<button type="button" class="travel-hub-detail-contribution-confirm-no-button" id="travel-hub-detail-cancel-delete-' + contributionType + '-' + contributionId + '" name="travel_hub_cancel_delete_' + contributionType + '_' + contributionId + '">না</button>';

    if (contributionType === 'photo') {
      parentCard.after(confirmBar);
    } else {
      parentCard.appendChild(confirmBar);
    }
  }

  /* Save edit */
  document.addEventListener('click', function (event) {
    const saveButton = event.target.closest('.travel-hub-detail-contribution-save-button');
    if (!saveButton) return;
    event.stopPropagation();

    let contributionType = saveButton.getAttribute('data-type');
    let contributionId = saveButton.getAttribute('data-id');
    let destinationId = saveButton.getAttribute('data-dest-id');
    let editForm = saveButton.closest('.travel-hub-detail-contribution-edit-form');
    /* For photos, the edit form is a sibling of the thumb — find the thumb by data-photo-id */
    let parentCard;
    if (contributionType === 'photo') {
      parentCard = document.querySelector('.travel-hub-detail-media-card[data-photo-id="' + contributionId + '"]');
    } else {
      parentCard = editForm.parentNode;
    }
    let apiUrl = '';
    let payload = {};

    if (contributionType === 'photo') {
      apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/photo/' + contributionId + '/';
      const captionInput = editForm.querySelector('input');
      payload = { caption_bn: (captionInput.value || '').trim() };
    } else if (contributionType === 'youtube') {
      apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/youtube/' + contributionId + '/';
      const youtubeEditInputs = editForm.querySelectorAll('input');
      payload = {
        video_title_bn: (youtubeEditInputs[0].value || '').trim(),
        description_bn: (youtubeEditInputs[1].value || '').trim(),
      };
    } else if (contributionType === 'link') {
      apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/link/' + contributionId + '/';
      const referenceLinkEditInputs = editForm.querySelectorAll('input');
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
        'X-CSRFToken': getCsrfTokenValue(),
      },
      body: JSON.stringify(payload),
    })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success) {
          editForm.remove();
          /* Update displayed content */
          if (contributionType === 'photo') {
            /* Update data attribute on the thumb inside the card */
            const photoThumb = parentCard.querySelector('.travel-hub-detail-photo-thumb');
            if (photoThumb) photoThumb.setAttribute('data-photo-caption', data.caption_bn || '');
            /* Update the caption div in the card */
            let captionDiv = parentCard.querySelector('.travel-hub-detail-media-card-caption');
            if (data.caption_bn) {
              if (!captionDiv) {
                captionDiv = document.createElement('div');
                captionDiv.className = 'travel-hub-detail-media-card-caption';
                const footer = parentCard.querySelector('.travel-hub-detail-media-card-footer');
                if (footer) {
                  parentCard.insertBefore(captionDiv, footer);
                } else {
                  parentCard.appendChild(captionDiv);
                }
              }
              captionDiv.textContent = data.caption_bn;
            } else if (captionDiv) {
              captionDiv.remove();
            }
          } else if (contributionType === 'youtube') {
            /* Update title in the caption div */
            let youtubeTitle = parentCard.querySelector('.travel-hub-detail-youtube-title');
            if (youtubeTitle && data.video_title_bn) youtubeTitle.textContent = data.video_title_bn;
            /* Update or create caption div if title changed */
            let videoCaptionDiv = parentCard.querySelector('.travel-hub-detail-media-card-caption');
            if (data.video_title_bn) {
              if (!videoCaptionDiv) {
                videoCaptionDiv = document.createElement('div');
                videoCaptionDiv.className = 'travel-hub-detail-media-card-caption';
                const videoFooter = parentCard.querySelector('.travel-hub-detail-media-card-footer');
                if (videoFooter) {
                  parentCard.insertBefore(videoCaptionDiv, videoFooter);
                }
              }
              if (!youtubeTitle) {
                const titleLink = document.createElement('a');
                titleLink.className = 'travel-hub-detail-youtube-title';
                titleLink.target = '_blank';
                titleLink.rel = 'noopener';
                videoCaptionDiv.appendChild(titleLink);
                youtubeTitle = titleLink;
              }
              youtubeTitle.textContent = data.video_title_bn;
            }
          } else if (contributionType === 'link') {
            const linkUrl = parentCard.querySelector('.travel-hub-detail-link-url');
            let linkDescription = parentCard.querySelector('.travel-hub-detail-link-desc');
            if (linkUrl && data.reference_title_bn) linkUrl.textContent = data.reference_title_bn;
            if (data.description_bn) {
              if (!linkDescription) {
                linkDescription = document.createElement('span');
                linkDescription.className = 'travel-hub-detail-link-desc';
                const linkMeta = parentCard.querySelector('.travel-hub-detail-contribution-meta');
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
    const cancelButton = event.target.closest('.travel-hub-detail-contribution-cancel-button');
    if (!cancelButton) return;
    event.stopPropagation();
    const editForm = cancelButton.closest('.travel-hub-detail-contribution-edit-form');
    if (editForm) editForm.remove();
  });

  /* Confirm delete — Yes */
  document.addEventListener('click', function (event) {
    const confirmYesButton = event.target.closest('.travel-hub-detail-contribution-confirm-yes-button');
    if (!confirmYesButton) return;
    event.stopPropagation();

    const contributionType = confirmYesButton.getAttribute('data-type');
    const contributionId = confirmYesButton.getAttribute('data-id');
    let destinationId = confirmYesButton.getAttribute('data-dest-id');
    let confirmBar = confirmYesButton.closest('.travel-hub-detail-contribution-delete-confirm');
    /* For photos, the confirm bar is a sibling of the thumb — find the thumb by data-photo-id */
    let parentCard;
    if (contributionType === 'photo') {
      parentCard = document.querySelector('.travel-hub-detail-media-card[data-photo-id="' + contributionId + '"]');
    } else {
      parentCard = confirmBar.parentNode;
    }
    const section = (parentCard || confirmBar).closest('.travel-hub-detail-section');

    let apiUrl = '';
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
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
    })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
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
    const confirmNoButton = event.target.closest('.travel-hub-detail-contribution-confirm-no-button');
    if (!confirmNoButton) return;
    event.stopPropagation();
    const confirmBar = confirmNoButton.closest('.travel-hub-detail-contribution-delete-confirm');
    if (confirmBar) confirmBar.remove();
  });

  function escapeAttribute(text) {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ========== Set photo as destination cover image ========== */

  const COVER_LABEL_ACTIVE = '\u2713 \u0995\u09AD\u09BE\u09B0 \u099B\u09AC\u09BF (Cover photo)';
  const COVER_LABEL_SET = '\u2606 \u0995\u09AD\u09BE\u09B0 \u099B\u09AC\u09BF \u09B8\u09C7\u099F \u0995\u09B0\u09C1\u09A8 (Set as cover)';

  document.addEventListener('click', function (event) {
    const setCoverButton = event.target.closest('.travel-hub-detail-set-cover-button');
    if (!setCoverButton) return;

    event.preventDefault();
    event.stopPropagation();

    /* Already the active cover — do nothing */
    if (setCoverButton.classList.contains('travel-hub-detail-set-cover-button-active')) return;

    const photoId = setCoverButton.getAttribute('data-photo-id');
    const destinationId = setCoverButton.getAttribute('data-dest-id');
    if (!photoId || !destinationId) return;

    /* Disable button during request */
    setCoverButton.disabled = true;

    const apiUrl = '/bangladesh-tourist-destinations/api/destination/' + destinationId + '/photo/' + photoId + '/set-cover/';
    fetch(apiUrl, {
      method: 'PATCH',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      setCoverButton.disabled = false;
      let cardElement = setCoverButton.closest('.travel-hub-detail-media-card');

      if (!data.success) {
        showInlineMessage(cardElement, data.error || '\u0995\u09AD\u09BE\u09B0 \u09B8\u09C7\u099F \u0995\u09B0\u09BE \u09AF\u09BE\u09AF\u09BC\u09A8\u09BF', true);
        return;
      }

      /* Remove active class and reset labels on all cover buttons */
      const allCoverButtons = document.querySelectorAll('.travel-hub-detail-set-cover-button');
      for (let i = 0; i < allCoverButtons.length; i++) {
        allCoverButtons[i].classList.remove('travel-hub-detail-set-cover-button-active');
        const labelElement = allCoverButtons[i].querySelector('.travel-hub-detail-set-cover-label');
        if (labelElement) labelElement.textContent = COVER_LABEL_SET;
      }

      /* Mark this one as active */
      setCoverButton.classList.add('travel-hub-detail-set-cover-button-active');
      const activeLabel = setCoverButton.querySelector('.travel-hub-detail-set-cover-label');
      if (activeLabel) activeLabel.textContent = COVER_LABEL_ACTIVE;

      /* Update hero image at the top of the page */
      const heroElement = document.getElementById('travel-hub-detail-hero');
      if (heroElement && data.cover_image_url) {
        heroElement.style.backgroundImage = "url('" + data.cover_image_url + "')";
        heroElement.classList.remove('display-hidden');
      }

      showInlineMessage(cardElement, '\u0995\u09AD\u09BE\u09B0 \u099B\u09AC\u09BF \u09B8\u09C7\u099F \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 (Cover set)', false);
    })
    .catch(function () {
      setCoverButton.disabled = false;
      const cardElement = setCoverButton.closest('.travel-hub-detail-media-card');
      showInlineMessage(cardElement, '\u09A8\u09C7\u099F\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u0995 \u09A4\u09CD\u09B0\u09C1\u099F\u09BF (Network error)', true);
    });
  });


})();

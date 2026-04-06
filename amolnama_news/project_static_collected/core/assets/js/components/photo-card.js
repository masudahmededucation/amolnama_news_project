/**
 * photo-card.js — Shared photo card interaction component.
 *
 * Provides: set-cover, like, view count, edit caption, delete photo.
 * Each page calls window.photoCard.init(config) with its own API URLs and selectors.
 *
 * Usage:
 *   window.photoCard.init({
 *     cardSelector: '.photo-card',
 *     imageSelector: '.photo-card-image',
 *     idAttribute: 'data-photo-id',           // primary ID attribute on card
 *     parentIdAttribute: 'data-dest-id',       // parent entity ID attribute on card
 *     heroElementId: 'my-hero',                // hero image element ID (optional)
 *     buildApiUrl: function (parentId, photoId, action) {
 *       return '/my-app/api/entity/' + parentId + '/photo/' + photoId + '/' + action + '/';
 *     },
 *     onDeleteCard: function (cardElement) { ... },  // optional: cleanup after card removed
 *   });
 *
 * HTML dependency: include core/components/photo-card.html (or build cards with matching classes)
 * CSS dependency: core/assets/css/components/photo-card.css
 */
(function () {
  'use strict';

  let config = {};

  /* ---- CSRF token ---- */


  /* ---- Escape HTML for safe attribute insertion ---- */

  function escapeHtmlAttribute(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ---- Inline message helper (no popups) ---- */

  function showInlineMessage(nearElement, text, isError) {
    if (!nearElement || !nearElement.parentNode) return;
    const existing = nearElement.parentNode.querySelector('.photo-card-inline-message');
    if (existing) existing.remove();

    const messageElement = document.createElement('div');
    messageElement.className = 'photo-card-inline-message '
      + (isError ? 'photo-card-inline-message-error' : 'photo-card-inline-message-success');
    messageElement.textContent = text;
    nearElement.parentNode.insertBefore(messageElement, nearElement.nextSibling);

    setTimeout(function () {
      if (messageElement.parentNode) messageElement.remove();
    }, 5000);
  }

  /* ---- Helper: get IDs from card element ---- */

  function getCardIds(cardElement) {
    return {
      photoId: cardElement.getAttribute(config.idAttribute),
      parentId: cardElement.getAttribute(config.parentIdAttribute),
    };
  }

  /* ---- SET COVER ---- */

  const COVER_LABEL_ACTIVE = '✓ কভার ছবি (Cover photo)';
  const COVER_LABEL_SET = '☆ কভার ছবি সেট করুন (Set as cover)';

  function handleSetCover(event) {
    const setCoverButton = event.target.closest('.photo-card-set-cover-button');
    if (!setCoverButton) return;

    event.preventDefault();
    event.stopPropagation();

    if (setCoverButton.classList.contains('photo-card-set-cover-button-active')) return;

    let cardElement = setCoverButton.closest(config.cardSelector);
    if (!cardElement) return;

    let ids = getCardIds(cardElement);
    if (!ids.photoId || !ids.parentId) return;

    setCoverButton.disabled = true;

    let apiUrl = config.buildApiUrl(ids.parentId, ids.photoId, 'set-cover');
    fetch(apiUrl, {
      method: 'PATCH',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      setCoverButton.disabled = false;

      if (!data.success) {
        showInlineMessage(cardElement, data.error || 'কভার সেট করা যায়নি', true);
        return;
      }

      /* Reset all cover buttons */
      const allCoverButtons = document.querySelectorAll('.photo-card-set-cover-button');
      for (let buttonIndex = 0; buttonIndex < allCoverButtons.length; buttonIndex++) {
        allCoverButtons[buttonIndex].classList.remove('photo-card-set-cover-button-active');
        const labelElement = allCoverButtons[buttonIndex].querySelector('.photo-card-set-cover-label');
        if (labelElement) labelElement.textContent = COVER_LABEL_SET;
      }

      /* Mark this one as active */
      setCoverButton.classList.add('photo-card-set-cover-button-active');
      const activeLabel = setCoverButton.querySelector('.photo-card-set-cover-label');
      if (activeLabel) activeLabel.textContent = COVER_LABEL_ACTIVE;

      /* Update hero image */
      if (config.heroElementId && data.cover_image_url) {
        const heroElement = document.getElementById(config.heroElementId);
        if (heroElement) {
          heroElement.style.backgroundImage = "url('" + data.cover_image_url + "')";
          heroElement.hidden = false;
        }
      }

      showInlineMessage(cardElement, 'কভার ছবি সেট হয়েছে (Cover set)', false);
    })
    .catch(function (networkError) {
      setCoverButton.disabled = false;
      showInlineMessage(cardElement, 'নেটওয়ার্ক ত্রুটি (Network error)', true);
    });
  }

  /* ---- LIKE TOGGLE ---- */

  function handleLikeToggle(event) {
    const likeButton = event.target.closest('.photo-card-like-button');
    if (!likeButton) return;

    event.preventDefault();
    event.stopPropagation();

    let cardElement = likeButton.closest(config.cardSelector);
    if (!cardElement) return;

    let ids = getCardIds(cardElement);
    if (!ids.photoId || !ids.parentId) return;

    likeButton.disabled = true;

    let apiUrl = config.buildApiUrl(ids.parentId, ids.photoId, 'like');
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      likeButton.disabled = false;

      if (!data.success) {
        showInlineMessage(cardElement, data.error || 'পছন্দ করা যায়নি', true);
        return;
      }

      const likeIconElement = likeButton.querySelector('.photo-card-like-icon');
      const likeCountElement = likeButton.querySelector('.photo-card-like-count');

      if (data.liked) {
        likeButton.classList.add('photo-card-like-button-active');
        if (likeIconElement) likeIconElement.textContent = '👍';
      } else {
        likeButton.classList.remove('photo-card-like-button-active');
        if (likeIconElement) likeIconElement.textContent = '👍';
      }
      if (likeCountElement) likeCountElement.textContent = data.like_count;
    })
    .catch(function (networkError) {
      likeButton.disabled = false;
    });
  }

  /* ---- VIEW COUNT (fire and forget on image click) ---- */

  function handleViewCount(event) {
    let imageElement = event.target.closest(config.imageSelector + '[data-photo-url]');
    if (!imageElement) return;

    /* Skip clicks on buttons inside the card */
    if (event.target.closest('.photo-card-footer')) return;
    if (event.target.closest('.photo-card-set-cover-button')) return;
    if (event.target.closest('.photo-card-actions')) return;

    let cardElement = imageElement.closest(config.cardSelector);
    if (!cardElement) return;

    let ids = getCardIds(cardElement);
    if (!ids.photoId || !ids.parentId) return;

    let apiUrl = config.buildApiUrl(ids.parentId, ids.photoId, 'view');
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      if (data.success) {
        const viewCountElement = cardElement.querySelector('.photo-card-view-count');
        if (viewCountElement) {
          const currentViewCount = parseInt(viewCountElement.textContent.replace(/[^\d]/g, '') || '0', 10);
          viewCountElement.innerHTML = '👁️ <span class="photo-card-view-label">ভিউ</span> ' + (currentViewCount + 1);
        }
      }
    })
    .catch(function (networkError) {
    });
  }

  /* ---- EDIT CAPTION ---- */

  function handleEditClick(event) {
    const editButton = event.target.closest('.photo-card-edit-button');
    if (!editButton) return;

    event.preventDefault();
    event.stopPropagation();

    let cardElement = editButton.closest(config.cardSelector);
    if (!cardElement) return;

    /* Don't open if already editing */
    if (cardElement.querySelector('.photo-card-edit-form')) return;

    let ids = getCardIds(cardElement);
    const currentCaption = editButton.getAttribute('data-caption') || '';

    let editFormElement = document.createElement('div');
    editFormElement.className = 'photo-card-edit-form';
    editFormElement.innerHTML = '<input type="text" '
      + 'id="photo-card-edit-input-' + ids.photoId + '" '
      + 'name="photo_card_edit_input_' + ids.photoId + '" '
      + 'value="' + escapeHtmlAttribute(currentCaption) + '" '
      + 'placeholder="ক্যাপশন (Caption)" maxlength="1000">'
      + '<button type="button" class="photo-card-save-button" '
      + 'id="photo-card-save-' + ids.photoId + '" '
      + 'name="photo_card_save_' + ids.photoId + '" '
      + 'data-photo-id="' + ids.photoId + '" data-parent-id="' + ids.parentId + '">'
      + 'সংরক্ষণ (Save)</button>'
      + '<button type="button" class="photo-card-cancel-button" '
      + 'id="photo-card-cancel-' + ids.photoId + '" '
      + 'name="photo_card_cancel_' + ids.photoId + '">'
      + 'বাতিল (Cancel)</button>';

    cardElement.appendChild(editFormElement);
    editFormElement.querySelector('input').focus();
  }

  function handleEditSave(event) {
    const saveButton = event.target.closest('.photo-card-save-button');
    if (!saveButton) return;

    event.stopPropagation();

    let photoId = saveButton.getAttribute('data-photo-id');
    let parentId = saveButton.getAttribute('data-parent-id');
    let editFormElement = saveButton.closest('.photo-card-edit-form');
    const captionInput = editFormElement.querySelector('input');
    const newCaption = (captionInput.value || '').trim();

    saveButton.disabled = true;
    saveButton.textContent = 'সংরক্ষণ হচ্ছে...';

    let apiUrl = config.buildApiUrl(parentId, photoId, 'caption');
    fetch(apiUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfTokenValue(),
      },
      body: JSON.stringify({ caption_bn: newCaption }),
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      let cardElement = editFormElement.closest(config.cardSelector);
      editFormElement.remove();

      if (data.success) {
        const savedCaption = data.caption_bn || '';

        /* Update caption display */
        const captionElement = cardElement.querySelector('.photo-card-caption');
        if (captionElement) captionElement.textContent = savedCaption;

        /* Update data-caption on edit button for next edit */
        const editButtonElement = cardElement.querySelector('.photo-card-edit-button');
        if (editButtonElement) editButtonElement.setAttribute('data-caption', savedCaption);

        /* Update data-photo-caption on image for lightbox */
        const imageElement = cardElement.querySelector(config.imageSelector);
        if (imageElement) imageElement.setAttribute('data-photo-caption', savedCaption);

        showInlineMessage(cardElement, 'ক্যাপশন পরিবর্তন হয়েছে (Caption updated)', false);
      } else {
        showInlineMessage(cardElement, data.error || 'ক্যাপশন পরিবর্তন করা যায়নি', true);
      }
    })
    .catch(function (networkError) {
      let cardElement = editFormElement.closest(config.cardSelector);
      editFormElement.remove();
      if (cardElement) {
        showInlineMessage(cardElement, 'নেটওয়ার্ক ত্রুটি (Network error)', true);
      }
    });
  }

  function handleEditCancel(event) {
    const cancelButton = event.target.closest('.photo-card-cancel-button');
    if (!cancelButton) return;
    event.stopPropagation();
    const editFormElement = cancelButton.closest('.photo-card-edit-form');
    if (editFormElement) editFormElement.remove();
  }

  /* ---- DELETE PHOTO ---- */

  function handleDeleteClick(event) {
    const deleteButton = event.target.closest('.photo-card-delete-button');
    if (!deleteButton) return;

    event.preventDefault();
    event.stopPropagation();

    let cardElement = deleteButton.closest(config.cardSelector);
    if (!cardElement) return;

    if (cardElement.querySelector('.photo-card-delete-confirm')) return;

    const ids = getCardIds(cardElement);

    let confirmBarElement = document.createElement('div');
    confirmBarElement.className = 'photo-card-delete-confirm';
    confirmBarElement.innerHTML = '<span>মুছে ফেলতে চান? (Delete this photo?)</span>'
      + '<button type="button" class="photo-card-confirm-delete-button" '
      + 'id="photo-card-confirm-delete-' + ids.photoId + '" '
      + 'name="photo_card_confirm_delete_' + ids.photoId + '" '
      + 'data-photo-id="' + ids.photoId + '" data-parent-id="' + ids.parentId + '">'
      + 'হ্যাঁ (Yes)</button>'
      + '<button type="button" class="photo-card-cancel-delete-button" '
      + 'id="photo-card-cancel-delete-' + ids.photoId + '" '
      + 'name="photo_card_cancel_delete_' + ids.photoId + '">'
      + 'না (No)</button>';

    cardElement.appendChild(confirmBarElement);
  }

  function handleDeleteConfirm(event) {
    const confirmDeleteButton = event.target.closest('.photo-card-confirm-delete-button');
    if (!confirmDeleteButton) return;

    event.stopPropagation();

    const photoId = confirmDeleteButton.getAttribute('data-photo-id');
    const parentId = confirmDeleteButton.getAttribute('data-parent-id');
    const cardElement = confirmDeleteButton.closest(config.cardSelector);

    confirmDeleteButton.disabled = true;
    confirmDeleteButton.textContent = 'মুছে ফেলা হচ্ছে...';

    const apiUrl = config.buildApiUrl(parentId, photoId, 'delete');
    fetch(apiUrl, {
      method: 'DELETE',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      if (data.success) {
        cardElement.remove();

        /* Optional callback for cleanup (e.g., remove empty groups) */
        if (typeof config.onDeleteCard === 'function') {
          config.onDeleteCard();
        }
      } else {
        showInlineMessage(cardElement, data.error || 'ছবি মুছে ফেলা যায়নি', true);
        confirmDeleteButton.disabled = false;
        confirmDeleteButton.textContent = 'হ্যাঁ (Yes)';
      }
    })
    .catch(function (networkError) {
      showInlineMessage(cardElement, 'নেটওয়ার্ক ত্রুটি (Network error)', true);
      confirmDeleteButton.disabled = false;
      confirmDeleteButton.textContent = 'হ্যাঁ (Yes)';
    });
  }

  function handleDeleteCancel(event) {
    const cancelDeleteButton = event.target.closest('.photo-card-cancel-delete-button');
    if (!cancelDeleteButton) return;
    event.stopPropagation();
    const confirmBarElement = cancelDeleteButton.closest('.photo-card-delete-confirm');
    if (confirmBarElement) confirmBarElement.remove();
  }

  /* ---- Init — bind all event listeners ---- */

  function initPhotoCard(userConfig) {
    config = {
      cardSelector: userConfig.cardSelector || '.photo-card',
      imageSelector: userConfig.imageSelector || '.photo-card-image',
      idAttribute: userConfig.idAttribute || 'data-photo-id',
      parentIdAttribute: userConfig.parentIdAttribute || 'data-parent-id',
      heroElementId: userConfig.heroElementId || null,
      buildApiUrl: userConfig.buildApiUrl,
      onDeleteCard: userConfig.onDeleteCard || null,
    };

    if (typeof config.buildApiUrl !== 'function') {
      return;
    }

    /* All handlers use event delegation on document */
    document.addEventListener('click', handleSetCover);
    document.addEventListener('click', handleLikeToggle);
    document.addEventListener('click', handleViewCount);
    document.addEventListener('click', handleEditClick);
    document.addEventListener('click', handleEditSave);
    document.addEventListener('click', handleEditCancel);
    document.addEventListener('click', handleDeleteClick);
    document.addEventListener('click', handleDeleteConfirm);
    document.addEventListener('click', handleDeleteCancel);
  }

  /* ---- Public API ---- */
  window.photoCard = {
    init: initPhotoCard,
    showMessage: showInlineMessage,
  };
})();

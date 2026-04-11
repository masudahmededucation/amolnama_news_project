/* debate-home.js — Search filter + Create topic inline form (staff only). No popups. */
(function () {
  'use strict';

  /* ---- Search / Filter topics ---- */
  const searchInput = document.getElementById('debate-home-search-input');
  if (searchInput) {
    function normalizeBengali(text) {
      /* NFC normalize + strip optional Bengali marks (chandrabindu, anusvara, visarga) for fuzzy match + lowercase */
      return (text || '').normalize('NFC').replace(/[\u0981\u0982\u0983]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    searchInput.addEventListener('input', function () {
      const query = normalizeBengali(searchInput.value);
      const topicCards = document.querySelectorAll('.debate-topic-card');
      topicCards.forEach(function (card) {
        const title = normalizeBengali((card.querySelector('.debate-topic-card-title') || {}).textContent);
        const description = normalizeBengali((card.querySelector('.debate-topic-card-description') || {}).textContent);
        /* Each word in query must match somewhere (title OR description) */
        const combined = title + ' ' + description;
        const queryWords = query.split(' ').filter(function (word) { return word.length > 0; });
        const match = queryWords.length === 0 || queryWords.every(function (word) { return combined.indexOf(word) !== -1; });
        match ? card.hidden = false : card.hidden = true;
      });
    });
  }

  /* ---- Filter pills — client-side debate type filter ---- */
  /* Document delegation — guard against duplicate registration on SPA re-navigation */
  if (!window.__debateFilterPillsRegistered) {
  window.__debateFilterPillsRegistered = true;
  document.addEventListener('click', function (event) {
    const pill = event.target.closest('#debate-home-filter-pills .filter-pills-pill');
    if (!pill) return;

    const pillsGroup = document.getElementById('debate-home-filter-pills');
    if (!pillsGroup) return;

    pillsGroup.querySelectorAll('.filter-pills-pill').forEach(function (p) {
      p.classList.remove('filter-pills-pill-active');
    });
    pill.classList.add('filter-pills-pill-active');

    const filterType = pill.getAttribute('data-debate-type');
    let visibleCount = 0;
    document.querySelectorAll('.debate-topic-card').forEach(function (card) {
      if (!filterType) {
        card.hidden = false;
        visibleCount++;
      } else {
        const match = card.getAttribute('data-debate-type') === filterType;
        card.hidden = !match;
        if (match) visibleCount++;
      }
    });

    /* Show/hide empty state when filter returns no results */
    let filterEmpty = document.getElementById('debate-filter-empty');
    if (visibleCount === 0) {
      if (!filterEmpty) {
        filterEmpty = document.createElement('div');
        filterEmpty.id = 'debate-filter-empty';
        filterEmpty.className = 'debate-empty-state';
        var topicList = document.getElementById('debate-topic-list');
        if (topicList) topicList.appendChild(filterEmpty);
      }
      filterEmpty.innerHTML = '<p>এই ধরনের কোনো বিতর্ক নেই — শীঘ্রই আসছে</p>';
      filterEmpty.hidden = false;
    } else if (filterEmpty) {
      filterEmpty.hidden = true;
    }

    /* Update filter crumbs */
    var crumbsWrap = document.getElementById('debate-filter-crumbs');
    var crumbsChips = document.getElementById('debate-filter-crumbs-chips');
    var crumbsClear = document.getElementById('debate-filter-crumbs-clear');
    if (crumbsWrap && crumbsChips) {
      if (filterType) {
        var pillText = pill.textContent.trim();
        crumbsChips.innerHTML = '<span class="filter-crumbs-chip">' + escapeHtml(pillText) +
          ' <button class="filter-crumbs-chip-remove" data-action="clear-debate-type">✕</button></span>';
        crumbsWrap.hidden = false;
      } else {
        crumbsWrap.hidden = true;
        crumbsChips.innerHTML = '';
      }
    }
  });
  document.addEventListener('click', function (event) {
    var chipRemove = event.target.closest('#debate-filter-crumbs .filter-crumbs-chip-remove');
    var clearAll = event.target.closest('#debate-filter-crumbs-clear');
    if (!chipRemove && !clearAll) return;

    /* Reset filter to "All" */
    var pillsGroup = document.getElementById('debate-home-filter-pills');
    if (pillsGroup) {
      pillsGroup.querySelectorAll('.filter-pills-pill').forEach(function (p) {
        p.classList.remove('filter-pills-pill-active');
      });
      var allPill = pillsGroup.querySelector('[data-debate-type=""]');
      if (allPill) allPill.classList.add('filter-pills-pill-active');
    }

    /* Show all cards */
    document.querySelectorAll('.debate-topic-card').forEach(function (card) {
      card.hidden = false;
    });

    /* Hide crumbs */
    var crumbsWrap = document.getElementById('debate-filter-crumbs');
    if (crumbsWrap) crumbsWrap.hidden = true;

    /* Hide empty state */
    var filterEmpty = document.getElementById('debate-filter-empty');
    if (filterEmpty) filterEmpty.hidden = true;
  });
  } /* end guard: __debateFilterPillsRegistered */

  const createButton = document.getElementById('debate-home-create-button');
  if (!createButton) return;

  let formVisible = false;


  createButton.addEventListener('click', function () {
    if (formVisible) return;
    formVisible = true;
    createButton.hidden = true;

    /* Build inline form */
    const formContainer = document.createElement('div');
    formContainer.className = 'debate-home-create-form';
    formContainer.id = 'debate-home-create-form';

    const titleLabel = document.createElement('label');
    titleLabel.setAttribute('for', 'debate-home-create-title-input');
    titleLabel.className = 'debate-home-create-label';
    titleLabel.textContent = 'বিতর্কের বিষয়';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'debate-home-create-input';
    titleInput.id = 'debate-home-create-title-input';
    titleInput.name = 'debate_home_create_title_input';
    titleInput.placeholder = 'কমপক্ষে ১০ অক্ষর লিখুন';

    const timeLabel = document.createElement('label');
    timeLabel.setAttribute('for', 'debate-home-create-time-input');
    timeLabel.className = 'debate-home-create-label';
    timeLabel.textContent = 'সময়সূচী (Scheduled Date)';

    const timeInput = document.createElement('input');
    timeInput.type = 'datetime-local';
    timeInput.className = 'debate-home-create-input';
    timeInput.id = 'debate-home-create-time-input';
    timeInput.name = 'debate_home_create_time_input';

    const descriptionLabel = document.createElement('label');
    descriptionLabel.setAttribute('for', 'debate-home-create-description-textarea');
    descriptionLabel.className = 'debate-home-create-label';
    descriptionLabel.textContent = 'বিস্তারিত বিবরণ (ঐচ্ছিক)';

    const descriptionTextarea = document.createElement('textarea');
    descriptionTextarea.className = 'debate-home-create-textarea';
    descriptionTextarea.id = 'debate-home-create-description-textarea';
    descriptionTextarea.name = 'debate_home_create_description_textarea';
    descriptionTextarea.placeholder = 'বিষয়ের পটভূমি ও প্রসঙ্গ লিখুন...';
    descriptionTextarea.rows = 6;

    const blueSideLabelLabel = document.createElement('label');
    blueSideLabelLabel.setAttribute('for', 'debate-home-create-blue-side-label-input');
    blueSideLabelLabel.className = 'debate-home-create-label';
    blueSideLabelLabel.textContent = '🔵 পক্ষের নাম (ঐচ্ছিক)';

    const blueSideLabelInput = document.createElement('input');
    blueSideLabelInput.type = 'text';
    blueSideLabelInput.className = 'debate-home-create-input';
    blueSideLabelInput.id = 'debate-home-create-blue-side-label-input';
    blueSideLabelInput.name = 'debate_home_create_blue_side_label_input';
    blueSideLabelInput.placeholder = 'যেমন: পার্থ সাহেবের পক্ষে, সংবিধান রক্ষার পক্ষে';

    const redSideLabelLabel = document.createElement('label');
    redSideLabelLabel.setAttribute('for', 'debate-home-create-red-side-label-input');
    redSideLabelLabel.className = 'debate-home-create-label';
    redSideLabelLabel.textContent = '🔴 বিপক্ষের নাম (ঐচ্ছিক)';

    const redSideLabelInput = document.createElement('input');
    redSideLabelInput.type = 'text';
    redSideLabelInput.className = 'debate-home-create-input';
    redSideLabelInput.id = 'debate-home-create-red-side-label-input';
    redSideLabelInput.name = 'debate_home_create_red_side_label_input';
    redSideLabelInput.placeholder = 'যেমন: পার্থ সাহেবের বিপক্ষে, সংবিধান পরিবর্তনের পক্ষে';

    const buttonRow = document.createElement('div');
    buttonRow.className = 'debate-home-create-button-row';

    const submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.className = 'debate-home-create-submit-button';
    submitButton.id = 'debate-home-create-submit-button';
    submitButton.name = 'debate_home_create_submit_button';
    submitButton.textContent = 'তৈরি করুন';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'debate-home-create-cancel-button';
    cancelButton.id = 'debate-home-create-cancel-button';
    cancelButton.name = 'debate_home_create_cancel_button';
    cancelButton.textContent = 'বাতিল';

    buttonRow.appendChild(submitButton);
    buttonRow.appendChild(cancelButton);

    formContainer.appendChild(titleLabel);
    formContainer.appendChild(titleInput);
    formContainer.appendChild(descriptionLabel);
    formContainer.appendChild(descriptionTextarea);
    formContainer.appendChild(blueSideLabelLabel);
    formContainer.appendChild(blueSideLabelInput);
    formContainer.appendChild(redSideLabelLabel);
    formContainer.appendChild(redSideLabelInput);

    /* Debate category dropdown */
    const categoryLabel = document.createElement('label');
    categoryLabel.setAttribute('for', 'debate-home-create-category-select');
    categoryLabel.className = 'debate-home-create-label';
    categoryLabel.textContent = 'বিতর্কের ধরন (Debate Category)';

    const categorySelect = document.createElement('select');
    categorySelect.className = 'debate-home-create-input';
    categorySelect.id = 'debate-home-create-category-select';
    categorySelect.name = 'debate_home_create_category_select';
    categorySelect.innerHTML = '<option value="general">⚖️ সাধারণ বিতর্ক (General)</option>' +
      '<option value="parliament">🏛️ সংসদ বিতর্ক (Parliament)</option>';

    formContainer.appendChild(categoryLabel);
    formContainer.appendChild(categorySelect);

    const motionLabel = document.createElement('label');
    motionLabel.setAttribute('for', 'debate-home-create-motion-textarea');
    motionLabel.className = 'debate-home-create-label';
    motionLabel.id = 'debate-home-create-motion-label';
    motionLabel.textContent = 'প্রস্তাব / বিল (Motion Text)';
    motionLabel.hidden = true;

    const motionTextarea = document.createElement('textarea');
    motionTextarea.className = 'debate-home-create-textarea';
    motionTextarea.id = 'debate-home-create-motion-textarea';
    motionTextarea.name = 'debate_home_create_motion_textarea';
    motionTextarea.placeholder = 'এই সভায় আলোচনার জন্য প্রস্তাব লিখুন...';
    motionTextarea.rows = 3;
    motionTextarea.hidden = true;

    /* Wire shared category → side-label auto-fill behaviour
       (single source of truth: debate/components/debate-category-side-labels.js) */
    if (window.debateCategorySideLabels) {
      window.debateCategorySideLabels.attach({
        categorySelect: categorySelect,
        blueSideLabelInput: blueSideLabelInput,
        redSideLabelInput: redSideLabelInput,
        motionLabel: motionLabel,
        motionTextarea: motionTextarea,
      });
    }

    formContainer.appendChild(motionLabel);
    formContainer.appendChild(motionTextarea);

    /* Media URL fields — video + image per side */
    const mediaSection = document.createElement('div');
    mediaSection.className = 'debate-home-create-media-section';

    const mediaSectionToggle = document.createElement('button');
    mediaSectionToggle.type = 'button';
    mediaSectionToggle.className = 'debate-home-create-media-toggle';
    mediaSectionToggle.id = 'debate-home-create-media-toggle';
    mediaSectionToggle.name = 'debate_home_create_media_toggle';
    mediaSectionToggle.textContent = '📎 ভিডিও/ছবি যোগ করুন (ঐচ্ছিক)';

    const mediaFields = document.createElement('div');
    mediaFields.className = 'debate-home-create-media-fields debate-home-create-media-fields-hidden';
    mediaFields.id = 'debate-home-create-media-fields';

    const blueVideoLabel = document.createElement('label');
    blueVideoLabel.setAttribute('for', 'debate-home-create-blue-video-url');
    blueVideoLabel.className = 'debate-home-create-label';
    blueVideoLabel.textContent = '🔵 পক্ষের ভিডিও URL (YouTube)';
    const blueVideoInput = document.createElement('input');
    blueVideoInput.type = 'url';
    blueVideoInput.className = 'debate-home-create-input';
    blueVideoInput.id = 'debate-home-create-blue-video-url';
    blueVideoInput.name = 'debate_home_create_blue_video_url';
    blueVideoInput.placeholder = 'https://youtube.com/watch?v=...';

    const redVideoLabel = document.createElement('label');
    redVideoLabel.setAttribute('for', 'debate-home-create-red-video-url');
    redVideoLabel.className = 'debate-home-create-label';
    redVideoLabel.textContent = '🔴 বিপক্ষের ভিডিও URL (YouTube)';
    const redVideoInput = document.createElement('input');
    redVideoInput.type = 'url';
    redVideoInput.className = 'debate-home-create-input';
    redVideoInput.id = 'debate-home-create-red-video-url';
    redVideoInput.name = 'debate_home_create_red_video_url';
    redVideoInput.placeholder = 'https://youtube.com/watch?v=...';

    const blueImageLabel = document.createElement('label');
    blueImageLabel.setAttribute('for', 'debate-home-create-blue-image-url');
    blueImageLabel.className = 'debate-home-create-label';
    blueImageLabel.textContent = '🔵 পক্ষের ছবি URL';
    const blueImageInput = document.createElement('input');
    blueImageInput.type = 'url';
    blueImageInput.className = 'debate-home-create-input';
    blueImageInput.id = 'debate-home-create-blue-image-url';
    blueImageInput.name = 'debate_home_create_blue_image_url';
    blueImageInput.placeholder = 'https://example.com/image.jpg';

    const redImageLabel = document.createElement('label');
    redImageLabel.setAttribute('for', 'debate-home-create-red-image-url');
    redImageLabel.className = 'debate-home-create-label';
    redImageLabel.textContent = '🔴 বিপক্ষের ছবি URL';
    const redImageInput = document.createElement('input');
    redImageInput.type = 'url';
    redImageInput.className = 'debate-home-create-input';
    redImageInput.id = 'debate-home-create-red-image-url';
    redImageInput.name = 'debate_home_create_red_image_url';
    redImageInput.placeholder = 'https://example.com/image.jpg';

    mediaFields.appendChild(blueVideoLabel);
    mediaFields.appendChild(blueVideoInput);
    mediaFields.appendChild(redVideoLabel);
    mediaFields.appendChild(redVideoInput);
    mediaFields.appendChild(blueImageLabel);
    mediaFields.appendChild(blueImageInput);
    mediaFields.appendChild(redImageLabel);
    mediaFields.appendChild(redImageInput);

    mediaSectionToggle.addEventListener('click', function () {
      mediaFields.classList.toggle('debate-home-create-media-fields-hidden');
    });

    mediaSection.appendChild(mediaSectionToggle);
    mediaSection.appendChild(mediaFields);
    formContainer.appendChild(mediaSection);

    formContainer.appendChild(timeLabel);
    formContainer.appendChild(timeInput);
    formContainer.appendChild(buttonRow);

    createButton.parentElement.appendChild(formContainer);
    titleInput.focus();

    /* Cancel */
    cancelButton.addEventListener('click', function () {
      formContainer.remove();
      createButton.hidden = false;
      formVisible = false;
    });

    /* Submit */
    submitButton.addEventListener('click', function () {
      const topicTitle = titleInput.value.trim();
      const scheduledTime = timeInput.value;
      const topicDescription = descriptionTextarea.value.trim() || null;
      const blueSideLabel = blueSideLabelInput.value.trim() || null;
      const redSideLabel = redSideLabelInput.value.trim() || null;

      if (!topicTitle || topicTitle.length < 10) {
        titleInput.classList.add('debate-home-create-input-invalid');
        return;
      }
      titleInput.classList.remove('debate-home-create-input-invalid');
      if (!scheduledTime) {
        timeInput.classList.add('debate-home-create-input-invalid');
        return;
      }
      timeInput.classList.remove('debate-home-create-input-invalid');

      submitButton.disabled = true;

      fetch('/debate/api/topic/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({
          topic_title: topicTitle,
          topic_description: topicDescription,
          blue_side_label: blueSideLabel,
          red_side_label: redSideLabel,
          blue_side_video_url: blueVideoInput.value.trim() || null,
          red_side_video_url: redVideoInput.value.trim() || null,
          blue_side_image_url: blueImageInput.value.trim() || null,
          red_side_image_url: redImageInput.value.trim() || null,
          debate_category_code: categorySelect.value,
          parliament_motion_text: motionTextarea.value.trim() || null,
          scheduled_start_at: scheduledTime,
        }),
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success) {
          window.location.href = '/debate/topic/' + data.debate_coll_topic_id + '/';
        } else {
          const errorElement = formContainer.querySelector('.debate-arena-inline-message');
          if (errorElement) errorElement.remove();
          let errorMessage = document.createElement('div');
          errorMessage.className = 'debate-arena-inline-message debate-arena-inline-message-error';
          errorMessage.textContent = data.error;
          formContainer.appendChild(errorMessage);
          submitButton.disabled = false;
        }
      })
      .catch(function () {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'debate-arena-inline-message debate-arena-inline-message-error';
        errorMessage.textContent = 'নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।';
        formContainer.appendChild(errorMessage);
        submitButton.disabled = false;
      });
    });
  });
})();

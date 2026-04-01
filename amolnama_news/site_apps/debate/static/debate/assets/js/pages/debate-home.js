/* debate-home.js — Search filter + Create topic inline form (staff only). No popups. */
(function () {
  'use strict';

  /* ---- Search / Filter topics ---- */
  var searchInput = document.getElementById('debate-home-search-input');
  if (searchInput) {
    function normalizeBengali(text) {
      /* NFC normalize + strip optional Bengali marks (chandrabindu, anusvara, visarga) for fuzzy match + lowercase */
      return (text || '').normalize('NFC').replace(/[\u0981\u0982\u0983]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    searchInput.addEventListener('input', function () {
      var query = normalizeBengali(searchInput.value);
      var topicCards = document.querySelectorAll('.debate-topic-card');
      topicCards.forEach(function (card) {
        var title = normalizeBengali((card.querySelector('.debate-topic-card-title') || {}).textContent);
        var description = normalizeBengali((card.querySelector('.debate-topic-card-description') || {}).textContent);
        /* Each word in query must match somewhere (title OR description) */
        var combined = title + ' ' + description;
        var queryWords = query.split(' ').filter(function (word) { return word.length > 0; });
        var match = queryWords.length === 0 || queryWords.every(function (word) { return combined.indexOf(word) !== -1; });
        card.style.display = match ? '' : 'none';
      });
    });
  }

  var createButton = document.getElementById('debate-home-create-button');
  if (!createButton) return;

  var formVisible = false;

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  createButton.addEventListener('click', function () {
    if (formVisible) return;
    formVisible = true;
    createButton.style.display = 'none';

    /* Build inline form */
    var formContainer = document.createElement('div');
    formContainer.className = 'debate-home-create-form';
    formContainer.id = 'debate-home-create-form';

    var titleLabel = document.createElement('label');
    titleLabel.setAttribute('for', 'debate-home-create-title-input');
    titleLabel.className = 'debate-home-create-label';
    titleLabel.textContent = 'বিতর্কের বিষয়';

    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'debate-home-create-input';
    titleInput.id = 'debate-home-create-title-input';
    titleInput.name = 'debate_home_create_title_input';
    titleInput.placeholder = 'কমপক্ষে ১০ অক্ষর লিখুন';

    var timeLabel = document.createElement('label');
    timeLabel.setAttribute('for', 'debate-home-create-time-input');
    timeLabel.className = 'debate-home-create-label';
    timeLabel.textContent = 'সময়সূচী (Scheduled Date)';

    var timeInput = document.createElement('input');
    timeInput.type = 'datetime-local';
    timeInput.className = 'debate-home-create-input';
    timeInput.id = 'debate-home-create-time-input';
    timeInput.name = 'debate_home_create_time_input';

    var descriptionLabel = document.createElement('label');
    descriptionLabel.setAttribute('for', 'debate-home-create-description-textarea');
    descriptionLabel.className = 'debate-home-create-label';
    descriptionLabel.textContent = 'বিস্তারিত বিবরণ (ঐচ্ছিক)';

    var descriptionTextarea = document.createElement('textarea');
    descriptionTextarea.className = 'debate-home-create-textarea';
    descriptionTextarea.id = 'debate-home-create-description-textarea';
    descriptionTextarea.name = 'debate_home_create_description_textarea';
    descriptionTextarea.placeholder = 'বিষয়ের পটভূমি ও প্রসঙ্গ লিখুন...';
    descriptionTextarea.rows = 6;

    var blueSideLabelLabel = document.createElement('label');
    blueSideLabelLabel.setAttribute('for', 'debate-home-create-blue-side-label-input');
    blueSideLabelLabel.className = 'debate-home-create-label';
    blueSideLabelLabel.textContent = '🔵 পক্ষের নাম (ঐচ্ছিক)';

    var blueSideLabelInput = document.createElement('input');
    blueSideLabelInput.type = 'text';
    blueSideLabelInput.className = 'debate-home-create-input';
    blueSideLabelInput.id = 'debate-home-create-blue-side-label-input';
    blueSideLabelInput.name = 'debate_home_create_blue_side_label_input';
    blueSideLabelInput.placeholder = 'যেমন: পার্থ সাহেবের পক্ষে, সংবিধান রক্ষার পক্ষে';

    var redSideLabelLabel = document.createElement('label');
    redSideLabelLabel.setAttribute('for', 'debate-home-create-red-side-label-input');
    redSideLabelLabel.className = 'debate-home-create-label';
    redSideLabelLabel.textContent = '🔴 বিপক্ষের নাম (ঐচ্ছিক)';

    var redSideLabelInput = document.createElement('input');
    redSideLabelInput.type = 'text';
    redSideLabelInput.className = 'debate-home-create-input';
    redSideLabelInput.id = 'debate-home-create-red-side-label-input';
    redSideLabelInput.name = 'debate_home_create_red_side_label_input';
    redSideLabelInput.placeholder = 'যেমন: পার্থ সাহেবের বিপক্ষে, সংবিধান পরিবর্তনের পক্ষে';

    var buttonRow = document.createElement('div');
    buttonRow.className = 'debate-home-create-button-row';

    var submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.className = 'debate-home-create-submit-button';
    submitButton.id = 'debate-home-create-submit-button';
    submitButton.name = 'debate_home_create_submit_button';
    submitButton.textContent = 'তৈরি করুন';

    var cancelButton = document.createElement('button');
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
    formContainer.appendChild(timeLabel);
    formContainer.appendChild(timeInput);
    formContainer.appendChild(buttonRow);

    createButton.parentElement.appendChild(formContainer);
    titleInput.focus();

    /* Cancel */
    cancelButton.addEventListener('click', function () {
      formContainer.remove();
      createButton.style.display = '';
      formVisible = false;
    });

    /* Submit */
    submitButton.addEventListener('click', function () {
      var topicTitle = titleInput.value.trim();
      var scheduledTime = timeInput.value;
      var topicDescription = descriptionTextarea.value.trim() || null;
      var blueSideLabel = blueSideLabelInput.value.trim() || null;
      var redSideLabel = redSideLabelInput.value.trim() || null;

      if (!topicTitle || topicTitle.length < 10) {
        titleInput.style.borderColor = '#dc2626';
        return;
      }
      if (!scheduledTime) {
        timeInput.style.borderColor = '#dc2626';
        return;
      }

      submitButton.disabled = true;

      fetch('/debate/api/topic/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({
          topic_title: topicTitle,
          topic_description: topicDescription,
          blue_side_label: blueSideLabel,
          red_side_label: redSideLabel,
          scheduled_start_at: scheduledTime,
        }),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          window.location.href = '/debate/topic/' + data.debate_coll_topic_id + '/';
        } else {
          var errorElement = formContainer.querySelector('.debate-arena-inline-message');
          if (errorElement) errorElement.remove();
          var errorMessage = document.createElement('div');
          errorMessage.className = 'debate-arena-inline-message debate-arena-inline-message-error';
          errorMessage.textContent = data.error;
          formContainer.appendChild(errorMessage);
          submitButton.disabled = false;
        }
      })
      .catch(function () {
        submitButton.disabled = false;
      });
    });
  });
})();

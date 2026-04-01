/* debate-home.js — Create topic inline form (staff only). No popups. */
(function () {
  'use strict';

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

    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'debate-home-create-input';
    titleInput.id = 'debate-home-create-title-input';
    titleInput.name = 'debate_home_create_title_input';
    titleInput.placeholder = 'বিতর্কের বিষয় লিখুন (কমপক্ষে ১০ অক্ষর)';

    var timeInput = document.createElement('input');
    timeInput.type = 'datetime-local';
    timeInput.className = 'debate-home-create-input';
    timeInput.id = 'debate-home-create-time-input';
    timeInput.name = 'debate_home_create_time_input';

    var descriptionTextarea = document.createElement('textarea');
    descriptionTextarea.className = 'debate-home-create-textarea';
    descriptionTextarea.id = 'debate-home-create-description-textarea';
    descriptionTextarea.name = 'debate_home_create_description_textarea';
    descriptionTextarea.placeholder = 'বিস্তারিত বিবরণ (ঐচ্ছিক)';
    descriptionTextarea.rows = 2;

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

    formContainer.appendChild(titleInput);
    formContainer.appendChild(timeInput);
    formContainer.appendChild(descriptionTextarea);
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

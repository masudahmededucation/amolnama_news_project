/**
 * biography-add.js — Campus entry create form submission.
 */
(function () {
  'use strict';

  var form = document.getElementById('biography-add-form');
  var submitButton = document.getElementById('biography-add-submit-button');
  var messageElement = document.getElementById('biography-add-message');

  if (!form || !submitButton) return;

  function showMessage(text, isError) {
    messageElement.textContent = text;
    messageElement.className = 'biography-add-message ' +
      (isError ? 'biography-add-message--error' : 'biography-add-message--success');
    messageElement.hidden = false;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    messageElement.hidden = true;

    var titleInput = document.getElementById('biography-add-title-bn');
    var titleValue = (titleInput.value || '').trim();
    if (!titleValue) {
      showMessage('শিরোনাম আবশ্যক', true);
      titleInput.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'প্রকাশ হচ্ছে...';

    var payload = {
      biography_entry_title_bn: titleValue,
      link_content_ref_content_subcategory_id: document.getElementById('biography-add-category').value || null,
      institution_name_bn: (document.getElementById('biography-add-institution-name-bn').value || '').trim() || null,
      institution_type_code: document.getElementById('biography-add-institution-type').value || null,
      institution_location_bn: (document.getElementById('biography-add-institution-location').value || '').trim() || null,
      biography_entry_short_description_bn: (document.getElementById('biography-add-short-description').value || '').trim() || null,
      biography_entry_description_bn: (document.getElementById('biography-add-description').value || '').trim() || null,
    };

    fetch('/jibonkotha/api/create/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfTokenValue()
      },
      body: JSON.stringify(payload)
    })
    .then(function (response) {
      if (!response.ok) throw new Error('Server error: ' + response.status);
      return response.json();
    })
    .then(function (data) {
      if (data.success) {
        showMessage('সফলভাবে প্রকাশিত হয়েছে! পুনঃনির্দেশ হচ্ছে...', false);
        setTimeout(function () {
          window.location.href = '/jibonkotha/' + data.biography_entry_slug + '/';
        }, 1000);
      } else {
        showMessage(data.error || 'সমস্যা হয়েছে', true);
        submitButton.disabled = false;
        submitButton.textContent = 'প্রকাশ করুন (Publish)';
      }
    })
    .catch(function (error) {
      console.error('Biography entry create failed:', error);
      showMessage('নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন', true);
      submitButton.disabled = false;
      submitButton.textContent = 'প্রকাশ করুন (Publish)';
    });
  });
})();

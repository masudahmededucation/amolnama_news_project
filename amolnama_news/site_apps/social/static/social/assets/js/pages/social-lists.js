/* social-lists.js — create a new user list via POST /social/api/list/create/ */
(function () {
  'use strict';

  var createInput = document.getElementById('social-lists-create-input');
  var createButton = document.getElementById('social-lists-create-button');
  if (!createInput || !createButton) return;

  function getSocialListsCsrfTokenValue() {
    var match = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return match ? match.pop() : '';
  }

  function showSocialListsCreateError(message) {
    var existing = document.getElementById('social-lists-create-error');
    if (existing) existing.remove();
    var errorBox = document.createElement('div');
    errorBox.id = 'social-lists-create-error';
    errorBox.className = 'social-lists-create-error';
    errorBox.textContent = message;
    createInput.parentNode.insertAdjacentElement('afterend', errorBox);
  }

  createButton.addEventListener('click', function () {
    var listName = createInput.value.trim();
    if (!listName) {
      showSocialListsCreateError('তালিকার নাম লিখুন');
      return;
    }
    createButton.disabled = true;
    fetch('/social/api/list/create/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getSocialListsCsrfTokenValue() },
      body: JSON.stringify({ list_name: listName }),
    })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (data) {
      if (data.success) {
        window.location.reload();
        return;
      }
      createButton.disabled = false;
      showSocialListsCreateError(data.error || 'তালিকা তৈরি করা যায়নি');
    })
    .catch(function (socialListsCreateError) {
      console.error('Social list create failed:', socialListsCreateError);
      createButton.disabled = false;
      showSocialListsCreateError('নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন');
    });
  });

  createInput.addEventListener('keydown', function (keyEvent) {
    if (keyEvent.key === 'Enter') {
      keyEvent.preventDefault();
      createButton.click();
    }
  });
})();

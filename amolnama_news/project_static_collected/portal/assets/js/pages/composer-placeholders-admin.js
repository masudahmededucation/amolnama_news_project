/* composer-placeholders-admin.js — staff UI to add/toggle/feature/delete composer placeholders */
(function () {
  'use strict';

  const addInput = document.getElementById('placeholder-add-input');
  const addCategory = document.getElementById('placeholder-add-category');
  const addButton = document.getElementById('placeholder-add-button');
  const messageContainer = document.getElementById('placeholder-admin-message');
  const placeholderList = document.getElementById('placeholder-list');
  if (!addInput || !addCategory || !addButton || !messageContainer || !placeholderList) return;

  function escapeHtmlValue(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }

  function getCsrfTokenValueLocal() {
    if (typeof getCsrfTokenValue === 'function') {
      return getCsrfTokenValue();
    }
    const cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  function showMessage(text, isError) {
    messageContainer.innerHTML = '<div class="placeholder-inline-message ' + (isError ? 'placeholder-inline-message-error' : 'placeholder-inline-message-success') + '">' + escapeHtmlValue(text) + '</div>';
    setTimeout(function () { messageContainer.innerHTML = ''; }, 3000);
  }

  /* Add placeholder */
  addButton.addEventListener('click', function () {
    const text = addInput.value.trim();
    if (!text) return;
    fetch('/portal/api/placeholders/add/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValueLocal() },
      body: JSON.stringify({ placeholder_text: text, placeholder_category_code: addCategory.value }),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) { addInput.value = ''; location.reload(); }
        else showMessage(data.error || 'যোগ করা যায়নি', true);
      })
      .catch(function () { showMessage('নেটওয়ার্ক ত্রুটি', true); });
  });

  /* Toggle switches (feature + active) — delegated change event */
  placeholderList.addEventListener('change', function (event) {
    const toggleInput = event.target.closest('.placeholder-toggle-input');
    if (!toggleInput) return;
    const placeholderItem = toggleInput.closest('.placeholder-item');
    if (!placeholderItem) return;
    const placeholderId = parseInt(placeholderItem.getAttribute('data-id'), 10);
    const action = toggleInput.getAttribute('data-action');

    if (action === 'toggle') {
      fetch('/portal/api/placeholders/toggle/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValueLocal() },
        body: JSON.stringify({ placeholder_id: placeholderId }),
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            placeholderItem.classList.toggle('placeholder-item-inactive', !data.is_active);
            toggleInput.checked = data.is_active;
          } else {
            toggleInput.checked = !toggleInput.checked;
            showMessage(data.error || 'পরিবর্তন করা যায়নি', true);
          }
        })
        .catch(function () { toggleInput.checked = !toggleInput.checked; showMessage('নেটওয়ার্ক ত্রুটি', true); });
    }

    if (action === 'feature') {
      fetch('/portal/api/placeholders/feature/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValueLocal() },
        body: JSON.stringify({ placeholder_id: placeholderId, is_featured: toggleInput.checked, duration_minutes: 30 }),
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            placeholderItem.classList.toggle('placeholder-item-featured', data.is_featured);
            toggleInput.checked = data.is_featured;
            showMessage(data.is_featured ? '৩০ মিনিটের জন্য ফিচার করা হয়েছে' : 'ফিচার বন্ধ করা হয়েছে', false);
          } else {
            toggleInput.checked = !toggleInput.checked;
            showMessage(data.error || 'ফিচার করা যায়নি', true);
          }
        })
        .catch(function () { toggleInput.checked = !toggleInput.checked; showMessage('নেটওয়ার্ক ত্রুটি', true); });
    }
  });

  /* Delete button — delegated click event */
  placeholderList.addEventListener('click', function (event) {
    const deleteButton = event.target.closest('.placeholder-delete-button');
    if (!deleteButton) return;
    const placeholderItem = deleteButton.closest('.placeholder-item');
    if (!placeholderItem) return;
    const placeholderId = parseInt(placeholderItem.getAttribute('data-id'), 10);

    fetch('/portal/api/placeholders/delete/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValueLocal() },
      body: JSON.stringify({ placeholder_id: placeholderId }),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) placeholderItem.remove();
        else showMessage(data.error || 'মুছা যায়নি', true);
      })
      .catch(function () { showMessage('নেটওয়ার্ক ত্রুটি', true); });
  });
})();

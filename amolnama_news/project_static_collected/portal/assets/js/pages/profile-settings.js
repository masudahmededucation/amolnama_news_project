/* profile-settings.js — muted words add/remove UI for profile settings page */
(function () {
  'use strict';
  const mutedWordInput = document.getElementById('muted-words-input');
  const mutedWordAddButton = document.getElementById('muted-words-add-button');
  const mutedWordListContainer = document.getElementById('muted-words-list');
  if (!mutedWordInput || !mutedWordAddButton || !mutedWordListContainer) return;

  function getMutedWordCsrfToken() {
    const match = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return match ? match.pop() : '';
  }

  function renderMutedWords(words) {
    mutedWordListContainer.innerHTML = '';
    words.forEach(function (word) {
      const tag = document.createElement('span');
      tag.className = 'muted-words-tag';

      const textNode = document.createTextNode(word + ' ');
      tag.appendChild(textNode);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'muted-words-tag-remove-button';
      removeButton.setAttribute('data-muted-word', word);
      removeButton.textContent = '\u2715';
      tag.appendChild(removeButton);

      mutedWordListContainer.appendChild(tag);
    });
  }

  function loadMutedWords() {
    fetch('/newsengine/api/muted-words/')
      .then(function (response) { return response.json(); })
      .then(function (data) { if (data.success) renderMutedWords(data.muted_words); })
      .catch(function () { /* network failure — leave list empty */ });
  }

  mutedWordAddButton.addEventListener('click', function () {
    const word = mutedWordInput.value.trim();
    if (!word) return;
    fetch('/newsengine/api/muted-words/add/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getMutedWordCsrfToken() },
      body: JSON.stringify({ muted_word: word }),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) { mutedWordInput.value = ''; loadMutedWords(); }
      })
      .catch(function () { /* network failure — ignore */ });
  });

  mutedWordListContainer.addEventListener('click', function (event) {
    const removeButton = event.target.closest('[data-muted-word]');
    if (!removeButton) return;
    fetch('/newsengine/api/muted-words/remove/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getMutedWordCsrfToken() },
      body: JSON.stringify({ muted_word: removeButton.getAttribute('data-muted-word') }),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) { if (data.success) loadMutedWords(); })
      .catch(function () { /* network failure — ignore */ });
  });

  mutedWordInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') { event.preventDefault(); mutedWordAddButton.click(); }
  });

  loadMutedWords();
})();

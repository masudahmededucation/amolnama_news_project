/**
 * biography-home.js — Biography landing page interactions.
 *
 * Features:
 *   - Category filter pills (client-side filtering)
 *   - Quick-add cards (person search + quote/YouTube submission)
 */
(function () {
  'use strict';

  /* ── Category filter pills ── */
  var filterPillsContainer = document.getElementById('biography-filter-pills');
  var entryGrid = document.getElementById('biography-entry-grid');

  if (filterPillsContainer && entryGrid) {
    filterPillsContainer.addEventListener('click', function (event) {
      var pill = event.target.closest('.biography-filter-pill');
      if (!pill) return;

      var allPills = filterPillsContainer.querySelectorAll('.biography-filter-pill');
      for (var pillIndex = 0; pillIndex < allPills.length; pillIndex++) {
        allPills[pillIndex].classList.remove('biography-filter-pill--active');
      }
      pill.classList.add('biography-filter-pill--active');

      var selectedCategory = pill.getAttribute('data-category');
      var allCards = entryGrid.querySelectorAll('.biography-entry-card');
      var visibleCount = 0;

      for (var cardIndex = 0; cardIndex < allCards.length; cardIndex++) {
        var card = allCards[cardIndex];
        var cardCategory = card.getAttribute('data-category');
        var isMatch = !selectedCategory || cardCategory === selectedCategory;
        card.hidden = !isMatch;
        if (isMatch) visibleCount++;
      }

      var emptyState = entryGrid.querySelector('.biography-empty-state');
      if (emptyState) {
        emptyState.hidden = visibleCount > 0;
      }
    });
  }

  /* ── Quick-add cards toggle ── */
  var quickAddCards = document.querySelectorAll('.biography-quick-add-card');
  for (var cardIndex = 0; cardIndex < quickAddCards.length; cardIndex++) {
    (function (card) {
      var form = card.querySelector('.biography-quick-add-card-form');
      if (!form) return;

      card.addEventListener('click', function (event) {
        if (event.target.closest('.biography-quick-add-card-form')) return;
        form.hidden = !form.hidden;
      });
    })(quickAddCards[cardIndex]);
  }

  /* ── Person search (debounced) ── */
  var personSearchTimer = null;

  function setupPersonSearch(inputElement, hiddenIdElement) {
    if (!inputElement) return;

    var dropdownElement = document.createElement('div');
    dropdownElement.className = 'biography-quick-add-person-dropdown';
    dropdownElement.hidden = true;
    inputElement.parentNode.style.position = 'relative';
    inputElement.parentNode.appendChild(dropdownElement);

    inputElement.addEventListener('input', function () {
      var query = inputElement.value.trim();
      if (personSearchTimer) clearTimeout(personSearchTimer);
      if (query.length < 1) {
        dropdownElement.hidden = true;
        return;
      }

      personSearchTimer = setTimeout(function () {
        fetch('/jibonkotha/api/persons/search/?q=' + encodeURIComponent(query))
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (!data.success || !data.persons.length) {
              dropdownElement.hidden = true;
              return;
            }
            dropdownElement.innerHTML = '';
            data.persons.forEach(function (person) {
              var option = document.createElement('button');
              option.type = 'button';
              option.className = 'biography-quick-add-person-option';
              option.innerHTML = '<span class="biography-quick-add-person-option-name">' +
                (person.person_name_bn || '') + '</span>' +
                (person.person_name_en ? ' <span class="biography-quick-add-person-option-info">(' + person.person_name_en + ')</span>' : '') +
                (person.person_occupation_bn ? '<br><span class="biography-quick-add-person-option-info">' + person.person_occupation_bn + '</span>' : '');
              option.addEventListener('click', function () {
                inputElement.value = person.person_name_bn + (person.person_name_en ? ' (' + person.person_name_en + ')' : '');
                hiddenIdElement.value = person.person_id;
                dropdownElement.hidden = true;
              });
              dropdownElement.appendChild(option);
            });
            dropdownElement.hidden = false;
          })
          .catch(function (error) {
            console.error('Person search failed:', error);
          });
      }, 300);
    });

    document.addEventListener('click', function (event) {
      if (!inputElement.contains(event.target) && !dropdownElement.contains(event.target)) {
        dropdownElement.hidden = true;
      }
    });
  }

  setupPersonSearch(
    document.getElementById('biography-quick-add-quote-person'),
    document.getElementById('biography-quick-add-quote-person-id')
  );
  setupPersonSearch(
    document.getElementById('biography-quick-add-photo-person'),
    document.getElementById('biography-quick-add-photo-person-id')
  );
  setupPersonSearch(
    document.getElementById('biography-quick-add-youtube-person'),
    document.getElementById('biography-quick-add-youtube-person-id')
  );

  /* ── Quote quick-add submit ── */
  var quoteSubmitButton = document.getElementById('biography-quick-add-quote-submit');
  if (quoteSubmitButton) {
    quoteSubmitButton.addEventListener('click', function () {
      var messageElement = document.getElementById('biography-quick-add-quote-message');
      var personId = document.getElementById('biography-quick-add-quote-person-id').value;
      var titleBn = (document.getElementById('biography-quick-add-quote-title').value || '').trim();
      var textBn = (document.getElementById('biography-quick-add-quote-text').value || '').trim();
      var explanationBn = (document.getElementById('biography-quick-add-quote-explanation').value || '').trim();

      if (!personId || !titleBn || !textBn) {
        messageElement.textContent = 'ব্যক্তি, শিরোনাম ও উক্তি আবশ্যক';
        messageElement.className = 'biography-quick-add-message biography-quick-add-message--error';
        messageElement.hidden = false;
        return;
      }

      quoteSubmitButton.disabled = true;
      fetch('/jibonkotha/api/quick-add/quote/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({
          person_id: parseInt(personId, 10),
          quote_title_bn: titleBn,
          quote_text_bn: textBn,
          quote_explanation_bn: explanationBn || null,
        })
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          messageElement.textContent = 'উক্তি সফলভাবে যোগ হয়েছে!';
          messageElement.className = 'biography-quick-add-message biography-quick-add-message--success';
          messageElement.hidden = false;
          document.getElementById('biography-quick-add-quote-title').value = '';
          document.getElementById('biography-quick-add-quote-text').value = '';
          document.getElementById('biography-quick-add-quote-explanation').value = '';
        } else {
          messageElement.textContent = data.error || 'সমস্যা হয়েছে';
          messageElement.className = 'biography-quick-add-message biography-quick-add-message--error';
          messageElement.hidden = false;
        }
        quoteSubmitButton.disabled = false;
      })
      .catch(function (error) {
        console.error('Quote quick-add failed:', error);
        messageElement.textContent = 'নেটওয়ার্ক সমস্যা';
        messageElement.className = 'biography-quick-add-message biography-quick-add-message--error';
        messageElement.hidden = false;
        quoteSubmitButton.disabled = false;
      });
    });
  }

  /* ── YouTube quick-add submit ── */
  var youtubeSubmitButton = document.getElementById('biography-quick-add-youtube-submit');
  if (youtubeSubmitButton) {
    youtubeSubmitButton.addEventListener('click', function () {
      var messageElement = document.getElementById('biography-quick-add-youtube-message');
      var personId = document.getElementById('biography-quick-add-youtube-person-id').value;
      var youtubeUrl = (document.getElementById('biography-quick-add-youtube-url').value || '').trim();
      var videoTitleBn = (document.getElementById('biography-quick-add-youtube-title').value || '').trim();

      if (!personId || !youtubeUrl) {
        messageElement.textContent = 'ব্যক্তি ও ভিডিও URL আবশ্যক';
        messageElement.className = 'biography-quick-add-message biography-quick-add-message--error';
        messageElement.hidden = false;
        return;
      }

      youtubeSubmitButton.disabled = true;
      fetch('/jibonkotha/api/quick-add/youtube/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({
          person_id: parseInt(personId, 10),
          youtube_url: youtubeUrl,
          video_title_bn: videoTitleBn || null,
        })
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          messageElement.textContent = 'ভিডিও সফলভাবে যোগ হয়েছে!';
          messageElement.className = 'biography-quick-add-message biography-quick-add-message--success';
          messageElement.hidden = false;
          document.getElementById('biography-quick-add-youtube-url').value = '';
          document.getElementById('biography-quick-add-youtube-title').value = '';
        } else {
          messageElement.textContent = data.error || 'সমস্যা হয়েছে';
          messageElement.className = 'biography-quick-add-message biography-quick-add-message--error';
          messageElement.hidden = false;
        }
        youtubeSubmitButton.disabled = false;
      })
      .catch(function (error) {
        console.error('YouTube quick-add failed:', error);
        messageElement.textContent = 'নেটওয়ার্ক সমস্যা';
        messageElement.className = 'biography-quick-add-message biography-quick-add-message--error';
        messageElement.hidden = false;
        youtubeSubmitButton.disabled = false;
      });
    });
  }

  /* ── Photo quick-add ── */
  var photoBrowseButton = document.getElementById('biography-quick-add-photo-browse-button');
  var photoFileInput = document.getElementById('biography-quick-add-photo-file');
  var photoPreview = document.getElementById('biography-quick-add-photo-preview');
  var photoSubmitButton = document.getElementById('biography-quick-add-photo-submit');

  if (photoBrowseButton && photoFileInput) {
    photoBrowseButton.addEventListener('click', function () {
      photoFileInput.click();
    });

    photoFileInput.addEventListener('change', function () {
      if (!photoFileInput.files.length) return;
      var file = photoFileInput.files[0];
      var reader = new FileReader();
      reader.onload = function (event) {
        photoPreview.innerHTML = '<img src="' + event.target.result + '" style="max-width:100%;max-height:150px;border-radius:8px;">';
        photoPreview.hidden = false;
      };
      reader.readAsDataURL(file);
    });
  }

  if (photoSubmitButton) {
    photoSubmitButton.addEventListener('click', function () {
      var messageElement = document.getElementById('biography-quick-add-photo-message');
      var personId = document.getElementById('biography-quick-add-photo-person-id').value;

      if (!personId || !photoFileInput.files.length) {
        messageElement.textContent = 'ব্যক্তি ও ছবি আবশ্যক';
        messageElement.className = 'biography-quick-add-message biography-quick-add-message--error';
        messageElement.hidden = false;
        return;
      }

      photoSubmitButton.disabled = true;
      var formData = new FormData();
      formData.append('person_id', personId);
      formData.append('photo_file', photoFileInput.files[0]);
      formData.append('caption_bn', (document.getElementById('biography-quick-add-photo-caption').value || '').trim());
      formData.append('photo_era_label_bn', (document.getElementById('biography-quick-add-photo-era-label').value || '').trim());

      fetch('/jibonkotha/api/quick-add/photo/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
        body: formData
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          messageElement.textContent = 'ছবি সফলভাবে যোগ হয়েছে!';
          messageElement.className = 'biography-quick-add-message biography-quick-add-message--success';
          messageElement.hidden = false;
          photoFileInput.value = '';
          photoPreview.hidden = true;
          document.getElementById('biography-quick-add-photo-caption').value = '';
          document.getElementById('biography-quick-add-photo-era-label').value = '';
        } else {
          messageElement.textContent = data.error || 'সমস্যা হয়েছে';
          messageElement.className = 'biography-quick-add-message biography-quick-add-message--error';
          messageElement.hidden = false;
        }
        photoSubmitButton.disabled = false;
      })
      .catch(function (error) {
        console.error('Photo quick-add failed:', error);
        messageElement.textContent = 'নেটওয়ার্ক সমস্যা';
        messageElement.className = 'biography-quick-add-message biography-quick-add-message--error';
        messageElement.hidden = false;
        photoSubmitButton.disabled = false;
      });
    });
  }
})();

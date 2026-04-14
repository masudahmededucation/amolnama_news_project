/**
 * probashbarta-add.js — Probash entry create form submission + country dropdown.
 */
(function () {
  'use strict';

  var form = document.getElementById('probashbarta-add-form');
  var submitButton = document.getElementById('probashbarta-add-submit-button');
  var messageElement = document.getElementById('probashbarta-add-message');
  var countrySelect = document.getElementById('probashbarta-add-country');

  if (!form || !submitButton) return;

  /* ── Load countries from DB ── */
  if (countrySelect) {
    fetch('/probash-barta/api/countries/')
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success && data.countries) {
          data.countries.forEach(function (country) {
            var option = document.createElement('option');
            option.value = country.country_iso_code;
            option.textContent = country.country_name_bn
              ? country.country_name_bn + ' (' + country.country_name_en + ')'
              : country.country_name_en;
            option.setAttribute('data-country-name-bn', country.country_name_bn || '');
            option.setAttribute('data-country-name-en', country.country_name_en || '');
            countrySelect.appendChild(option);
          });
        }
      })
      .catch(function (error) {
        console.error('Failed to load countries:', error);
      });
  }

  function showMessage(text, isError) {
    messageElement.textContent = text;
    messageElement.className = 'probashbarta-add-message ' +
      (isError ? 'probashbarta-add-message--error' : 'probashbarta-add-message--success');
    messageElement.hidden = false;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    messageElement.hidden = true;

    var titleInput = document.getElementById('probashbarta-add-title-bn');
    var titleValue = (titleInput.value || '').trim();
    if (!titleValue) {
      showMessage('শিরোনাম আবশ্যক', true);
      titleInput.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'প্রকাশ হচ্ছে...';

    /* Get selected country details */
    var selectedCountryOption = countrySelect ? countrySelect.options[countrySelect.selectedIndex] : null;
    var countryCode = countrySelect ? countrySelect.value : null;
    var countryNameBn = selectedCountryOption ? selectedCountryOption.getAttribute('data-country-name-bn') : null;
    var countryNameEn = selectedCountryOption ? selectedCountryOption.getAttribute('data-country-name-en') : null;

    var payload = {
      probash_entry_title_bn: titleValue,
      link_content_ref_content_subcategory_id: document.getElementById('probashbarta-add-topic').value || null,
      probash_region_code: document.getElementById('probashbarta-add-region').value || null,
      probash_country_code: countryCode || null,
      probash_country_name_bn: countryNameBn || null,
      probash_country_name_en: countryNameEn || null,
      probash_city_name_bn: (document.getElementById('probashbarta-add-city').value || '').trim() || null,
      probash_entry_short_description_bn: (document.getElementById('probashbarta-add-short-description').value || '').trim() || null,
      probash_entry_description_bn: (document.getElementById('probashbarta-add-description').value || '').trim() || null,
    };

    fetch('/probash-barta/api/create/', {
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
          window.location.href = '/probash-barta/' + data.probash_entry_slug + '/';
        }, 1000);
      } else {
        showMessage(data.error || 'সমস্যা হয়েছে', true);
        submitButton.disabled = false;
        submitButton.textContent = 'প্রকাশ করুন (Publish)';
      }
    })
    .catch(function (error) {
      console.error('Probash entry create failed:', error);
      showMessage('নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন', true);
      submitButton.disabled = false;
      submitButton.textContent = 'প্রকাশ করুন (Publish)';
    });
  });
})();

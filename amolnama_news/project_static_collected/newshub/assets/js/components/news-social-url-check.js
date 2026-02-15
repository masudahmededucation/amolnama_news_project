/**
 * news-social-url-check.js
 * Checks if the social URL matches the selected platform type.
 * - Auto-selects platform when URL is pasted and no platform chosen yet.
 * - Warns if URL doesn't match the selected platform.
 */
(function () {
  var platformSelect = document.getElementById('social-platform-type');
  var urlInput = document.getElementById('social-source-url');
  if (!platformSelect || !urlInput) return;

  var urlField = urlInput.closest('.form-field');
  var warningEl = document.createElement('div');
  warningEl.className = 'social-url-mismatch';
  warningEl.style.display = 'none';
  urlField.appendChild(warningEl);

  /**
   * Extract hostname from a URL string. Returns lowercase or ''.
   */
  function getHost(url) {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  /**
   * Extract hostname from a platform's base_url data attribute.
   */
  function getPlatformHost(option) {
    var base = option.getAttribute('data-base-url');
    if (!base) return '';
    /* Add protocol if missing so URL constructor works */
    if (base.indexOf('://') === -1) base = 'https://' + base;
    return getHost(base);
  }

  /**
   * Find the platform option whose base_url matches the given URL host.
   * Returns the option element or null.
   */
  function detectPlatform(urlHost) {
    if (!urlHost) return null;
    var options = platformSelect.querySelectorAll('option[data-base-url]');
    for (var i = 0; i < options.length; i++) {
      var pHost = getPlatformHost(options[i]);
      if (pHost && urlHost.indexOf(pHost) !== -1) return options[i];
    }
    return null;
  }

  function check() {
    var url = urlInput.value.trim();
    if (!url) {
      warningEl.style.display = 'none';
      return;
    }

    var urlHost = getHost(url);
    if (!urlHost) {
      warningEl.style.display = 'none';
      return;
    }

    var selectedOption = platformSelect.options[platformSelect.selectedIndex];

    /* Auto-select platform if none chosen */
    if (!platformSelect.value) {
      var match = detectPlatform(urlHost);
      if (match) {
        platformSelect.value = match.value;
        platformSelect.dispatchEvent(new Event('change'));
      }
      warningEl.style.display = 'none';
      return;
    }

    /* Check if URL matches selected platform */
    var platformHost = getPlatformHost(selectedOption);
    if (platformHost && urlHost.indexOf(platformHost) === -1) {
      var detected = detectPlatform(urlHost);
      var hint = detected ? detected.textContent.trim() : urlHost;
      warningEl.textContent = 'লিঙ্কটি ' + selectedOption.textContent.trim()
        + ' এর নয়, মনে হচ্ছে ' + hint + ' (URL doesn\'t match ' + selectedOption.textContent.trim() + ')';
      warningEl.style.display = 'block';
    } else {
      warningEl.style.display = 'none';
    }
  }

  urlInput.addEventListener('input', check);
  urlInput.addEventListener('change', check);
  platformSelect.addEventListener('change', check);
})();

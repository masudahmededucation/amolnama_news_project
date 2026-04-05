/* tools-promo-card-share.js — share toggle + copy link for tools promo cards in the feed */
(function () {
  'use strict';

  /* Toggle share dropdown */
  document.addEventListener('click', function (event) {
    const shareToggle = event.target.closest('.tools-promo-card-share-toggle');
    if (shareToggle) {
      event.stopPropagation();
      const wrapper = shareToggle.closest('.tools-promo-card-share-wrapper');
      const dropdown = wrapper.querySelector('.tools-promo-card-share-dropdown');
      /* Close all other open dropdowns first */
      const allDropdowns = document.querySelectorAll('.tools-promo-card-share-dropdown-open');
      allDropdowns.forEach(function (openDropdown) {
        if (openDropdown !== dropdown) openDropdown.classList.remove('tools-promo-card-share-dropdown-open');
      });
      dropdown.classList.toggle('tools-promo-card-share-dropdown-open');
      return;
    }

    /* Copy Link */
    const copyLinkButton = event.target.closest('.tools-promo-card-share-copy-link');
    if (copyLinkButton) {
      const toolUrl = window.location.origin + copyLinkButton.getAttribute('data-url');
      navigator.clipboard.writeText(toolUrl).then(function () {
        const originalHtml = copyLinkButton.innerHTML;
        copyLinkButton.textContent = '✓ Copied!';
        setTimeout(function () { copyLinkButton.innerHTML = originalHtml; }, 2000);
      });
      const parentDropdown = copyLinkButton.closest('.tools-promo-card-share-dropdown');
      if (parentDropdown) parentDropdown.classList.remove('tools-promo-card-share-dropdown-open');
      return;
    }

    /* Close all dropdowns on outside click */
    const allOpenDropdowns = document.querySelectorAll('.tools-promo-card-share-dropdown-open');
    allOpenDropdowns.forEach(function (openDropdown) {
      openDropdown.classList.remove('tools-promo-card-share-dropdown-open');
    });
  });
})();

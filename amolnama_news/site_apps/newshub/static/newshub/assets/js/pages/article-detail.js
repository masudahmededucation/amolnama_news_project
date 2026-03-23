/* article-detail.js — Article view page interactions */
(function () {
  "use strict";

  /* Share button */
  var shareButton = document.getElementById("article-share-btn");
  if (shareButton) {
    shareButton.addEventListener("click", function () {
      var articleTitle = shareButton.getAttribute("data-title") || "";
      var articleUrl = window.location.href;

      if (navigator.share) {
        navigator.share({ title: articleTitle, url: articleUrl });
      } else {
        navigator.clipboard.writeText(articleUrl).then(function () {
          alert("লিংক কপি হয়েছে!");
        });
      }
    });
  }
})();

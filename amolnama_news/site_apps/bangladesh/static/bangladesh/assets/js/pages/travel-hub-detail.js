/**
 * travel-hub-detail.js — Destination detail page interactions.
 * Photo upload, YouTube link add, reference link add.
 * All use inline messages (no popups).
 */
(function () {
  'use strict';

  /* ========== Share buttons ========== */
  var shareBtns = document.querySelectorAll('.travel-hub-detail-share-btn');
  for (var s = 0; s < shareBtns.length; s++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var title = btn.getAttribute('data-title') || '';
        var url = window.location.href;
        if (navigator.share) {
          navigator.share({ title: title, url: url });
        } else {
          navigator.clipboard.writeText(url).then(function () {
            showMsg(btn.parentNode, 'লিংক কপি হয়েছে!', false);
          });
        }
      });
    })(shareBtns[s]);
  }

  function getCsrf() {
    var m = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return m ? m.pop() : '';
  }

  function showMsg(parent, text, isError) {
    var old = parent.querySelector('.travel-hub-detail-inline-msg');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'travel-hub-detail-inline-msg ' + (isError ? 'travel-hub-detail-inline-msg-error' : 'travel-hub-detail-inline-msg-success');
    el.textContent = text;
    parent.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 5000);
  }

  /* ========== Photo Upload ========== */

  var photoBtn = document.getElementById('travel-hub-detail-photo-upload-btn');
  if (photoBtn) {
    photoBtn.addEventListener('click', function () {
      var fileInput = document.getElementById('travel-hub-detail-photo-file');
      var captionInput = document.getElementById('travel-hub-detail-photo-caption');
      var destId = photoBtn.getAttribute('data-dest-id');

      if (!fileInput.files.length) {
        showMsg(photoBtn.parentNode.parentNode, 'ছবি নির্বাচন করুন', true);
        return;
      }

      photoBtn.disabled = true;
      photoBtn.textContent = 'আপলোড হচ্ছে...';

      var fd = new FormData();
      fd.append('file', fileInput.files[0]);
      fd.append('caption_bn', (captionInput.value || '').trim());

      fetch('/bangladesh/api/destination/' + destId + '/photo/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrf() },
        body: fd,
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success) {
            /* Add photo to grid */
            var grid = document.querySelector('.travel-hub-detail-photo-grid');
            if (!grid) {
              grid = document.createElement('div');
              grid.className = 'travel-hub-detail-photo-grid';
              var empty = document.querySelector('#travel-hub-detail-photos-section .travel-hub-detail-empty');
              if (empty) empty.remove();
              document.getElementById('travel-hub-detail-photos-section').querySelector('h3').after(grid);
            }
            var thumb = document.createElement('div');
            thumb.className = 'travel-hub-detail-photo-thumb';
            thumb.style.backgroundImage = "url('" + data.photo_url + "')";
            if (data.caption_bn) {
              var cap = document.createElement('span');
              cap.className = 'travel-hub-detail-photo-caption';
              cap.textContent = data.caption_bn;
              thumb.appendChild(cap);
            }
            grid.appendChild(thumb);
            fileInput.value = '';
            captionInput.value = '';
            showMsg(photoBtn.parentNode.parentNode, 'ছবি আপলোড হয়েছে', false);
          } else {
            showMsg(photoBtn.parentNode.parentNode, data.error || 'আপলোড ব্যর্থ', true);
          }
          photoBtn.disabled = false;
          photoBtn.textContent = '📷 আপলোড';
        })
        .catch(function () {
          showMsg(photoBtn.parentNode.parentNode, 'নেটওয়ার্ক ত্রুটি', true);
          photoBtn.disabled = false;
          photoBtn.textContent = '📷 আপলোড';
        });
    });
  }

  /* ========== YouTube Link ========== */

  var ytBtn = document.getElementById('travel-hub-detail-youtube-add-btn');
  if (ytBtn) {
    ytBtn.addEventListener('click', function () {
      var urlInput = document.getElementById('travel-hub-detail-youtube-url');
      var titleInput = document.getElementById('travel-hub-detail-youtube-title');
      var descInput = document.getElementById('travel-hub-detail-youtube-desc');
      var destId = ytBtn.getAttribute('data-dest-id');

      var url = (urlInput.value || '').trim();
      if (!url) {
        showMsg(ytBtn.parentNode.parentNode, 'YouTube লিংক দিন', true);
        return;
      }

      ytBtn.disabled = true;
      ytBtn.textContent = 'যোগ হচ্ছে...';

      fetch('/bangladesh/api/destination/' + destId + '/youtube/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrf(),
        },
        body: JSON.stringify({
          youtube_url: url,
          video_title_bn: (titleInput.value || '').trim(),
          description_bn: (descInput.value || '').trim(),
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success) {
            /* Add YouTube card to grid */
            var list = document.getElementById('travel-hub-detail-youtube-list');
            var empty = list.querySelector('.travel-hub-detail-empty');
            if (empty) empty.remove();

            var card = document.createElement('div');
            card.className = 'travel-hub-detail-youtube-card';
            var html = '';
            if (data.youtube_video_id) {
              html += '<a href="' + url + '" target="_blank" rel="noopener" class="travel-hub-detail-youtube-thumb" style="background-image:url(\'https://i.ytimg.com/vi/' + data.youtube_video_id + '/mqdefault.jpg\');">';
              html += '<span class="travel-hub-detail-youtube-play">▶</span>';
              html += '</a>';
            }
            html += '<div class="travel-hub-detail-youtube-info">';
            if (data.video_title_bn) html += '<a href="' + url + '" target="_blank" rel="noopener" class="travel-hub-detail-youtube-title">' + data.video_title_bn + '</a>';
            html += '</div>';
            card.innerHTML = html;
            list.appendChild(card);

            urlInput.value = '';
            titleInput.value = '';
            descInput.value = '';
            showMsg(ytBtn.parentNode.parentNode, 'ভিডিও যোগ হয়েছে', false);
          } else {
            showMsg(ytBtn.parentNode.parentNode, data.error || 'যোগ করা ব্যর্থ', true);
          }
          ytBtn.disabled = false;
          ytBtn.textContent = '🎬 যোগ করুন';
        })
        .catch(function () {
          showMsg(ytBtn.parentNode.parentNode, 'নেটওয়ার্ক ত্রুটি', true);
          ytBtn.disabled = false;
          ytBtn.textContent = '🎬 যোগ করুন';
        });
    });
  }

  /* ========== Reference Link ========== */

  var linkBtn = document.getElementById('travel-hub-detail-link-add-btn');
  if (linkBtn) {
    linkBtn.addEventListener('click', function () {
      var urlInput = document.getElementById('travel-hub-detail-link-url');
      var titleInput = document.getElementById('travel-hub-detail-link-title');
      var descInput = document.getElementById('travel-hub-detail-link-desc-input');
      var destId = linkBtn.getAttribute('data-dest-id');

      var url = (urlInput.value || '').trim();
      if (!url) {
        showMsg(linkBtn.parentNode.parentNode, 'লিংক দিন', true);
        return;
      }

      linkBtn.disabled = true;
      linkBtn.textContent = 'যোগ হচ্ছে...';

      fetch('/bangladesh/api/destination/' + destId + '/link/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrf(),
        },
        body: JSON.stringify({
          reference_url: url,
          reference_title_bn: (titleInput.value || '').trim(),
          description_bn: (descInput.value || '').trim(),
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success) {
            var list = document.getElementById('travel-hub-detail-links-list');
            var empty = list.querySelector('.travel-hub-detail-empty');
            if (empty) empty.remove();

            var card = document.createElement('div');
            card.className = 'travel-hub-detail-link-card';
            var linkEl = document.createElement('a');
            linkEl.className = 'travel-hub-detail-link-url';
            linkEl.href = url;
            linkEl.target = '_blank';
            linkEl.rel = 'noopener';
            linkEl.textContent = data.reference_title_bn || url;
            card.appendChild(linkEl);

            if (descInput.value.trim()) {
              var descEl = document.createElement('span');
              descEl.className = 'travel-hub-detail-link-desc';
              descEl.textContent = descInput.value.trim();
              card.appendChild(descEl);
            }
            list.appendChild(card);

            urlInput.value = '';
            titleInput.value = '';
            descInput.value = '';
            showMsg(linkBtn.parentNode.parentNode, 'তথ্যসূত্র যোগ হয়েছে', false);
          } else {
            showMsg(linkBtn.parentNode.parentNode, data.error || 'যোগ করা ব্যর্থ', true);
          }
          linkBtn.disabled = false;
          linkBtn.textContent = '🔗 যোগ করুন';
        })
        .catch(function () {
          showMsg(linkBtn.parentNode.parentNode, 'নেটওয়ার্ক ত্রুটি', true);
          linkBtn.disabled = false;
          linkBtn.textContent = '🔗 যোগ করুন';
        });
    });
  }
})();

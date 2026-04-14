/**
 * call-ui.js — Call overlay UI: ringing, connected, incoming ring, controls.
 *
 * Listens to events from call-webrtc.js and renders the appropriate UI.
 * Creates overlay DOM on first use, reuses thereafter.
 */
(function () {
  'use strict';

  var overlay = null;
  var elements = {};

  /* ── Build overlay DOM (once) ── */
  function ensureOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'messenger-call-overlay';
    overlay.id = 'messenger-call-overlay';
    overlay.setAttribute('hidden', '');

    overlay.innerHTML =
      '<div class="messenger-call-panel" id="messenger-call-panel" name="messenger_call_panel">' +
        /* Video area */
        '<div class="messenger-call-video-area" id="messenger-call-video-area" name="messenger_call_video_area" hidden>' +
          '<video class="messenger-call-remote-video" id="messenger-call-remote-video" name="messenger_call_remote_video" autoplay playsinline></video>' +
          '<video class="messenger-call-local-video" id="messenger-call-local-video" name="messenger_call_local_video" autoplay playsinline muted></video>' +
        '</div>' +
        /* Audio-only / ringing state */
        '<div class="messenger-call-info" id="messenger-call-info" name="messenger_call_info">' +
          '<div class="messenger-call-avatar" id="messenger-call-avatar" name="messenger_call_avatar">📞</div>' +
          '<div class="messenger-call-name" id="messenger-call-name" name="messenger_call_name"></div>' +
          '<div class="messenger-call-status" id="messenger-call-status" name="messenger_call_status"></div>' +
          '<div class="messenger-call-timer" id="messenger-call-timer" name="messenger_call_timer" hidden>00:00</div>' +
        '</div>' +
        /* Controls bar */
        '<div class="messenger-call-controls" id="messenger-call-controls" name="messenger_call_controls">' +
          /* Incoming-only buttons */
          '<button type="button" class="messenger-call-control-button messenger-call-accept-button" id="messenger-call-accept-button" name="messenger_call_accept_button" title="Accept" hidden>' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24 11.36 11.36 0 0 0 3.58.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/></svg>' +
          '</button>' +
          '<button type="button" class="messenger-call-control-button messenger-call-reject-button" id="messenger-call-reject-button" name="messenger_call_reject_button" title="Reject" hidden>' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9.37L8.11 5.5 4.63 2.02 3.21 3.44 5.07 5.3a16.97 16.97 0 0 0 8.64 15.26l2.2-2.2a1 1 0 0 1 1.01-.24 11.36 11.36 0 0 0 3.58.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4c0-.19.01-.38.03-.56L1.39 1.8 2.8.39l8.49 8.49.71.71z"/></svg>' +
          '</button>' +
          /* Active call buttons */
          '<button type="button" class="messenger-call-control-button messenger-call-mute-button" id="messenger-call-mute-button" name="messenger_call_mute_button" title="Mute" hidden>' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>' +
          '</button>' +
          '<button type="button" class="messenger-call-control-button messenger-call-video-toggle-button" id="messenger-call-video-toggle-button" name="messenger_call_video_toggle_button" title="Camera" hidden>' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' +
          '</button>' +
          '<button type="button" class="messenger-call-control-button messenger-call-screen-share-button" id="messenger-call-screen-share-button" name="messenger_call_screen_share_button" title="Screen share" hidden>' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>' +
          '</button>' +
          '<button type="button" class="messenger-call-control-button messenger-call-switch-camera-button" id="messenger-call-switch-camera-button" name="messenger_call_switch_camera_button" title="Switch camera" hidden>' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2h-3l-2-2H9L7 5H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><circle cx="12" cy="11" r="3"/></svg>' +
          '</button>' +
          /* End call (always visible during call) */
          '<button type="button" class="messenger-call-control-button messenger-call-end-button" id="messenger-call-end-button" name="messenger_call_end_button" title="End call" hidden>' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.29-.7.29-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1 0-1.36C3.69 8.47 7.65 7 12 7s8.31 1.47 11.71 4.72a.956.956 0 0 1 0 1.36l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.29a11.27 11.27 0 0 0-2.67-1.85.995.995 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    /* Cache element references */
    elements.panel = document.getElementById('messenger-call-panel');
    elements.videoArea = document.getElementById('messenger-call-video-area');
    elements.remoteVideo = document.getElementById('messenger-call-remote-video');
    elements.localVideo = document.getElementById('messenger-call-local-video');
    elements.info = document.getElementById('messenger-call-info');
    elements.avatar = document.getElementById('messenger-call-avatar');
    elements.name = document.getElementById('messenger-call-name');
    elements.status = document.getElementById('messenger-call-status');
    elements.timer = document.getElementById('messenger-call-timer');
    elements.acceptButton = document.getElementById('messenger-call-accept-button');
    elements.rejectButton = document.getElementById('messenger-call-reject-button');
    elements.muteButton = document.getElementById('messenger-call-mute-button');
    elements.videoToggleButton = document.getElementById('messenger-call-video-toggle-button');
    elements.screenShareButton = document.getElementById('messenger-call-screen-share-button');
    elements.switchCameraButton = document.getElementById('messenger-call-switch-camera-button');
    elements.endButton = document.getElementById('messenger-call-end-button');

    /* Bind control buttons */
    elements.acceptButton.addEventListener('click', function () {
      if (window.messengerCall) {
        window.messengerCall.acceptIncoming(
          elements.acceptButton.dataset.callId,
          elements.acceptButton.dataset.callType
        );
      }
    });
    elements.rejectButton.addEventListener('click', function () {
      if (window.messengerCall) window.messengerCall.rejectIncoming();
    });
    elements.muteButton.addEventListener('click', function () {
      if (window.messengerCall) window.messengerCall.toggleMute();
    });
    elements.videoToggleButton.addEventListener('click', function () {
      if (window.messengerCall) window.messengerCall.toggleVideo();
    });
    elements.screenShareButton.addEventListener('click', function () {
      if (window.messengerCall) window.messengerCall.toggleScreenShare();
    });
    elements.switchCameraButton.addEventListener('click', function () {
      if (window.messengerCall) window.messengerCall.switchCamera();
    });
    elements.endButton.addEventListener('click', function () {
      if (window.messengerCall) window.messengerCall.end();
    });
  }

  /* ── Format timer ── */
  function formatTime(seconds) {
    var minutes = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return (minutes < 10 ? '0' : '') + minutes + ':' + (secs < 10 ? '0' : '') + secs;
  }

  /* ── Show / hide helpers ── */
  function showActiveControls(isVideo) {
    elements.acceptButton.hidden = true;
    elements.rejectButton.hidden = true;
    elements.muteButton.hidden = false;
    elements.endButton.hidden = false;
    elements.videoToggleButton.hidden = !isVideo;
    elements.screenShareButton.hidden = false;
    elements.switchCameraButton.hidden = !isVideo;
  }

  function showIncomingControls() {
    elements.acceptButton.hidden = false;
    elements.rejectButton.hidden = false;
    elements.muteButton.hidden = true;
    elements.videoToggleButton.hidden = true;
    elements.screenShareButton.hidden = true;
    elements.switchCameraButton.hidden = true;
    elements.endButton.hidden = true;
  }

  function hideAllControls() {
    elements.acceptButton.hidden = true;
    elements.rejectButton.hidden = true;
    elements.muteButton.hidden = true;
    elements.videoToggleButton.hidden = true;
    elements.screenShareButton.hidden = true;
    elements.switchCameraButton.hidden = true;
    elements.endButton.hidden = true;
  }

  /* ── Event listeners ── */
  document.addEventListener('call:state', function (event) {
    var detail = event.detail;
    ensureOverlay();

    switch (detail.state) {
      case 'connecting':
        overlay.hidden = false;
        elements.status.textContent = 'সংযোগ হচ্ছে... (Connecting...)';
        elements.timer.hidden = true;
        hideAllControls();
        elements.endButton.hidden = false;
        break;

      case 'ringing':
        overlay.hidden = false;
        elements.status.textContent = 'রিং হচ্ছে... (Ringing...)';
        elements.timer.hidden = true;
        hideAllControls();
        elements.endButton.hidden = false;
        break;

      case 'incoming':
        overlay.hidden = false;
        elements.name.textContent = detail.remoteName || 'Unknown';
        elements.status.textContent = detail.callType === 'video'
          ? 'ভিডিও কল আসছে... (Incoming video call...)'
          : 'অডিও কল আসছে... (Incoming audio call...)';
        elements.timer.hidden = true;
        elements.acceptButton.dataset.callId = detail.callId;
        elements.acceptButton.dataset.callType = detail.callType;
        showIncomingControls();
        /* Show video area only for video calls */
        elements.videoArea.hidden = true;
        break;

      case 'connected':
        overlay.hidden = false;
        elements.status.textContent = 'সংযুক্ত (Connected)';
        elements.timer.hidden = false;
        showActiveControls(detail.callType === 'video');
        /* Show video area for video calls */
        if (detail.callType === 'video') {
          elements.videoArea.hidden = false;
          elements.info.classList.add('messenger-call-info--minimised');
        }
        break;

      case 'ended':
        elements.status.textContent = 'কল শেষ হয়েছে (Call ended)';
        hideAllControls();
        elements.videoArea.hidden = true;
        elements.info.classList.remove('messenger-call-info--minimised');
        setTimeout(function () {
          overlay.hidden = true;
        }, 2000);
        break;

      case 'rejected':
        elements.status.textContent = 'কল প্রত্যাখ্যান হয়েছে (Call rejected)';
        hideAllControls();
        setTimeout(function () {
          overlay.hidden = true;
        }, 2000);
        break;

      case 'failed':
        elements.status.textContent = 'কল ব্যর্থ হয়েছে (Call failed)';
        hideAllControls();
        setTimeout(function () {
          overlay.hidden = true;
        }, 2000);
        break;

      case 'idle':
        overlay.hidden = true;
        break;
    }
  });

  document.addEventListener('call:timer', function (event) {
    if (elements.timer) {
      elements.timer.textContent = formatTime(event.detail.seconds);
    }
  });

  document.addEventListener('call:media', function (event) {
    ensureOverlay();
    if (event.detail.localStream && elements.localVideo) {
      elements.localVideo.srcObject = event.detail.localStream;
    }
    if (event.detail.remoteStream && elements.remoteVideo) {
      elements.remoteVideo.srcObject = event.detail.remoteStream;
    }
  });

  document.addEventListener('call:track', function (event) {
    ensureOverlay();
    var detail = event.detail;

    if (elements.muteButton) {
      elements.muteButton.classList.toggle('messenger-call-control-button--active', detail.isMuted);
      elements.muteButton.title = detail.isMuted ? 'Unmute' : 'Mute';
    }
    if (elements.videoToggleButton) {
      elements.videoToggleButton.classList.toggle('messenger-call-control-button--active', detail.isVideoOff);
      elements.videoToggleButton.title = detail.isVideoOff ? 'Turn on camera' : 'Turn off camera';
    }
    if (elements.screenShareButton) {
      elements.screenShareButton.classList.toggle('messenger-call-control-button--active', detail.isScreenSharing);
    }
  });
})();

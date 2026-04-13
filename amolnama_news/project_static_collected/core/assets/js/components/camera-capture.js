/**
 * Camera Capture Modal — shared component.
 *
 * Opens device camera (laptop webcam or mobile camera), shows live preview,
 * lets user take a photo, review it, and confirm. Returns a File object.
 *
 * Works on any device with a camera — desktop, laptop, tablet, phone.
 * Uses WebRTC (navigator.mediaDevices.getUserMedia).
 *
 * Usage:
 *   window.cameraCapture.open(function (file) {
 *     // file is a File object (JPEG), ready for FormData or FileList
 *     console.log('Captured:', file.name, file.size);
 *   });
 */
(function () {
  'use strict';

  var currentStream = null;
  var currentFacingMode = 'environment'; // back camera default
  var onCaptureCallback = null;

  /**
   * Open the camera modal.
   * @param {Function} onCapture — called with a File object when user confirms the photo
   */
  function open(onCapture) {
    onCaptureCallback = onCapture;
    currentFacingMode = 'environment';
    startCamera();
  }

  function startCamera() {
    stopStream();

    // Build overlay
    var overlay = document.createElement('div');
    overlay.className = 'camera-capture-overlay';
    overlay.id = 'camera-capture-overlay';

    var video = document.createElement('video');
    video.className = 'camera-capture-video';
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.muted = true;

    var actions = document.createElement('div');
    actions.className = 'camera-capture-actions';

    var switchButton = document.createElement('button');
    switchButton.type = 'button';
    switchButton.className = 'camera-capture-switch-button';
    switchButton.textContent = '🔄 ফ্লিপ';

    var snapButton = document.createElement('button');
    snapButton.type = 'button';
    snapButton.className = 'camera-capture-snap-button';
    snapButton.title = 'ছবি তুলুন (Take photo)';

    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'camera-capture-close-button';
    closeButton.textContent = '✕ বন্ধ করুন';

    actions.appendChild(switchButton);
    actions.appendChild(snapButton);
    actions.appendChild(closeButton);

    overlay.appendChild(video);
    overlay.appendChild(actions);
    document.body.appendChild(overlay);

    // Request camera
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError(overlay, 'আপনার ব্রাউজার ক্যামেরা সমর্থন করে না।\nYour browser does not support camera access.');
      return;
    }

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    }).then(function (stream) {
      currentStream = stream;
      video.srcObject = stream;
    }).catch(function (error) {
      var message = 'ক্যামেরা চালু করা যায়নি।\nCould not start camera.';
      if (error.name === 'NotAllowedError') {
        message = 'ক্যামেরা অনুমতি প্রত্যাখ্যান করা হয়েছে।\nCamera permission denied. Please allow camera access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        message = 'কোনো ক্যামেরা পাওয়া যায়নি।\nNo camera found on this device.';
      }
      showError(overlay, message);
    });

    // Snap — capture frame from video
    snapButton.addEventListener('click', function () {
      if (!currentStream) return;
      var canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

      // Show preview
      stopStream();
      showPreview(overlay, canvas);
    });

    // Switch front/back camera
    switchButton.addEventListener('click', function () {
      currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
      stopStream();
      overlay.remove();
      startCamera();
    });

    // Close
    closeButton.addEventListener('click', function () {
      cleanup();
    });

    // Escape key
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') cleanup();
    });
    overlay.setAttribute('tabindex', '0');
    overlay.focus();
  }

  function showPreview(overlay, canvas) {
    overlay.innerHTML = '';

    var previewImage = document.createElement('img');
    previewImage.className = 'camera-capture-preview';
    previewImage.src = canvas.toDataURL('image/jpeg', 0.92);

    var confirmActions = document.createElement('div');
    confirmActions.className = 'camera-capture-confirm-actions';

    var useButton = document.createElement('button');
    useButton.type = 'button';
    useButton.className = 'camera-capture-use-button';
    useButton.textContent = '✓ ব্যবহার করুন (Use Photo)';

    var retakeButton = document.createElement('button');
    retakeButton.type = 'button';
    retakeButton.className = 'camera-capture-retake-button';
    retakeButton.textContent = '↺ আবার তুলুন (Retake)';

    confirmActions.appendChild(useButton);
    confirmActions.appendChild(retakeButton);

    overlay.appendChild(previewImage);
    overlay.appendChild(confirmActions);

    // Use — convert canvas to File and return
    useButton.addEventListener('click', function () {
      canvas.toBlob(function (blob) {
        if (!blob) {
          cleanup();
          return;
        }
        var timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        var file = new File([blob], 'camera-' + timestamp + '.jpg', { type: 'image/jpeg' });
        cleanup();
        if (onCaptureCallback) {
          onCaptureCallback(file);
        }
      }, 'image/jpeg', 0.92);
    });

    // Retake — go back to camera
    retakeButton.addEventListener('click', function () {
      overlay.remove();
      startCamera();
    });
  }

  function showError(overlay, message) {
    overlay.innerHTML = '';
    var errorDiv = document.createElement('div');
    errorDiv.className = 'camera-capture-error';
    errorDiv.textContent = message;

    var closeErrorButton = document.createElement('button');
    closeErrorButton.type = 'button';
    closeErrorButton.className = 'camera-capture-error-button';
    closeErrorButton.textContent = 'বন্ধ করুন (Close)';
    closeErrorButton.addEventListener('click', function () { cleanup(); });

    errorDiv.appendChild(document.createElement('br'));
    errorDiv.appendChild(closeErrorButton);
    overlay.appendChild(errorDiv);
  }

  function stopStream() {
    if (currentStream) {
      currentStream.getTracks().forEach(function (track) { track.stop(); });
      currentStream = null;
    }
  }

  function cleanup() {
    stopStream();
    var overlay = document.getElementById('camera-capture-overlay');
    if (overlay) overlay.remove();
    onCaptureCallback = null;
  }

  // Public API
  window.cameraCapture = { open: open };

})();

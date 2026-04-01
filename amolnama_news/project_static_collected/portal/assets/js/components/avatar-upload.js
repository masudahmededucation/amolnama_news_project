/* avatar-upload.js — Profile picture upload with Cropper.js circular crop */
(function () {
  'use strict';

  var fileInput = document.getElementById('avatar-upload-file-input');
  var cropperModal = document.getElementById('avatar-cropper-modal');
  var cropperImage = document.getElementById('avatar-cropper-image');
  var saveButton = document.getElementById('avatar-cropper-save-button');
  var cancelButton = document.getElementById('avatar-cropper-cancel-button');
  var messageElement = document.getElementById('avatar-cropper-message');
  var previewElement = document.getElementById('avatar-upload-preview');
  var cropperInstance = null;

  if (!fileInput || !cropperModal || !cropperImage) return;

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  /* ---- File selected → open cropper modal ---- */

  fileInput.addEventListener('change', function () {
    var file = fileInput.files[0];
    if (!file) return;

    /* Validate file */
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    /* Load image into cropper */
    var reader = new FileReader();
    reader.onload = function (event) {
      cropperImage.src = event.target.result;
      cropperModal.style.display = 'flex';

      /* Destroy previous cropper instance */
      if (cropperInstance) {
        cropperInstance.destroy();
      }

      /* Initialize Cropper.js with circular crop settings */
      cropperInstance = new Cropper(cropperImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 0.85,
        cropBoxResizable: true,
        cropBoxMovable: true,
        background: false,
        guides: false,
        center: true,
        highlight: false,
        ready: function () {
          /* Add circular mask overlay via CSS */
          var cropBox = document.querySelector('.cropper-crop-box');
          if (cropBox) cropBox.style.borderRadius = '50%';
          var viewBox = document.querySelector('.cropper-view-box');
          if (viewBox) {
            viewBox.style.borderRadius = '50%';
            viewBox.style.outline = '0';
          }
          var cropFace = document.querySelector('.cropper-face');
          if (cropFace) cropFace.style.borderRadius = '50%';

          /* Auto-detect face and center crop on it (Chrome/Edge only) */
          if (typeof FaceDetector !== 'undefined') {
            var faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
            faceDetector.detect(cropperImage)
              .then(function (detectedFaces) {
                if (detectedFaces.length > 0) {
                  var detectedFace = detectedFaces[0].boundingBox;
                  var imageData = cropperInstance.getImageData();
                  var canvasData = cropperInstance.getCanvasData();

                  /* Calculate face center relative to canvas */
                  var scaleX = canvasData.width / imageData.naturalWidth;
                  var scaleY = canvasData.height / imageData.naturalHeight;
                  var faceCenterX = canvasData.left + (detectedFace.x + detectedFace.width / 2) * scaleX;
                  var faceCenterY = canvasData.top + (detectedFace.y + detectedFace.height / 2) * scaleY;

                  /* Size crop box to fit face with padding */
                  var faceSize = Math.max(detectedFace.width, detectedFace.height) * scaleX * 1.8;
                  var containerData = cropperInstance.getContainerData();
                  faceSize = Math.min(faceSize, containerData.width * 0.9, containerData.height * 0.9);
                  faceSize = Math.max(faceSize, 100);

                  cropperInstance.setCropBoxData({
                    left: faceCenterX - faceSize / 2,
                    top: faceCenterY - faceSize / 2,
                    width: faceSize,
                    height: faceSize,
                  });
                }
              })
              .catch(function () {
                /* Face detection not available or failed — user crops manually */
              });
          }
        },
      });
    };
    reader.readAsDataURL(file);

    /* Reset file input so same file can be re-selected */
    fileInput.value = '';
  });

  /* ---- Cancel → close modal ---- */

  cancelButton.addEventListener('click', function () {
    cropperModal.style.display = 'none';
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
    messageElement.textContent = '';
  });

  /* ---- Save → crop + upload ---- */

  saveButton.addEventListener('click', function () {
    if (!cropperInstance) return;

    saveButton.disabled = true;
    saveButton.textContent = 'আপলোড হচ্ছে...';
    messageElement.textContent = '';

    /* Get cropped canvas (square, 400x400) */
    var croppedCanvas = cropperInstance.getCroppedCanvas({
      width: 400,
      height: 400,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });

    if (!croppedCanvas) {
      saveButton.disabled = false;
      saveButton.textContent = 'সংরক্ষণ করুন (Save)';
      return;
    }

    /* Convert to blob and upload */
    croppedCanvas.toBlob(function (blob) {
      var formData = new FormData();
      formData.append('avatar_image', blob, 'avatar.jpg');

      fetch('/portal/api/avatar/upload/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
        body: formData,
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        saveButton.disabled = false;
        saveButton.textContent = 'সংরক্ষণ করুন (Save)';

        if (data.success) {
          /* Update preview with new avatar */
          previewElement.innerHTML = '<img src="' + data.avatar_url + '" alt="প্রোফাইল ছবি" class="avatar-upload-current-image" id="avatar-upload-current-image">';

          /* Close modal */
          cropperModal.style.display = 'none';
          if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
          }

          messageElement.textContent = '';
        } else {
          messageElement.textContent = data.error || 'আপলোড করা যায়নি';
          messageElement.style.color = '#dc2626';
        }
      })
      .catch(function (networkError) {
        console.error('Avatar upload failed:', networkError);
        saveButton.disabled = false;
        saveButton.textContent = 'সংরক্ষণ করুন (Save)';
        messageElement.textContent = 'নেটওয়ার্ক ত্রুটি (Network error)';
        messageElement.style.color = '#dc2626';
      });
    }, 'image/jpeg', 0.9);
  });
})();

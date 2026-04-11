/* avatar-upload.js — Profile picture upload with Cropper.js circular crop */
(function () {
  'use strict';

  const fileInput = document.getElementById('avatar-upload-file-input');
  const cropperModal = document.getElementById('avatar-cropper-modal');
  const cropperImage = document.getElementById('avatar-cropper-image');
  const saveButton = document.getElementById('avatar-cropper-save-button');
  const cancelButton = document.getElementById('avatar-cropper-cancel-button');
  const messageElement = document.getElementById('avatar-cropper-message');
  const previewElement = document.getElementById('avatar-upload-preview');
  let cropperInstance = null;

  if (!fileInput || !cropperModal || !cropperImage) return;


  /* ---- File selected → open cropper modal ---- */

  fileInput.addEventListener('change', function () {
    const file = fileInput.files[0];
    if (!file) return;

    /* Validate file */
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    /* Load image into cropper */
    const reader = new FileReader();
    reader.onload = function (event) {
      cropperImage.src = event.target.result;
      cropperModal.hidden = false;

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
          /* Circular mask is applied via CSS rules on .avatar-cropper-container .cropper-* */

          /* Auto-detect face and center crop on it (Chrome/Edge only) */
          if (typeof FaceDetector !== 'undefined') {
            const faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
            faceDetector.detect(cropperImage)
              .then(function (detectedFaces) {
                if (detectedFaces.length > 0) {
                  const detectedFace = detectedFaces[0].boundingBox;
                  const imageData = cropperInstance.getImageData();
                  const canvasData = cropperInstance.getCanvasData();

                  /* Calculate face center relative to canvas */
                  const scaleX = canvasData.width / imageData.naturalWidth;
                  const scaleY = canvasData.height / imageData.naturalHeight;
                  const faceCenterX = canvasData.left + (detectedFace.x + detectedFace.width / 2) * scaleX;
                  const faceCenterY = canvasData.top + (detectedFace.y + detectedFace.height / 2) * scaleY;

                  /* Size crop box to fit face with padding */
                  let faceSize = Math.max(detectedFace.width, detectedFace.height) * scaleX * 1.8;
                  const containerData = cropperInstance.getContainerData();
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
    cropperModal.hidden = true;
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
    messageElement.textContent = '';
    messageElement.classList.remove('avatar-cropper-message-error');
  });

  /* ---- Save → crop + upload ---- */

  saveButton.addEventListener('click', function () {
    if (!cropperInstance) return;

    saveButton.disabled = true;
    saveButton.textContent = 'আপলোড হচ্ছে...';
    messageElement.textContent = '';

    /* Get cropped canvas (square, 400x400) */
    const croppedCanvas = cropperInstance.getCroppedCanvas({
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
      const formData = new FormData();
      formData.append('avatar_image', blob, 'avatar.jpg');

      fetch('/portal/api/avatar/upload/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
        body: formData,
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        saveButton.disabled = false;
        saveButton.textContent = 'সংরক্ষণ করুন (Save)';

        if (data.success) {
          /* Update preview with new avatar */
          previewElement.innerHTML = '<img src="' + escapeHtml(data.avatar_url) + '" alt="প্রোফাইল ছবি" class="avatar-upload-current-image" id="avatar-upload-current-image">';

          /* Close modal */
          cropperModal.hidden = true;
          if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
          }

          messageElement.textContent = '';
          messageElement.classList.remove('avatar-cropper-message-error');
        } else {
          messageElement.textContent = data.error || 'আপলোড করা যায়নি';
          messageElement.classList.add('avatar-cropper-message-error');
        }
      })
      .catch(function () {
        saveButton.disabled = false;
        saveButton.textContent = 'সংরক্ষণ করুন (Save)';
        messageElement.textContent = 'নেটওয়ার্ক ত্রুটি (Network error)';
        messageElement.classList.add('avatar-cropper-message-error');
      });
    }, 'image/jpeg', 0.9);
  });

  /* Register SPA cleanup — destroy Cropper.js instance */
  if (window.spaCleanupRegister) {
    window.spaCleanupRegister(function () {
      if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
      }
    });
  }
})();

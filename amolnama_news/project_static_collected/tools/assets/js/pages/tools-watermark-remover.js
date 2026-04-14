/**
 * Watermark Remover Tool
 *
 * Flow: Upload image → draw mask over watermark → server inpaints → download result.
 * Canvas-based mask drawing with adjustable brush size and undo.
 */
(function () {
  'use strict';

  var fileInput = document.getElementById('wmr-file-input');
  var dropzone = document.getElementById('wmr-dropzone');
  var browseButton = document.getElementById('wmr-browse-button');
  var uploadSection = document.getElementById('wmr-upload-section');
  var editorSection = document.getElementById('wmr-editor-section');
  var resultSection = document.getElementById('wmr-result-section');
  var processingOverlay = document.getElementById('wmr-processing');
  var errorDisplay = document.getElementById('wmr-error');
  var canvas = document.getElementById('wmr-canvas');
  var brushSlider = document.getElementById('wmr-brush-size');
  var brushSizeDisplay = document.getElementById('wmr-brush-size-display');
  var undoButton = document.getElementById('wmr-undo-button');
  var clearButton = document.getElementById('wmr-clear-button');
  var removeButton = document.getElementById('wmr-remove-button');
  var changeButton = document.getElementById('wmr-change-button');
  var downloadButton = document.getElementById('wmr-download-button');
  var retryButton = document.getElementById('wmr-retry-button');
  var newButton = document.getElementById('wmr-new-button');
  var resultBefore = document.getElementById('wmr-result-before');
  var resultAfter = document.getElementById('wmr-result-after');

  if (!canvas || !fileInput) return;

  var context = canvas.getContext('2d', { willReadFrequently: true });
  var originalImage = null;
  var originalImageDataURL = null;
  var maskHistory = [];
  var isDrawing = false;
  var isProcessing = false;
  var brushSize = 25;
  var resultBlobURL = null;

  /* Separate mask canvas — tracks where user brushed (white on black) */
  var maskCanvas = document.createElement('canvas');
  var maskContext = maskCanvas.getContext('2d');

  /* ===== Step 1: File Upload ===== */

  browseButton.addEventListener('click', function () {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) {
      loadImageFile(fileInput.files[0]);
    }
  });

  /* Drag and drop */
  dropzone.addEventListener('dragover', function (event) {
    event.preventDefault();
    dropzone.style.borderColor = 'var(--primary)';
  });
  dropzone.addEventListener('dragleave', function () {
    dropzone.style.borderColor = '';
  });
  dropzone.addEventListener('drop', function (event) {
    event.preventDefault();
    dropzone.style.borderColor = '';
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      loadImageFile(event.dataTransfer.files[0]);
    }
  });

  function loadImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showError('শুধুমাত্র ছবি ফাইল গ্রহণযোগ্য (Only image files accepted)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError('ফাইল সাইজ সর্বোচ্চ ১০ MB (Max 10 MB)');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (event) {
      var img = new Image();
      img.onload = function () {
        originalImage = img;
        originalImageDataURL = event.target.result;
        initEditor();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ===== Step 2: Canvas Mask Editor ===== */

  function initEditor() {
    uploadSection.hidden = true;
    resultSection.hidden = true;
    editorSection.hidden = false;
    errorDisplay.hidden = true;

    /* Size canvas to image (max 800px wide for usability) */
    var maxWidth = Math.min(originalImage.width, 800);
    var scale = maxWidth / originalImage.width;
    canvas.width = Math.round(originalImage.width * scale);
    canvas.height = Math.round(originalImage.height * scale);

    /* Draw image */
    context.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

    /* Init mask canvas — same size, all black (nothing masked) */
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    maskContext.fillStyle = '#000';
    maskContext.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    maskHistory = [];
    saveMaskState();
  }

  /* Brush size */
  brushSlider.addEventListener('input', function () {
    brushSize = parseInt(brushSlider.value, 10);
    brushSizeDisplay.textContent = brushSize + 'px';
  });

  /* Drawing */
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);
  canvas.addEventListener('touchstart', function (event) {
    event.preventDefault();
    startDraw(getTouchPosition(event));
  }, { passive: false });
  canvas.addEventListener('touchmove', function (event) {
    event.preventDefault();
    draw(getTouchPosition(event));
  }, { passive: false });
  canvas.addEventListener('touchend', stopDraw);

  function getTouchPosition(event) {
    var rect = canvas.getBoundingClientRect();
    var touch = event.touches[0];
    return {
      clientX: touch.clientX,
      clientY: touch.clientY
    };
  }

  function startDraw(event) {
    if (isProcessing) return;
    isDrawing = true;
    draw(event);
  }

  function draw(event) {
    if (!isDrawing || isProcessing) return;

    /* Fix mouse offset: account for CSS scaling of canvas */
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var x = (event.clientX - rect.left) * scaleX;
    var y = (event.clientY - rect.top) * scaleY;

    /* Draw red semi-transparent brush on visible canvas */
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = 'rgba(255, 0, 0, 0.4)';
    context.beginPath();
    context.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    context.fill();

    /* Draw white circle on mask canvas (tracks what to inpaint) */
    maskContext.fillStyle = '#fff';
    maskContext.beginPath();
    maskContext.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    maskContext.fill();
  }

  function stopDraw() {
    if (isDrawing) {
      isDrawing = false;
      saveMaskState();
    }
  }

  function saveMaskState() {
    maskHistory.push(context.getImageData(0, 0, canvas.width, canvas.height));
    if (maskHistory.length > 30) maskHistory.shift();
  }

  /* Undo */
  undoButton.addEventListener('click', function () {
    if (maskHistory.length > 1) {
      maskHistory.pop();
      context.putImageData(maskHistory[maskHistory.length - 1], 0, 0);
    }
  });

  /* Clear mask */
  clearButton.addEventListener('click', function () {
    context.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
    maskContext.fillStyle = '#000';
    maskContext.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskHistory = [];
    saveMaskState();
  });

  /* Change image */
  changeButton.addEventListener('click', function () {
    editorSection.hidden = true;
    resultSection.hidden = true;
    uploadSection.hidden = false;
  });

  /* ===== Step 3: Remove Watermark ===== */

  /* Auto remove — send image only, server detects watermark */
  /* Remove brushed area */
  removeButton.addEventListener('click', function () {
    if (!originalImage || isProcessing) return;

    /* Lock canvas during processing */
    isProcessing = true;
    canvas.style.pointerEvents = 'none';
    canvas.style.opacity = '0.6';
    removeButton.disabled = true;

    /* Send image + brushed mask */
    processingOverlay.hidden = false;

    var sendImageCanvas = document.createElement('canvas');
    sendImageCanvas.width = originalImage.width;
    sendImageCanvas.height = originalImage.height;
    sendImageCanvas.getContext('2d').drawImage(originalImage, 0, 0);

    var sendMaskCanvas = document.createElement('canvas');
    sendMaskCanvas.width = originalImage.width;
    sendMaskCanvas.height = originalImage.height;
    sendMaskCanvas.getContext('2d').drawImage(maskCanvas, 0, 0, originalImage.width, originalImage.height);

    sendImageCanvas.toBlob(function (imageBlob) {
      sendMaskCanvas.toBlob(function (maskBlob) {
        var formData = new FormData();
        formData.append('image_file', imageBlob, 'image.jpg');
        formData.append('mask_file', maskBlob, 'mask.png');
        sendToServer(formData);
      }, 'image/png');
    }, 'image/jpeg', 0.95);
  });

  /* Shared server call */
  function sendToServer(formData) {
    fetch('/tools/api/watermark-remove/', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': window.getCsrfTokenValue() }
    })
    .then(function (response) {
      if (!response.ok) {
        return response.json().then(function (data) {
          throw new Error(data.error || 'Server error');
        });
      }
      return response.blob();
    })
    .then(function (resultBlob) {
      unlockUI();
      if (resultBlobURL) URL.revokeObjectURL(resultBlobURL);
      resultBlobURL = URL.createObjectURL(resultBlob);
      resultBefore.src = originalImageDataURL;
      resultAfter.src = resultBlobURL;
      editorSection.hidden = true;
      resultSection.hidden = false;
    })
    .catch(function (fetchError) {
      unlockUI();
      showError('প্রক্রিয়াকরণ ব্যর্থ — ' + fetchError.message);
    });
  }

  function unlockUI() {
    processingOverlay.hidden = true;
    isProcessing = false;
    canvas.style.pointerEvents = '';
    canvas.style.opacity = '';
    removeButton.disabled = false;
  }

  /* ===== Step 4: Result Actions ===== */

  downloadButton.addEventListener('click', function () {
    if (!resultBlobURL) return;
    var downloadLink = document.createElement('a');
    downloadLink.href = resultBlobURL;
    downloadLink.download = 'watermark-removed.jpg';
    downloadLink.click();
  });

  retryButton.addEventListener('click', function () {
    resultSection.hidden = true;
    editorSection.hidden = false;
    /* Re-init canvas with original image */
    context.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
    maskHistory = [];
    saveMaskState();
  });

  newButton.addEventListener('click', function () {
    resultSection.hidden = true;
    editorSection.hidden = true;
    uploadSection.hidden = false;
    originalImage = null;
    originalImageDataURL = null;
    if (resultBlobURL) { URL.revokeObjectURL(resultBlobURL); resultBlobURL = null; }
  });

  /* ===== Helpers ===== */

  function showError(message) {
    errorDisplay.textContent = message;
    errorDisplay.hidden = false;
    setTimeout(function () { errorDisplay.hidden = true; }, 6000);
  }

})();

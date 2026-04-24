/* ============================================================
   bookwriter — inline prose image module (BLOCK model)
   --------------------------------------------------------
   Matches the gold-standard pattern used by Reedsy / Atticus /
   Vellum / Scrivener / Notion / Substack / Medium for novel
   and long-form writing apps: each image is its own row,
   text never wraps around it. Eliminates the float-model
   bugs (constant reflow on keystroke, browser-default copy on
   drag, broken reposition) at the cost of magazine-style
   side-by-side layouts (irrelevant for novels).

   Lifecycle:
     - DROP a file onto the prose, OR click the toolbar 🖼 image
       button → upload → insert at the cursor as a fresh <img>
     - CLICK an existing image → floating toolbar (top of image)
       offers Small / Medium / Full size, Left / Centre / Right
       align, six-dot Drag handle, and Delete (×).
     - DRAG the handle → ghost follows the cursor; a horizontal
       drop indicator slots between paragraphs; release moves
       the image element to that slot in the DOM. Touch-friendly
       (pointer events, not HTML5 drag-drop).
     - MIGRATE-ON-LOAD: any old image saved with the deprecated
       float-* class set is rewritten to the size+align class
       set the first time the chapter loads.

   Self-contained IIFE — no closure dependency on page-inkwell.js.
   Re-queries DOM on each interaction. window.bookwriter.apiPost
   handles JSON; multipart upload uses plain fetch with the same
   X-Requested-With header dev.py uses to skip Debug Toolbar.
   ============================================================ */
(function () {
  'use strict';

  var IMAGE_CSS_CLASS = 'bookwriter-prose-image';
  var SIZE_CSS_CLASS_PREFIX  = 'bookwriter-prose-image-size-';
  var ALIGN_CSS_CLASS_PREFIX = 'bookwriter-prose-image-align-';
  var SIZE_OPTIONS  = ['small', 'medium', 'full'];
  var ALIGN_OPTIONS = ['left', 'center', 'right'];
  var DEFAULT_SIZE_CODE  = 'medium';
  var DEFAULT_ALIGN_CODE = 'center';
  var DRAG_GHOST_FOLLOW_OFFSET_PX = 12;
  var DRAG_DISTANCE_TO_ENGAGE_PX = 5;

  /* ====================================================
     SHARED HELPERS — DOM lookup, CSRF, upload pipeline
     ==================================================== */
  function activeProseElement() {
    /* In full-screen / focus mode, the live editor is .bookwriter-focus-text
       (the original .bookwriter-prose still exists in the DOM but is
       hidden behind the focus overlay). All image events — toolbar
       click, drag handle, corner-resize — fire on focus-text's images
       in that mode, so we have to return focus-text or the handlers
       reject the event via `proseElement.contains(target)`. */
    if (document.body.classList.contains('bookwriter-focus-on')) {
      var focusTextElement = document.querySelector('.bookwriter-focus-text[contenteditable="true"]');
      if (focusTextElement) return focusTextElement;
    }
    return document.querySelector('.bookwriter-prose[contenteditable="true"]');
  }
  function activeChapterIdString() {
    var proseElement = activeProseElement();
    return proseElement ? (proseElement.dataset.chapterId || '') : '';
  }
  function getCsrfTokenFromCookie() {
    var match = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[2]) : '';
  }
  function uploadChapterImageFile(imageFile, chapterIdString) {
    var formData = new FormData();
    formData.append('chapter_image_file', imageFile);
    return fetch(
      '/bookwriter/api/chapter/' + encodeURIComponent(chapterIdString) + '/image/upload/',
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-CSRFToken': getCsrfTokenFromCookie(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
      }
    )
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data && data.ok) return data.image_url;
        // Server rejected the upload (Pillow.verify failed, file too
        // big, owner mismatch, etc). Log so the issue is visible in
        // the console; caller falls back to "image just doesn't
        // appear" UX which is intentional.
        console.error('uploadChapterImageFile: server rejected upload', data && data.error);
        return null;
      })
      .catch(function (uploadNetworkError) {
        console.error('uploadChapterImageFile: network error', uploadNetworkError);
        return null;
      });
  }
  function notifyProseChangedImmediately(proseElement) {
    proseElement.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ====================================================
     INSERT — block-model image with size + align classes
     ==================================================== */
  function setImageSizeCode(imageElement, sizeCode) {
    SIZE_OPTIONS.forEach(function (otherSizeCode) {
      imageElement.classList.remove(SIZE_CSS_CLASS_PREFIX + otherSizeCode);
    });
    imageElement.classList.add(SIZE_CSS_CLASS_PREFIX + sizeCode);
    imageElement.dataset.size = sizeCode;
    // Drop any inline width left over from the deprecated corner-resize
    // — the size class drives the width now.
    imageElement.style.width = '';
  }
  function setImageAlignCode(imageElement, alignCode) {
    ALIGN_OPTIONS.forEach(function (otherAlignCode) {
      imageElement.classList.remove(ALIGN_CSS_CLASS_PREFIX + otherAlignCode);
    });
    imageElement.classList.add(ALIGN_CSS_CLASS_PREFIX + alignCode);
    imageElement.dataset.align = alignCode;
  }
  function insertImageAtCurrentSelection(imageUrlString, proseElement) {
    var newImage = document.createElement('img');
    newImage.src = imageUrlString;
    newImage.alt = '';
    newImage.className = IMAGE_CSS_CLASS;
    setImageSizeCode(newImage,  DEFAULT_SIZE_CODE);
    setImageAlignCode(newImage, DEFAULT_ALIGN_CODE);
    // Block-model images are never natively drag-able — drag-to-
    // reposition is handled by the JS drag handle below. Native
    // drag inside contenteditable would default to copy and
    // recreate the duplicate-on-drag bug.
    newImage.draggable = false;

    var selectionObject = window.getSelection();
    var insertedAtSelection = false;
    if (selectionObject && selectionObject.rangeCount > 0) {
      var rangeObject = selectionObject.getRangeAt(0);
      if (proseElement.contains(rangeObject.startContainer)) {
        rangeObject.deleteContents();
        rangeObject.insertNode(newImage);
        rangeObject.setStartAfter(newImage);
        rangeObject.collapse(true);
        selectionObject.removeAllRanges();
        selectionObject.addRange(rangeObject);
        insertedAtSelection = true;
      }
    }
    if (!insertedAtSelection) proseElement.appendChild(newImage);
    return newImage;
  }

  /* ====================================================
     MIGRATE — old float-* images to block size+align
     ==================================================== */
  var FLOAT_TO_ALIGN_MAP = {
    'left':   'left',
    'right':  'right',
    'center': 'center',
    'none':   'center',
  };
  function migrateLegacyFloatClassesIntoBlockModel(proseElement) {
    if (!proseElement) return;
    var legacyImageElements = proseElement.querySelectorAll('img.' + IMAGE_CSS_CLASS);
    legacyImageElements.forEach(function (legacyImageElement) {
      var legacyFloatCode = legacyImageElement.dataset.float || '';
      legacyImageElement.classList.forEach(function (cssClassName) {
        if (cssClassName.indexOf('bookwriter-prose-image-float-') === 0) {
          legacyImageElement.classList.remove(cssClassName);
        }
      });
      delete legacyImageElement.dataset.float;
      legacyImageElement.draggable = false;
      var hasCustomInlineWidth = !!legacyImageElement.style.width;
      // SIZE: only assign a size bucket when the image has neither a
      // data-size attribute nor a custom inline width. A user-resized
      // image (corner drag) explicitly removes data-size and stores
      // its width inline — re-bucketing here would clobber that user
      // choice on every chapter open. The legacy float-only path
      // (no inline width, no data-size) still gets a default bucket.
      if (!legacyImageElement.dataset.size && !hasCustomInlineWidth) {
        setImageSizeCode(legacyImageElement, DEFAULT_SIZE_CODE);
      }
      if (!legacyImageElement.dataset.align) {
        var mappedAlignCode = FLOAT_TO_ALIGN_MAP[legacyFloatCode] || DEFAULT_ALIGN_CODE;
        setImageAlignCode(legacyImageElement, mappedAlignCode);
      }
    });
  }
  // Run migration whenever a chapter is loaded into the editor — the
  // page-inkwell.js applyChapterPayloadToEditor sets prose.innerHTML
  // and dispatches no event, so we hook a MutationObserver on the
  // prose element to catch it. Cheap: only fires when innerHTML
  // changes wholesale.
  function attachMigrationObserverToProse() {
    var proseElement = activeProseElement();
    if (!proseElement) return;
    if (proseElement.dataset.bookwriterImageMigrationWired === '1') return;
    proseElement.dataset.bookwriterImageMigrationWired = '1';
    migrateLegacyFloatClassesIntoBlockModel(proseElement);
    var mutationObserver = new MutationObserver(function () {
      migrateLegacyFloatClassesIntoBlockModel(proseElement);
    });
    mutationObserver.observe(proseElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachMigrationObserverToProse);
  } else {
    attachMigrationObserverToProse();
  }
  // Re-attach if the prose element is replaced (chapter switch)
  document.addEventListener('click', function () {
    setTimeout(attachMigrationObserverToProse, 0);
  });

  /* ====================================================
     DROP — file onto the prose
     ==================================================== */
  function isFileDragEvent(dragEvent) {
    if (!dragEvent.dataTransfer) return false;
    var transferTypes = dragEvent.dataTransfer.types;
    if (!transferTypes) return false;
    for (var transferTypeIndex = 0; transferTypeIndex < transferTypes.length; transferTypeIndex++) {
      if (transferTypes[transferTypeIndex] === 'Files') return true;
    }
    return false;
  }
  function handleProseDragOver(dragOverEvent) {
    if (!isFileDragEvent(dragOverEvent)) return;
    var proseElement = activeProseElement();
    if (!proseElement) return;
    if (!(proseElement.contains(dragOverEvent.target) || dragOverEvent.target === proseElement)) return;
    dragOverEvent.preventDefault();
    if (dragOverEvent.dataTransfer) dragOverEvent.dataTransfer.dropEffect = 'copy';
  }
  function handleProseDrop(dropEvent) {
    if (!isFileDragEvent(dropEvent)) return;
    var proseElement = activeProseElement();
    if (!proseElement) return;
    if (!(proseElement.contains(dropEvent.target) || dropEvent.target === proseElement)) return;
    dropEvent.preventDefault();
    var droppedFiles = dropEvent.dataTransfer && dropEvent.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;
    var chapterIdString = activeChapterIdString();
    if (!chapterIdString) return;
    placeCaretAtPoint(dropEvent.clientX, dropEvent.clientY);
    var firstImageFile = null;
    for (var fileIndex = 0; fileIndex < droppedFiles.length; fileIndex++) {
      if ((droppedFiles[fileIndex].type || '').indexOf('image/') === 0) {
        firstImageFile = droppedFiles[fileIndex];
        break;
      }
    }
    if (!firstImageFile) return;
    uploadChapterImageFile(firstImageFile, chapterIdString).then(function (uploadedImageUrl) {
      if (!uploadedImageUrl) return;
      var insertedImage = insertImageAtCurrentSelection(uploadedImageUrl, proseElement);
      if (insertedImage) notifyProseChangedImmediately(proseElement);
    });
  }
  function placeCaretAtPoint(clientX, clientY) {
    var caretRange = null;
    if (document.caretPositionFromPoint) {
      var caretPosition = document.caretPositionFromPoint(clientX, clientY);
      if (caretPosition) {
        caretRange = document.createRange();
        caretRange.setStart(caretPosition.offsetNode, caretPosition.offset);
      }
    } else if (document.caretRangeFromPoint) {
      caretRange = document.caretRangeFromPoint(clientX, clientY);
    }
    if (!caretRange) return;
    caretRange.collapse(true);
    var selection = window.getSelection();
    if (selection) { selection.removeAllRanges(); selection.addRange(caretRange); }
  }

  /* ====================================================
     TOOLBAR BUTTON — file picker fallback
     ==================================================== */
  function handleToolbarImageButtonClick(toolbarClickEvent) {
    var clickedToolbarButton = toolbarClickEvent.target.closest('#bookwriter-tool-image-button');
    if (!clickedToolbarButton) return;
    toolbarClickEvent.preventDefault();
    var proseElement = activeProseElement();
    if (!proseElement) return;
    var chapterIdString = activeChapterIdString();
    if (!chapterIdString) return;
    var hiddenFileInputElement = document.createElement('input');
    hiddenFileInputElement.type = 'file';
    hiddenFileInputElement.accept = 'image/jpeg,image/png,image/webp,image/gif';
    hiddenFileInputElement.onchange = function (fileChangeEvent) {
      var pickedImageFile = fileChangeEvent.target.files && fileChangeEvent.target.files[0];
      if (!pickedImageFile) return;
      uploadChapterImageFile(pickedImageFile, chapterIdString).then(function (uploadedImageUrl) {
        if (!uploadedImageUrl) return;
        proseElement.focus();
        var insertedImage = insertImageAtCurrentSelection(uploadedImageUrl, proseElement);
        if (insertedImage) notifyProseChangedImmediately(proseElement);
      });
    };
    hiddenFileInputElement.click();
  }

  /* ====================================================
     FLOATING TOOLBAR — Size / Align / Drag / Delete
     ==================================================== */
  var floatingToolbarElement = null;
  var floatingDragHandleElement = null;
  var toolbarTargetImageElement = null;

  function ensureFloatingToolbarExists() {
    if (floatingToolbarElement) return floatingToolbarElement;

    floatingToolbarElement = document.createElement('div');
    floatingToolbarElement.className = 'bookwriter-prose-image-toolbar';
    floatingToolbarElement.id = 'bookwriter-prose-image-toolbar';
    floatingToolbarElement.style.display = 'none';

    function buildToolbarButton(buttonId, buttonLabel, buttonTitle, buttonExtraClass) {
      var toolbarButton = document.createElement('button');
      toolbarButton.type = 'button';
      toolbarButton.id = 'bookwriter-prose-image-toolbar-' + buttonId + '-button';
      toolbarButton.name = 'bookwriter_prose_image_toolbar_' + buttonId + '_button';
      toolbarButton.className = 'bookwriter-prose-image-toolbar-button' + (buttonExtraClass ? ' ' + buttonExtraClass : '');
      toolbarButton.dataset.bookwriterToolbarAction = buttonId;
      toolbarButton.title = buttonTitle;
      toolbarButton.textContent = buttonLabel;
      toolbarButton.addEventListener('mousedown', function (mouseDownEvent) {
        // Stop the click from yanking focus out of the prose; otherwise
        // hideFloatingToolbar runs before the button's click handler.
        mouseDownEvent.preventDefault();
      });
      return toolbarButton;
    }
    function buildDivider() {
      var dividerElement = document.createElement('span');
      dividerElement.className = 'bookwriter-prose-image-toolbar-divider';
      dividerElement.setAttribute('aria-hidden', 'true');
      return dividerElement;
    }

    var sizeButtonSmall  = buildToolbarButton('size-small',  'S',  'Small image (240px)');
    var sizeButtonMedium = buildToolbarButton('size-medium', 'M',  'Medium image (480px)');
    var sizeButtonFull   = buildToolbarButton('size-full',   'F',  'Full-width image');
    var alignButtonLeft   = buildToolbarButton('align-left',   '\u2190',  'Align left');
    var alignButtonCenter = buildToolbarButton('align-center', '\u2194',  'Align centre');
    var alignButtonRight  = buildToolbarButton('align-right',  '\u2192',  'Align right');
    var deleteButton     = buildToolbarButton('delete',      '\u00d7',  'Delete image', 'bookwriter-prose-image-toolbar-button-danger');

    floatingToolbarElement.appendChild(sizeButtonSmall);
    floatingToolbarElement.appendChild(sizeButtonMedium);
    floatingToolbarElement.appendChild(sizeButtonFull);
    floatingToolbarElement.appendChild(buildDivider());
    floatingToolbarElement.appendChild(alignButtonLeft);
    floatingToolbarElement.appendChild(alignButtonCenter);
    floatingToolbarElement.appendChild(alignButtonRight);
    floatingToolbarElement.appendChild(buildDivider());
    floatingToolbarElement.appendChild(deleteButton);

    floatingToolbarElement.addEventListener('click', handleToolbarActionClick);
    document.body.appendChild(floatingToolbarElement);

    // Drag handle is a sibling overlay (not part of the toolbar) so
    // a long press / pointer-down doesn't trigger toolbar buttons.
    floatingDragHandleElement = document.createElement('span');
    floatingDragHandleElement.className = 'bookwriter-prose-image-drag-handle';
    floatingDragHandleElement.id = 'bookwriter-prose-image-drag-handle';
    floatingDragHandleElement.title = 'Drag to move image';
    floatingDragHandleElement.setAttribute('aria-label', 'Drag to move image');
    floatingDragHandleElement.textContent = '\u22ee\u22ee'; // ⋮⋮ — six-dot grip
    floatingDragHandleElement.style.display = 'none';
    floatingDragHandleElement.addEventListener('pointerdown', handleDragHandlePointerDown);
    document.body.appendChild(floatingDragHandleElement);

    return floatingToolbarElement;
  }

  function showFloatingToolbarOverImage(targetImageElement) {
    var toolbarElement = ensureFloatingToolbarExists();
    toolbarTargetImageElement = targetImageElement;
    var imageRect = targetImageElement.getBoundingClientRect();
    toolbarElement.style.position = 'absolute';
    // Toolbar bottom flush with image top — no gap. Eliminates the
    // "cursor crosses dead zone, toolbar vanishes" problem
    // geometrically. The grace-period handler below is still there as
    // a safety net for edge cases.
    toolbarElement.style.top  = (window.scrollY + imageRect.top - toolbarElement.offsetHeight) + 'px';
    toolbarElement.style.left = (window.scrollX + imageRect.left) + 'px';
    toolbarElement.style.display = 'inline-flex';
    floatingDragHandleElement.style.position = 'absolute';
    floatingDragHandleElement.style.top  = (window.scrollY + imageRect.top + 6) + 'px';
    floatingDragHandleElement.style.left = (window.scrollX + imageRect.left + 6) + 'px';
    floatingDragHandleElement.style.display = 'inline-flex';
    syncToolbarActiveStates(targetImageElement);
  }
  function hideFloatingToolbar() {
    if (floatingToolbarElement) floatingToolbarElement.style.display = 'none';
    if (floatingDragHandleElement) floatingDragHandleElement.style.display = 'none';
    toolbarTargetImageElement = null;
  }
  function syncToolbarActiveStates(targetImageElement) {
    if (!floatingToolbarElement) return;
    var currentSizeCode  = targetImageElement.dataset.size  || DEFAULT_SIZE_CODE;
    var currentAlignCode = targetImageElement.dataset.align || DEFAULT_ALIGN_CODE;
    floatingToolbarElement.querySelectorAll('.bookwriter-prose-image-toolbar-button').forEach(function (toolbarButton) {
      var actionCode = toolbarButton.dataset.bookwriterToolbarAction || '';
      var isActive = (
           actionCode === 'size-'  + currentSizeCode
        || actionCode === 'align-' + currentAlignCode
      );
      toolbarButton.classList.toggle('bookwriter-prose-image-toolbar-button-is-active', isActive);
    });
  }
  function handleToolbarActionClick(toolbarClickEvent) {
    var clickedToolbarButton = toolbarClickEvent.target.closest('.bookwriter-prose-image-toolbar-button');
    if (!clickedToolbarButton || !toolbarTargetImageElement) return;
    var actionCode = clickedToolbarButton.dataset.bookwriterToolbarAction || '';
    var proseElement = activeProseElement();
    if (!proseElement || !proseElement.contains(toolbarTargetImageElement)) return;
    if (actionCode.indexOf('size-') === 0) {
      setImageSizeCode(toolbarTargetImageElement, actionCode.slice('size-'.length));
    } else if (actionCode.indexOf('align-') === 0) {
      setImageAlignCode(toolbarTargetImageElement, actionCode.slice('align-'.length));
    } else if (actionCode === 'delete') {
      toolbarTargetImageElement.parentNode.removeChild(toolbarTargetImageElement);
      hideFloatingToolbar();
      notifyProseChangedImmediately(proseElement);
      return;
    }
    syncToolbarActiveStates(toolbarTargetImageElement);
    showFloatingToolbarOverImage(toolbarTargetImageElement);
    notifyProseChangedImmediately(proseElement);
  }

  /* ====================================================
     CLICK on image — open the floating toolbar
     ==================================================== */
  function isProseImageElement(domElement) {
    return domElement
      && domElement.tagName === 'IMG'
      && domElement.classList.contains(IMAGE_CSS_CLASS);
  }
  document.addEventListener('click', function (clickEvent) {
    var proseElement = activeProseElement();
    if (!proseElement) return;
    if (isProseImageElement(clickEvent.target) && proseElement.contains(clickEvent.target)) {
      // The trailing click after a corner-handle resize would otherwise
      // re-open the toolbar over the just-resized image. Skip when the
      // resize handler set its in-progress flag (cleared on the next
      // tick after pointerup).
      if (clickEvent.target.dataset.bookwriterResizeInProgress === '1') return;
      clickEvent.preventDefault();
      showFloatingToolbarOverImage(clickEvent.target);
      return;
    }
    // Click on toolbar / drag handle keeps it open
    if (floatingToolbarElement && floatingToolbarElement.contains(clickEvent.target)) return;
    if (floatingDragHandleElement && clickEvent.target === floatingDragHandleElement) return;
    hideFloatingToolbar();
  });

  /* Show the toolbar + drag handle on HOVER too (Gemini blueprint pt 1
     "appears on hover") — discoverable without an extra click. The
     toolbar still STAYS open after click; a hover-leave triggers a
     short grace-period delay (250ms) before hiding so the user has
     time to traverse the small visual gap between the image and the
     toolbar above it without the toolbar vanishing mid-reach. Standard
     tooltip-library pattern. Re-entering the image / toolbar / handle
     cancels the pending hide. */
  var HOVER_HIDE_GRACE_PERIOD_MS = 250;
  var pendingHoverHideTimerHandle = null;

  function cancelPendingToolbarHide() {
    if (pendingHoverHideTimerHandle !== null) {
      clearTimeout(pendingHoverHideTimerHandle);
      pendingHoverHideTimerHandle = null;
    }
  }
  function schedulePendingToolbarHide() {
    cancelPendingToolbarHide();
    pendingHoverHideTimerHandle = setTimeout(function () {
      pendingHoverHideTimerHandle = null;
      // A drag started during the grace period; preserve the toolbar.
      if (activeDragState) return;
      hideFloatingToolbar();
    }, HOVER_HIDE_GRACE_PERIOD_MS);
  }

  function isMouseOverPreservedToolbarElement(targetElement) {
    if (floatingToolbarElement && floatingToolbarElement.contains(targetElement)) return true;
    if (floatingDragHandleElement && targetElement === floatingDragHandleElement) return true;
    return false;
  }

  document.addEventListener('mouseover', function (mouseOverEvent) {
    var proseElement = activeProseElement();
    if (!proseElement) return;
    if (isProseImageElement(mouseOverEvent.target) && proseElement.contains(mouseOverEvent.target)) {
      cancelPendingToolbarHide();
      showFloatingToolbarOverImage(mouseOverEvent.target);
      return;
    }
    if (isMouseOverPreservedToolbarElement(mouseOverEvent.target)) {
      cancelPendingToolbarHide();
      return;
    }
    if (activeDragState) return;
    schedulePendingToolbarHide();
  });
  window.addEventListener('scroll', function () {
    if (toolbarTargetImageElement) showFloatingToolbarOverImage(toolbarTargetImageElement);
  }, { passive: true });
  window.addEventListener('resize', function () {
    if (toolbarTargetImageElement) showFloatingToolbarOverImage(toolbarTargetImageElement);
  });

  /* ====================================================
     DRAG-TO-REPOSITION via the drag handle
     ==================================================== */
  var activeDragState = null;
  function handleDragHandlePointerDown(pointerDownEvent) {
    if (!toolbarTargetImageElement) return;
    pointerDownEvent.preventDefault();
    activeDragState = {
      pointerStartX: pointerDownEvent.clientX,
      pointerStartY: pointerDownEvent.clientY,
      draggedImageElement: toolbarTargetImageElement,
      ghostElement: null,
      dropIndicatorElement: null,
      hasMovedPastThreshold: false,
    };
    document.addEventListener('pointermove', handleDragHandlePointerMove);
    document.addEventListener('pointerup', handleDragHandlePointerUp, { once: true });
  }
  function handleDragHandlePointerMove(pointerMoveEvent) {
    if (!activeDragState) return;
    var pointerDeltaX = pointerMoveEvent.clientX - activeDragState.pointerStartX;
    var pointerDeltaY = pointerMoveEvent.clientY - activeDragState.pointerStartY;
    var pointerDistance = Math.sqrt(pointerDeltaX * pointerDeltaX + pointerDeltaY * pointerDeltaY);
    if (!activeDragState.hasMovedPastThreshold) {
      if (pointerDistance < DRAG_DISTANCE_TO_ENGAGE_PX) return;
      activeDragState.hasMovedPastThreshold = true;
      activeDragState.ghostElement = createDragGhostFor(activeDragState.draggedImageElement);
      activeDragState.dropIndicatorElement = createDropIndicatorElement();
      // Fade the source so it's clear which image is being moved
      // (Gemini blueprint pt 3 "is-dragging" class).
      activeDragState.draggedImageElement.classList.add('bookwriter-prose-image-is-dragging');
      hideFloatingToolbar();
    }
    activeDragState.ghostElement.style.top  = (pointerMoveEvent.clientY + DRAG_GHOST_FOLLOW_OFFSET_PX) + 'px';
    activeDragState.ghostElement.style.left = (pointerMoveEvent.clientX + DRAG_GHOST_FOLLOW_OFFSET_PX) + 'px';
    showDropIndicatorAtPoint(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
  }
  function handleDragHandlePointerUp(pointerUpEvent) {
    document.removeEventListener('pointermove', handleDragHandlePointerMove);
    if (!activeDragState) return;
    if (activeDragState.hasMovedPastThreshold) {
      var dropTargetElement = findDropTargetBlockAtPoint(pointerUpEvent.clientX, pointerUpEvent.clientY);
      if (dropTargetElement && dropTargetElement.parentNode) {
        var draggedImageElement = activeDragState.draggedImageElement;
        // Move the SAME element into the new slot. Because we move
        // (not copy), no duplicate is created — even if the browser
        // would have done so via HTML5 drag.
        if (draggedImageElement.parentNode) {
          draggedImageElement.parentNode.removeChild(draggedImageElement);
        }
        dropTargetElement.parentNode.insertBefore(draggedImageElement, dropTargetElement);
        var proseElement = activeProseElement();
        if (proseElement) notifyProseChangedImmediately(proseElement);
        // Re-show the toolbar over the now-moved image
        setTimeout(function () { showFloatingToolbarOverImage(draggedImageElement); }, 0);
      }
    }
    if (activeDragState.ghostElement && activeDragState.ghostElement.parentNode) {
      activeDragState.ghostElement.parentNode.removeChild(activeDragState.ghostElement);
    }
    if (activeDragState.dropIndicatorElement && activeDragState.dropIndicatorElement.parentNode) {
      activeDragState.dropIndicatorElement.parentNode.removeChild(activeDragState.dropIndicatorElement);
    }
    if (activeDragState.draggedImageElement) {
      activeDragState.draggedImageElement.classList.remove('bookwriter-prose-image-is-dragging');
    }
    activeDragState = null;
  }
  function createDragGhostFor(sourceImageElement) {
    var ghostElement = document.createElement('img');
    ghostElement.src = sourceImageElement.src;
    ghostElement.alt = '';
    ghostElement.className = 'bookwriter-prose-image-drag-ghost';
    ghostElement.draggable = false;
    document.body.appendChild(ghostElement);
    return ghostElement;
  }
  function createDropIndicatorElement() {
    var dropIndicatorElement = document.createElement('div');
    dropIndicatorElement.className = 'bookwriter-prose-image-drop-indicator';
    dropIndicatorElement.id = 'bookwriter-prose-image-drop-indicator';
    return dropIndicatorElement;
  }
  function findDropTargetBlockAtPoint(clientX, clientY) {
    var proseElement = activeProseElement();
    if (!proseElement) return null;
    // Look for the nearest direct child of the prose at the pointer
    // — that's the element we'll insertBefore. Walk up from
    // elementFromPoint until we hit a child of the prose.
    var elementUnderPointer = document.elementFromPoint(clientX, clientY);
    if (!elementUnderPointer) return proseElement.lastChild || null;
    if (elementUnderPointer === proseElement) return proseElement.lastChild || null;
    if (elementUnderPointer === activeDragState.draggedImageElement) return null;
    while (elementUnderPointer && elementUnderPointer.parentNode !== proseElement) {
      elementUnderPointer = elementUnderPointer.parentNode;
      if (!elementUnderPointer || elementUnderPointer === document.body) return proseElement.lastChild || null;
    }
    if (elementUnderPointer === activeDragState.draggedImageElement) {
      return elementUnderPointer.nextSibling || null;
    }
    // Decide insert-before vs insert-after based on the pointer's Y
    // position relative to the target block's mid-line.
    var targetRect = elementUnderPointer.getBoundingClientRect();
    var pointerIsInUpperHalf = clientY < (targetRect.top + targetRect.height / 2);
    return pointerIsInUpperHalf ? elementUnderPointer : elementUnderPointer.nextSibling;
  }
  function showDropIndicatorAtPoint(clientX, clientY) {
    if (!activeDragState || !activeDragState.dropIndicatorElement) return;
    var dropTargetElement = findDropTargetBlockAtPoint(clientX, clientY);
    if (!dropTargetElement) return;
    if (activeDragState.dropIndicatorElement.parentNode) {
      activeDragState.dropIndicatorElement.parentNode.removeChild(activeDragState.dropIndicatorElement);
    }
    if (dropTargetElement.parentNode) {
      dropTargetElement.parentNode.insertBefore(activeDragState.dropIndicatorElement, dropTargetElement);
    }
  }

  /* ====================================================
     CONTINUOUS RESIZE — bottom-right corner pointer drag.
     The S / M / F toolbar buttons cover the common cases,
     but a continuous drag is useful when the writer wants
     a precise width that doesn't match a preset (e.g. an
     image that should sit at 360px so the caption below
     reads at the same line-length as the next paragraph).
     Hit-tested to the bottom-right 18×18px square — anywhere
     else on the image opens the toolbar instead. The size
     class is removed when the user starts a manual resize so
     the explicit pixel width takes effect; clicking S/M/F
     in the toolbar restores the class-driven width.
     ==================================================== */
  var RESIZE_HANDLE_HIT_AREA_PX = 18;
  var MIN_IMAGE_WIDTH_PX = 80;
  var continuousResizeState = null;

  function isPointInImageResizeCorner(imageElement, clientX, clientY) {
    var imageRect = imageElement.getBoundingClientRect();
    return (
         clientX >= imageRect.right  - RESIZE_HANDLE_HIT_AREA_PX
      && clientX <= imageRect.right
      && clientY >= imageRect.bottom - RESIZE_HANDLE_HIT_AREA_PX
      && clientY <= imageRect.bottom
    );
  }
  function handleResizeCornerPointerDown(pointerDownEvent) {
    if (!isProseImageElement(pointerDownEvent.target)) return;
    var proseElement = activeProseElement();
    if (!proseElement || !proseElement.contains(pointerDownEvent.target)) return;
    if (!isPointInImageResizeCorner(pointerDownEvent.target, pointerDownEvent.clientX, pointerDownEvent.clientY)) return;
    pointerDownEvent.preventDefault();
    var startingImageRect = pointerDownEvent.target.getBoundingClientRect();
    continuousResizeState = {
      imageElement: pointerDownEvent.target,
      pointerStartX: pointerDownEvent.clientX,
      startingImageWidthPx: startingImageRect.width,
      proseInnerWidthPx: proseElement.clientWidth,
    };
    // Mark the image as being resized so the click handler knows
    // to skip the toolbar-open on the trailing click event.
    pointerDownEvent.target.dataset.bookwriterResizeInProgress = '1';
    document.addEventListener('pointermove', handleResizeCornerPointerMove);
    document.addEventListener('pointerup', handleResizeCornerPointerUp, { once: true });
  }
  function handleResizeCornerPointerMove(pointerMoveEvent) {
    if (!continuousResizeState) return;
    var pointerDeltaX = pointerMoveEvent.clientX - continuousResizeState.pointerStartX;
    var nextWidthPx = Math.max(
      MIN_IMAGE_WIDTH_PX,
      Math.min(
        continuousResizeState.proseInnerWidthPx,
        continuousResizeState.startingImageWidthPx + pointerDeltaX
      )
    );
    var roundedNextWidthPx = Math.round(nextWidthPx);
    // Strip the size class so the inline width takes effect, but
    // keep the align class so left/center/right placement stays.
    SIZE_OPTIONS.forEach(function (sizeCode) {
      continuousResizeState.imageElement.classList.remove(SIZE_CSS_CLASS_PREFIX + sizeCode);
    });
    delete continuousResizeState.imageElement.dataset.size;
    continuousResizeState.imageElement.style.width = roundedNextWidthPx + 'px';
  }
  function handleResizeCornerPointerUp() {
    document.removeEventListener('pointermove', handleResizeCornerPointerMove);
    if (!continuousResizeState) return;
    var resizedImageElement = continuousResizeState.imageElement;
    continuousResizeState = null;
    setTimeout(function () { delete resizedImageElement.dataset.bookwriterResizeInProgress; }, 0);
    var proseElement = activeProseElement();
    if (proseElement) notifyProseChangedImmediately(proseElement);
    showFloatingToolbarOverImage(resizedImageElement);
  }
  document.addEventListener('pointerdown', handleResizeCornerPointerDown);


  /* ====================================================
     PREVENT NATIVE DRAG-COPY on prose images
     ==================================================== */
  document.addEventListener('dragstart', function (dragStartEvent) {
    var proseElement = activeProseElement();
    if (!proseElement) return;
    if (isProseImageElement(dragStartEvent.target) && proseElement.contains(dragStartEvent.target)) {
      dragStartEvent.preventDefault();
    }
  });

  /* ====================================================
     Wire — delegated on document so chapter-switched DOM
     keeps the handlers without re-binding.
     ==================================================== */
  document.addEventListener('dragover', handleProseDragOver);
  document.addEventListener('drop', handleProseDrop);
  document.addEventListener('click', handleToolbarImageButtonClick);
})();

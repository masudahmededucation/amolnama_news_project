/* ============================================================
   bookwriter — cover designer (standalone module)
   --------------------------------------------------------
   Extracted from page-inkwell.js. Owns all cover-* DOM:
   templates, fonts, palettes, backgrounds, sliders, live
   preview, and the persistence calls (POST to
   /api/book/<id>/cover-design/save/).

   Self-contained IIFE — no closure dependency on the main
   page-inkwell.js. Element refs are queried on init; the
   chapters element's data-book-id resolves the book id for
   the persist endpoint; window.bookwriter.apiPost handles
   CSRF + JSON wiring.

   Listener consolidation: in the previous flat layout the
   template-tile / font-button / palette-tile each had TWO
   click handlers — one in the UI section (live preview) and
   one in the persist section (debounced POST). Both are now
   merged into a single handler per element, doing the UI
   update first and then the persist call. Saves listener
   count, removes the chance for the two paths to drift.

   External entrypoints (called from inline onclick):
     window.zoomCover(delta)
     window.flipCover()
     window.setAsCover()
   ============================================================ */
(function () {
  'use strict';

  var coverElement       = document.getElementById('cover');
  var coverArtElement    = document.getElementById('coverArt');
  var coverTitleElement  = document.getElementById('cvTitle');
  var coverAuthorElement = document.getElementById('cvAuthor');
  var inputTitleElement     = document.getElementById('inTitle');
  var inputSubtitleElement  = document.getElementById('inSubtitle');
  var inputAuthorElement    = document.getElementById('inAuthor');
  var titleSizeSliderElement     = document.getElementById('titleSize');
  var letterSpacingSliderElement = document.getElementById('tracking');
  var titleSizeReadoutElement     = document.getElementById('sizeVal');
  var letterSpacingReadoutElement = document.getElementById('trackVal');
  var zoomReadoutElement = document.getElementById('zoomLabel');

  if (!coverElement) return; // page without cover surface (rare) — bail silently

  /* ---------- LIVE-PREVIEW STATE ---------- */
  var currentTemplateCode = 'classical';
  var currentPalette      = { bg: '#f4ede0', fg: '#1a1612', accent: '#8b2a1f' };
  var currentBackgroundCode = 'solid';
  var zoomPercent = 100;

  /* ---------- PERSIST WIRING ---------- */
  var COVER_AUTOSAVE_DEBOUNCE_MILLISECONDS = 600;
  var coverAutosaveTimerHandle;
  function persistCoverFieldsAfterDebounce(payload) {
    var chaptersListElement = document.getElementById('chapters');
    var bookIdString = chaptersListElement ? chaptersListElement.dataset.bookId : null;
    if (!bookIdString) return;
    if (coverAutosaveTimerHandle) clearTimeout(coverAutosaveTimerHandle);
    coverAutosaveTimerHandle = setTimeout(function () {
      window.bookwriter.apiPost(
        '/bookwriter/api/book/' + encodeURIComponent(bookIdString) + '/cover-design/save/',
        payload
      ).catch(function () { /* silent retry on next interaction */ });
    }, COVER_AUTOSAVE_DEBOUNCE_MILLISECONDS);
  }

  /* ---------- COLOUR HELPERS ---------- */
  function hexWithAlpha(hex, alpha) {
    var redChannel   = parseInt(hex.slice(1, 3), 16);
    var greenChannel = parseInt(hex.slice(3, 5), 16);
    var blueChannel  = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + redChannel + ',' + greenChannel + ',' + blueChannel + ',' + alpha + ')';
  }
  function shade(hex, amount) {
    var redChannel   = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    var greenChannel = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    var blueChannel  = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return 'rgb(' + redChannel + ',' + greenChannel + ',' + blueChannel + ')';
  }

  /* ---------- BACKGROUND PAINT ---------- */
  function applyBackgroundToCoverPreview() {
    coverElement.style.background = currentPalette.bg;
    if (coverArtElement) coverArtElement.style.background = '';

    if (currentTemplateCode === 'photo' && coverArtElement) {
      coverArtElement.style.background =
        'linear-gradient(transparent 30%, rgba(0,0,0,0.55) 100%),' +
        'radial-gradient(ellipse at 30% 20%, ' + hexWithAlpha(currentPalette.accent, 0.3) + ', transparent 60%),' +
        'linear-gradient(165deg, ' + currentPalette.fg + ' 0%, ' + currentPalette.accent + ' 60%, ' + currentPalette.bg + ' 100%)';
      return;
    }

    switch (currentBackgroundCode) {
      case 'solid':
        coverElement.style.background = currentPalette.bg;
        break;
      case 'grad-1':
        coverElement.style.background = 'linear-gradient(135deg, ' + currentPalette.bg + ', ' + currentPalette.accent + ')';
        break;
      case 'grad-2':
        coverElement.style.background = 'linear-gradient(165deg, ' + currentPalette.fg + ', ' + currentPalette.bg + ')';
        break;
      case 'grad-3':
        coverElement.style.background = 'linear-gradient(135deg, ' + currentPalette.fg + ', ' + shade(currentPalette.fg, 20) + ')';
        break;
      case 'noise':
        coverElement.style.background = currentPalette.bg;
        if (coverArtElement) {
          coverArtElement.style.background = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='3'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/></svg>\")";
          coverArtElement.style.mixBlendMode = 'multiply';
        }
        break;
      case 'dots':
        coverElement.style.background = 'radial-gradient(' + currentPalette.fg + ' 1.5px, transparent 1.5px) 0 0 / 18px 18px, ' + currentPalette.bg;
        break;
      case 'stripes':
        coverElement.style.background = 'repeating-linear-gradient(45deg, ' + currentPalette.accent + ', ' + currentPalette.accent + ' 6px, ' + currentPalette.bg + ' 6px, ' + currentPalette.bg + ' 18px)';
        break;
    }
  }

  /* ---------- TEXT INPUTS (pure preview, no persist — title/author
       persist via the book-title autosave handled in page-inkwell.js
       through a separate channel). ---------- */
  if (inputTitleElement) {
    inputTitleElement.addEventListener('input', function () {
      if (coverTitleElement) coverTitleElement.innerText = inputTitleElement.value || 'Untitled';
    });
  }
  if (inputAuthorElement) {
    inputAuthorElement.addEventListener('input', function () {
      if (coverAuthorElement) coverAuthorElement.innerText = inputAuthorElement.value || 'Anonymous';
    });
  }
  if (inputSubtitleElement) {
    inputSubtitleElement.addEventListener('input', function () {
      var existingSubtitleElement = document.querySelector('.bookwriter-cover-art-subtitle');
      if (inputSubtitleElement.value.trim()) {
        if (existingSubtitleElement) {
          existingSubtitleElement.innerText = inputSubtitleElement.value;
        } else if (coverTitleElement) {
          var subtitleElement = document.createElement('div');
          subtitleElement.className = 'bookwriter-cover-art-subtitle';
          subtitleElement.style.cssText = "font-family: 'EB Garamond', serif; font-style: italic; font-size: 14px; margin-top: 10px; opacity: 0.8;";
          subtitleElement.innerText = inputSubtitleElement.value;
          coverTitleElement.insertAdjacentElement('afterend', subtitleElement);
        }
      } else if (existingSubtitleElement) {
        existingSubtitleElement.remove();
      }
    });
  }

  /* ---------- TEMPLATE TILES — single click handler does preview +
       persist. (Was two separate handlers; collapsed.) ---------- */
  document.querySelectorAll('.bookwriter-cover-template-tile').forEach(function (templateTileElement) {
    templateTileElement.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-cover-template-tile').forEach(function (otherTemplateTileElement) {
        otherTemplateTileElement.classList.remove('bookwriter-cover-template-tile-is-selected');
      });
      templateTileElement.classList.add('bookwriter-cover-template-tile-is-selected');
      currentTemplateCode = templateTileElement.dataset.style;
      if (coverElement && currentTemplateCode) coverElement.dataset.style = currentTemplateCode;
      applyBackgroundToCoverPreview();
      if (currentTemplateCode) persistCoverFieldsAfterDebounce({ cover_template_code: currentTemplateCode });
    });
  });

  /* ---------- FONT BUTTONS — single handler. ---------- */
  document.querySelectorAll('#fontPick button').forEach(function (fontPickButtonElement) {
    fontPickButtonElement.addEventListener('click', function () {
      document.querySelectorAll('#fontPick button').forEach(function (otherFontPickButtonElement) {
        otherFontPickButtonElement.classList.remove('bookwriter-font-pick-button-is-active');
      });
      fontPickButtonElement.classList.add('bookwriter-font-pick-button-is-active');
      var fontCode = fontPickButtonElement.dataset.font;
      if (coverElement) {
        coverElement.classList.remove('bookwriter-font-serif', 'bookwriter-font-italic', 'bookwriter-font-body', 'bookwriter-font-mono');
        if (fontCode) coverElement.classList.add('font-' + fontCode);
      }
      if (fontCode) persistCoverFieldsAfterDebounce({ cover_font_code: fontCode });
    });
  });

  /* ---------- TITLE SIZE / LETTER SPACING SLIDERS — preview on
       input (every pixel), persist on change (release). ---------- */
  if (titleSizeSliderElement) {
    titleSizeSliderElement.addEventListener('input', function () {
      if (coverTitleElement) coverTitleElement.style.fontSize = titleSizeSliderElement.value + 'px';
      if (titleSizeReadoutElement) titleSizeReadoutElement.textContent = titleSizeSliderElement.value + 'pt';
    });
    titleSizeSliderElement.addEventListener('change', function () {
      persistCoverFieldsAfterDebounce({ cover_title_size_pt: parseInt(titleSizeSliderElement.value, 10) });
    });
  }
  if (letterSpacingSliderElement) {
    letterSpacingSliderElement.addEventListener('input', function () {
      var letterSpacingEmValue = letterSpacingSliderElement.value / 100;
      if (coverTitleElement) coverTitleElement.style.letterSpacing = letterSpacingEmValue + 'em';
      if (letterSpacingReadoutElement) {
        letterSpacingReadoutElement.textContent = (letterSpacingSliderElement.value > 0 ? '+' : '') + letterSpacingSliderElement.value;
      }
    });
    letterSpacingSliderElement.addEventListener('change', function () {
      persistCoverFieldsAfterDebounce({ cover_letter_spacing_unit: parseInt(letterSpacingSliderElement.value, 10) });
    });
  }

  /* ---------- PALETTE TILES — single handler. ---------- */
  document.querySelectorAll('.bookwriter-cover-palette-tile').forEach(function (paletteTileElement) {
    paletteTileElement.addEventListener('click', function () {
      document.querySelectorAll('.bookwriter-cover-palette-tile').forEach(function (otherPaletteTileElement) {
        otherPaletteTileElement.classList.remove('bookwriter-cover-palette-tile-is-selected');
      });
      paletteTileElement.classList.add('bookwriter-cover-palette-tile-is-selected');
      currentPalette = {
        bg:     paletteTileElement.dataset.bg,
        fg:     paletteTileElement.dataset.fg,
        accent: paletteTileElement.dataset.accent
      };
      if (coverElement) coverElement.style.color = currentPalette.fg;
      applyBackgroundToCoverPreview();
      persistCoverFieldsAfterDebounce({
        cover_palette_bg_hex_override:     currentPalette.bg     || null,
        cover_palette_fg_hex_override:     currentPalette.fg     || null,
        cover_palette_accent_hex_override: currentPalette.accent || null,
      });
    });
  });

  /* ---------- BACKGROUND OPTIONS — preview-only (preset codes
       previewed in JS; saved via the separate background-grid below
       which writes the FK code to the DB). The 'upload' branch reads
       the file as a data URL for live preview only — full upload
       persistence is a separate feature (deferred). ---------- */
  /* Single source of truth for "apply this image File as the cover
     background" — used by both the file-picker click on the Upload
     tile AND the drag-drop handler below. Swaps the upload-tile
     active state, sets currentBackgroundCode, paints the cover. */
  function applyUploadedImageFileAsCoverBackground(imageFile) {
    if (!imageFile || (imageFile.type || '').indexOf('image/') !== 0) return;
    var fileReader = new FileReader();
    fileReader.onload = function (fileReadEvent) {
      var uploadOptionElement = document.querySelector(
        '.bookwriter-background-option[data-bg="upload"]'
      );
      document.querySelectorAll('.bookwriter-background-option').forEach(function (otherBackgroundOptionElement) {
        otherBackgroundOptionElement.classList.remove('bookwriter-background-option-is-selected');
      });
      if (uploadOptionElement) uploadOptionElement.classList.add('bookwriter-background-option-is-selected');
      currentBackgroundCode = 'upload';
      coverElement.style.background = 'url(' + fileReadEvent.target.result + ') center/cover, ' + currentPalette.bg;
      if (coverArtElement) coverArtElement.style.background = 'linear-gradient(transparent 40%, rgba(0,0,0,0.55))';
    };
    fileReader.readAsDataURL(imageFile);
  }

  document.querySelectorAll('.bookwriter-background-option').forEach(function (backgroundOptionElement) {
    backgroundOptionElement.addEventListener('click', function () {
      if (backgroundOptionElement.dataset.bg === 'upload') {
        var fileInputElement = document.createElement('input');
        fileInputElement.type = 'file';
        fileInputElement.accept = 'image/*';
        fileInputElement.onchange = function (fileChangeEvent) {
          var pickedImageFile = fileChangeEvent.target.files && fileChangeEvent.target.files[0];
          applyUploadedImageFileAsCoverBackground(pickedImageFile);
        };
        fileInputElement.click();
        return;
      }
      document.querySelectorAll('.bookwriter-background-option').forEach(function (otherBackgroundOptionElement) {
        otherBackgroundOptionElement.classList.remove('bookwriter-background-option-is-selected');
      });
      backgroundOptionElement.classList.add('bookwriter-background-option-is-selected');
      currentBackgroundCode = backgroundOptionElement.dataset.bg;
      applyBackgroundToCoverPreview();
    });
  });

  /* Drag-drop image onto the cover surface — same effect as clicking
     the Upload tile then picking a file, but discoverable for users
     who already know the drag-drop pattern from prose images. The
     dragover handler must preventDefault to allow the drop event;
     dropEffect = 'copy' shows the file-copy cursor over the cover. */
  function isImageFileDragEvent(dragEvent) {
    if (!dragEvent.dataTransfer) return false;
    var transferTypes = dragEvent.dataTransfer.types;
    if (!transferTypes) return false;
    for (var transferTypeIndex = 0; transferTypeIndex < transferTypes.length; transferTypeIndex++) {
      if (transferTypes[transferTypeIndex] === 'Files') return true;
    }
    return false;
  }
  coverElement.addEventListener('dragover', function (dragOverEvent) {
    if (!isImageFileDragEvent(dragOverEvent)) return;
    dragOverEvent.preventDefault();
    if (dragOverEvent.dataTransfer) dragOverEvent.dataTransfer.dropEffect = 'copy';
  });
  coverElement.addEventListener('drop', function (dropEvent) {
    if (!isImageFileDragEvent(dropEvent)) return;
    dropEvent.preventDefault();
    var droppedFiles = dropEvent.dataTransfer && dropEvent.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;
    applyUploadedImageFileAsCoverBackground(droppedFiles[0]);
  });

  /* ---------- BACKGROUND GRID (8 preset DB-backed backgrounds) —
       persists the FK code via the cover-design endpoint. ---------- */
  document.querySelectorAll('#bookwriter-cover-background-grid .bookwriter-cover-background-button').forEach(function (backgroundButton) {
    backgroundButton.addEventListener('click', function () {
      var backgroundCode = backgroundButton.dataset.backgroundCode || null;
      if (!backgroundCode) return;
      document.querySelectorAll('#bookwriter-cover-background-grid .bookwriter-cover-background-button').forEach(function (otherBackgroundButton) {
        otherBackgroundButton.classList.toggle('bookwriter-cover-background-button-is-selected', otherBackgroundButton === backgroundButton);
      });
      persistCoverFieldsAfterDebounce({ cover_background_code: backgroundCode });
    });
  });

  /* ---------- ZOOM / FLIP — exposed via window for inline onclick. ---------- */
  function zoomCover(delta) {
    zoomPercent = Math.max(60, Math.min(160, zoomPercent + delta));
    if (zoomReadoutElement) zoomReadoutElement.textContent = zoomPercent + '%';
    coverElement.style.width = (340 * zoomPercent / 100) + 'px';
  }
  window.zoomCover = zoomCover;

  function flipCover() {
    coverElement.style.transform = coverElement.style.transform.indexOf('rotateY(6deg)') !== -1
      ? 'perspective(2000px) rotateY(-6deg)'
      : 'perspective(2000px) rotateY(6deg)';
  }
  window.flipCover = flipCover;

  /* ---------- SET AS COVER — persist the active template code to
       the book row and surface success on the button label. ---------- */
  window.setAsCover = function () {
    var setCoverButton      = document.querySelector('.bookwriter-set-as-cover');
    var setCoverButtonLabel = setCoverButton ? setCoverButton.querySelector('span') : null;
    var activeTemplateTile  = document.querySelector('#templates .bookwriter-cover-template-tile-is-selected');
    var templateCode        = activeTemplateTile ? (activeTemplateTile.dataset.style || null) : null;
    if (!templateCode) {
      if (setCoverButtonLabel) setCoverButtonLabel.innerText = 'Pick a template first';
      return;
    }
    var chaptersListElement = document.getElementById('chapters');
    var bookIdString = chaptersListElement ? chaptersListElement.dataset.bookId : null;
    if (!bookIdString) return;
    window.bookwriter.apiPost(
      '/bookwriter/api/book/' + encodeURIComponent(bookIdString) + '/cover-design/save/',
      { cover_template_code: templateCode }
    )
      .then(function () {
        if (setCoverButton) setCoverButton.style.background = 'var(--moss)';
        if (setCoverButtonLabel) setCoverButtonLabel.innerText = 'Cover saved to manuscript';
        setTimeout(function () {
          if (setCoverButton) setCoverButton.style.background = 'var(--ink)';
          if (setCoverButtonLabel) setCoverButtonLabel.innerText = 'Set as book cover';
        }, 2000);
      })
      .catch(function () {
        if (setCoverButtonLabel) setCoverButtonLabel.innerText = 'Save failed — try again';
      });
  };
})();

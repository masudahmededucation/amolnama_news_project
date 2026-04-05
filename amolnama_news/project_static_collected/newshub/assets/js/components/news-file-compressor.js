/**
 * news-file-compressor.js
 * Client-side image compression using Canvas API.
 * Automatically reduces oversized image files to fit within ref_asset_type limits.
 * Non-image files cannot be compressed client-side and are passed through as-is.
 *
 * Exposes: window.newshubFileCompressor.compress(file, maxSizeBytes)
 * Returns: Promise<{ file: File, wasCompressed: boolean }>
 */
(function () {

  /* MIME types we can compress via Canvas */
  const COMPRESSIBLE = {
    'image/jpeg': { quality: 0.65, canReduceQuality: true },
    'image/jpg':  { quality: 0.65, canReduceQuality: true },
    'image/webp': { quality: 0.65, canReduceQuality: true },
    'image/png':  { quality: undefined, canReduceQuality: false }
  };

  /**
   * Load an image File into an HTMLImageElement.
   */
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  }

  /**
   * Draw image to canvas at given dimensions and export as Blob.
   */
  function canvasToBlob(img, width, height, mimeType, quality) {
    return new Promise(function (resolve, reject) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(function (blob) {
        if (blob) { resolve(blob); }
        else { reject(new Error('Canvas toBlob failed')); }
      }, mimeType, quality);
    });
  }

  /**
   * Compress an image file to fit within maxSizeBytes.
   * Strategy:
   *   1. Re-encode at medium quality (0.65 for JPEG/WebP)
   *   2. If still too large, scale down dimensions by 80% and retry
   *   3. Up to 4 attempts total
   *   4. If still too large after all attempts, return best result anyway
   *
   * @param {File} file
   * @param {number} maxSizeBytes
   * @returns {Promise<{ file: File, wasCompressed: boolean }>}
   */
  function compressImage(file, maxSizeBytes) {
    const settings = COMPRESSIBLE[file.type];
    if (!settings) {
      return Promise.resolve({ file: file, wasCompressed: false });
    }

    return loadImage(file).then(function (img) {
      const mimeType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      const quality = settings.quality;
      const MAX_ATTEMPTS = 4;

      function attempt(w, h, q, n) {
        return canvasToBlob(img, w, h, mimeType, q).then(function (blob) {
          if (blob.size <= maxSizeBytes || n >= MAX_ATTEMPTS) {
            /* Build a new File with the original name and type */
            const compressed = new File([blob], file.name, {
              type: file.type,
              lastModified: file.lastModified
            });
            return { file: compressed, wasCompressed: true };
          }
          /* Scale down by 80% and slightly reduce quality */
          const newW = Math.round(w * 0.8);
          const newH = Math.round(h * 0.8);
          const newQ = q !== undefined ? Math.max(q - 0.1, 0.3) : undefined;
          return attempt(newW, newH, newQ, n + 1);
        });
      }

      return attempt(width, height, quality, 1);
    });
  }

  /**
   * Main entry point.
   * @param {File} file          — the file to compress
   * @param {number} maxSizeBytes — target max size in bytes
   * @returns {Promise<{ file: File, wasCompressed: boolean }>}
   */
  function compress(file, maxSizeBytes) {
    /* Already within limit — no compression needed */
    if (file.size <= maxSizeBytes) {
      return Promise.resolve({ file: file, wasCompressed: false });
    }

    /* Check if this is a compressible image type */
    if (COMPRESSIBLE[file.type]) {
      return compressImage(file, maxSizeBytes);
    }

    /* Non-image or unsupported image — can't compress client-side, pass through */
    return Promise.resolve({ file: file, wasCompressed: false });
  }

  window.newshubFileCompressor = { compress: compress };

})();

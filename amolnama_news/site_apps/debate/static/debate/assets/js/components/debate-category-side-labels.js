/**
 * debate-category-side-labels.js — Shared logic for debate category side-label auto-fill.
 *
 * When the category dropdown changes:
 *   - If the selected category has metadata in #debate-category-metadata-json with
 *     `blue_side_label_bn` / `red_side_label_bn` keys, auto-fill blank side-label inputs
 *     with those values and mark them as auto-filled (data-auto-filled="1").
 *   - Switching to a category without metadata (or back to one) clears ONLY the
 *     auto-filled values — never values the user typed manually.
 *
 * Manual user input on the side-label inputs removes the auto-filled flag, so any
 * subsequent category switch leaves the user's value untouched.
 *
 * Source of truth: [content].[ref_content_subcategory].subcategory_metadata_json
 * — added by content/views or any view that calls
 *   get_subcategory_metadata_map('blog_debate_category')
 * and renders the result as a <script type="application/json"
 *   id="debate-category-metadata-json"> block.
 *
 * Adding a new debate category with default side labels = ONE DB INSERT row, zero JS changes.
 *
 * Used by:
 *   - debate-home.js (create-topic form)
 *   - debate-arena.js (edit-topic form)
 *
 * Usage:
 *   debateCategorySideLabels.attach({
 *     categorySelect: <HTMLSelectElement>,
 *     blueSideLabelInput: <HTMLInputElement>,
 *     redSideLabelInput: <HTMLInputElement>,
 *     motionLabel: <HTMLLabelElement>,        // optional — hidden unless parliament
 *     motionTextarea: <HTMLTextAreaElement>,  // optional — hidden unless parliament
 *   });
 */
window.debateCategorySideLabels = (function () {
  'use strict';

  const AUTO_FILLED_ATTR = 'data-auto-filled';
  const PARLIAMENT_VALUE = 'parliament';

  /* Read DB-driven metadata once on script load. Falls back to {} if missing. */
  let categoryMetadata = {};
  const metadataElement = document.getElementById('debate-category-metadata-json');
  if (metadataElement && metadataElement.textContent.trim()) {
    try {
      categoryMetadata = JSON.parse(metadataElement.textContent);
    } catch (parseError) {
      console.error('debate-category-side-labels: failed to parse metadata JSON', parseError);
    }
  }

  function clearAutoFilledFlag() {
    this.removeAttribute(AUTO_FILLED_ATTR);
  }

  function attach(config) {
    const categorySelect = config.categorySelect;
    const blueInput = config.blueSideLabelInput;
    const redInput = config.redSideLabelInput;
    const motionLabel = config.motionLabel || null;
    const motionTextarea = config.motionTextarea || null;

    if (!categorySelect || !blueInput || !redInput) return;

    /* Manual edit removes the auto-filled flag — protects user-typed values */
    blueInput.addEventListener('input', clearAutoFilledFlag);
    redInput.addEventListener('input', clearAutoFilledFlag);

    categorySelect.addEventListener('change', function () {
      const selectedCategoryCode = categorySelect.value;
      const isParliament = selectedCategoryCode === PARLIAMENT_VALUE;

      /* Show/hide motion text fields if provided (parliament-only feature) */
      if (motionLabel) motionLabel.hidden = !isParliament;
      if (motionTextarea) motionTextarea.hidden = !isParliament;

      const meta = categoryMetadata[selectedCategoryCode] || null;
      const blueDefaultLabel = meta && meta.blue_side_label_bn ? meta.blue_side_label_bn : null;
      const redDefaultLabel = meta && meta.red_side_label_bn ? meta.red_side_label_bn : null;

      if (blueDefaultLabel || redDefaultLabel) {
        /* This category has default side labels — auto-fill blanks, mark them */
        if (blueDefaultLabel && !blueInput.value.trim()) {
          blueInput.value = blueDefaultLabel;
          blueInput.setAttribute(AUTO_FILLED_ATTR, '1');
        }
        if (redDefaultLabel && !redInput.value.trim()) {
          redInput.value = redDefaultLabel;
          redInput.setAttribute(AUTO_FILLED_ATTR, '1');
        }
      } else {
        /* This category has no default side labels — clear ONLY auto-filled values */
        if (blueInput.getAttribute(AUTO_FILLED_ATTR) === '1') {
          blueInput.value = '';
          blueInput.removeAttribute(AUTO_FILLED_ATTR);
        }
        if (redInput.getAttribute(AUTO_FILLED_ATTR) === '1') {
          redInput.value = '';
          redInput.removeAttribute(AUTO_FILLED_ATTR);
        }
      }
    });
  }

  return { attach: attach };
})();

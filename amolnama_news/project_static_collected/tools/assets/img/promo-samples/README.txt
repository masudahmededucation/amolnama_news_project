Tools Promo Card — Sample Work Images

Drop sample images here to make the home-feed tools-promo-card show a
"sample work vibe" — what the tool actually produces.

File names (must match exactly):
  reduce-file-size.webp
  file-conversion.webp
  zip-creator.webp
  passport-photo-resizer.webp
  background-remover.webp
  merge-documents.webp
  split-pdf.webp
  photo-album.webp
  gpa-calculator.webp
  age-calculator.webp

Recommended:
  - Format: webp (or jpg/png — webp = smallest)
  - Dimensions: 600 x 320 px (aspect 15:8, matches the CSS aspect-ratio)
  - Style: composite "before → after" works best for visual tools
           (background remover, passport resizer, file shrink).
           For calculators, a clean screenshot of the result is fine.

Behavior when missing:
  - Card renders without image (CSS aspect-ratio reserves no space if
    the .tools-promo-card-sample wrapper is absent).
  - The Django template only outputs the wrapper if tool_sample_image_url
    is non-empty (TOOLS_CATALOG entry).
  - The <img> onerror also hides the wrapper if the URL exists but the
    file is 404 — defensive.

To disable a sample image for a specific tool, set
  'tool_sample_image_url': ''
on its TOOLS_CATALOG entry in newsengine/promo_builders.py.

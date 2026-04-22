---
name: Snapshot mutable state at call time, not inside .then()
description: When a JS function fires an async operation that needs the current value of mutable state (DOM text, dataset, selected element), capture the value into a local variable BEFORE the network call. Reading it inside the .then() callback reads the latest value at resolve time, which can be a different state if the user has acted in between.
type: feedback
---

If you write `apiPost(...).then(function () { foo(elementRef.value) })`, you're reading `elementRef.value` at promise-resolve time, not at call time. If a user has typed / clicked / switched chapters in between, the .then() reads the CURRENT value, not the value the POST was made with. The result is a write to the wrong row, wrong target, wrong chapter.

**Why:** Bookwriter title-autosave bug 2026-04-22 — `performChapterTitleAutosave` POSTed the title, then in the .then() callback re-read `title.innerText` to mirror it into `.bookwriter-chapter-row-is-active .bookwriter-ch-title`. A chapter switch in flight made the .then() write the (now empty, mid-clear) title text into the WRONG (newly-active) rail row, leaving the just-saved chapter showing "Untitled Chapter" in the rail despite a real DB title. User reported "click chapter 2, sidebar says Untitled but it has a title."

**How to apply:**
- Any time a fetch/apiPost reads from `element.value`, `element.innerText`, `element.dataset.*`, `selection.getRangeAt(0)`, or `document.querySelector(...)` to send to the server — capture the snapshot into a `const` / `var` BEFORE the fetch.
- Inside the .then() / .catch(), use the snapshot, not a fresh DOM read.
- The same goes for "find the matching DOM element": if the function targets a row/element by id at call time, capture the element reference too — `document.querySelector(...)` re-evaluation in the .then() can hit a different element if active state has shifted.

**Pattern:**
```js
function performAutosave() {
  var chapterId = prose.dataset.chapterId;
  if (!chapterId) return;

  // SNAPSHOT — read once, before the network call
  var titleSnapshot = title.innerText || '';
  var matchingRailRowSnapshot = document.querySelector(
    '#chapters .bookwriter-chapter[data-chapter-id="' + chapterId + '"] .bookwriter-chapter-rail-row-title'
  );

  apiPost('/save/', { chapter_title: titleSnapshot }).then(function () {
    // Use snapshots — DOM may have changed under us
    if (matchingRailRowSnapshot) {
      matchingRailRowSnapshot.textContent = titleSnapshot || 'Untitled Chapter';
    }
  });
}
```

Avoid:
```js
apiPost('/save/', { chapter_title: title.innerText }).then(function () {
  document.querySelector('.bookwriter-chapter-row-is-active .bookwriter-ch-title').textContent = title.innerText;
  // ^ Both reads happen at resolve time, not call time. Wrong row, wrong text.
});
```

Bookwriter applies this pattern in:
- `performChapterTitleAutosave` (page-inkwell.js)
- `performChapterAutosave` for body html
- Both mirror their saved values into `chapterPayloadCacheById` so a SWR re-open never paints stale content over live edits.

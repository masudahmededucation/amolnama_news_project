---
name: Universal modularisation rule
description: Complete rules for modularised reusable components — UI, data entry, style, placeholders, documents, and collectstatic. Apply universally with no partial implementations.
type: feedback
---

When asked to modularise and make something reusable, do it universally. No picking and dropping.
Stop providing inconsistent information — consistency must be maintained "anywhere and everywhere."

This applies to ALL groups (Name, Identity, Party Details, Attachment, and any future groups)
on BOTH sides (UI + backend). Every modularised component must be the **same across everywhere**.

## 1. Personal Identity Group (UI rendering)

- Make it reusable and modularised. Changes in one place must reflect globally.
- Must be unique and identical for any and every location.
- Must be the same for accused, victim, and witness — **no differences at all**.
- Implement in ALL forms where referenced. Implement in ALL steps where referenced.
- All 3 rendering modes (template include, HTML string, DOM creation) must produce
  the same labels, attributes (data-bn/data-en, data-ph-bn/data-ph-en), wrapper structure,
  default option format, etc. Only CSS classes differ per role.

## 2. Style

- Style differently per role via the **CSS class** — that is proper modularisation.
- Never duplicate HTML structure to achieve different styling; use a single template
  with role-specific CSS classes (e.g., `.actor-accused`, `.actor-victim`, `.actor-witness`).

## 3. Documents

- Update ALL changes and field mapping documents whenever a modularised component changes.
- Every field-to-DB mapping must be written into the appropriate file in
  `site_apps/newshub/field_mapping/`. One file per form, common steps in
  `db-mapping-common-steps.txt`.

## 4. Placeholder format

- Placeholder values should mention English or Bengali fields in brackets.
- Example: `শেষ নাম (ইংরেজিতে)` — tells the user which language to type in.
- Apply this format consistently across all inputs in all forms.

## 5. Collectstatic

- Run `collectstatic --noinput` after any static file edit.
- Copy changes to `project_static_collected/` mirror as well when applicable.

## 6. Data entry / save operations

- Field mapping from UI fields to database columns must be uniform across ALL instances.
- Data entry order and format within the database must be identical.
- All data must be processed into the SAME table using the SAME data entry operations.
- All forms must use the SAME shared Python helper functions to save actor data.
- No form should have its own inline `Person.objects.create` or profile INSERT for
  standard modularised fields.
- This is NOT just a UI change — it is a standardised, modularised data entry format
  for the backend. Same JSON keys → same DB columns → same save operation → same tables.

Form-specific extras (WCV relationship, July mother name, etc.) are handled as
post-updates or additional table inserts AFTER the shared save completes.

## 7. Attachment / File Upload

- Attachment option must be modularised and reusable — one shared template partial,
  one shared JS module.
- Only **labels**, **hints**, and **CSS styles** differ per form context.
- The upload structure (file input, file list, add button, hidden JSON, featured-image
  radio, descriptions) must come from the single shared template/JS — never duplicated
  inline in form-specific component templates.
- Forms that need evidence/document uploads (crime, extortion, land-grab, etc.) must
  `{% include %}` the shared partial with context variables for label/hint/class,
  NOT copy-paste their own upload HTML.

## 8. Location Fields (Standard Setting)

- Location administrative cascade (Division → District → Upazila → etc.) must use
  standardised field settings across all forms.

## 9. Location Map Search

- Map search option must be a **separate, modularised module**.
- One shared template partial + one shared JS module.
- Only labels, hints, and CSS styles differ per form context.

## 10. Location Thana Search

- Thana search must be a **separate, modularised module**.
- Used in the GD/FIR radio button section when "Yes" is selected.
- Must be its own reusable include, not inline HTML inside form-specific templates.

## 11. GD/FIR (Law — General Diary / First Information Report)

- GD/FIR section must be a **separate, modularised module** — `law-gd-fir-section.html`.
- Appears inside the Legal Action step of forms that have legal proceedings.
- One shared template partial + one shared JS factory module (`news-law-gd-fir.js`).
- Template accepts `fir_prefix` context variable — all IDs generated from prefix.
- ID convention: `{prefix}-fir-status-radios`, `{prefix}-fir-status-data`,
  `{prefix}-fir-details-row`, `{prefix}-police-station`, `{prefix}-case-number`,
  `{prefix}-police-refused-row`, `{prefix}-police-refusal-statement`,
  `{prefix}-no-fir-row`, `{prefix}-no-fir-reason`.
- JS factory: `window.newshubLawGdFir.initLawGdFirSection({prefix, onChange})` —
  returns API with `isFirYes`, `isFirNo`, `isFirPoliceRefused`, `getFirStatusId`,
  `getPoliceStation`, `getCaseNumber`, `getPoliceRefusalStatement`, `getNoFirReason`,
  `resetFir`.
- Thana search (`news-thana-search-select.js`) is auto-initialized inside the factory
  when FIR = YES — no need for form-specific JS to init Tom Select on police station.
- FIR status data JSON (`{prefix}-fir-status-data`) must be provided by the parent
  template (either from view context or hardcoded fallback).
- Form-specific JS only handles form-specific fields (applicable laws, case status,
  support services, retaliation, remarks) — FIR logic is fully delegated to the factory.

## 12. Social Link

- Social link/source section must be modularised and reusable.
- One shared template partial, one shared JS module.
- Only labels, hints, and CSS styles differ per form context.

## 12. Additional rules for future modularisation

- **Single source of truth**: Each modularised component (JS module, Python helper,
  template partial) must exist in exactly ONE location. All consumers import/include from
  that single location. Never copy-paste a module and tweak it for a specific form.
- **Key naming contract**: JSON keys emitted by JS modules are the API contract between
  frontend and backend. Once established, keys must not change without updating ALL
  consumers (JS modules, Python helpers, field mapping docs) simultaneously.
- **New group checklist**: When adding a new reusable group:
  1. Define the JS module with `{groupName}Defaults` and `get{GroupName}Data()`.
  2. Create one template partial (`{group-name}-fields.html`).
  3. Add one shared Python helper (`_save_{group_name}()`).
  4. Document in `db-mapping-common-steps.txt`.
  5. Wire into every form/step that needs it — no partial rollouts.
- **No silent failures**: If a shared helper receives invalid data (e.g., missing required
  field), it must either raise an error or return `None` — never silently create
  incomplete records.
- **Test with all forms**: After changing a shared module/helper, verify it works for
  ALL forms that use it, not just the one you're currently editing.

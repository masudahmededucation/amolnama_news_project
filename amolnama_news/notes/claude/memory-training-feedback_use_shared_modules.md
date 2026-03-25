---
name: Use shared modules not manual field declarations
description: Always use newshubPersonName and newshubPersonIdentity shared modules instead of manually declaring DOM elements for standard name and identity fields
type: feedback
---

Always use the shared reusable JS modules for standard person fields. Never manually declare individual DOM elements for fields that belong to standard groups.

**Standard Name Group** (newshubPersonName):
- Template mode: `read(prefix)`, `bind(prefix, fn)`, `reset(prefix)`
- DOM repeater mode: `buildNameGroupDom(classPrefix, borderColor)`
- Fields: firstNameEn, lastNameEn, firstNameBn, lastNameBn, alias, fatherFirstName, fatherLastName

**Standard Personal Identity Group** (newshubPersonIdentity):
- Template mode: `read(prefix)`, `bind(prefix, fn)`, `reset(prefix)`
- DOM repeater mode: `buildIdentityGroupDom(classPrefix, refData, borderColor)`
- Fields: genderId, religionId, age, dob, districtId, contact

**Rule**: Form-specific JS files should ONLY manually handle extra fields that go into a separate WCV/form-specific group. Standard groups must use the shared modules.

**Why:** User has corrected this multiple times. Manual field declarations duplicate logic, miss fields (like alias was missed), and violate the modularisation principle. The shared modules are the single source of truth.

**How to apply:** When creating or modifying any form JS that has person name or identity fields, check if shared module functions exist first. Use them. Only add manual code for form-specific extra fields in their own separate group.

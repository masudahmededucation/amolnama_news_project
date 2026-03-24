# Edit Pre-Population Plan — Multistep News Forms

## Goal
When user clicks "Edit" on an article view, open the multistep form with ALL existing data pre-filled — headline, summary, body, location, tags, actors, AND investigation-specific data.

## Architecture

### URL Pattern
- **Create**: `/newshub/news-collection/multistep/extortion/` (no params)
- **Edit**: `/newshub/news-collection/multistep/extortion/?edit=<coll_news_entry_id>` (entry ID in query string)
- **View**: `/newshub/article/<slug>/` (public, read-only)

### Data Flow (Edit Mode)
```
article_detail.html [Edit Button]
    → GET /newshub/news-collection/multistep/extortion/?edit=123
    → views.py: news_collection_multistep_extortion(request)
        → detects request.GET['edit']
        → fetches CollNewsEntry + all related data
        → serializes to JSON
        → passes as context alongside normal form context
    → Template renders form + <script type="application/json" id="edit-data-*"> blocks
    → news-form-edit-load.js reads JSON, populates all fields
    → news-form-persist.js SKIPPED (edit data takes priority over localStorage)
```

### Key Decisions
1. **Same view function** — no separate edit view. `?edit=<id>` param triggers edit mode.
2. **Server-side data fetch** — Python reconstructs all JSON payloads from DB (extortion_incident_json, ext_legal, actors, etc.)
3. **Client-side population** — New JS file `news-form-edit-load.js` reads JSON from `<script>` tags and fills fields.
4. **localStorage skipped in edit mode** — `news-form-persist.js` must detect edit mode and skip restore.
5. **Submit = UPDATE** — `_handle_news_submission()` detects hidden `edit_entry_id` field and UPDATEs instead of CREATEs.
6. **Duplicate headline check** — Excludes own entry when checking for duplicates in edit mode.
7. **Permission check** — Only owner/admin can access `?edit=<id>`.

---

## Implementation Steps

### Step 1: Server-Side Edit Data Builder (`helpers.py`)

Add `build_edit_data(entry_id, form_type_code)` that returns a dict with ALL form data reconstructed from DB:

```python
{
    # Step 2 — Contributor
    'contributor': {
        'full_name_bn': '...',
        'type_id': 1,
        'email': '...',
        'phone': '...',
        'organization_id': None,
        'organization_custom': '...',
        'organisation_type_id': None,
    },

    # Step 3 — News Content
    'news_entry': {
        'headline_bn': '...',
        'summary_bn': '...',
        'content_body_bn': '...',
        'occurrence_at': '2026-03-20T14:30',
    },

    # Step 4-6 — Actors (accused/victim/witness)
    'accused': [ {name, alias, designation, org, patron, contact, statement, involvementTypeId, actorTypeId}, ... ],
    'victims': [ ... ],
    'witnesses': [ ... ],

    # Step 7 — Form-specific (extortion example)
    'extortion_incident': {
        'sectorId': 427,
        'amountDemanded': 50000,
        'amountTaken': 30000,
        'frequencyId': 438,
        'affiliationIds': [444, 448],
        'threatMethodIds': [452, 456],
        'consequenceIds': [461, 463],
        'bangladeshContextIds': [],
        'remarks': '...',
    },

    # Step 8 — Legal (extortion example)
    'ext_legal': {
        'firStatusId': 205,
        'policeStation': '...',
        'caseNumber': '...',
        'applicableLawIds': [474, 476],
        'caseStatusId': 487,
        'supportServiceIds': [478],
        'retaliationIds': [],
        'remarks': '...',
    },

    # Step 9 — Location
    'location': {
        'district_id': 10,
        'constituency_id': 45,
        'upazila_id': 120,
        'upazila_city_corporation_name': '...',
        'union_parishad_id': 500,
        'ward_name': '...',
        'village_moholla_name': '...',
        'latitude': '23.7461',
        'longitude': '90.3742',
        'formatted_address_bn': '...',
        'full_address_bn': '...',
    },

    # Step 10 — Social Sources
    'social_sources': [ {platformId, url, embedCode}, ... ],

    # Step 11 — Category & Tags
    'category_id': 5,
    'tag_ids': [12, 34, 56],
    'is_breaking': false,
}
```

#### BIT flag → status_id reconstruction

For extortion incident, reconstruct status_ids from BIT flags:
```python
# Sector: exactly one BIT is true → map back to status_id
SECTOR_BIT_TO_ID = {
    'sector_is_shop_market': 427,
    'sector_is_transport_vehicle': 428,
    'sector_is_construction_site': 429,
    'sector_is_contract_tender': 430,
    'sector_is_garment_factory': 431,
    'sector_is_crops_produce': 432,
    'sector_is_school_college': 433,
    'sector_is_healthcare_clinic': 434,
    'sector_is_phone_digital': 435,
    'sector_is_other': 436,
}

# Multi-select BIT flags → list of status_ids
AFFILIATION_BIT_TO_ID = {
    'accused_is_political_student_wing': 444,
    'accused_is_transport_association': 445,
    'accused_is_business_trade_association': 446,
    'accused_is_professional_gang': 447,
    'accused_is_law_enforcement': 448,
    'accused_is_teen_gang': 449,
    'accused_is_disguised_association_fee': 450,
    'accused_is_unknown': 451,
}
# Same pattern for threat_is_*, consequence_is_*, context_is_*
```

### Step 2: View Modification

In `news_collection_multistep_extortion()` (and each form type view):

```python
# After building normal context...
edit_entry_id = request.GET.get('edit')
if edit_entry_id:
    # Permission check
    entry = CollNewsEntry.objects.get(coll_news_entry_id=int(edit_entry_id))
    # Verify user is owner or admin
    edit_data = build_edit_data(int(edit_entry_id), 'extortion')
    extra['edit_entry_id'] = int(edit_entry_id)
    extra['edit_data_json'] = json.dumps(edit_data, default=str)
```

### Step 3: Template Changes

In `news-multistep-base.html`, add edit data block:

```html
{% if edit_entry_id %}
  <input type="hidden" name="edit_entry_id" value="{{ edit_entry_id }}">
  <script type="application/json" id="edit-data">{{ edit_data_json|safe }}</script>
{% endif %}
```

### Step 4: Client-Side JS (`news-form-edit-load.js`)

New file loaded AFTER all form component JS files:

```javascript
(function() {
    var editDataEl = document.getElementById('edit-data');
    if (!editDataEl) return;  // Not in edit mode

    var data = JSON.parse(editDataEl.textContent);

    // Signal to news-form-persist.js: skip localStorage restore
    window.__EDIT_MODE__ = true;

    // Wait for DOM + all component JS to initialize
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(populateAll, 300);  // small delay for Tom Select init
    });

    function populateAll() {
        populateContributor(data.contributor);
        populateNewsContent(data.news_entry);
        populateLocation(data.location);
        populateCategoryTags(data.category_id, data.tag_ids, data.is_breaking);
        populateActors('accused', data.accused);
        populateActors('victims', data.victims);
        populateActors('witnesses', data.witnesses);
        populateSocialSources(data.social_sources);

        // Form-specific (detected from hidden field or data attribute)
        if (data.extortion_incident) populateExtortionIncident(data.extortion_incident);
        if (data.ext_legal) populateExtortionLegal(data.ext_legal);
        // ... more form types
    }
})();
```

### Step 5: Modify `news-form-persist.js`

Add at the top of restore section:
```javascript
// Skip localStorage restore in edit mode (server data takes priority)
if (window.__EDIT_MODE__) return;
```

### Step 6: Modify `_handle_news_submission()` for UPDATE

When `edit_entry_id` is in POST data:
1. Fetch existing `CollNewsEntry`
2. UPDATE fields instead of CREATE
3. DELETE + re-INSERT for junction tables (tags, actors, social sources)
4. UPDATE form-specific rows (ExtortionFormImpact, etc.)
5. Skip duplicate headline check for own entry
6. Don't create new `CollContributor` — update existing

### Step 7: Fix `edit_url` in `article_detail()`

Currently: `edit_url = reverse(url_name)`
Change to: `edit_url = reverse(url_name) + '?edit=' + str(entry.coll_news_entry_id)`

---

## Phase 1: Extortion Only
- Build and test with extortion form type
- All shared steps (contributor, content, location, tags, actors, social) work for all forms
- Only form-specific steps (7, 8) need per-type builders

## Phase 2: Extend to All 13 Form Types
After extortion tested:
1. crime_violence — casualties, weapons, crime legal
2. land_grabbing — land facts, land legal
3. price_hike_syndicate — commodity, stockpiling
4. civic_community — civic impact
5. global_news — global facts, BD impact
6. war_conflict — conflict impact, actor countries
7. sports — key performances (model pending)
8. entertainment — facts (model pending)
9. july_uprising_2024 — protest facts
10. women_child_violence — victim profile, perpetrator, WCV legal
11. watchdog_bangladesh — contradiction, issue, context
12. general_news — no form-specific steps

---

## Files to Create
| File | Purpose |
|------|---------|
| `newshub/static/newshub/assets/js/pages/news-form-edit-load.js` | Client-side edit pre-population |

## Files to Modify
| File | Change |
|------|--------|
| `newshub/helpers.py` | Add `build_edit_data()` + BIT→ID mappers |
| `newshub/views.py` | Add `?edit=` handling to each form view + UPDATE mode in `_handle_news_submission()` |
| `newshub/views.py` → `article_detail()` | Append `?edit=<id>` to edit_url |
| `newshub/templates/newshub/pages/news-multistep-base.html` | Add edit data JSON block + hidden field |
| `newshub/static/newshub/assets/js/components/news-form-persist.js` | Skip restore in edit mode |
| `seo/views.py` | Bump CACHE_NAME |

## Risk Areas
- **Cascade timing**: Location cascade (district → upazila → union) needs sequential waits
- **Tom Select sync**: Must use `.tomselect.setValue()` not `.value =`
- **Actor repeater DOM**: Actors built dynamically by JS — must call existing add-row functions
- **File attachments**: Cannot pre-fill file inputs (browser security). Show existing files as text list.
- **BIT flag accuracy**: Must verify all BIT→ID mappings match actual ref_status data

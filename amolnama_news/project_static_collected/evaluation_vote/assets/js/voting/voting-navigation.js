/* ========== VOTING NAVIGATION - Step Navigation & Breadcrumb Updates ========== */

/**
 * Update breadcrumb based on current selection state
 * @param {string} division - Division name (EN)
 * @param {string} divisionBn - Division name (BN)
 * @param {string} district - District name (EN, optional)
 * @param {string} districtBn - District name (BN, optional)
 * @param {string} constituency - Constituency name (EN, optional)
 * @param {string} constituencyBn - Constituency name (BN, optional)
 */
function updateBreadcrumb(division, divisionBn, district, districtBn, constituency, constituencyBn) {
  const bc = document.getElementById('breadcrumb');
  if (!bc) return;

  let html = `<a href="#" onclick="goBackToDivisions(); return false;">Division / বিভাগ</a>`;
  
  if (division) {
    html += `<span>›</span><span class="current">${division} (${divisionBn})</span>`;
  }
  
  if (district && division) {
    html = `<a href="#" onclick="goBackToDivisions(); return false;">Division / বিভাগ</a>`;
    html += `<span>›</span><a href="#" onclick="goBackToDistricts(); return false;">${division} (${divisionBn})</a>`;
    html += `<span>›</span><span class="current">${district} (${districtBn})</span>`;
  }
  
  if (constituency && district && division) {
    html = `<a href="#" onclick="goBackToDivisions(); return false;">Division / বিভাগ</a>`;
    html += `<span>›</span><a href="#" onclick="goBackToDistricts(); return false;">${division} (${divisionBn})</a>`;
    html += `<span>›</span><a href="#" onclick="goBackToConstituencies(); return false;">${district} (${districtBn})</a>`;
    html += `<span>›</span><span class="current">${constituency} (${constituencyBn})</span>`;
  }
  
  bc.innerHTML = html;
}

/**
 * Show specific view and hide others
 * @param {string} viewId - ID of view to show (e.g., 'division-view', 'district-view')
 */
function showView(viewId) {
  const views = ['division-view', 'district-view', 'constituency-view', 'party-view', 'success-view'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  
  const showEl = document.getElementById(viewId);
  if (showEl) showEl.style.display = 'block';
}

/**
 * Navigate back to divisions view (reset all selections)
 */
function goBackToDivisions() {
  selectedDivision = null;
  selectedDistrict = null;
  selectedConstituency = null;
  selectedParty = null;
  
  const bc = document.getElementById('breadcrumb');
  if (bc) bc.innerHTML = '<span class="current">Division / বিভাগ</span>';
  
  showView('division-view');
}

/**
 * Navigate back to districts view
 * Reloads districts for the currently selected division
 */
function goBackToDistricts() {
  if (!selectedDivision) {
    goBackToDivisions();
    return;
  }

  selectedDistrict = null;
  selectedConstituency = null;
  selectedParty = null;

  // Reload districts by calling selectDivision again
  selectDivision(selectedDivision.id, selectedDivision.nameEn, selectedDivision.nameBn);
}

/**
 * Navigate back to constituencies view
 * Reloads constituencies for the currently selected district
 */
function goBackToConstituencies() {
  if (!selectedDivision || !selectedDistrict) {
    goBackToDistricts();
    return;
  }

  selectedConstituency = null;
  selectedParty = null;

  // Reload constituencies by calling selectDistrict again
  selectDistrict(selectedDistrict.id, selectedDistrict.nameEn, selectedDistrict.nameBn);
}

/**
 * Start a new vote from the beginning
 */
function startNewVote() {
  selectedDivision = null;
  selectedDistrict = null;
  selectedConstituency = null;
  selectedParty = null;
  currentVoteId = null;
  
  const bc = document.getElementById('breadcrumb');
  if (bc) {
    bc.style.display = 'flex';
    bc.innerHTML = '<span class="current">Division / বিভাগ</span>';
  }
  
  showView('division-view');
}

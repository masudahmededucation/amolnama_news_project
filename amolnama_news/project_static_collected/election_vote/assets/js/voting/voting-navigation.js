/* ========== Election Vote – Navigation & Breadcrumb ========== */

/**
 * Show a specific voting step and hide all others.
 * @param {string} stepId - The DOM id of the step to display.
 */
function showVotingStep(stepId) {
  const allSteps = [
    'election-view', 'division-view', 'district-view',
    'constituency-view', 'party-view', 'receipt-view',
  ];
  allSteps.forEach(function (id) {
    const element = document.getElementById(id);
    if (element) element.hidden = true;
  });
  const target = document.getElementById(stepId);
  if (target) target.hidden = false;
}

/**
 * Update the breadcrumb trail to reflect the current navigation depth.
 */
function updateBreadcrumbTrail(election, division, district, constituency) {
  let breadcrumb = document.getElementById('breadcrumb');
  if (!breadcrumb) return;
  breadcrumb.hidden = false;

  let html = '';

  if (election) {
    html += '<a href="#" onclick="navigateBackToElections(); return false;">Election</a>';
    html += '<span>\u203A</span>';
  }

  if (!division) {
    html += '<span class="current">' + election.nameBn + '</span>';
  } else if (!district) {
    html += '<a href="#" onclick="navigateBackToDivisions(); return false;">' + election.nameBn + '</a>';
    html += '<span>\u203A</span><span class="current">' + division.nameEn + ' (' + division.nameBn + ')</span>';
  } else if (!constituency) {
    html += '<a href="#" onclick="navigateBackToDivisions(); return false;">' + election.nameBn + '</a>';
    html += '<span>\u203A</span><a href="#" onclick="navigateBackToDistricts(); return false;">' + division.nameEn + ' (' + division.nameBn + ')</a>';
    html += '<span>\u203A</span><span class="current">' + district.nameEn + ' (' + district.nameBn + ')</span>';
  } else {
    html += '<a href="#" onclick="navigateBackToDivisions(); return false;">' + election.nameBn + '</a>';
    html += '<span>\u203A</span><a href="#" onclick="navigateBackToDistricts(); return false;">' + division.nameEn + ' (' + division.nameBn + ')</a>';
    html += '<span>\u203A</span><a href="#" onclick="navigateBackToConstituencies(); return false;">' + district.nameEn + ' (' + district.nameBn + ')</a>';
    html += '<span>\u203A</span><span class="current">' + constituency.nameEn + ' (' + constituency.nameBn + ')</span>';
  }

  breadcrumb.innerHTML = html;
}

/* --- Back Navigation --- */

function navigateBackToElections() {
  selectedElection = null;
  selectedDivision = null;
  selectedDistrict = null;
  selectedConstituency = null;
  selectedParty = null;

  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) breadcrumb.hidden = true;

  showVotingStep('election-view');
}

function navigateBackToDivisions() {
  selectedDivision = null;
  selectedDistrict = null;
  selectedConstituency = null;
  selectedParty = null;

  updateBreadcrumbTrail(selectedElection, null, null, null);
  showVotingStep('division-view');
}

function navigateBackToDistricts() {
  if (!selectedDivision) { navigateBackToDivisions(); return; }
  selectedDistrict = null;
  selectedConstituency = null;
  selectedParty = null;

  handleDivisionSelection(selectedDivision.id, selectedDivision.nameEn, selectedDivision.nameBn);
}

function navigateBackToConstituencies() {
  if (!selectedDistrict) { navigateBackToDistricts(); return; }
  selectedConstituency = null;
  selectedParty = null;

  handleDistrictSelection(selectedDistrict.id, selectedDistrict.nameEn, selectedDistrict.nameBn);
}

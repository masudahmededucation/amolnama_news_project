/* ========== Election Vote – Cascading Location Selection ========== */

/**
 * Step 0: Handle election selection.
 * Checks voter eligibility before proceeding to division step.
 */
function handleElectionSelection(electionEvaluationId, electionId, nameEn, nameBn) {
  selectedElection = {
    electionEvaluationId: electionEvaluationId,
    electionId: electionId,
    nameEn: nameEn,
    nameBn: nameBn,
  };
  selectedDivision = null;
  selectedDistrict = null;
  selectedConstituency = null;
  selectedParty = null;

  // Start bot-detection timing
  voteStartTime = Date.now();
  interactionCount = 0;
  stepTimestamps = [Date.now()];

  // Non-authenticated users can browse but not vote — skip eligibility check
  if (!isAuthenticated) {
    updateBreadcrumbTrail(selectedElection, null, null, null);
    showVotingStep('division-view');
    return;
  }

  // Check eligibility before proceeding
  fetch('/election_vote/api/check-eligibility/' + electionEvaluationId + '/')
    .then(function (response) {
      if (response.redirected || !response.ok) {
        showPageMessage(
          '\u09AD\u09CB\u099F \u09A6\u09BF\u09A4\u09C7 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 <a href="/account/login/">\u09B2\u0997\u0987\u09A8</a> \u0995\u09B0\u09C1\u09A8\u0964 (Please <a href="/account/login/">log in</a> to cast your vote.)',
          'warning'
        );
        return Promise.reject('not_authenticated');
      }
      return response.json();
    })
    .then(function (data) {
      if (!data) return;
      if (!data.eligible) {
        showPageMessage(data.error || 'You are not eligible to vote in this election.', 'warning');
        return;
      }
      clearPageMessage();
      updateBreadcrumbTrail(selectedElection, null, null, null);
      showVotingStep('division-view');
    })
    .catch(function (err) {
      if (err === 'not_authenticated') return;
      console.error('Eligibility check failed:', err);
    });
}

/**
 * Step 1: Handle division selection.
 * Fetches districts for the chosen division via API.
 */
function handleDivisionSelection(id, nameEn, nameBn) {
  selectedDivision = { id: id, nameEn: nameEn, nameBn: nameBn };
  selectedDistrict = null;
  selectedConstituency = null;
  selectedParty = null;
  stepTimestamps.push(Date.now());

  updateBreadcrumbTrail(selectedElection, selectedDivision, null, null);
  showVotingStep('district-view');

  fetch('/evaluation_vote/api/districts/' + id + '/')
    .then(function (response) { return response.json(); })
    .then(function (data) {
      var districtList = document.getElementById('district-list');
      if (!districtList) return;
      districtList.innerHTML = '';

      if (data.districts.length === 0) {
        districtList.innerHTML = '<li>No districts found / \u0995\u09CB\u09A8\u09CB \u099C\u09C7\u09B2\u09BE \u09AA\u09BE\u0993\u09AF\u09BC\u09BE \u09AF\u09BE\u09AF\u09BC\u09A8\u09BF</li>';
        return;
      }

      data.districts.forEach(function (district) {
        var li = document.createElement('li');
        li.onclick = function () {
          handleDistrictSelection(district.id, district.name_en, district.name_bn);
        };
        li.innerHTML =
          '<span class="name-en">' + district.name_en + '</span> ' +
          '<span class="name-bn">(' + district.name_bn + ')</span>';
        districtList.appendChild(li);
      });
    })
    .catch(function (err) { console.error('Error loading districts:', err); });
}

/**
 * Step 2: Handle district selection.
 * Fetches constituencies for the chosen district via API.
 */
function handleDistrictSelection(id, nameEn, nameBn) {
  selectedDistrict = { id: id, nameEn: nameEn, nameBn: nameBn };
  selectedConstituency = null;
  selectedParty = null;
  stepTimestamps.push(Date.now());

  updateBreadcrumbTrail(selectedElection, selectedDivision, selectedDistrict, null);
  showVotingStep('constituency-view');

  fetch('/evaluation_vote/api/constituencies/' + id + '/')
    .then(function (response) { return response.json(); })
    .then(function (data) {
      var constituencyList = document.getElementById('constituency-list');
      if (!constituencyList) return;
      constituencyList.innerHTML = '';

      if (data.constituencies.length === 0) {
        constituencyList.innerHTML = '<li>No constituencies found</li>';
        return;
      }

      data.constituencies.forEach(function (constituency) {
        var li = document.createElement('li');
        li.onclick = function () {
          handleConstituencySelection(constituency.id, constituency.name_en, constituency.name_bn);
        };
        li.innerHTML =
          '<span class="name-en">' + constituency.name_en + '</span> ' +
          '<span class="name-bn">(' + constituency.name_bn + ')</span>' +
          (constituency.area_bn ? '<div class="area-info">' + constituency.area_bn + '</div>' : '');
        constituencyList.appendChild(li);
      });
    })
    .catch(function (err) { console.error('Error loading constituencies:', err); });
}

/**
 * Step 3: Handle constituency selection.
 * Advances to the party selection step.
 */
function handleConstituencySelection(id, nameEn, nameBn) {
  selectedConstituency = { id: id, nameEn: nameEn, nameBn: nameBn };
  selectedParty = null;
  stepTimestamps.push(Date.now());

  updateBreadcrumbTrail(selectedElection, selectedDivision, selectedDistrict, selectedConstituency);
  showVotingStep('party-view');
}

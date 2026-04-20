/* ============================================================
   bookwriter — beta reader management module (standalone)
   --------------------------------------------------------
   Distinct from share-link (one URL anyone can use). Invite
   creates a per-reader row; the writer can revoke a single
   reader without burning the share link.
   ============================================================ */
(function () {
  'use strict';

  var betaReaderInviteForm = document.getElementById('bookwriter-beta-reader-invite-form');
  var betaReaderListElement = document.getElementById('bookwriter-beta-reader-list');
  if (!betaReaderInviteForm || !betaReaderListElement) return;

  var inviteSubmitButton = document.getElementById('bookwriter-beta-reader-invite-submit-button');
  if (inviteSubmitButton) {
    inviteSubmitButton.addEventListener('click', function () {
      var emailInput = document.getElementById('bookwriter-beta-reader-invite-email-input');
      var permissionSelect = document.getElementById('bookwriter-beta-reader-invite-permission-select');
      if (!emailInput || !permissionSelect) return;
      var emailValue = (emailInput.value || '').trim().toLowerCase();
      if (!emailValue || emailValue.indexOf('@') === -1) return;
      var inviteBookId = betaReaderInviteForm.dataset.bookId;
      if (!inviteBookId) return;

      inviteSubmitButton.disabled = true;
      window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(inviteBookId) + '/beta-reader/invite/', {
          reader_email: emailValue,
          beta_permission_code: permissionSelect.value || 'read',
        })
        .then(function (data) {
          appendBetaReaderRowToList(data.beta_reader || {});
          emailInput.value = '';
        })
        .catch(function () { /* leave input populated; user can retry */ })
        .then(function () { inviteSubmitButton.disabled = false; });
    });
  }

  // Wire delete buttons on server-rendered rows.
  betaReaderListElement.querySelectorAll('.bookwriter-beta-reader-row').forEach(function (rowElement) {
    var removeButton = rowElement.querySelector('.bookwriter-beta-reader-remove-button');
    if (removeButton) wireBetaReaderRemoveButton(removeButton, rowElement);
  });

  function appendBetaReaderRowToList(betaReaderRecord) {
    if (!betaReaderListElement || !betaReaderRecord.id) return;
    var emptyEl = betaReaderListElement.querySelector('.bookwriter-beta-reader-empty');
    if (emptyEl) emptyEl.parentNode.removeChild(emptyEl);

    var rowElement = document.createElement('div');
    rowElement.className = 'bookwriter-reader bookwriter-beta-reader-row';
    rowElement.dataset.betaReaderId = String(betaReaderRecord.id);

    var avatarEl = document.createElement('div');
    avatarEl.className = 'bookwriter-reader-avatar';
    avatarEl.textContent = betaReaderRecord.avatar_initial || (betaReaderRecord.email || '?').slice(0, 1);

    var nameEl = document.createElement('div');
    nameEl.className = 'bookwriter-reader-name';
    nameEl.textContent = betaReaderRecord.display_name || betaReaderRecord.email || '';

    var permEl = document.createElement('div');
    permEl.className = 'bookwriter-reader-perm';
    permEl.textContent = betaReaderRecord.permission_code || 'read';

    var removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'bookwriter-reader-remove bookwriter-beta-reader-remove-button';
    removeButton.id = 'bookwriter-beta-reader-' + betaReaderRecord.id + '-remove-button';
    removeButton.name = 'bookwriter_beta_reader_' + betaReaderRecord.id + '_remove_button';
    removeButton.title = 'Remove this reader';
    removeButton.textContent = '×';

    rowElement.appendChild(avatarEl);
    rowElement.appendChild(nameEl);
    rowElement.appendChild(permEl);
    rowElement.appendChild(removeButton);
    betaReaderListElement.appendChild(rowElement);
    wireBetaReaderRemoveButton(removeButton, rowElement);
  }

  function wireBetaReaderRemoveButton(buttonElement, rowElement) {
    buttonElement.addEventListener('click', function () {
      var betaReaderId = rowElement.dataset.betaReaderId;
      if (!betaReaderId) return;
      window.bookwriter.apiDelete('/bookwriter/api/beta-reader/' + encodeURIComponent(betaReaderId) + '/remove/')
        .then(function () {
          rowElement.parentNode.removeChild(rowElement);
        })
        .catch(function () { /* leave row */ });
    });
  }
})();

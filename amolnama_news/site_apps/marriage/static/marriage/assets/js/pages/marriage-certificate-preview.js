/**
 * marriage-certificate-preview.js
 * Builds the formal marriage certificate layout on the preview step (Step 6).
 * Reads all form fields and signature uploads to render a printable document.
 */
(function () {
  'use strict';

  var previewEl = document.getElementById('cert-preview');
  var printBtn = document.getElementById('btn-cert-print');
  var editBtn = document.getElementById('btn-cert-edit');

  if (!previewEl) return;

  /* ---- Helpers ---- */

  function val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  function field(value, fallback) {
    if (value) {
      return '<span class="cert-field">' + escHtml(value) + '</span>';
    }
    return '<span class="cert-field cert-field-empty">' + (fallback || '_______________') + '</span>';
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    var months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    var y = parts[0];
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    return d + ' ' + months[m - 1] + ' ' + y;
  }

  function getSigUrl(dropId) {
    var drop = document.getElementById(dropId);
    return drop ? (drop.dataset.sigUrl || '') : '';
  }

  /* ---- Build Certificate ---- */

  function buildCertificate() {
    var govtTitle = val('cert-govt-title') || 'Government Of The People\'s Republic Of Bangladesh';
    var officeName = val('cert-office-name') || 'Office of the Muslim Marriage Register & Kazi';
    var officeAddr = val('cert-office-address');
    var regNo = val('cert-reg-no');
    var certDate = val('cert-date');

    var groomName = val('cert-groom-name');
    var groomDob = val('cert-groom-dob');
    var groomFather = val('cert-groom-father');
    var groomMother = val('cert-groom-mother');
    var groomAddress = val('cert-groom-address');

    var brideName = val('cert-bride-name');
    var brideDob = val('cert-bride-dob');
    var brideFather = val('cert-bride-father');
    var brideMother = val('cert-bride-mother');
    var brideAddress = val('cert-bride-address');

    var marriageDate = val('cert-marriage-date');
    var bookNo = val('cert-book-no');
    var volumeNo = val('cert-volume-no');
    var pageNo = val('cert-page-no');
    var entryNo = val('cert-entry-no');
    var regYear = val('cert-reg-year');

    var issueDate = val('cert-issue-date');
    var attestedName = val('cert-attested-name');
    var attestedQual = val('cert-attested-qualification');
    var attestedDesg = val('cert-attested-designation');
    var attestedPlace = val('cert-attested-place');
    var attestedDate = val('cert-attested-date');
    var attestedSig = getSigUrl('sig-attested-drop');

    var registrarName = val('cert-registrar-name');
    var registrarDesg = val('cert-registrar-designation');
    var registrarOffice = val('cert-registrar-office');
    var registrarDate = val('cert-registrar-date');
    var registrarSig = getSigUrl('sig-registrar-drop');

    var html = '';

    /* ---- Header ---- */
    html += '<div class="cert-header">';
    html += '<div class="cert-header-govt">' + escHtml(govtTitle) + '</div>';
    html += '<div class="cert-header-office">' + escHtml(officeName) + '</div>';
    html += '<div class="cert-header-address">' + escHtml(officeAddr || '') + '&nbsp;</div>';
    html += '<div class="cert-header-meta">';
    html += '<span>REGD NO: <span class="meta-value">' + escHtml(regNo || '') + '</span></span>';
    html += '<span>DATE: <span class="meta-value">' + formatDate(certDate) + '</span></span>';
    html += '</div>';
    html += '</div>';

    /* ---- Title box ---- */
    html += '<div class="cert-title-box-wrap">';
    html += '<div class="cert-title-box"><h2>Marriage Certificate</h2></div>';
    html += '</div>';

    /* ---- Body paragraph ---- */
    html += '<div class="cert-body">';
    html += '<p>';
    html += 'This is to certify that ' + field(groomName, '(Groom Name)');
    html += ', born on ' + field(formatDate(groomDob), '(DOB)');
    html += ', son of ' + field(groomFather, '(Father)');
    html += ' and ' + field(groomMother, '(Mother)');
    html += ', residing at ' + field(groomAddress, '(Address)');
    html += ', and ' + field(brideName, '(Bride Name)');
    html += ', born on ' + field(formatDate(brideDob), '(DOB)');
    html += ', daughter of ' + field(brideFather, '(Father)');
    html += ' and ' + field(brideMother, '(Mother)');
    html += ', residing at ' + field(brideAddress, '(Address)');
    html += ', were united in marriage on ' + field(formatDate(marriageDate), '(Marriage Date)');
    html += '.';
    html += '</p>';

    /* Registration details */
    html += '<p>';
    html += 'The marriage has been duly registered in Book No. ' + field(bookNo, '___');
    html += ', Volume No. ' + field(volumeNo, '___');
    html += ', Page No. ' + field(pageNo, '___');
    html += ', Entry No. ' + field(entryNo, '___');
    if (regYear) {
      html += ' of the year ' + field(regYear);
    }
    html += '.';
    html += '</p>';
    html += '</div>';

    /* ---- Footer signature zone ---- */
    html += '<div class="cert-footer">';

    /* Left column — Issue date + seal */
    html += '<div class="cert-footer-col">';
    html += '<div class="cert-footer-col-title">Issue Date</div>';
    html += '<div>' + (issueDate ? formatDate(issueDate) : '_______________') + '</div>';
    html += '<div class="cert-seal-area">SEAL</div>';
    html += '</div>';

    /* Center column — Attested */
    html += '<div class="cert-footer-col">';
    html += '<div class="cert-footer-col-title">Attested</div>';
    html += '<div class="cert-sig-area">';
    if (attestedSig) {
      html += '<img src="' + attestedSig + '" alt="Attester Signature">';
    }
    html += '</div>';
    html += '<div class="cert-sig-line"></div>';
    if (attestedName) html += '<div class="cert-footer-name">' + escHtml(attestedName) + '</div>';
    if (attestedQual) html += '<div class="cert-footer-desg">' + escHtml(attestedQual) + '</div>';
    if (attestedDesg) html += '<div class="cert-footer-desg">' + escHtml(attestedDesg) + '</div>';
    if (attestedPlace) html += '<div class="cert-footer-desg">' + escHtml(attestedPlace) + '</div>';
    if (attestedDate) html += '<div class="cert-footer-desg">' + formatDate(attestedDate) + '</div>';
    html += '</div>';

    /* Right column — Registrar / Kazi */
    html += '<div class="cert-footer-col">';
    html += '<div class="cert-footer-col-title">Signature &amp; Seal of the Marriage Register &amp; Kazi</div>';
    html += '<div class="cert-sig-area">';
    if (registrarSig) {
      html += '<img src="' + registrarSig + '" alt="Registrar Signature">';
    }
    html += '</div>';
    html += '<div class="cert-sig-line"></div>';
    if (registrarName) html += '<div class="cert-footer-name">' + escHtml(registrarName) + '</div>';
    if (registrarDesg) html += '<div class="cert-footer-desg">' + escHtml(registrarDesg) + '</div>';
    if (registrarOffice) html += '<div class="cert-footer-desg">' + escHtml(registrarOffice) + '</div>';
    if (registrarDate) html += '<div class="cert-footer-desg">' + formatDate(registrarDate) + '</div>';
    html += '</div>';

    html += '</div>'; /* .cert-footer */

    previewEl.innerHTML = html;
  }

  /* ---- Rebuild preview when entering the last step ---- */

  document.addEventListener('certificate:stepChanged', function (e) {
    var panels = document.querySelectorAll('.step-panel[data-step]');
    var lastStep = panels.length;
    if (e.detail.step === lastStep) {
      buildCertificate();
    }
  });

  /* ---- Print ---- */

  if (printBtn) {
    printBtn.addEventListener('click', function () {
      window.print();
    });
  }

  /* ---- Download as PDF ---- */

  var pdfBtn = document.getElementById('btn-cert-pdf');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', function () {
      if (!previewEl) return;
      pdfBtn.disabled = true;
      pdfBtn.textContent = 'PDF তৈরি হচ্ছে...';
      html2canvas(previewEl, { scale: 2, useCORS: true }).then(function (canvas) {
        var imgData = canvas.toDataURL('image/jpeg', 0.95);
        var pdf = new window.jspdf.jsPDF({
          orientation: canvas.width > canvas.height ? 'l' : 'p',
          unit: 'mm',
          format: 'a4'
        });
        var pageWidth = pdf.internal.pageSize.getWidth();
        var pageHeight = pdf.internal.pageSize.getHeight();
        var margin = 10;
        var imgWidth = pageWidth - margin * 2;
        var imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (imgHeight <= pageHeight - margin * 2) {
          pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
        } else {
          var pageContentHeight = pageHeight - margin * 2;
          var srcPageHeight = (pageContentHeight * canvas.width) / imgWidth;
          var pages = Math.ceil(canvas.height / srcPageHeight);
          for (var i = 0; i < pages; i++) {
            if (i > 0) pdf.addPage();
            var sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = Math.min(srcPageHeight, canvas.height - i * srcPageHeight);
            var ctx = sliceCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, -i * srcPageHeight);
            var sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
            var sliceImgH = (sliceCanvas.height * imgWidth) / sliceCanvas.width;
            pdf.addImage(sliceData, 'JPEG', margin, margin, imgWidth, sliceImgH);
          }
        }
        pdf.save('marriage-certificate.pdf');
      }).finally(function () {
        pdfBtn.disabled = false;
        pdfBtn.textContent = '📄 PDF ডাউনলোড (Download PDF)';
      });
    });
  }

  /* ---- Edit (go back to step 1) ---- */

  if (editBtn) {
    editBtn.addEventListener('click', function () {
      if (window.certStepper) {
        window.certStepper.goToStep(1);
      }
    });
  }

})();

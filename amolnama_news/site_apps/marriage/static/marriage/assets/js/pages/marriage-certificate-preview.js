/**
 * marriage-certificate-preview.js
 * Builds the formal marriage certificate layout on the preview step (Step 6).
 * Reads all form fields and signature uploads to render a printable document.
 */
(function () {
  'use strict';

  const previewEl = document.getElementById('cert-preview');
  const printBtn = document.getElementById('btn-cert-print');
  const editBtn = document.getElementById('btn-cert-edit');

  if (!previewEl) return;

  /* ---- Helpers ---- */

  function val(id) {
    const el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  function field(value, fallback) {
    if (value) {
      return '<span class="cert-field">' + escHtml(value) + '</span>';
    }
    return '<span class="cert-field cert-field-empty">' + (fallback || '_______________') + '</span>';
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return d + ' ' + months[m - 1] + ' ' + y;
  }

  function getSigUrl(dropId) {
    const drop = document.getElementById(dropId);
    return drop ? (drop.dataset.sigUrl || '') : '';
  }

  /* ---- Build Certificate ---- */

  function buildCertificate() {
    const govtTitle = val('cert-govt-title') || 'Government Of The People\'s Republic Of Bangladesh';
    const officeName = val('cert-office-name') || 'Office of the Muslim Marriage Register & Kazi';
    const officeAddr = val('cert-office-address');
    const regNo = val('cert-reg-no');
    const certDate = val('cert-date');

    const groomName = val('cert-groom-name');
    const groomDob = val('cert-groom-dob');
    const groomFather = val('cert-groom-father');
    const groomMother = val('cert-groom-mother');
    const groomAddress = val('cert-groom-address');

    const brideName = val('cert-bride-name');
    const brideDob = val('cert-bride-dob');
    const brideFather = val('cert-bride-father');
    const brideMother = val('cert-bride-mother');
    const brideAddress = val('cert-bride-address');

    const marriageDate = val('cert-marriage-date');
    const bookNo = val('cert-book-no');
    const volumeNo = val('cert-volume-no');
    const pageNo = val('cert-page-no');
    const entryNo = val('cert-entry-no');
    const regYear = val('cert-reg-year');

    const issueDate = val('cert-issue-date');
    const attestedName = val('cert-attested-name');
    const attestedQual = val('cert-attested-qualification');
    const attestedDesg = val('cert-attested-designation');
    const attestedPlace = val('cert-attested-place');
    const attestedDate = val('cert-attested-date');
    const attestedSig = getSigUrl('sig-attested-drop');

    const registrarName = val('cert-registrar-name');
    const registrarDesg = val('cert-registrar-designation');
    const registrarOffice = val('cert-registrar-office');
    const registrarDate = val('cert-registrar-date');
    const registrarSig = getSigUrl('sig-registrar-drop');

    let html = '';

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
    const panels = document.querySelectorAll('.step-panel[data-step]');
    const lastStep = panels.length;
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

  const pdfBtn = document.getElementById('btn-cert-pdf');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', function () {
      if (!previewEl) return;
      pdfBtn.disabled = true;
      pdfBtn.textContent = 'PDF তৈরি হচ্ছে...';
      html2canvas(previewEl, { scale: 2, useCORS: true }).catch(function (error) {
        console.error('Certificate PDF generation failed:', error);
      }).then(function (canvas) {
        if (!canvas) return;
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new window.jspdf.jsPDF({
          orientation: canvas.width > canvas.height ? 'l' : 'p',
          unit: 'mm',
          format: 'a4'
        });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (imgHeight <= pageHeight - margin * 2) {
          pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
        } else {
          const pageContentHeight = pageHeight - margin * 2;
          const srcPageHeight = (pageContentHeight * canvas.width) / imgWidth;
          const pages = Math.ceil(canvas.height / srcPageHeight);
          for (let i = 0; i < pages; i++) {
            if (i > 0) pdf.addPage();
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = Math.min(srcPageHeight, canvas.height - i * srcPageHeight);
            const ctx = sliceCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, -i * srcPageHeight);
            const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
            const sliceImgH = (sliceCanvas.height * imgWidth) / sliceCanvas.width;
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

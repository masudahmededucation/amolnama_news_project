/**
 * marriage-form-preview.js
 * Builds the Nikah Nama preview (Q1-Q25) on the final step.
 * Renders as A4 pages with page numbers, like a print preview.
 */
(function () {
  'use strict';

  const BENGALI_DIGITS = ['\u09E6', '\u09E7', '\u09E8', '\u09E9', '\u09EA', '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF'];

  const previewBody = document.getElementById('marriage-preview-body');
  const printBtn = document.getElementById('button-marriage-print');
  const editBtn = document.getElementById('button-marriage-edit');

  if (!previewBody) return;

  /* ---- Helpers ---- */

  function val(id) {
    let el = document.getElementById(id);
    if (!el) return '';
    if (el.tagName === 'SELECT') {
      const opt = el.options[el.selectedIndex];
      return opt && opt.value ? opt.textContent : '';
    }
    return (el.value || '').trim();
  }

  function rawVal(id) {
    const el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function field(value, fallback) {
    if (value) {
      return '<span class="cert-field">' + escHtml(value) + '</span>';
    }
    return '<span class="preview-empty">' + (fallback || '\u2014') + '</span>';
  }

  function getSigUrl(dropId) {
    const drop = document.getElementById(dropId);
    return drop ? (drop.dataset.sigUrl || '') : '';
  }

  function sigImg(dropId) {
    const url = getSigUrl(dropId);
    if (url) {
      return '<img src="' + url + '" class="preview-signature-thumbnail" alt="signature">';
    }
    return '<span class="preview-empty">\u2014</span>';
  }

  function toBengaliNumber(num) {
    return String(num).split('').map(function (d) {
      return BENGALI_DIGITS[parseInt(d, 10)] || d;
    }).join('');
  }

  /* Build one Q&A row with question number */
  function qRow(qNum, label, value) {
    return '<tr class="q-main"><td class="q-num">' + qNum + '</td><td class="q-label">' + label + '</td><td class="q-value">' + (value || '<span class="preview-empty">\u2014</span>') + '</td></tr>';
  }

  /* Build a sub-row (no question number) */
  function subRow(label, value) {
    return '<tr><td></td><td class="q-label">' + label + '</td><td class="q-value">' + (value || '<span class="preview-empty">\u2014</span>') + '</td></tr>';
  }

  /* ---- Build all content blocks as an array ---- */

  function buildContentBlocks() {
    let blocks = [];

    /* Registration header — certificate-style */
    let hdr = '<div class="preview-reg-header">';
    hdr += '<h3 class="preview-reg-title">\u09A8\u09BF\u0995\u09BE\u09B9\u09A8\u09BE\u09AE\u09BE</h3>';
    hdr += '<p class="preview-reg-subtitle">Note: \u09AE\u09C1\u09B8\u09B2\u09BF\u09AE \u09AC\u09BF\u09AC\u09BE\u09B9 \u0993 \u09A4\u09BE\u09B2\u09BE\u0995 (\u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09A8) \u09AC\u09BF\u09A7\u09BF\u09AE\u09BE\u09B2\u09BE, \u09E8\u09E6\u09E6\u09EF \u098F\u09B0 \u09AC\u09BF\u09A7\u09BF \u09E8\u09EE(\u09E7) (\u0998) \u0985\u09A8\u09C1\u09AF\u09BE\u09AF\u09BC\u09C0 \u09AC\u09BF\u09AC\u09BE\u09B9 \u09AB\u09B0\u09CD\u09AE</p>';
    hdr += '<div class="preview-reg-row">';
    hdr += '<span class="preview-reg-label">\u09A8\u09BF\u0995\u09BE\u09B9 \u09B0\u09C7\u099C\u09BF\u09B8\u09CD\u099F\u09CD\u09B0\u09BE\u09B0\u09C7\u09B0 \u09A8\u09BE\u09AE (Registrar):</span>';
    hdr += '<span class="preview-reg-value">' + (val('reg-kazi-name') ? escHtml(val('reg-kazi-name')) : '\u2014') + '</span>';
    hdr += '</div>';
    hdr += '<div class="preview-reg-row">';
    hdr += '<span class="preview-reg-label">\u09B2\u09BE\u0987\u09B8\u09C7\u09A8\u09CD\u09B8 \u09A8\u0982 (License No.):</span>';
    hdr += '<span class="preview-reg-value">' + (val('reg-license-no') ? escHtml(val('reg-license-no')) : '\u2014') + '</span>';
    hdr += '</div>';
    hdr += '<div class="preview-reg-row">';
    hdr += '<span class="preview-reg-label">\u09AC\u09BE\u0982\u09B2\u09BE\u09A6\u09C7\u09B6 \u09AB\u09B0\u09CD\u09AE \u09A8\u0982\u0983:</span>';
    hdr += '<span class="preview-reg-value">' + (val('reg-bd-form-no') ? escHtml(val('reg-bd-form-no')) : '\u2014') + '</span>';
    hdr += '</div>';
    hdr += '<div class="preview-reg-row">';
    hdr += '<span class="preview-reg-label">\u0995\u09CD\u09B0\u09AE\u09BF\u0995 \u09A8\u0982 (Serial No.):</span>';
    hdr += '<span class="preview-reg-value">' + (val('reg-serial-no') || '\u2014') + '</span>';
    hdr += '</div>';
    hdr += '<div class="preview-reg-row-divider">\u09B0\u09C7\u099C\u09BF\u0983 \u0995</div>';
    hdr += '<div class="preview-reg-row">';
    hdr += '<span class="preview-reg-label">\u09AC\u0987 \u09A8\u0982 (Book No.):</span>';
    hdr += '<span class="preview-reg-value">' + (val('reg-book-no') || '\u2014') + '</span>';
    hdr += '</div>';
    hdr += '<div class="preview-reg-row">';
    hdr += '<span class="preview-reg-label">\u0996\u09A3\u09CD\u09A1 \u09A8\u0982 (Volume No.):</span>';
    hdr += '<span class="preview-reg-value">' + (val('reg-volume-no') || '\u2014') + '</span>';
    hdr += '</div>';
    hdr += '<div class="preview-reg-row">';
    hdr += '<span class="preview-reg-label">\u09AA\u09C3\u09B7\u09CD\u09A0\u09BE \u09A8\u0982 (Page No.):</span>';
    hdr += '<span class="preview-reg-value">' + (val('reg-page-no') || '\u2014') + '</span>';
    hdr += '</div>';
    hdr += '<div class="preview-reg-row">';
    hdr += '<span class="preview-reg-label">\u09A4\u09BE\u09B0\u09BF\u0996\u0983:</span>';
    hdr += '<span class="preview-reg-value">' + (val('reg-header-date') || '\u2014') + '</span>';
    hdr += '</div>';
    hdr += '</div>';
    blocks.push(hdr);

    /* Q&A rows — each question group is a block */
    function tableWrap(rows) {
      return '<table class="preview-nikah-table"><tbody>' + rows + '</tbody></table>';
    }

    /* Q2 */
    let q2 = qRow('\u09E8\u0964', '\u09AC\u09B0\u09C7\u09B0 \u09A8\u09BE\u09AE (Groom)', field(val('groom-name-bn')) + (rawVal('groom-name-en') ? ' (' + escHtml(val('groom-name-en')) + ')' : ''));
    q2 += subRow('\u09AA\u09BF\u09A4\u09BE (Father)', field(val('groom-father')));
    q2 += subRow('\u09AE\u09BE\u09A4\u09BE (Mother)', field(val('groom-mother')));
    q2 += subRow('\u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09A0\u09BF\u0995\u09BE\u09A8\u09BE (Present)', field(val('groom-present-address')));
    q2 += subRow('\u09B8\u09CD\u09A5\u09BE\u09AF\u09BC\u09C0 \u09A0\u09BF\u0995\u09BE\u09A8\u09BE (Permanent)', field(val('groom-permanent-address')));
    blocks.push(tableWrap(q2));

    /* Q3 */
    let q3 = qRow('\u09E9\u0964', '\u09AC\u09B0\u09C7\u09B0 \u09AC\u09AF\u09BC\u09B8/DOB, NID, \u09AA\u09C7\u09B6\u09BE, \u09A7\u09B0\u09CD\u09AE, \u099C\u09BE\u09A4\u09C0\u09AF\u09BC\u09A4\u09BE', '');
    q3 += subRow('\u099C\u09A8\u09CD\u09AE \u09A4\u09BE\u09B0\u09BF\u0996 (DOB)', field(val('groom-dob')));
    q3 += subRow('NID', field(val('groom-nid')));
    q3 += subRow('\u09AA\u09C7\u09B6\u09BE (Occupation)', field(val('groom-occupation')));
    q3 += subRow('\u09A7\u09B0\u09CD\u09AE (Religion)', field(val('groom-religion')));
    q3 += subRow('\u099C\u09BE\u09A4\u09C0\u09AF\u09BC\u09A4\u09BE (Nationality)', field(val('groom-nationality')));
    q3 += subRow('\u09AE\u09CB\u09AC\u09BE\u0987\u09B2 (Phone)', field(val('groom-phone')));
    blocks.push(tableWrap(q3));

    /* Q4 */
    let q4 = qRow('\u09EA\u0964', '\u0995\u09A8\u09C7\u09B0 \u09A8\u09BE\u09AE (Bride)', field(val('bride-name-bn')) + (rawVal('bride-name-en') ? ' (' + escHtml(val('bride-name-en')) + ')' : ''));
    q4 += subRow('\u09AA\u09BF\u09A4\u09BE (Father)', field(val('bride-father')));
    q4 += subRow('\u09AE\u09BE\u09A4\u09BE (Mother)', field(val('bride-mother')));
    q4 += subRow('\u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09A0\u09BF\u0995\u09BE\u09A8\u09BE (Present)', field(val('bride-present-address')));
    q4 += subRow('\u09B8\u09CD\u09A5\u09BE\u09AF\u09BC\u09C0 \u09A0\u09BF\u0995\u09BE\u09A8\u09BE (Permanent)', field(val('bride-permanent-address')));
    blocks.push(tableWrap(q4));

    /* Q5 */
    let q5 = qRow('\u09EB\u0964', '\u0995\u09A8\u09C7\u09B0 \u09AC\u09AF\u09BC\u09B8/DOB, NID, \u09AA\u09C7\u09B6\u09BE, \u09A7\u09B0\u09CD\u09AE, \u099C\u09BE\u09A4\u09C0\u09AF\u09BC\u09A4\u09BE', '');
    q5 += subRow('\u099C\u09A8\u09CD\u09AE \u09A4\u09BE\u09B0\u09BF\u0996 (DOB)', field(val('bride-dob')));
    q5 += subRow('NID', field(val('bride-nid')));
    q5 += subRow('\u09AA\u09C7\u09B6\u09BE (Occupation)', field(val('bride-occupation')));
    q5 += subRow('\u09A7\u09B0\u09CD\u09AE (Religion)', field(val('bride-religion')));
    q5 += subRow('\u099C\u09BE\u09A4\u09C0\u09AF\u09BC\u09A4\u09BE (Nationality)', field(val('bride-nationality')));
    q5 += subRow('\u09AE\u09CB\u09AC\u09BE\u0987\u09B2 (Phone)', field(val('bride-phone')));
    blocks.push(tableWrap(q5));

    /* Q6 */
    let q6 = qRow('\u09EC\u0964', '\u0995\u09A8\u09C7\u09B0 \u09AC\u09C8\u09AC\u09BE\u09B9\u09BF\u0995 \u0985\u09AC\u09B8\u09CD\u09A5\u09BE (Marital Status)', field(val('bride-marital-status')));
    if (rawVal('bride-prev-husband')) {
      q6 += subRow('\u09AA\u09C2\u09B0\u09CD\u09AC\u09AC\u09B0\u09CD\u09A4\u09C0 \u09B8\u09CD\u09AC\u09BE\u09AE\u09C0 (Previous Husband)', field(val('bride-prev-husband')));
    }
    blocks.push(tableWrap(q6));

    /* Q7 */
    let q7 = qRow('\u09ED\u0964', '\u0995\u09A8\u09C7\u09B0 \u0989\u0995\u09BF\u09B2 (Bride\'s Advocate)', field(val('bride-advocate-name')));
    q7 += subRow('\u09AA\u09BF\u09A4\u09BE (Father)', field(val('bride-advocate-father')));
    q7 += subRow('\u09A0\u09BF\u0995\u09BE\u09A8\u09BE (Address)', field(val('bride-advocate-address')));
    q7 += subRow('\u09B8\u09AE\u09CD\u09AA\u09B0\u09CD\u0995 (Relation)', field(val('bride-advocate-relation')));
    blocks.push(tableWrap(q7));

    /* Q8 */
    let q8 = qRow('\u09EE\u0964', '\u09AC\u09B0\u09C7\u09B0 \u0989\u0995\u09BF\u09B2 (Groom\'s Advocate)', field(val('groom-advocate-name')));
    q8 += subRow('\u09AA\u09BF\u09A4\u09BE (Father)', field(val('groom-advocate-father')));
    q8 += subRow('\u09A0\u09BF\u0995\u09BE\u09A8\u09BE (Address)', field(val('groom-advocate-address')));
    q8 += subRow('\u09B8\u09AE\u09CD\u09AA\u09B0\u09CD\u0995 (Relation)', field(val('groom-advocate-relation')));
    blocks.push(tableWrap(q8));

    /* Q9 */
    let q9 = qRow('\u09EF\u0964', '\u0995\u09A8\u09C7\u09B0 \u09AA\u0995\u09CD\u09B7\u09C7\u09B0 \u09B8\u09BE\u0995\u09CD\u09B7\u09C0 (Bride\'s Witnesses)', '');
    q9 += subRow('\u09B8\u09BE\u0995\u09CD\u09B7\u09C0 \u09E7 (Witness 1)', field(val('bride-witness1-name')) + ' \u2014 ' + field(val('bride-witness1-address')));
    q9 += subRow('\u09B8\u09BE\u0995\u09CD\u09B7\u09C0 \u09E8 (Witness 2)', field(val('bride-witness2-name')) + ' \u2014 ' + field(val('bride-witness2-address')));
    blocks.push(tableWrap(q9));

    /* Q10 */
    let q10 = qRow('\u09E7\u09E6\u0964', '\u09AC\u09B0\u09C7\u09B0 \u09AA\u0995\u09CD\u09B7\u09C7\u09B0 \u09B8\u09BE\u0995\u09CD\u09B7\u09C0 (Groom\'s Witnesses)', '');
    q10 += subRow('\u09B8\u09BE\u0995\u09CD\u09B7\u09C0 \u09E7 (Witness 1)', field(val('groom-witness1-name')) + ' \u2014 ' + field(val('groom-witness1-address')));
    q10 += subRow('\u09B8\u09BE\u0995\u09CD\u09B7\u09C0 \u09E8 (Witness 2)', field(val('groom-witness2-name')) + ' \u2014 ' + field(val('groom-witness2-address')));
    blocks.push(tableWrap(q10));

    /* Q11 */
    let q11 = qRow('\u09E7\u09E7\u0964', '\u09AC\u09BF\u09AC\u09BE\u09B9\u09C7\u09B0 \u09B8\u09BE\u0995\u09CD\u09B7\u09C0 (Marriage Witnesses)', '');
    q11 += subRow('\u09B8\u09BE\u0995\u09CD\u09B7\u09C0 \u09E7', field(val('marriage-witness1-name')) + ' \u2014 ' + field(val('marriage-witness1-address')));
    q11 += subRow('\u09B8\u09BE\u0995\u09CD\u09B7\u09C0 \u09E8', field(val('marriage-witness2-name')) + ' \u2014 ' + field(val('marriage-witness2-address')));
    q11 += subRow('\u09B8\u09BE\u0995\u09CD\u09B7\u09C0 \u09E9', field(val('marriage-witness3-name')) + ' \u2014 ' + field(val('marriage-witness3-address')));
    blocks.push(tableWrap(q11));

    /* Q12 */
    let q12 = qRow('\u09E7\u09E8\u0964', '\u09AF\u09BF\u09A8\u09BF \u09AC\u09BF\u09AC\u09BE\u09B9 \u09AA\u09A1\u09BC\u09BE\u0987\u09AF\u09BC\u09BE\u099B\u09C7\u09A8 (Solemnizer)', field(val('solemnizer-name')));
    q12 += subRow('\u09A0\u09BF\u0995\u09BE\u09A8\u09BE (Address)', field(val('solemnizer-address')));
    blocks.push(tableWrap(q12));

    /* Q13 */
    let q13 = qRow('\u09E7\u09E9\u0964', '\u09AE\u09CB\u099F \u09A6\u09C7\u09A8\u09AE\u09CB\u09B9\u09B0 (Total Mehr)', field(val('mehr-total')));
    if (rawVal('mehr-total-words')) {
      q13 += subRow('\u0995\u09A5\u09BE\u09AF\u09BC (In Words)', field(val('mehr-total-words')));
    }
    blocks.push(tableWrap(q13));

    /* Q14 */
    let q14 = qRow('\u09E7\u09EA\u0964', '\u09A4\u09BE\u09CE\u0995\u09CD\u09B7\u09A3\u09BF\u0995 \u09A6\u09C7\u09A8\u09AE\u09CB\u09B9\u09B0 (Prompt Mehr)', field(val('mehr-prompt')));
    if (rawVal('mehr-prompt-paid')) {
      q14 += subRow('\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09BF\u09A4 (Paid?)', field(val('mehr-prompt-paid')));
    }
    blocks.push(tableWrap(q14));

    /* Q15 */
    blocks.push(tableWrap(qRow('\u09E7\u09EB\u0964', '\u09AC\u09BF\u09B2\u09AE\u09CD\u09AC\u09BF\u09A4 \u09A6\u09C7\u09A8\u09AE\u09CB\u09B9\u09B0 (Deferred Mehr)', field(val('mehr-deferred')))));

    /* Q16 */
    blocks.push(tableWrap(qRow('\u09E7\u09EC\u0964', '\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09AA\u09A6\u09CD\u09A7\u09A4\u09BF (Payment Method)', field(val('mehr-payment-method')))));

    /* Q17 */
    blocks.push(tableWrap(qRow('\u09E7\u09ED\u0964', '\u09A6\u09C7\u09A8\u09AE\u09CB\u09B9\u09B0\u09C7\u09B0 \u09AC\u09BF\u09AC\u09B0\u09A3 (Mehr Description)', field(val('mehr-description')))));

    /* Q18 */
    blocks.push(tableWrap(qRow('\u09E7\u09EE\u0964', '\u09AC\u09BF\u09AC\u09BE\u09B9\u09C7\u09B0 \u09B6\u09B0\u09CD\u09A4 (Marriage Conditions)', field(val('marriage-conditions')))));

    /* Q19 */
    let q19 = qRow('\u09E7\u09EF\u0964', '\u09A4\u09BE\u09B2\u09BE\u0995 \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8\u09C7\u09B0 \u0995\u09CD\u09B7\u09AE\u09A4\u09BE (Divorce Delegation)', field(val('divorce-delegation')));
    if (rawVal('divorce-delegation-details')) {
      q19 += subRow('\u09B6\u09B0\u09CD\u09A4 (Conditions)', field(val('divorce-delegation-details')));
    }
    blocks.push(tableWrap(q19));

    /* Q20 */
    blocks.push(tableWrap(qRow('\u09E8\u09E6\u0964', '\u09B8\u0982\u09AF\u09C1\u0995\u09CD\u09A4 \u09A6\u09B2\u09BF\u09B2 (Attached Documents)', field(val('attached-documents')))));

    /* Q21 */
    let q21 = qRow('\u09E8\u09E7\u0964', '\u09AC\u09B0\u09C7\u09B0 \u09AC\u09C8\u09AC\u09BE\u09B9\u09BF\u0995 \u0985\u09AC\u09B8\u09CD\u09A5\u09BE (Groom Marital Status)', field(val('groom-marital-status')));
    if (rawVal('groom-living-wives')) {
      q21 += subRow('\u099C\u09C0\u09AC\u09BF\u09A4 \u09B8\u09CD\u09A4\u09CD\u09B0\u09C0\u09B0 \u09B8\u0982\u0996\u09CD\u09AF\u09BE (Living Wives)', field(val('groom-living-wives')));
    }
    blocks.push(tableWrap(q21));

    /* Q22 */
    if (rawVal('groom-arbitration')) {
      let q22 = qRow('\u09E8\u09E8\u0964', '\u09B8\u09BE\u09B2\u09BF\u09B6\u09C0 \u09AA\u09B0\u09BF\u09B7\u09A6\u09C7\u09B0 \u0985\u09A8\u09C1\u09AE\u09A4\u09BF (Arbitration Permission)', field(val('groom-arbitration')));
      if (rawVal('groom-arbitration-details')) {
        q22 += subRow('\u09AC\u09BF\u09AC\u09B0\u09A3 (Details)', field(val('groom-arbitration-details')));
      }
      blocks.push(tableWrap(q22));
    }

    /* Q23 */
    blocks.push(tableWrap(qRow('\u09E8\u09E9\u0964', '\u09AC\u09BF\u09AC\u09BE\u09B9\u09C7\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996 \u0993 \u09B8\u09CD\u09A5\u09BE\u09A8 (Marriage Date & Place)', field(val('reg-marriage-date')) + ' \u2014 ' + field(val('reg-marriage-place')))));

    /* Q24 */
    let q24 = qRow('\u09E8\u09EA\u0964', '\u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09A8\u09C7\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996 (Registration Date)', field(val('reg-reg-date')));
    q24 += subRow('\u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09A8 \u09AB\u09BF (Registration Fee)', field(val('reg-fee')));
    blocks.push(tableWrap(q24));

    /* Q25 */
    blocks.push(tableWrap(qRow('\u09E8\u09EB\u0964', '\u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF (Remarks)', field(val('reg-remarks')))));

    /* Signatures section — matches real Nikah Nama layout */
    let sig = '<div class="preview-signatures">';

    /* Row 1: Groom sig + Groom advocate sig */
    sig += '<div class="preview-sig-line-row">';
    sig += '<div class="preview-sig-line-item">';
    sig += '<span class="preview-sig-line-label">\u09AC\u09B0\u09C7\u09B0 \u09B8\u09CD\u09AC\u09BE\u0995\u09CD\u09B7\u09B0\u0983</span>';
    sig += '<span class="preview-sig-line">' + sigImg('sig-groom-drop') + '</span>';
    sig += '</div>';
    sig += '<div class="preview-sig-line-item">';
    sig += '<span class="preview-sig-line-label">\u09AC\u09B0\u09C7\u09B0 \u0989\u0995\u09BF\u09B2\u09C7\u09B0 \u09B8\u09CD\u09AC\u09BE\u0995\u09CD\u09B7\u09B0\u0983</span>';
    sig += '<span class="preview-sig-line">' + sigImg('sig-groom-advocate-drop') + '</span>';
    sig += '</div>';
    sig += '</div>';

    /* Row 2: Bride sig + Bride advocate sig */
    sig += '<div class="preview-sig-line-row">';
    sig += '<div class="preview-sig-line-item">';
    sig += '<span class="preview-sig-line-label">\u0995\u09A8\u09C7\u09B0 \u09B8\u09CD\u09AC\u09BE\u0995\u09CD\u09B7\u09B0\u0983</span>';
    sig += '<span class="preview-sig-line">' + sigImg('sig-bride-drop') + '</span>';
    sig += '</div>';
    sig += '<div class="preview-sig-line-item">';
    sig += '<span class="preview-sig-line-label">\u0995\u09A8\u09C7\u09B0 \u0989\u0995\u09BF\u09B2\u09C7\u09B0 \u09B8\u09CD\u09AC\u09BE\u0995\u09CD\u09B7\u09B0\u0983</span>';
    sig += '<span class="preview-sig-line">' + sigImg('sig-bride-advocate-drop') + '</span>';
    sig += '</div>';
    sig += '</div>';

    /* Row 3: Groom advocate appointment witnesses */
    sig += '<div class="preview-sig-witnesses">';
    sig += '<div class="preview-sig-line-label">বরের উকিলের নিয়োগের ব্যাপারে সাক্ষির স্বাক্ষরঃ</div>';
    sig += '<div class="preview-sig-line-item">';
    sig += '<span class="preview-sig-line-label">(১)</span>';
    sig += '<span class="preview-sig-line"></span>';
    sig += '</div>';
    sig += '<div class="preview-sig-line-item">';
    sig += '<span class="preview-sig-line-label">(২)</span>';
    sig += '<span class="preview-sig-line"></span>';
    sig += '</div>';
    sig += '</div>';

    /* Row 4: Marriage witnesses */
    sig += '<div class="preview-sig-witnesses">';
    sig += '<div class="preview-sig-line-label">\u09AC\u09BF\u09AC\u09BE\u09B9\u09C7\u09B0 \u09B8\u09BE\u0995\u09CD\u09B7\u09BF\u09A6\u09C7\u09B0 \u09B8\u09CD\u09AC\u09BE\u0995\u09CD\u09B7\u09B0\u0983</div>';
    sig += '<div class="preview-sig-line-item">';
    sig += '<span class="preview-sig-line-label">(\u09E7)</span>';
    sig += '<span class="preview-sig-line"></span>';
    sig += '</div>';
    sig += '<div class="preview-sig-line-item">';
    sig += '<span class="preview-sig-line-label">(\u09E8)</span>';
    sig += '<span class="preview-sig-line"></span>';
    sig += '</div>';
    sig += '</div>';

    /* Row 5: Kazi (solemnizer) — separate line */
    sig += '<div class="preview-sig-line-row preview-sig-line-single">';
    sig += '<div class="preview-sig-line-item">';
    sig += '<span class="preview-sig-line-label">(কাজী) যে ব্যাক্তির দ্বারা বিবাহ পড়ানো হয়েছে,<br>তার স্বাক্ষর ও তারিখঃ</span>';
    sig += '<span class="preview-sig-line"></span>';
    sig += '</div>';
    sig += '</div>';

    /* Row 6: Registrar signature — separate line */
    sig += '<div class="preview-sig-line-row preview-sig-line-single">';
    sig += '<div class="preview-sig-line-item">';
    sig += '<span class="preview-sig-line-label">বিবাহ রেজিস্ট্রারের স্বাক্ষর ও তারিখঃ</span>';
    sig += '<span class="preview-sig-line">' + sigImg('sig-kazi-drop') + '</span>';
    sig += '</div>';
    sig += '</div>';

    /* Row 7: Registrar seal heading */
    sig += '<div class="preview-sig-seal-heading">বিবাহ রেজিস্ট্রারের সীলঃ</div>';

    /* Row 8: Stamp seal (left) + Round seal (right) */
    sig += '<div class="preview-sig-seal-row">';
    sig += '<div class="preview-seal-box">';
    sig += '<span class="preview-sig-line-label">স্ট্যাম্প সিল (Stamp)</span>';
    sig += '<div class="preview-stamp-area"></div>';
    sig += '</div>';
    sig += '<div class="preview-seal-box">';
    sig += '<span class="preview-sig-line-label">গোল সিল (Round Seal)</span>';
    sig += '<div class="preview-seal-area"></div>';
    sig += '</div>';
    sig += '</div>';

    sig += '</div>';

    /* Bottom reserved space for pre-printed info */
    sig += '<div class="preview-seal-space">';
    sig += 'প্রি-প্রিন্টেড তথ্যের জন্য সংরক্ষিত';
    sig += '</div>';
    blocks.push(sig);

    return blocks;
  }

  /* ---- Paginate content into A4 pages ---- */

  /*
   * A4 = 297mm tall. Reserving:
   *   top seal margin: ~20mm (75px)
   *   bottom blank:    ~20mm (75px)
   *   page footer:     ~8mm  (30px)
   *   side padding accounted in CSS
   * Usable content: 297 - 20 - 20 - 8 ≈ 249mm ≈ 940px at 96dpi
   */
  const PAGE_CONTENT_HEIGHT = 940;

  function paginateBlocks(blocks) {
    /* Stage: render blocks offscreen to measure heights */
    const stage = document.createElement('div');
    stage.className = 'preview-a4-page-content';
    stage.style.position = 'absolute';
    stage.style.left = '-9999px';
    stage.style.width = '680px'; /* matches page width minus padding */
    document.body.appendChild(stage);

    const measured = [];
    blocks.forEach(function (html) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      stage.appendChild(wrapper);
      measured.push({ html: html, height: wrapper.offsetHeight });
      stage.removeChild(wrapper);
    });

    document.body.removeChild(stage);

    /* Distribute blocks across pages */
    let pages = [];
    let currentPageBlocks = [];
    let currentHeight = 0;

    measured.forEach(function (item) {
      if (currentHeight + item.height > PAGE_CONTENT_HEIGHT && currentPageBlocks.length > 0) {
        pages.push(currentPageBlocks);
        currentPageBlocks = [];
        currentHeight = 0;
      }
      currentPageBlocks.push(item.html);
      currentHeight += item.height;
    });

    if (currentPageBlocks.length > 0) {
      pages.push(currentPageBlocks);
    }

    return pages;
  }

  /* ---- Render pages ---- */

  function buildPreview() {
    const blocks = buildContentBlocks();
    const pages = paginateBlocks(blocks);
    const totalPages = pages.length;

    let html = '';
    pages.forEach(function (pageBlocks, index) {
      let pageNum = index + 1;
      html += '<div class="preview-a4-page">';

      /* Top seal/stamp reserved space */
      html += '<div class="preview-page-top-space"></div>';

      html += '<div class="preview-a4-page-content">';
      html += pageBlocks.join('');
      html += '</div>';

      /* Bottom blank space */
      html += '<div class="preview-page-bottom-space"></div>';

      html += '<div class="preview-a4-page-footer">';
      html += '<span>Page ' + pageNum + ' / ' + totalPages + '</span>';
      html += '</div>';
      html += '</div>';

      /* Gap between pages */
      if (pageNum < totalPages) {
        html += '<div class="preview-page-gap"></div>';
      }
    });

    /* ---- Photo pages (from Step 8) ---- */
    const photoHtml = buildPhotoPages(totalPages);
    html += photoHtml;

    previewBody.innerHTML = html;
  }

  /* Build photo preview pages from marriagePhotos store — one photo per page at 5"x7" */
  function buildPhotoPages(startPageNum) {
    if (typeof window.marriagePhotos === 'undefined') return '';
    const store = window.marriagePhotos.getStore();

    const SECTION_LABELS = {
      first_meet:       '💕 প্রথম দেখা',
      gaye_holud:       '🌼 গায়ে হলুদ',
      bor_jatra:        '🎺 বরযাত্রা',
      wedding_ceremony: '💍 বিয়ের অনুষ্ঠান',
      bou_bhat:         '🍽️ বৌভাত',
      other:            '📸 অন্যান্য',
    };

    // Collect all photos with section labels
    const allPhotos = [];
    for (const section in SECTION_LABELS) {
      if (!store[section]) continue;
      for (let i = 0; i < store[section].length; i++) {
        allPhotos.push({ url: store[section][i].url, label: SECTION_LABELS[section], num: i + 1 });
      }
    }
    if (allPhotos.length === 0) return '';

    let html = '';
    let pageNum = startPageNum;

    for (let p = 0; p < allPhotos.length; p++) {
      pageNum++;
      const photo = allPhotos[p];
      const isFirst = (p === 0);

      html += '<div class="preview-page-gap"></div>';
      html += '<div class="preview-a4-page">';
      html += '<div class="preview-page-top-space"></div>';
      html += '<div class="preview-a4-page-content preview-photo-page-content">';

      // Title only on first photo page
      if (isFirst) {
        html += '<h3 class="preview-photo-page-title">বিবাহের কিছু স্মৃতি</h3>';
      }

      // Section label
      html += '<p class="preview-photo-page-label">' + photo.label + '</p>';

      // Photo frame 5"x7" (480x672px) — image fits inside without stretching
      html += '<div class="preview-photo-frame">'
        + '<img src="' + photo.url + '" class="preview-photo-frame-image" alt="' + photo.label + ' ' + photo.num + '">'
        + '</div>';

      html += '</div>';
      html += '<div class="preview-page-bottom-space"></div>';
      html += '<div class="preview-a4-page-footer"><span>Page ' + pageNum + '</span></div>';
      html += '</div>';
    }

    return html;
  }

  /* ---- Pre-printed form toggle ---- */

  const preprintedChk = document.getElementById('chk-preprinted');
  const previewContainer = document.querySelector('.marriage-preview');

  if (preprintedChk && previewContainer) {
    preprintedChk.addEventListener('change', function () {
      if (preprintedChk.checked) {
        previewContainer.classList.add('preprinted');
      } else {
        previewContainer.classList.remove('preprinted');
      }
    });
  }

  /* ---- Rebuild preview when entering the last step ---- */

  document.addEventListener('marriage:stepChanged', function (e) {
    const panels = document.querySelectorAll('.step-panel[data-step]');
    const lastStep = panels.length;
    if (e.detail.step === lastStep) {
      buildPreview();
    }
  });

  /* ---- Print ---- */

  if (printBtn) {
    printBtn.addEventListener('click', function () {
      window.print();
    });
  }

  /* ---- Download as PDF ---- */

  const pdfBtn = document.getElementById('button-marriage-pdf');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', function () {
      const pageEls = document.querySelectorAll('.preview-a4-page');
      if (!pageEls.length) return;
      pdfBtn.disabled = true;
      pdfBtn.textContent = 'PDF \u09A4\u09C8\u09B0\u09BF \u09B9\u099A\u09CD\u099B\u09C7...';

      const pdf = new window.jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imgWidth = pageWidth - margin * 2;

      const captureNext = function (index) {
        if (index >= pageEls.length) {
          pdf.save('nikah-nama.pdf');
          pdfBtn.disabled = false;
          pdfBtn.textContent = '\uD83D\uDCC4 PDF \u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1 (Download PDF)';
          return;
        }
        if (index > 0) pdf.addPage();
        html2canvas(pageEls[index], { scale: 2, useCORS: true }).then(function (canvas) {
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const maxW = pageWidth - margin * 2;
          const maxH = pageHeight - margin * 2;
          const ratio = canvas.width / canvas.height;
          let fitW = maxW;
          let fitH = fitW / ratio;
          // If too tall, scale down by height instead
          if (fitH > maxH) {
            fitH = maxH;
            fitW = fitH * ratio;
          }
          // Center on page
          const offsetX = margin + (maxW - fitW) / 2;
          const offsetY = margin + (maxH - fitH) / 2;
          pdf.addImage(imgData, 'JPEG', offsetX, offsetY, fitW, fitH);
          captureNext(index + 1);
        }).catch(function (error) {
          console.error('Nikah nama PDF page ' + index + ' capture failed:', error);
          pdfBtn.disabled = false;
          pdfBtn.textContent = '\uD83D\uDCC4 PDF \u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1 (Download PDF)';
        });
      };

      captureNext(0);
    });
  }

  /* ---- Edit (go back to step 1) ---- */

  if (editBtn) {
    editBtn.addEventListener('click', function () {
      if (window.marriageStepper) {
        window.marriageStepper.goToStep(1);
      }
    });
  }

})();

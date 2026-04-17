/* Quiz certificate template editor — save / preview / load default / token-insert.
   Uses window.quizadminPost from quizadmin-utils.js. */
(function () {
  'use strict';

  var textarea = document.getElementById('quizadmin-cert-editor-textarea');
  if (!textarea) return;

  var inlineMessage = document.getElementById('quizadmin-cert-editor-message');
  var saveButton = document.getElementById('quizadmin-cert-editor-save');
  var previewButton = document.getElementById('quizadmin-cert-editor-preview');
  var loadDefaultButton = document.getElementById('quizadmin-cert-editor-load-default');
  var examId = textarea.dataset.examId;

  // Realistic sample data used for the preview-only render
  var SAMPLE_SUBSTITUTIONS = {
    '{{recipient_name}}': 'মাসুদ আহমেদ',
    '{{quiz_title}}': document.title.replace(/^Certificate template — /, '') || 'Sample Quiz',
    '{{score_percentage}}': '92.5%',
    '{{issued_date}}': new Date().toISOString().slice(0, 10),
    '{{certificate_serial}}': 'PREVIEW-SAMPLE-NOT-REAL',
    '{{verification_url}}': window.location.origin + '/mastermind/certificate/PREVIEW-SAMPLE-NOT-REAL/',
  };

  // Polished bilingual default template — print-ready, mobile-friendly, self-contained.
  var DEFAULT_TEMPLATE_HTML = ''
    + '<!DOCTYPE html>\n'
    + '<html lang="bn">\n'
    + '<head>\n'
    + '  <meta charset="utf-8">\n'
    + '  <meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '  <title>Certificate — {{recipient_name}}</title>\n'
    + '  <style>\n'
    + '    @page { size: A4 landscape; margin: 0; }\n'
    + '    * { box-sizing: border-box; margin: 0; padding: 0; }\n'
    + '    body {\n'
    + '      font-family: "Noto Serif Bengali", "Times New Roman", serif;\n'
    + '      background: #f5f5f5; min-height: 100vh;\n'
    + '      display: flex; align-items: center; justify-content: center; padding: 24px;\n'
    + '    }\n'
    + '    .certificate {\n'
    + '      width: 100%; max-width: 1100px; aspect-ratio: 1.414;\n'
    + '      background: #fff; border: 18px solid #1B6B4A;\n'
    + '      box-shadow: 0 6px 30px rgba(0,0,0,0.15);\n'
    + '      padding: 60px 80px; text-align: center;\n'
    + '      display: flex; flex-direction: column; justify-content: space-between;\n'
    + '      position: relative; overflow: hidden;\n'
    + '    }\n'
    + '    .certificate::before, .certificate::after {\n'
    + '      content: ""; position: absolute; width: 200px; height: 200px;\n'
    + '      border: 6px solid #c5a572; border-radius: 50%;\n'
    + '    }\n'
    + '    .certificate::before { top: -100px; left: -100px; }\n'
    + '    .certificate::after { bottom: -100px; right: -100px; }\n'
    + '    .platform { font-size: 14px; letter-spacing: 4px; color: #6b7280; text-transform: uppercase; }\n'
    + '    .heading { font-size: 56px; font-weight: 700; color: #1B6B4A; margin: 16px 0 8px; }\n'
    + '    .subheading { font-size: 18px; color: #6b7280; }\n'
    + '    .recipient { font-size: 44px; font-weight: 700; color: #111827; margin: 32px 0 16px;\n'
    + '                 padding: 0 40px; border-bottom: 2px solid #c5a572; padding-bottom: 16px; display: inline-block; }\n'
    + '    .quiz-line { font-size: 20px; color: #374151; margin: 24px 0 8px; }\n'
    + '    .quiz-title { font-size: 26px; font-weight: 600; color: #111827; }\n'
    + '    .score { font-size: 32px; font-weight: 700; color: #1B6B4A; margin: 16px 0; }\n'
    + '    .meta { display: flex; justify-content: space-between; align-items: end; margin-top: 40px; font-size: 13px; color: #6b7280; }\n'
    + '    .meta strong { color: #111827; font-weight: 600; }\n'
    + '    .verify { font-family: ui-monospace, monospace; font-size: 11px; word-break: break-all; max-width: 50%; text-align: right; }\n'
    + '    .print-button {\n'
    + '      position: fixed; top: 16px; right: 16px;\n'
    + '      padding: 10px 18px; background: #1B6B4A; color: #fff; border: none;\n'
    + '      border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;\n'
    + '    }\n'
    + '    @media print {\n'
    + '      body { background: #fff; padding: 0; }\n'
    + '      .certificate { border-width: 12px; box-shadow: none; }\n'
    + '      .print-button { display: none; }\n'
    + '    }\n'
    + '  </style>\n'
    + '</head>\n'
    + '<body>\n'
    + '  <button class="print-button" onclick="window.print()">Print / Save as PDF</button>\n'
    + '  <div class="certificate">\n'
    + '    <div>\n'
    + '      <p class="platform">Amolnama Mastermind</p>\n'
    + '      <h1 class="heading">Certificate of Achievement</h1>\n'
    + '      <p class="subheading">এই মর্মে সনদ প্রদান করা হলো</p>\n'
    + '      <h2 class="recipient">{{recipient_name}}</h2>\n'
    + '      <p class="quiz-line">has successfully passed the quiz</p>\n'
    + '      <p class="quiz-title">{{quiz_title}}</p>\n'
    + '      <p class="score">Score: {{score_percentage}}</p>\n'
    + '    </div>\n'
    + '    <div class="meta">\n'
    + '      <div>Issued: <strong>{{issued_date}}</strong><br>Serial: <strong>{{certificate_serial}}</strong></div>\n'
    + '      <div class="verify">Verify: {{verification_url}}</div>\n'
    + '    </div>\n'
    + '  </div>\n'
    + '</body>\n'
    + '</html>\n';

  function _setMessage(text, tone) {
    if (!inlineMessage) return;
    inlineMessage.textContent = text;
    inlineMessage.dataset.tone = tone || 'success';
    inlineMessage.hidden = false;
    setTimeout(function () { inlineMessage.hidden = true; }, 4000);
  }

  function _substituteTokens(html) {
    var output = html;
    Object.keys(SAMPLE_SUBSTITUTIONS).forEach(function (token) {
      output = output.split(token).join(SAMPLE_SUBSTITUTIONS[token]);
    });
    return output;
  }

  function _openPreview() {
    var raw = textarea.value || '';
    if (!raw.trim()) {
      _setMessage('Template is empty — paste or load the default first.', 'error');
      return;
    }
    var rendered = _substituteTokens(raw);
    var previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      _setMessage('Pop-up blocked — allow pop-ups to preview.', 'error');
      return;
    }
    previewWindow.document.open();
    previewWindow.document.write(rendered);
    previewWindow.document.close();
  }

  function _loadDefault() {
    if (textarea.value.trim() && !confirm) {
      // (no native confirm per project rules — overwrite directly only if empty)
    }
    if (textarea.value.trim()) {
      _setMessage('Clear the textarea first to load the default.', 'error');
      return;
    }
    textarea.value = DEFAULT_TEMPLATE_HTML;
    _setMessage('Default template loaded — preview, edit, then save.', 'success');
  }

  async function _save() {
    saveButton.disabled = true;
    var originalText = saveButton.textContent;
    saveButton.textContent = 'Saving…';
    try {
      var result = await window.quizadminPost(
        '/quizadmin/api/quiz/' + examId + '/certificate-template/',
        { exam_certificate_template_html: textarea.value },
      );
      if (result && result.is_active) {
        _setMessage('Saved (' + result.template_length + ' chars). Certificates will issue on every future pass.', 'success');
      } else {
        _setMessage('Saved as empty — certificates DISABLED for this quiz.', 'success');
      }
    } catch (error) {
      _setMessage(error.message || 'Save failed.', 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = originalText;
    }
  }

  // Token click → insert at caret
  document.addEventListener('click', function (event) {
    var tokenButton = event.target.closest('.quizadmin-cert-editor-token');
    if (!tokenButton) return;
    var tokenText = tokenButton.dataset.token;
    if (!tokenText) return;
    var start = textarea.selectionStart || textarea.value.length;
    var end = textarea.selectionEnd || textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + tokenText + textarea.value.slice(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + tokenText.length;
    tokenButton.classList.add('quizadmin-cert-editor-token-just-copied');
    setTimeout(function () {
      tokenButton.classList.remove('quizadmin-cert-editor-token-just-copied');
    }, 800);
  });

  saveButton.addEventListener('click', _save);
  previewButton.addEventListener('click', _openPreview);
  loadDefaultButton.addEventListener('click', _loadDefault);
})();

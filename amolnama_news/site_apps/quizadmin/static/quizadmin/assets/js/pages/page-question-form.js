/* Question form — create + edit with dynamic option rows by question type. */
(function () {
  'use strict';

  const form = document.getElementById('quizadmin-question-form');
  if (!form) return;

  const mode = form.dataset.mode;
  const editingQuestionId = form.dataset.questionId || '';
  const questionTypeSelect = document.getElementById('question_type_id');
  const optionsContainer = document.getElementById('quizadmin-question-form-options-container');
  const addOptionButton = document.getElementById('quizadmin-question-form-add-option');
  const answerTextWrapper = document.getElementById('quizadmin-question-form-answer-text-wrapper');
  const answerTextInput = document.getElementById('answer_text');
  const isTrueWrapper = document.getElementById('quizadmin-question-form-is-true-wrapper');
  const answersHelp = document.getElementById('quizadmin-question-form-answers-help');
  const inlineMessage = document.getElementById('quizadmin-question-form-inline-message');
  const submitButton = document.getElementById('quizadmin-question-form-submit');

  const existingOptions = window.quizadminReadJson('quizadmin-existing-options', []);
  const BENGALI_LABELS = window.QUIZADMIN_BENGALI_LABELS;

  const renderOptionRow = (optionIndex, optionData) => {
    const row = document.createElement('div');
    row.className = 'quizadmin-question-form-option-row';
    row.dataset.optionIndex = String(optionIndex);

    const label = BENGALI_LABELS[optionIndex] || String(optionIndex + 1);
    row.innerHTML = `
      <span class="quizadmin-question-form-option-label">${label}</span>
      <input type="text" id="option_${optionIndex}_text_bn" name="option_${optionIndex}_text_bn"
             class="quizadmin-question-form-input quizadmin-question-form-option-input"
             placeholder="Option text (Bengali)" value="${window.quizadminEscapeHtml(optionData.option_text_bn || '')}" required>
      <label class="quizadmin-question-form-option-correct">
        <input type="checkbox" id="option_${optionIndex}_is_correct" name="option_${optionIndex}_is_correct" ${optionData.is_correct ? 'checked' : ''}>
        <span>Correct</span>
      </label>
      <button type="button" class="quizadmin-question-form-option-remove"
              id="option_${optionIndex}_remove" name="option_${optionIndex}_remove" aria-label="Remove option">✕</button>
    `;
    row.querySelector('.quizadmin-question-form-option-remove').addEventListener('click', () => {
      row.remove();
      relabelRows();
    });
    return row;
  };

  const relabelRows = () => {
    [...optionsContainer.children].forEach((row, newIndex) => {
      row.dataset.optionIndex = String(newIndex);
      const labelSpan = row.querySelector('.quizadmin-question-form-option-label');
      if (labelSpan) labelSpan.textContent = BENGALI_LABELS[newIndex] || String(newIndex + 1);
    });
  };

  const clearOptions = () => { optionsContainer.innerHTML = ''; };

  const applyQuestionType = () => {
    const selectedOption = questionTypeSelect.options[questionTypeSelect.selectedIndex];
    const typeCode = selectedOption ? selectedOption.dataset.code : 'mcq_single';

    clearOptions();
    addOptionButton.hidden = true;
    answerTextWrapper.hidden = true;
    isTrueWrapper.hidden = true;
    answerTextInput.required = false;

    if (typeCode === 'mcq_single' || typeCode === 'mcq_multi') {
      addOptionButton.hidden = false;
      answersHelp.textContent = typeCode === 'mcq_single'
        ? 'Mark exactly one option as correct.'
        : 'Mark one or more options as correct.';
      const seed = existingOptions.length ? existingOptions : [{}, {}, {}, {}];
      seed.forEach((optionData, index) => {
        optionsContainer.appendChild(renderOptionRow(index, optionData));
      });
    } else if (typeCode === 'true_false') {
      answersHelp.textContent = 'Pick the correct verdict. Options (সত্য / মিথ্যা) are created automatically.';
      isTrueWrapper.hidden = false;
    } else if (typeCode === 'fill_blank' || typeCode === 'short_answer') {
      answersHelp.textContent = 'Enter the expected correct answer text.';
      answerTextWrapper.hidden = false;
      answerTextInput.required = true;
      if (existingOptions.length && existingOptions[0].option_text_bn) {
        answerTextInput.value = existingOptions[0].option_text_bn;
      }
    }
  };

  questionTypeSelect.addEventListener('change', applyQuestionType);
  addOptionButton.addEventListener('click', () => {
    const nextIndex = optionsContainer.children.length;
    if (nextIndex >= BENGALI_LABELS.length) return;
    optionsContainer.appendChild(renderOptionRow(nextIndex, {}));
  });

  const gatherPayload = () => {
    const formData = new FormData(form);
    const selectedTypeOption = questionTypeSelect.options[questionTypeSelect.selectedIndex];
    const typeCode = selectedTypeOption ? selectedTypeOption.dataset.code : 'mcq_single';

    const payload = {
      question_text_bn: formData.get('question_text_bn') || '',
      question_text_en: formData.get('question_text_en') || '',
      question_explanation_bn: formData.get('question_explanation_bn') || '',
      question_hint_bn: formData.get('question_hint_bn') || '',
      question_type_id: parseInt(formData.get('question_type_id'), 10),
      difficulty_id: parseInt(formData.get('difficulty_id'), 10),
      topic_id: parseInt(formData.get('topic_id'), 10),
      book_id: formData.get('book_id') ? parseInt(formData.get('book_id'), 10) : null,
      chapter_id: formData.get('chapter_id') ? parseInt(formData.get('chapter_id'), 10) : null,
      source_page_number: formData.get('source_page_number') ? parseInt(formData.get('source_page_number'), 10) : null,
      source_snippet_text: formData.get('source_snippet_text') || '',
      question_points: parseInt(formData.get('question_points') || '1', 10),
      question_time_limit_seconds: formData.get('question_time_limit_seconds') || null,
      question_negative_marking_points: formData.get('question_negative_marking_points') || 0,
      question_status_code: formData.get('question_status_code') || 'draft',
    };

    if (typeCode === 'mcq_single' || typeCode === 'mcq_multi') {
      payload.options = [...optionsContainer.children].map((row, index) => ({
        text_bn: row.querySelector(`#option_${row.dataset.optionIndex}_text_bn`)?.value || row.querySelector('input[type="text"]').value,
        is_correct: !!row.querySelector('input[type="checkbox"]').checked,
      }));
    } else if (typeCode === 'true_false') {
      payload.is_true = formData.get('is_true') === 'true';
    } else if (typeCode === 'fill_blank' || typeCode === 'short_answer') {
      payload.answer_text = formData.get('answer_text') || '';
    }
    return payload;
  };

  window.quizadminTrackUnsavedChanges(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = gatherPayload();

    if (!payload.question_text_bn) {
      window.quizadminShowInline(inlineMessage, 'Question text (Bengali) is required.', 'error');
      return;
    }

    if ((payload.options && payload.options.length) && !payload.options.some(function (option) { return option.is_correct; })) {
      window.quizadminShowInline(inlineMessage, 'Mark at least one option as correct.', 'error');
      return;
    }

    window.quizadminSetLoading(submitButton, true);
    window.quizadminHideInline(inlineMessage);

    const endpoint = mode === 'edit'
      ? `/quizadmin/api/question/${editingQuestionId}/update/`
      : '/quizadmin/api/question/create/';

    try {
      const result = await window.quizadminPost(endpoint, payload);
      const newId = result.question_id || editingQuestionId;
      window.quizadminShowInline(inlineMessage, 'Saved successfully.', 'success');
      setTimeout(() => {
        window.location.href = `/quizadmin/question/${newId}/edit/`;
      }, 500);
    } catch (error) {
      window.quizadminShowInline(inlineMessage, error.message || 'Save failed. Try again.', 'error');
      window.quizadminSetLoading(submitButton, false);
    }
  });

  applyQuestionType();

  var bookSelect = document.getElementById('book_id');
  var chapterSelect = document.getElementById('chapter_id');
  if (bookSelect && chapterSelect) {
    var allChapterOptions = Array.from(chapterSelect.querySelectorAll('option')).map(function (option) {
      return option.cloneNode(true);
    });
    var previouslySelectedChapterValue = chapterSelect.value;
    bookSelect.addEventListener('change', function () {
      var selectedBookId = bookSelect.value;
      chapterSelect.replaceChildren();
      allChapterOptions.forEach(function (option) {
        if (!option.value || option.dataset.bookId === selectedBookId || !selectedBookId) {
          var freshClone = option.cloneNode(true);
          if (freshClone.value === previouslySelectedChapterValue) freshClone.selected = true;
          chapterSelect.appendChild(freshClone);
        }
      });
    });
  }
})();

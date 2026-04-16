/* Quiz builder form — dynamic question rows by type.
 *
 * Reads the three JSON script blocks emitted by the template:
 *   #quizadmin-question-types      — list of {id, code, name_bn, name_en}
 *   #quizadmin-difficulty-levels   — list of {id, code, name_bn}
 *   #quizadmin-existing-questions  — list of question objects (edit mode only)
 */
(function () {
  'use strict';

  const form = document.getElementById('quizadmin-quiz-form');
  if (!form) return;

  const mode = form.dataset.mode;
  const examId = form.dataset.examId || '';
  const container = document.getElementById('quizadmin-quiz-form-questions-container');
  const addQuestionButton = document.getElementById('quizadmin-quiz-form-add-question');
  const countValue = document.getElementById('quizadmin-quiz-form-questions-count-value');
  const countPlural = document.getElementById('quizadmin-quiz-form-questions-count-plural');
  const inlineMessage = document.getElementById('quizadmin-quiz-form-inline-message');
  const submitButton = document.getElementById('quizadmin-quiz-form-submit');
  const rewardsEnabledInput = document.getElementById('exam_rewards_enabled');
  const rewardCriteriaSelect = document.getElementById('exam_reward_criteria_code');
  const rewardThresholdWrapper = document.getElementById('exam_reward_threshold_wrapper');
  const rewardTopNWrapper = document.getElementById('exam_reward_top_n_wrapper');

  const questionTypes = window.quizadminReadJson('quizadmin-question-types', []);
  const difficultyLevels = window.quizadminReadJson('quizadmin-difficulty-levels', []);
  const existingQuestions = window.quizadminReadJson('quizadmin-existing-questions', []);

  const questionTypeByCode = {};
  const questionTypeById = {};
  questionTypes.forEach((type) => {
    questionTypeByCode[type.question_type_code] = type;
    questionTypeById[type.mastermind_ref_quiz_question_type_id] = type;
  });

  const BENGALI_LABELS = window.QUIZADMIN_BENGALI_LABELS;

  const makeOptionsEditor = (questionTypeCode, seedOptions) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'quizadmin-quiz-form-question-options';

    if (questionTypeCode === 'mcq_single' || questionTypeCode === 'mcq_multi') {
      const list = document.createElement('div');
      list.className = 'quizadmin-quiz-form-option-list';
      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className = 'quizadmin-quiz-form-option-add';
      addButton.textContent = '+ Add option';
      const addButtonUniqueToken = Math.random().toString(36).slice(2, 8);
      addButton.id = `quizadmin-quiz-form-option-add-${addButtonUniqueToken}`;
      addButton.name = `quizadmin_quiz_form_option_add_${addButtonUniqueToken}`;

      const renderOption = (optionIndex, data) => {
        const row = document.createElement('div');
        row.className = 'quizadmin-quiz-form-option-row';
        row.dataset.optionIndex = String(optionIndex);
        const label = BENGALI_LABELS[optionIndex] || String(optionIndex + 1);
        const uniqueToken = `q${row.parentNode ? row.parentNode.children.length : Math.random().toString(36).slice(2, 8)}o${optionIndex}`;
        row.innerHTML = `
          <span class="quizadmin-quiz-form-option-label">${label}</span>
          <input type="text"
                 id="quizadmin-quiz-form-option-text-${uniqueToken}"
                 name="quizadmin_quiz_form_option_text_${uniqueToken}"
                 class="quizadmin-quiz-form-input quizadmin-quiz-form-option-text"
                 placeholder="Option text (Bengali)" value="${(data.option_text_bn || '').replace(/"/g, '&quot;')}" required>
          <label class="quizadmin-quiz-form-option-correct">
            <input type="checkbox"
                   id="quizadmin-quiz-form-option-is-correct-${uniqueToken}"
                   name="quizadmin_quiz_form_option_is_correct_${uniqueToken}"
                   class="quizadmin-quiz-form-option-is-correct" ${data.is_correct ? 'checked' : ''}>
            <span>Correct</span>
          </label>
          <button type="button"
                  id="quizadmin-quiz-form-option-remove-${uniqueToken}"
                  name="quizadmin_quiz_form_option_remove_${uniqueToken}"
                  class="quizadmin-quiz-form-option-remove" aria-label="Remove option">✕</button>
        `;
        row.querySelector('.quizadmin-quiz-form-option-remove').addEventListener('click', () => {
          row.remove();
          relabel();
        });
        return row;
      };
      const relabel = () => {
        [...list.children].forEach((row, index) => {
          row.dataset.optionIndex = String(index);
          row.querySelector('.quizadmin-quiz-form-option-label').textContent =
            BENGALI_LABELS[index] || String(index + 1);
        });
      };
      addButton.addEventListener('click', () => {
        if (list.children.length >= BENGALI_LABELS.length) return;
        list.appendChild(renderOption(list.children.length, {}));
      });
      const seed = seedOptions && seedOptions.length ? seedOptions : [{}, {}, {}, {}];
      seed.forEach((optionData, index) => list.appendChild(renderOption(index, optionData)));

      wrapper.appendChild(list);
      wrapper.appendChild(addButton);
    } else if (questionTypeCode === 'true_false') {
      const radioGroupToken = Math.random().toString(36).slice(2, 8);
      wrapper.innerHTML = `
        <div class="quizadmin-quiz-form-radio-group">
          <label class="quizadmin-quiz-form-radio">
            <input type="radio"
                   id="quizadmin-quiz-form-is-true-yes-${radioGroupToken}"
                   name="quizadmin_quiz_form_is_true_${radioGroupToken}"
                   value="true" class="quizadmin-quiz-form-is-true" checked>
            <span>সত্য (True)</span>
          </label>
          <label class="quizadmin-quiz-form-radio">
            <input type="radio"
                   id="quizadmin-quiz-form-is-true-no-${radioGroupToken}"
                   name="quizadmin_quiz_form_is_true_${radioGroupToken}"
                   value="false" class="quizadmin-quiz-form-is-true">
            <span>মিথ্যা (False)</span>
          </label>
        </div>
      `;
      // Seed: if an existing option with is_correct=True is the first (labeled সত্য), keep default
      if (seedOptions && seedOptions.length) {
        const trueOption = seedOptions.find((option) => option.option_text_bn === 'সত্য');
        if (trueOption && !trueOption.is_correct) {
          wrapper.querySelectorAll('.quizadmin-quiz-form-is-true')[1].checked = true;
        }
      }
    } else if (questionTypeCode === 'fill_blank' || questionTypeCode === 'short_answer' || questionTypeCode === 'essay') {
      const placeholder = questionTypeCode === 'essay'
        ? 'Model answer or grading notes (optional — essays are reviewed manually)'
        : 'Correct answer text';
      const initial = (seedOptions && seedOptions[0] && seedOptions[0].option_text_bn) || '';
      const answerToken = Math.random().toString(36).slice(2, 8);
      wrapper.innerHTML = `
        <label class="quizadmin-quiz-form-field">
          <span class="quizadmin-quiz-form-label">${placeholder}</span>
          <input type="text"
                 id="quizadmin-quiz-form-answer-text-${answerToken}"
                 name="quizadmin_quiz_form_answer_text_${answerToken}"
                 class="quizadmin-quiz-form-input quizadmin-quiz-form-answer-text"
                 value="${initial.replace(/"/g, '&quot;')}">
        </label>
      `;
    }
    return wrapper;
  };

  const renderQuestionRow = (questionIndex, data) => {
    const row = document.createElement('div');
    row.className = 'quizadmin-quiz-form-question-row';
    row.dataset.questionIndex = String(questionIndex);
    if (data.mastermind_coll_question_id) {
      row.dataset.questionId = String(data.mastermind_coll_question_id);
    }

    const currentTypeId = data.link_mastermind_ref_quiz_question_type_id || (questionTypes[0] && questionTypes[0].mastermind_ref_quiz_question_type_id);
    const currentType = questionTypeById[currentTypeId] || questionTypes[0];

    const questionTypeOptionsHtml = questionTypes.map((type) =>
      `<option value="${type.mastermind_ref_quiz_question_type_id}"
               data-code="${type.question_type_code}"
               ${type.mastermind_ref_quiz_question_type_id === currentTypeId ? 'selected' : ''}>
         ${type.question_type_name_bn} (${type.question_type_name_en || ''})
       </option>`,
    ).join('');

    const difficultyOptionsHtml = difficultyLevels.map((level) =>
      `<option value="${level.mastermind_ref_quiz_difficulty_level_id}"
               ${data.link_mastermind_ref_quiz_difficulty_level_id === level.mastermind_ref_quiz_difficulty_level_id ? 'selected' : ''}>
         ${level.difficulty_name_bn}
       </option>`,
    ).join('');

    const questionToken = `q${questionIndex}t${Math.random().toString(36).slice(2, 6)}`;
    row.innerHTML = `
      <header class="quizadmin-quiz-form-question-header">
        <span class="quizadmin-quiz-form-question-number">Q<span class="quizadmin-quiz-form-question-number-value">${questionIndex + 1}</span></span>
        <select id="quizadmin-quiz-form-question-type-${questionToken}"
                name="quizadmin_quiz_form_question_type_${questionToken}"
                class="quizadmin-quiz-form-select quizadmin-quiz-form-question-type">${questionTypeOptionsHtml}</select>
        <select id="quizadmin-quiz-form-question-difficulty-${questionToken}"
                name="quizadmin_quiz_form_question_difficulty_${questionToken}"
                class="quizadmin-quiz-form-select quizadmin-quiz-form-question-difficulty">${difficultyOptionsHtml}</select>
        <button type="button"
                id="quizadmin-quiz-form-question-remove-${questionToken}"
                name="quizadmin_quiz_form_question_remove_${questionToken}"
                class="quizadmin-quiz-form-question-remove" aria-label="Remove question">Remove</button>
      </header>

      <label class="quizadmin-quiz-form-field">
        <span class="quizadmin-quiz-form-label">Question text (Bengali) *</span>
        <textarea id="quizadmin-quiz-form-question-text-bn-${questionToken}"
                  name="quizadmin_quiz_form_question_text_bn_${questionToken}"
                  class="quizadmin-quiz-form-textarea quizadmin-quiz-form-question-text-bn" rows="2" required>${(data.question_text_bn || '').replace(/</g, '&lt;')}</textarea>
      </label>

      <div class="quizadmin-quiz-form-row">
        <label class="quizadmin-quiz-form-field">
          <span class="quizadmin-quiz-form-label">Image URL (optional)</span>
          <input type="url"
                 id="quizadmin-quiz-form-question-image-url-${questionToken}"
                 name="quizadmin_quiz_form_question_image_url_${questionToken}"
                 class="quizadmin-quiz-form-input quizadmin-quiz-form-question-image-url"
                 value="${(data.question_image_url || '').replace(/"/g, '&quot;')}"
                 placeholder="https://example.com/image.png">
        </label>
        <label class="quizadmin-quiz-form-field">
          <span class="quizadmin-quiz-form-label">Points</span>
          <input type="number"
                 id="quizadmin-quiz-form-question-points-${questionToken}"
                 name="quizadmin_quiz_form_question_points_${questionToken}"
                 class="quizadmin-quiz-form-input quizadmin-quiz-form-question-points"
                 min="0" value="${data.question_points || 1}">
        </label>
      </div>

      <div class="quizadmin-quiz-form-question-options-slot"></div>

      <label class="quizadmin-quiz-form-field">
        <span class="quizadmin-quiz-form-label">Explanation (optional)</span>
        <textarea id="quizadmin-quiz-form-question-explanation-${questionToken}"
                  name="quizadmin_quiz_form_question_explanation_${questionToken}"
                  class="quizadmin-quiz-form-textarea quizadmin-quiz-form-question-explanation" rows="2">${(data.question_explanation_bn || '').replace(/</g, '&lt;')}</textarea>
      </label>
    `;

    const typeSelect = row.querySelector('.quizadmin-quiz-form-question-type');
    const optionsSlot = row.querySelector('.quizadmin-quiz-form-question-options-slot');
    const renderOptionsForCurrentType = (seedOptions) => {
      optionsSlot.innerHTML = '';
      const selectedOption = typeSelect.options[typeSelect.selectedIndex];
      const code = selectedOption ? selectedOption.dataset.code : 'mcq_single';
      optionsSlot.appendChild(makeOptionsEditor(code, seedOptions));
    };
    typeSelect.addEventListener('change', () => renderOptionsForCurrentType([]));
    renderOptionsForCurrentType(data.options || []);

    row.querySelector('.quizadmin-quiz-form-question-remove').addEventListener('click', () => {
      row.remove();
      relabelQuestionRows();
    });

    return row;
  };

  const relabelQuestionRows = () => {
    [...container.children].forEach((row, index) => {
      row.dataset.questionIndex = String(index);
      const numberSpan = row.querySelector('.quizadmin-quiz-form-question-number-value');
      if (numberSpan) numberSpan.textContent = String(index + 1);
    });
    updateQuestionCount();
  };
  const updateQuestionCount = () => {
    const total = container.children.length;
    countValue.textContent = String(total);
    countPlural.textContent = total === 1 ? '' : 's';
  };

  addQuestionButton.addEventListener('click', () => {
    container.appendChild(renderQuestionRow(container.children.length, {}));
    relabelQuestionRows();
  });

  // Seed existing questions in edit mode
  if (existingQuestions && existingQuestions.length) {
    existingQuestions.forEach((question, index) => {
      container.appendChild(renderQuestionRow(index, question));
    });
  } else if (mode === 'create') {
    container.appendChild(renderQuestionRow(0, {}));
  }
  updateQuestionCount();

  // Reward criteria show/hide logic
  const syncRewardVisibility = () => {
    const enabled = rewardsEnabledInput.checked;
    const criteria = rewardCriteriaSelect.value;
    rewardThresholdWrapper.hidden = !enabled || criteria !== 'threshold';
    rewardTopNWrapper.hidden = !enabled || criteria !== 'top_n';
  };
  rewardsEnabledInput.addEventListener('change', syncRewardVisibility);
  rewardCriteriaSelect.addEventListener('change', syncRewardVisibility);
  syncRewardVisibility();

  // Gather + submit
  const gatherQuestionPayload = (row) => {
    const questionTypeSelect = row.querySelector('.quizadmin-quiz-form-question-type');
    const typeOption = questionTypeSelect.options[questionTypeSelect.selectedIndex];
    const code = typeOption ? typeOption.dataset.code : 'mcq_single';

    const payload = {
      question_id: row.dataset.questionId ? parseInt(row.dataset.questionId, 10) : null,
      question_type_id: parseInt(questionTypeSelect.value, 10),
      difficulty_id: parseInt(row.querySelector('.quizadmin-quiz-form-question-difficulty').value, 10),
      question_text_bn: row.querySelector('.quizadmin-quiz-form-question-text-bn').value,
      question_image_url: row.querySelector('.quizadmin-quiz-form-question-image-url').value,
      question_points: parseInt(row.querySelector('.quizadmin-quiz-form-question-points').value || '1', 10),
      question_explanation_bn: row.querySelector('.quizadmin-quiz-form-question-explanation').value,
    };

    if (code === 'mcq_single' || code === 'mcq_multi') {
      payload.options = [...row.querySelectorAll('.quizadmin-quiz-form-option-row')].map((optionRow) => ({
        text_bn: optionRow.querySelector('.quizadmin-quiz-form-option-text').value,
        is_correct: !!optionRow.querySelector('.quizadmin-quiz-form-option-is-correct').checked,
      }));
    } else if (code === 'true_false') {
      const selected = row.querySelector('.quizadmin-quiz-form-is-true:checked');
      payload.is_true = selected ? selected.value === 'true' : true;
    } else if (code === 'fill_blank' || code === 'short_answer' || code === 'essay') {
      const answerInput = row.querySelector('.quizadmin-quiz-form-answer-text');
      payload.answer_text = answerInput ? answerInput.value : '';
    }
    return payload;
  };

  const gatherQuizPayload = () => {
    const readBool = (id) => document.getElementById(id)?.checked || false;
    const readStr = (id) => document.getElementById(id)?.value || '';
    const readInt = (id) => {
      const rawValue = readStr(id);
      return rawValue ? parseInt(rawValue, 10) : null;
    };
    const readFloat = (id) => {
      const rawValue = readStr(id);
      return rawValue ? parseFloat(rawValue) : null;
    };
    return {
      exam_title_bn: readStr('exam_title_bn'),
      exam_title_en: readStr('exam_title_en'),
      exam_description_bn: readStr('exam_description_bn'),
      link_mastermind_coll_quiz_topic_id: readInt('link_mastermind_coll_quiz_topic_id'),
      link_mastermind_coll_book_id: readInt('link_mastermind_coll_book_id'),
      exam_status_code: readStr('exam_status_code'),
      exam_time_limit_minutes: readInt('exam_time_limit_minutes'),
      exam_pass_percentage: readFloat('exam_pass_percentage'),
      exam_negative_marking_per_wrong: readFloat('exam_negative_marking_per_wrong'),
      exam_max_attempts: readInt('exam_max_attempts'),
      exam_shuffle_questions: readBool('exam_shuffle_questions'),
      exam_shuffle_options: readBool('exam_shuffle_options'),
      exam_allow_review: readBool('exam_allow_review'),
      exam_rewards_enabled: readBool('exam_rewards_enabled'),
      exam_reward_criteria_code: readStr('exam_reward_criteria_code'),
      exam_reward_threshold_percent: readFloat('exam_reward_threshold_percent'),
      exam_reward_top_n: readInt('exam_reward_top_n'),
      link_reward_badge_id: readInt('link_reward_badge_id'),
      exam_reward_description: readStr('exam_reward_description'),
      questions: [...container.children].map((row) => gatherQuestionPayload(row)),
    };
  };

  window.quizadminTrackUnsavedChanges(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = gatherQuizPayload();
    if (!payload.questions.length) {
      window.quizadminShowInline(inlineMessage, 'Add at least one question before saving.', 'error');
      return;
    }

    var hasEmptyQuestionText = payload.questions.some(function (question) { return !question.question_text_bn; });
    if (hasEmptyQuestionText) {
      window.quizadminShowInline(inlineMessage, 'All questions must have Bengali text.', 'error');
      return;
    }

    window.quizadminSetLoading(submitButton, true);
    window.quizadminHideInline(inlineMessage);

    const endpoint = mode === 'edit'
      ? `/quizadmin/api/quiz/${examId}/update/`
      : '/quizadmin/api/quiz/create/';

    try {
      const result = await window.quizadminPost(endpoint, payload);
      const targetExamId = result.exam_id || examId;
      window.quizadminShowInline(inlineMessage, 'Quiz saved successfully.', 'success');
      setTimeout(() => {
        window.location.href = `/quizadmin/quiz/${targetExamId}/edit/`;
      }, 600);
    } catch (error) {
      window.quizadminShowInline(inlineMessage, error.message || 'Save failed. Try again.', 'error');
      window.quizadminSetLoading(submitButton, false);
    }
  });
})();

/*
 * QingciPractice - bounded, offline retrieval-practice sessions.
 * This module is independent from FSRS and never receives or changes cards/daily state.
 */
(function attachQingciPractice(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.QingciPractice = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPracticeApi() {
  'use strict';

  const SCHEMA = 1;
  const DEFAULT_LIMIT = 6;
  const MAX_LIMIT = 8;
  const DEFAULT_RETRY_GAP = 2;
  const MAX_RETRY_GAP = 8;
  const DIRECTIONS = Object.freeze(['en-to-zh', 'zh-to-en']);
  const ATTEMPTS = Object.freeze(['initial', 'retry']);
  const DANGEROUS_IDS = new Set([
    '__proto__',
    'prototype',
    'constructor',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
  ]);

  function fail(message) {
    throw new TypeError(`QingciPractice: ${message}`);
  }

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function assertPlainObject(value, label) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      fail(`${label} must be a plain object`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) fail(`${label} has an unsafe prototype`);
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get || descriptor.set) fail(`${label}.${key} must be a data property`);
    }
    return value;
  }

  function assertInteger(value, minimum, maximum, label) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      fail(`${label} must be an integer from ${minimum} to ${maximum}`);
    }
    return value;
  }

  function assertText(value, minimum, maximum, label) {
    if (typeof value !== 'string' || value.trim().length < minimum || value.length > maximum) {
      fail(`${label} must contain ${minimum} to ${maximum} characters`);
    }
    return value;
  }

  function assertId(value, label) {
    assertText(value, 1, 200, label);
    if (/\p{C}/u.test(value)) fail(`${label} contains a control character`);
    if (DANGEROUS_IDS.has(value) || Object.prototype.hasOwnProperty.call(Object.prototype, value)) {
      fail(`${label} is a forbidden identifier`);
    }
    return value;
  }

  function cloneJson(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(cloneJson);
    const output = {};
    for (const key of Object.keys(value)) output[key] = cloneJson(value[key]);
    return output;
  }

  function deepFreeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return Object.freeze(value);
  }

  function normalizeOptions(input) {
    if (input === undefined) {
      return { limit: DEFAULT_LIMIT, retryGap: DEFAULT_RETRY_GAP };
    }
    const options = assertPlainObject(input, 'options');
    for (const key of Object.keys(options)) {
      if (!['limit', 'retryGap'].includes(key)) fail(`options.${key} is unknown`);
    }
    return {
      limit: assertInteger(options.limit === undefined ? DEFAULT_LIMIT : options.limit, 1, MAX_LIMIT, 'options.limit'),
      retryGap: assertInteger(
        options.retryGap === undefined ? DEFAULT_RETRY_GAP : options.retryGap,
        DEFAULT_RETRY_GAP,
        MAX_RETRY_GAP,
        'options.retryGap',
      ),
    };
  }

  function normalizeWords(input, limit) {
    if (!Array.isArray(input) || input.length < 1 || input.length > 100000) {
      fail('words must be a non-empty array');
    }
    const result = [];
    const ids = new Set();
    for (let index = 0; index < Math.min(input.length, limit); index += 1) {
      const source = assertPlainObject(input[index], `words[${index}]`);
      const id = assertId(source.id, `words[${index}].id`);
      if (ids.has(id)) fail('words contains a duplicate id');
      ids.add(id);
      const word = assertText(source.word, 1, 200, `words[${index}].word`);
      const meaning = assertText(source.meaning, 1, 4000, `words[${index}].meaning`);
      const phonetic = source.phonetic === undefined || source.phonetic === null
        ? ''
        : assertText(source.phonetic, 0, 200, `words[${index}].phonetic`);
      result.push({ id, word, meaning, phonetic });
    }
    return result;
  }

  function directionRecord() {
    return {
      initial: null,
      initialReason: null,
      retry: null,
      retryReason: null,
      retryStatus: 'not-needed',
    };
  }

  function recordKey(direction) {
    return direction === 'en-to-zh' ? 'enToZh' : 'zhToEn';
  }

  function createSession(inputWords, inputOptions) {
    const options = normalizeOptions(inputOptions);
    const words = normalizeWords(inputWords, options.limit);
    const state = {
      schema: SCHEMA,
      options,
      words,
      phase: 'en-to-zh',
      initialQueue: words.map((_word, index) => index),
      retryQueue: [],
      answeredCount: 0,
      records: words.map((word) => ({
        id: word.id,
        enToZh: directionRecord(),
        zhToEn: directionRecord(),
      })),
      history: [],
    };
    return deepFreeze(state);
  }

  function assertSession(state) {
    const value = assertPlainObject(state, 'state');
    if (value.schema !== SCHEMA) fail(`unsupported state schema: ${String(value.schema)}`);
    if (!DIRECTIONS.includes(value.phase) && value.phase !== 'done') fail('state.phase is invalid');
    if (!Array.isArray(value.words) || value.words.length < 1 || value.words.length > MAX_LIMIT) {
      fail('state.words is invalid');
    }
    if (!Array.isArray(value.initialQueue) || !Array.isArray(value.retryQueue)) fail('state queues are invalid');
    if (!Array.isArray(value.records) || value.records.length !== value.words.length) fail('state.records is invalid');
    if (!Array.isArray(value.history)) fail('state.history is invalid');
    assertInteger(value.answeredCount, 0, value.words.length * DIRECTIONS.length * ATTEMPTS.length, 'state.answeredCount');
    return value;
  }

  function findTask(state) {
    if (state.phase === 'done') return null;
    if (state.initialQueue.length > 0) {
      return { wordIndex: state.initialQueue[0], attempt: 'initial' };
    }
    const retryIndex = state.retryQueue.findIndex((task) => task.eligibleAt <= state.answeredCount);
    if (retryIndex < 0) return null;
    return { wordIndex: state.retryQueue[retryIndex].wordIndex, attempt: 'retry', retryIndex };
  }

  function countScheduledQuestions(state) {
    if (state.phase === 'done') return state.answeredCount;
    const laterInitial = state.phase === 'en-to-zh' ? state.words.length : 0;
    return state.answeredCount + state.initialQueue.length + state.retryQueue.length + laterInitial;
  }

  function current(inputState) {
    const state = assertSession(inputState);
    const task = findTask(state);
    if (!task) return null;
    const selected = state.words[task.wordIndex];
    const englishFirst = state.phase === 'en-to-zh';
    return deepFreeze({
      id: selected.id,
      word: selected.word,
      meaning: selected.meaning,
      phonetic: selected.phonetic,
      direction: state.phase,
      attempt: task.attempt,
      prompt: englishFirst ? selected.word : selected.meaning,
      answer: englishFirst ? selected.meaning : selected.word,
      answeredCount: state.answeredCount,
      questionNumber: state.answeredCount + 1,
      baseQuestionCount: state.words.length * DIRECTIONS.length,
      scheduledQuestionCount: countScheduledQuestions(state),
      maxQuestionCount: state.words.length * DIRECTIONS.length * ATTEMPTS.length,
    });
  }

  function normalizeRecallResponse(response) {
    let value = response;
    if (response !== null && typeof response === 'object') {
      const object = assertPlainObject(response, 'response');
      if (Object.keys(object).some((key) => key !== 'result')) fail('recall response has unknown fields');
      value = object.result;
    }
    if (value === 'correct') return { result: 'correct', reason: 'self-rated' };
    if (value === 'hint') return { result: 'hint', reason: 'hint' };
    if (value === 'skip') return { result: 'wrong', reason: 'skip' };
    if (value === '' || value === undefined || value === null) return { result: 'wrong', reason: 'empty' };
    if (value === 'wrong') return { result: 'wrong', reason: 'wrong' };
    fail('recall result must be correct, wrong, hint, skip, or empty');
  }

  function normalizeSpelling(value) {
    return value.trim().toLocaleLowerCase('en-US');
  }

  function normalizeSpellingResponse(response, expected) {
    let object;
    if (typeof response === 'string') object = { answer: response };
    else object = assertPlainObject(response, 'response');
    for (const key of Object.keys(object)) {
      if (!['answer', 'usedHint', 'result'].includes(key)) fail(`spelling response.${key} is unknown`);
    }
    if (object.usedHint !== undefined && typeof object.usedHint !== 'boolean') {
      fail('spelling response.usedHint must be boolean');
    }
    if (object.usedHint === true || object.result === 'hint') {
      return { result: 'hint', reason: 'hint', submittedAnswer: typeof object.answer === 'string' ? object.answer : '' };
    }
    if (object.result === 'skip') return { result: 'wrong', reason: 'skip', submittedAnswer: '' };
    if (object.result === 'wrong' && object.answer === undefined) {
      return { result: 'wrong', reason: 'wrong', submittedAnswer: '' };
    }
    if (object.result !== undefined) fail('spelling result may only be hint, skip, or wrong');
    if (typeof object.answer !== 'string' || object.answer.length > 200) {
      fail('spelling response.answer must be a string of at most 200 characters');
    }
    if (object.answer.trim().length === 0) return { result: 'wrong', reason: 'empty', submittedAnswer: object.answer };
    const matches = normalizeSpelling(object.answer) === normalizeSpelling(expected);
    return {
      result: matches ? 'correct' : 'wrong',
      reason: matches ? 'exact' : 'mismatch',
      submittedAnswer: object.answer,
    };
  }

  function settleMutable(state) {
    while (state.phase !== 'done') {
      if (state.initialQueue.length > 0) return;
      if (state.retryQueue.some((task) => task.eligibleAt <= state.answeredCount)) return;

      if (state.retryQueue.length > 0) {
        const key = recordKey(state.phase);
        for (const task of state.retryQueue) state.records[task.wordIndex][key].retryStatus = 'unavailable';
        state.retryQueue = [];
      }

      if (state.phase === 'en-to-zh') {
        state.phase = 'zh-to-en';
        state.initialQueue = state.words.map((_word, index) => index);
      } else {
        state.phase = 'done';
        state.initialQueue = [];
      }
    }
  }

  function advance(inputState, response) {
    const state = assertSession(inputState);
    const before = current(state);
    if (!before) fail('session has no current question');
    const task = findTask(state);
    const next = cloneJson(state);
    const selected = next.words[task.wordIndex];
    const assessed = next.phase === 'en-to-zh'
      ? normalizeRecallResponse(response)
      : normalizeSpellingResponse(response, selected.word);

    if (task.attempt === 'initial') next.initialQueue.shift();
    else next.retryQueue.splice(task.retryIndex, 1);

    const record = next.records[task.wordIndex][recordKey(next.phase)];
    if (task.attempt === 'initial') {
      record.initial = assessed.result;
      record.initialReason = assessed.reason;
      if (assessed.result === 'correct') {
        record.retryStatus = 'not-needed';
      } else {
        record.retryStatus = 'pending';
        next.retryQueue.push({
          wordIndex: task.wordIndex,
          eligibleAt: next.answeredCount + 1 + next.options.retryGap,
        });
      }
    } else {
      record.retry = assessed.result;
      record.retryReason = assessed.reason;
      record.retryStatus = 'completed';
    }

    next.answeredCount += 1;
    next.history.push({
      id: selected.id,
      direction: next.phase,
      attempt: task.attempt,
      result: assessed.result,
      reason: assessed.reason,
    });
    settleMutable(next);
    const frozenState = deepFreeze(next);
    const outcome = deepFreeze({
      id: selected.id,
      word: selected.word,
      direction: before.direction,
      attempt: task.attempt,
      result: assessed.result,
      reason: assessed.reason,
      submittedAnswer: own(assessed, 'submittedAnswer') ? assessed.submittedAnswer : null,
      expectedAnswer: before.answer,
      retryScheduled: task.attempt === 'initial' && assessed.result !== 'correct',
    });
    return deepFreeze({
      state: frozenState,
      current: current(frozenState),
      outcome,
      summary: summary(frozenState),
    });
  }

  function emptyFirstPassCounts() {
    return { correct: 0, hint: 0, wrong: 0, unanswered: 0 };
  }

  function summary(inputState) {
    const state = assertSession(inputState);
    const firstPass = {
      'en-to-zh': emptyFirstPassCounts(),
      'zh-to-en': emptyFirstPassCounts(),
    };
    const retry = {
      correct: 0,
      hint: 0,
      wrong: 0,
      pending: 0,
      unavailable: 0,
    };
    const pendingItems = [];
    const unavailableItems = [];
    const needsPractice = [];
    const recordOutput = [];

    for (let index = 0; index < state.records.length; index += 1) {
      const source = state.records[index];
      const word = state.words[index];
      const failedDirections = [];
      let allFailedDirectionsCorrected = true;
      const directions = {};
      for (const direction of DIRECTIONS) {
        const key = recordKey(direction);
        const value = source[key];
        const first = value.initial === null ? 'unanswered' : value.initial;
        firstPass[direction][first] += 1;
        if (value.retry === 'correct') retry.correct += 1;
        if (value.retry === 'hint') retry.hint += 1;
        if (value.retry === 'wrong') retry.wrong += 1;
        if (value.retryStatus === 'pending') {
          retry.pending += 1;
          pendingItems.push({ id: word.id, direction });
        }
        if (value.retryStatus === 'unavailable') {
          retry.unavailable += 1;
          unavailableItems.push({ id: word.id, direction });
        }
        if (value.initial === 'wrong' || value.initial === 'hint') {
          failedDirections.push(direction);
          if (value.retry !== 'correct') allFailedDirectionsCorrected = false;
        }
        directions[direction] = cloneJson(value);
      }
      if (failedDirections.length > 0) {
        needsPractice.push({
          id: word.id,
          word: word.word,
          directions: failedDirections,
          correctedThisSession: allFailedDirectionsCorrected,
        });
      }
      recordOutput.push({ id: word.id, word: word.word, directions });
    }

    return deepFreeze({
      status: state.phase === 'done' ? 'complete' : 'in-progress',
      phase: state.phase,
      totalWords: state.words.length,
      answeredCount: state.answeredCount,
      baseQuestionCount: state.words.length * DIRECTIONS.length,
      scheduledQuestionCount: countScheduledQuestions(state),
      maxQuestionCount: state.words.length * DIRECTIONS.length * ATTEMPTS.length,
      firstPass,
      retry,
      pendingIds: [...new Set(pendingItems.map((item) => item.id))],
      pendingItems,
      unavailableIds: [...new Set(unavailableItems.map((item) => item.id))],
      unavailableItems,
      needsPractice,
      records: recordOutput,
    });
  }

  return Object.freeze({
    createSession,
    current,
    advance,
    summary,
    constants: Object.freeze({
      SCHEMA,
      DEFAULT_LIMIT,
      MAX_LIMIT,
      DEFAULT_RETRY_GAP,
      MAX_RETRY_GAP,
      DIRECTIONS,
    }),
  });
});

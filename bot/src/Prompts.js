// Промпты и схемы ответа Gemini. Тоже без Apps Script — проверяются тестами.
//
// Схемы уходят в generationConfig.responseJsonSchema: модель отвечает строго
// JSON такой формы, и разбирать свободный текст не приходится.

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 1, maximum: 10, description: 'Grade from 1 to 10' },
    summary: { type: 'string', description: 'One line: what the candidate actually said' },
    gaps: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 3,
      description: 'What is missing or inaccurate, up to 3 short items',
    },
    reference: { type: 'string', description: 'Model answer in 1-3 sentences' },
    language: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 3,
      description: 'Corrections of the candidate\'s English as "wrong → right"',
    },
    followUp: { type: 'string', description: 'One follow-up question a live interviewer would ask next' },
  },
  required: ['score', 'summary', 'gaps', 'reference', 'language', 'followUp'],
};

const FOLLOW_UP_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 1, maximum: 10, description: 'Grade from 1 to 10' },
    summary: { type: 'string', description: 'One line: what the candidate actually said' },
    comment: { type: 'string', description: '1-2 sentences: what was right and what was missing' },
    reference: { type: 'string', description: 'Model answer in 1-2 sentences' },
    language: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 3,
      description: 'Corrections of the candidate\'s English as "wrong → right"',
    },
  },
  required: ['score', 'summary', 'comment', 'reference', 'language'],
};

const SCALE =
  'Score scale: 9-10 complete and precise, like a strong candidate; 7-8 correct but missing details; ' +
  '5-6 partially correct; 3-4 superficial or with errors; 1-2 wrong, off-topic or no answer.';

function languageRule(lang) {
  return lang === 'en'
    ? 'Write all feedback in English. language: up to 3 short corrections of the candidate\'s English ' +
        '(grammar, word choice, unnatural phrasing) in the form "wrong → right"; an empty array if the English is fine. ' +
        'Ignore filler words and hesitations in audio.'
    : 'Write all feedback in Russian. language: always an empty array.';
}

function reviewInstruction(lang) {
  return [
    'You are a senior technical interviewer (React Native, frontend, QA) running a mock interview in Telegram.',
    'Grade the candidate\'s answer against the reference answer. The reference is a guide, not a checklist: ' +
      'accept correct ideas in the candidate\'s own words; lower the score for factual errors and missing key points.',
    SCALE,
    'Be very brief, the candidate reads on a phone. gaps: at most 3 items, each under 15 words, only what is missing ' +
      'or inaccurate; an empty array if nothing. reference: a model answer in 1-3 sentences. ' +
      'followUp: exactly one question a live interviewer would ask next to dig deeper into the same topic; the hints show where interviewers usually go.',
    'summary: one line on what the candidate actually said; for audio, a short paraphrase.',
    languageRule(lang),
    'Use `backticks` for code identifiers. No headings, no bold, no markdown lists.',
  ].join('\n');
}

function followUpInstruction(lang) {
  return [
    'You are a senior technical interviewer (React Native, frontend, QA) running a mock interview in Telegram.',
    'You already graded the main answer and asked a follow-up question. Now grade the answer to the follow-up, briefly.',
    SCALE,
    'comment: 1-2 short sentences on what was right and what was missing. reference: a model answer in 1-2 sentences. ' +
      'summary: one line on what the candidate actually said.',
    languageRule(lang),
    'Use `backticks` for code identifiers. No headings, no bold, no markdown lists.',
  ].join('\n');
}

function answerLine(answerText) {
  return answerText ? `Candidate's answer:\n${answerText}` : 'The candidate\'s answer is in the attached audio.';
}

function reviewRequest(question, answerText) {
  const lines = ['Question:', question.q, '', 'Reference answer (not shown to the candidate):', question.ref, ''];
  if (question.hints && question.hints.length > 0) {
    lines.push('Where interviewers usually dig further:', ...question.hints.map((hint) => `- ${hint}`), '');
  }
  lines.push(answerLine(answerText));
  return lines.join('\n');
}

function followUpRequest(question, state, answerText) {
  return [
    'Original question:',
    question.q,
    '',
    'Reference answer for the original question:',
    question.ref,
    '',
    `What the candidate said to the original question: ${state.mainSummary || '(not recorded)'}`,
    '',
    'Your follow-up question:',
    state.followUp,
    '',
    answerLine(answerText),
  ].join('\n');
}

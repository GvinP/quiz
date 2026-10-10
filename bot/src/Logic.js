// Чистая логика бота: выбор вопроса, Лейтнер, статистика, разметка и тексты.
// Здесь нет ни одного вызова Apps Script, поэтому файл гоняется тестами
// в Node (test/bot.test.ts) — всё, что можно проверить без Google, живёт тут.

/** Интервалы Лейтнера в днях по номеру коробки — те же, что в приложении. */
const BOX_INTERVALS = [0, 1, 3, 7, 21];
const MAX_BOX = BOX_INTERVALS.length;
/** Средний балл темы, по которой ещё нет ответов: вес средний, не нулевой. */
const NEUTRAL_AVERAGE = 6;
/** Сколько последних оценок темы учитывать: важен текущий уровень, а не история. */
const TOPIC_WINDOW = 10;
/** Telegram режет сообщения длиннее 4096 символов. */
const MESSAGE_LIMIT = 4096;

// ---------------------------------------------------------------- Лейтнер

/**
 * 8–10 — вопрос усвоен, следующая коробка; 1–4 — обратно в первую;
 * середина оставляет вопрос на месте, чтобы он вернулся с тем же интервалом.
 */
function nextBox(box, score) {
  const current = Math.min(Math.max(box || 1, 1), MAX_BOX);
  if (score >= 8) return Math.min(current + 1, MAX_BOX);
  if (score <= 4) return 1;
  return current;
}

function dueDay(box, today) {
  return today + BOX_INTERVALS[box - 1];
}

/** Карточка после оценки основного ответа. Новый вопрос стартует с первой коробки. */
function updateCard(card, question, score, today) {
  const box = nextBox(card ? card.box : 1, score);
  return {
    id: question.id,
    topic: question.topic,
    box,
    due: dueDay(box, today),
    last: today,
    seen: (card ? card.seen : 0) + 1,
    lastScore: score,
  };
}

// ---------------------------------------------------------------- Даты

/** 'yyyy-MM-dd' → номер дня от эпохи. Часовой пояс уже учтён тем, кто форматировал дату. */
function dayFromIso(iso) {
  const [year, month, day] = String(iso).split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / 86400000);
}

function isoFromDay(day) {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

/** 'HH:MM' или 'H' → [час, минута]; мусор даёт null. */
function parseTime(value) {
  const match = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour > 23 || minute > 59) return null;
  return [hour, minute];
}

// ---------------------------------------------------------------- Выбор вопроса

/** Средний балл по последним TOPIC_WINDOW основным ответам каждой темы. */
function topicAverages(history) {
  const scores = {};
  for (const row of history) {
    if (row.stage !== 'main' || !(row.score > 0)) continue;
    (scores[row.topic] = scores[row.topic] || []).push(row.score);
  }
  const result = {};
  for (const topic of Object.keys(scores)) {
    const recent = scores[topic].slice(-TOPIC_WINDOW);
    result[topic] = recent.reduce((sum, score) => sum + score, 0) / recent.length;
  }
  return result;
}

/** Чем ниже средний балл темы, тем чаще она выпадает: 3 из 10 весит втрое больше девятки. */
function topicWeight(average) {
  return 11 - (average === undefined ? NEUTRAL_AVERAGE : average);
}

function weightedPick(items, weightOf, random) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let point = random() * total;
  for (const item of items) {
    point -= weightOf(item);
    if (point < 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Тема выбирается случайно с весом по слабости, внутри темы — сначала то,
 * что пора повторить, потом новое с самой низкой сложностью.
 * Вопрос, отвеченный сегодня, сегодня больше не предлагается: у первой коробки
 * интервал ноль, и без этого провальный вопрос шёл бы по кругу.
 */
function pickQuestion(questions, cards, averages, today, options) {
  const opts = options || {};
  const random = opts.random || Math.random;
  const pool = questions.filter((question) => question.id !== opts.exclude);
  if (pool.length === 0) return questions[0] || null;

  const byTopic = {};
  for (const question of pool) {
    const card = cards[question.id];
    const bucket = (byTopic[question.topic] = byTopic[question.topic] || { topic: question.topic, due: [], fresh: [] });
    if (!card) bucket.fresh.push(question);
    else if (card.due <= today && card.last !== today) bucket.due.push(question);
  }

  const open = Object.keys(byTopic)
    .map((topic) => byTopic[topic])
    .filter((bucket) => bucket.due.length > 0 || bucket.fresh.length > 0);

  if (open.length === 0) {
    // Всё выучено и ничего не созрело — берём то, что созреет раньше всех.
    return pool.slice().sort((a, b) => cards[a.id].due - cards[b.id].due || cards[a.id].box - cards[b.id].box)[0];
  }

  const bucket = weightedPick(open, (item) => topicWeight(averages[item.topic]), random);

  if (bucket.due.length > 0) {
    return bucket.due.slice().sort((a, b) => cards[a.id].due - cards[b.id].due || cards[a.id].box - cards[b.id].box)[0];
  }

  const easiest = Math.min(...bucket.fresh.map((question) => question.d || 1));
  const candidates = bucket.fresh.filter((question) => (question.d || 1) === easiest);
  return candidates[Math.floor(random() * candidates.length)] || candidates[0];
}

// ---------------------------------------------------------------- Ответ Gemini

/** Модель иногда оборачивает JSON в ```json — снимаем обёртку, прежде чем разбирать. */
function parseModelJson(text) {
  const trimmed = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(trimmed);
}

function clampScore(value) {
  const score = Math.round(Number(value));
  if (!Number.isFinite(score)) throw new Error('В ответе модели нет оценки');
  return Math.min(Math.max(score, 1), 10);
}

function stringList(value, limit) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit);
}

function cleanText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/** Приводит ответ модели к ожидаемой форме: схема помогает, но не гарантирует. */
function normalizeReview(raw) {
  return {
    score: clampScore(raw && raw.score),
    summary: cleanText(raw && raw.summary),
    gaps: stringList(raw && raw.gaps, 3),
    reference: cleanText(raw && raw.reference),
    language: stringList(raw && raw.language, 3),
    followUp: cleanText(raw && raw.followUp),
    comment: cleanText(raw && raw.comment),
  };
}

// ---------------------------------------------------------------- Разметка

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function plainMarkdown(segment) {
  return escapeHtml(segment)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/^(\s*)[-*] /gm, '$1• ');
}

function inlineMarkdown(segment) {
  return segment
    .split(/`([^`\n]+)`/g)
    .map((part, index) => (index % 2 === 1 ? `<code>${escapeHtml(part)}</code>` : plainMarkdown(part)))
    .join('');
}

/**
 * Markdown вопросов → HTML для Telegram: блоки кода, `код`, **жирный** и
 * списки. Остальное просто экранируется — Telegram не прощает незакрытых тегов.
 */
function markdownToHtml(markdown) {
  const parts = String(markdown || '').split(/```[\w-]*\n?([\s\S]*?)```/g);
  return parts
    .map((part, index) => (index % 2 === 1 ? `<pre>${escapeHtml(part.replace(/\n$/, ''))}</pre>` : inlineMarkdown(part)))
    .join('')
    .trim();
}

/** Запасной путь, если HTML не прошёл: теги вон, сущности обратно. */
function htmlToPlain(html) {
  return String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function truncate(value, limit) {
  const max = limit || MESSAGE_LIMIT;
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

// ---------------------------------------------------------------- Тексты

const T = {
  ru: {
    help: (time) =>
      'Тренировка к собеседованиям.\n\n/question — новый вопрос\n/skip — пропустить\n/lang — RU/EN\n/stats — статистика\n\n' +
      `Отвечай текстом или голосом. Вопрос дня приходит в ${time}.`,
    daily: '☀️ Вопрос дня',
    answerHint: 'Текстом или голосом · /skip',
    gaps: 'Упущено:',
    reference: 'Эталон:',
    language: 'Язык:',
    followUp: 'Уточнение:',
    closed: '✅ Вопрос закрыт · /question — ещё',
    closedNoReview: 'Закрыто без уточнения · /question — ещё',
    noQuestion: 'Сейчас нет вопроса. /question — получить',
    onlyTextOrVoice: 'Отвечай текстом или голосом',
    tooLong: 'Голосовое длиннее 10 минут — сократи, пожалуйста',
    reviewFailed: 'Не получилось проверить ответ 😕 Пришли его ещё раз',
    bankFailed: 'Не смог загрузить вопросы, попробуй позже',
    busy: 'Ещё проверяю прошлое сообщение — повтори через минуту',
    unknownCommand: 'Не знаю такой команды. /help',
    langSwitched: '🇷🇺 Русский. Следующий вопрос — на русском',
    statsEmpty: 'Пока нет ответов. /question — начать',
    statsHead: (count, average) => `📊 Ответов: ${count} · средний ${average}`,
    statsWeak: '🔻 Слабые:',
    statsTopics: 'По темам:',
  },
  en: {
    help: (time) =>
      'Interview practice.\n\n/question — new question\n/skip — skip\n/lang — RU/EN\n/stats — stats\n\n' +
      `Answer by text or voice. The question of the day comes at ${time}.`,
    daily: '☀️ Question of the day',
    answerHint: 'Text or voice · /skip',
    gaps: 'Missed:',
    reference: 'Model answer:',
    language: 'Your English:',
    followUp: 'Follow-up:',
    closed: '✅ Done · /question — next',
    closedNoReview: 'Closed without the follow-up · /question — next',
    noQuestion: 'No active question. /question — get one',
    onlyTextOrVoice: 'Answer by text or voice',
    tooLong: 'The voice message is over 10 minutes — please keep it shorter',
    reviewFailed: 'Could not check the answer 😕 Please send it again',
    bankFailed: 'Could not load the questions, try again later',
    busy: 'Still checking the previous message — try again in a minute',
    unknownCommand: 'Unknown command. /help',
    langSwitched: '🇬🇧 English. The next question will be in English',
    statsEmpty: 'No answers yet. /question — start',
    statsHead: (count, average) => `📊 Answers: ${count} · average ${average}`,
    statsWeak: '🔻 Weak:',
    statsTopics: 'By topic:',
  },
};

function strings(lang) {
  return T[lang] || T.ru;
}

function scoreMark(score) {
  if (score >= 8) return '🟢';
  if (score >= 5) return '🟡';
  return '🔴';
}

function bullets(items) {
  return items.map((item) => `• ${inlineMarkdown(item)}`).join('\n');
}

function formatQuestion(question, lang, daily) {
  const s = strings(lang);
  const level = question.d || 1;
  const head = `<b>${escapeHtml(question.title || question.topic)}</b> · ${'●'.repeat(level)}${'○'.repeat(3 - level)}`;
  return [daily ? s.daily : '', head, '', markdownToHtml(question.q), '', `<i>${s.answerHint}</i>`]
    .filter((line, index) => index > 0 || line)
    .join('\n');
}

function languageBlock(review, lang) {
  if (lang !== 'en' || review.language.length === 0) return [];
  return ['', `✍️ ${strings(lang).language}`, bullets(review.language)];
}

function formatReview(review, lang) {
  const s = strings(lang);
  const lines = [`<b>${review.score}/10</b> ${scoreMark(review.score)}`];
  if (review.gaps.length > 0) lines.push('', s.gaps, bullets(review.gaps));
  if (review.reference) lines.push('', `${s.reference} ${inlineMarkdown(review.reference)}`);
  lines.push(...languageBlock(review, lang));
  if (review.followUp) lines.push('', `❓ <b>${s.followUp}</b> ${inlineMarkdown(review.followUp)}`);
  return lines.join('\n');
}

function formatFollowUpReview(review, lang) {
  const s = strings(lang);
  const lines = [`<b>${review.score}/10</b> ${scoreMark(review.score)} ${inlineMarkdown(review.comment)}`.trim()];
  if (review.reference) lines.push('', `${s.reference} ${inlineMarkdown(review.reference)}`);
  lines.push(...languageBlock(review, lang));
  lines.push('', s.closed);
  return lines.join('\n');
}

/** Средний балл по темам (последние оценки) и три самые слабые темы. */
function formatStats(history, titles, lang) {
  const s = strings(lang);
  const main = history.filter((row) => row.stage === 'main' && row.score > 0);
  if (main.length === 0) return s.statsEmpty;

  const counts = {};
  for (const row of main) counts[row.topic] = (counts[row.topic] || 0) + 1;
  const averages = topicAverages(main);
  const topics = Object.keys(averages).sort((a, b) => averages[a] - averages[b]);
  const overall = main.reduce((sum, row) => sum + row.score, 0) / main.length;
  const title = (topic) => escapeHtml((titles && titles[topic]) || topic);

  const lines = [s.statsHead(main.length, overall.toFixed(1))];
  const weak = topics.filter((topic) => averages[topic] < 7).slice(0, 3);
  if (weak.length > 0) {
    lines.push(`${s.statsWeak} ${weak.map((topic) => `${title(topic)} — ${averages[topic].toFixed(1)}`).join(', ')}`);
  }
  lines.push('', s.statsTopics);
  for (const topic of topics) {
    lines.push(`${scoreMark(averages[topic])} ${title(topic)} — ${averages[topic].toFixed(1)} (${counts[topic]})`);
  }
  return lines.join('\n');
}

/** Команда из текста: '/Question@my_bot arg' → '/question'. */
function commandOf(message) {
  const match = String(message || '').trim().match(/^\/([a-zA-Z_]+)(?:@\w+)?(?:\s|$)/);
  return match ? `/${match[1].toLowerCase()}` : null;
}

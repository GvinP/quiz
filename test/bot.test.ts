import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Файлы бота — скрипты Apps Script, а не модули: все функции глобальные.
// Грузим чистые файлы в отдельный контекст и забираем нужное последним выражением.
const source = ['Logic.js', 'Prompts.js']
  .map((file) => readFileSync(new URL(`../bot/src/${file}`, import.meta.url), 'utf8'))
  .join('\n');

interface Card {
  id: string;
  topic: string;
  box: number;
  due: number;
  last: number;
  seen: number;
  lastScore: number;
}

interface BankQuestion {
  id: string;
  topic: string;
  d: number;
  q: string;
  ref: string;
  hints: string[];
  title?: string;
}

interface Review {
  score: number;
  summary: string;
  gaps: string[];
  reference: string;
  language: string[];
  followUp: string;
  comment: string;
}

interface HistoryRow {
  topic: string;
  stage: string;
  score: number;
}

interface Bot {
  nextBox(box: number, score: number): number;
  updateCard(card: Card | undefined, question: BankQuestion, score: number, today: number): Card;
  dayFromIso(iso: string): number;
  isoFromDay(day: number): string;
  parseTime(value: string): [number, number] | null;
  topicAverages(history: HistoryRow[]): Record<string, number>;
  pickQuestion(
    questions: BankQuestion[],
    cards: Record<string, Card>,
    averages: Record<string, number>,
    today: number,
    options?: { exclude?: string; random?: () => number },
  ): BankQuestion;
  parseModelJson(text: string): unknown;
  normalizeReview(raw: unknown): Review;
  markdownToHtml(markdown: string): string;
  htmlToPlain(html: string): string;
  formatQuestion(question: BankQuestion, lang: string, daily: boolean): string;
  formatReview(review: Review, lang: string): string;
  formatFollowUpReview(review: Review, lang: string): string;
  formatStats(history: HistoryRow[], titles: Record<string, string>, lang: string): string;
  commandOf(text: string | undefined): string | null;
  reviewRequest(question: BankQuestion, answerText: string): string;
  reviewInstruction(lang: string): string;
  REVIEW_SCHEMA: { required: string[] };
}

const bot = vm.runInNewContext(
  `${source}
;({ nextBox, updateCard, dayFromIso, isoFromDay, parseTime, topicAverages, pickQuestion, parseModelJson,
    normalizeReview, markdownToHtml, htmlToPlain, formatQuestion, formatReview, formatFollowUpReview,
    formatStats, commandOf, reviewRequest, reviewInstruction, REVIEW_SCHEMA })`,
) as Bot;

const question = (id: string, topic: string, d = 1): BankQuestion => ({ id, topic, d, q: `${id}?`, ref: 'ref', hints: [] });
const card = (id: string, topic: string, box: number, due: number, last = 0): Card => ({
  id,
  topic,
  box,
  due,
  last,
  seen: 1,
  lastScore: 5,
});
const fixed = (value: number) => () => value;

test('Лейтнер: высокая оценка поднимает, низкая сбрасывает, средняя держит', () => {
  assert.equal(bot.nextBox(1, 9), 2);
  assert.equal(bot.nextBox(5, 10), 5);
  assert.equal(bot.nextBox(4, 3), 1);
  assert.equal(bot.nextBox(3, 6), 3);
});

test('карточка нового вопроса стартует с первой коробки и получает срок по интервалу', () => {
  const fresh = bot.updateCard(undefined, question('a-1', 'a'), 8, 100);
  assert.deepEqual({ box: fresh.box, due: fresh.due, last: fresh.last, seen: fresh.seen }, { box: 2, due: 101, last: 100, seen: 1 });

  const failed = bot.updateCard(fresh, question('a-1', 'a'), 2, 105);
  assert.deepEqual({ box: failed.box, due: failed.due, seen: failed.seen }, { box: 1, due: 105, seen: 2 });
});

test('дни считаются от эпохи и переводятся обратно', () => {
  assert.equal(bot.dayFromIso('1970-01-02'), 1);
  assert.equal(bot.isoFromDay(bot.dayFromIso('2026-10-10')), '2026-10-10');
});

test('время рассылки разбирается и отбраковывается', () => {
  assert.deepEqual([...(bot.parseTime('11:00') ?? [])], [11, 0]);
  assert.deepEqual([...(bot.parseTime('9') ?? [])], [9, 0]);
  assert.equal(bot.parseTime('25:00'), null);
  assert.equal(bot.parseTime('11.00'), null);
});

test('средний балл темы считается по последним основным ответам', () => {
  const history = [
    ...Array.from({ length: 10 }, () => ({ topic: 'a', stage: 'main', score: 2 })),
    ...Array.from({ length: 10 }, () => ({ topic: 'a', stage: 'main', score: 8 })),
    { topic: 'a', stage: 'followup', score: 1 },
    { topic: 'b', stage: 'skipped', score: 0 },
  ];
  assert.deepEqual({ ...bot.topicAverages(history) }, { a: 8 });
});

test('слабая тема выпадает чаще сильной', () => {
  const questions = [question('weak-1', 'weak'), question('strong-1', 'strong')];
  const averages = { weak: 2, strong: 9 };
  let weak = 0;
  for (let index = 0; index < 100; index++) {
    const picked = bot.pickQuestion(questions, {}, averages, 100, { random: fixed(index / 100) });
    if (picked.topic === 'weak') weak++;
  }
  // Веса 9 и 2: слабая тема должна занимать 9/11 равномерной сетки.
  assert.equal(weak, 82);
});

test('внутри темы созревший вопрос идёт раньше нового, новый — с минимальной сложностью', () => {
  const questions = [question('a-1', 'a', 2), question('a-2', 'a', 1), question('a-3', 'a', 3)];
  assert.equal(bot.pickQuestion(questions, { 'a-3': card('a-3', 'a', 2, 99) }, {}, 100, { random: fixed(0) }).id, 'a-3');
  assert.equal(bot.pickQuestion(questions, { 'a-3': card('a-3', 'a', 2, 101) }, {}, 100, { random: fixed(0) }).id, 'a-2');
});

test('вопрос, отвеченный сегодня, сегодня не возвращается, даже из первой коробки', () => {
  const questions = [question('a-1', 'a'), question('b-1', 'b')];
  const cards = { 'a-1': card('a-1', 'a', 1, 100, 100), 'b-1': card('b-1', 'b', 2, 100, 99) };
  assert.equal(bot.pickQuestion(questions, cards, {}, 100, { random: fixed(0) }).id, 'b-1');
});

test('исключённый вопрос не повторяется подряд, а при пустой очереди берётся ближайший по сроку', () => {
  const questions = [question('a-1', 'a'), question('a-2', 'a'), question('a-3', 'a')];
  const cards = {
    'a-1': card('a-1', 'a', 3, 110),
    'a-2': card('a-2', 'a', 3, 105),
    'a-3': card('a-3', 'a', 3, 103),
  };
  assert.equal(bot.pickQuestion(questions, cards, {}, 100, { exclude: 'a-3' }).id, 'a-2');
});

test('JSON модели разбирается и в обёртке ```json', () => {
  assert.deepEqual({ ...(bot.parseModelJson('```json\n{"score": 7}\n```') as object) }, { score: 7 });
});

test('ответ модели приводится к форме: оценка в границах, списки обрезаны', () => {
  const review = bot.normalizeReview({ score: 14.2, gaps: ['a', '', 'b', 'c', 'd'], language: 'oops' });
  assert.equal(review.score, 10);
  assert.deepEqual([...review.gaps], ['a', 'b', 'c']);
  assert.deepEqual([...review.language], []);
  assert.equal(review.followUp, '');
  assert.throws(() => bot.normalizeReview({ score: 'нет' }));
});

test('Markdown вопроса превращается в HTML Telegram и экранируется', () => {
  const html = bot.markdownToHtml('Что выведет **код**?\n\n```js\nif (a < b) log(`x`);\n```\n- `<div>` & пункт');
  assert.equal(html, 'Что выведет <b>код</b>?\n\n<pre>if (a &lt; b) log(`x`);</pre>\n• <code>&lt;div&gt;</code> &amp; пункт');
  assert.equal(bot.htmlToPlain(html).includes('<pre>'), false);
});

test('вопрос показывает тему, сложность и подсказку; вопрос дня помечен', () => {
  const text = bot.formatQuestion({ ...question('a-1', 'a', 2), title: 'React & co' }, 'ru', true);
  assert.equal(text.split('\n')[0], '☀️ Вопрос дня');
  assert.match(text, /<b>React &amp; co<\/b> · ●●○/);
  assert.match(text, /\/skip/);
  assert.equal(bot.formatQuestion(question('a-1', 'a'), 'en', false).startsWith('<b>a</b>'), true);
});

const review: Review = {
  score: 6,
  summary: 's',
  gaps: ['нет про `key`'],
  reference: 'Эталон',
  language: ['I has → I have'],
  followUp: 'А что с Context?',
  comment: 'Почти',
};

test('фидбек: правки языка только в режиме EN', () => {
  const ru = bot.formatReview(review, 'ru');
  assert.match(ru, /^<b>6\/10<\/b> 🟡/);
  assert.match(ru, /• нет про <code>key<\/code>/);
  assert.match(ru, /❓ <b>Уточнение:<\/b> А что с Context\?/);
  assert.equal(ru.includes('I has'), false);
  assert.match(bot.formatReview(review, 'en'), /✍️ Your English:\n• I has → I have/);
  assert.match(bot.formatFollowUpReview(review, 'ru'), /Вопрос закрыт/);
});

test('статистика: слабые темы сверху, без ответов — подсказка', () => {
  const history = [
    { topic: 'a', stage: 'main', score: 9 },
    { topic: 'b', stage: 'main', score: 3 },
    { topic: 'b', stage: 'main', score: 5 },
    { topic: 'b', stage: 'skipped', score: 0 },
  ];
  const text = bot.formatStats(history, { a: 'Тема A', b: 'Тема B' }, 'ru');
  assert.equal(
    text,
    '📊 Ответов: 3 · средний 5.7\n🔻 Слабые: Тема B — 4.0\n\nПо темам:\n🔴 Тема B — 4.0 (2)\n🟢 Тема A — 9.0 (1)',
  );
  assert.match(bot.formatStats([], {}, 'ru'), /Пока нет ответов/);
});

test('команды распознаются с упоминанием бота и в любом регистре', () => {
  assert.equal(bot.commandOf('/Question@my_bot'), '/question');
  assert.equal(bot.commandOf('/skip сейчас'), '/skip');
  assert.equal(bot.commandOf('ответ про /skip'), null);
  assert.equal(bot.commandOf(undefined), null);
});

test('запрос к модели: эталон и подсказки на месте, голосовое помечено', () => {
  const request = bot.reviewRequest({ ...question('a-1', 'a'), hints: ['Куда дальше?'] }, '');
  assert.match(request, /Reference answer/);
  assert.match(request, /- Куда дальше\?/);
  assert.match(request, /attached audio/);
  assert.match(bot.reviewInstruction('en'), /English/);
  assert.deepEqual([...bot.REVIEW_SCHEMA.required].sort(), ['followUp', 'gaps', 'language', 'reference', 'score', 'summary']);
});

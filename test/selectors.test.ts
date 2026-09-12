import test from 'node:test';
import assert from 'node:assert/strict';
import { quizQueue, reviewQueue, weakQueue, shuffle } from '../src/progress/selectors.ts';
import type { Question } from '../src/data/types.ts';
import type { Progress } from '../src/progress/types.ts';

const question = (id: string, topic: string): Question => ({
  id,
  topic,
  type: 'single',
  question: id,
  options: ['а', 'б'],
  correct: [0],
  explanation: '…',
  difficulty: 1,
});

const questions: Question[] = [
  question('rn-arch-001', 'rn-architecture'),
  question('rn-arch-002', 'rn-architecture'),
  question('rn-perf-001', 'rn-performance'),
];

/** Отключаем перемешивание, чтобы проверять состав, а не порядок. */
const noShuffle = () => 0;

test('квиз берёт только вопросы своей темы и сохраняет порядок файла', () => {
  assert.deepEqual(
    quizQueue(questions, 'rn-architecture').map((q) => q.id),
    ['rn-arch-001', 'rn-arch-002'],
  );
});

test('повторение включает всё неотвеченное', () => {
  assert.equal(reviewQueue(questions, {}, 100, noShuffle).length, 3);
});

test('повторение пропускает то, что ещё не подошло по интервалу', () => {
  const progress: Progress = {
    'rn-architecture': {
      'rn-arch-001': { box: 3, seen: 4, correct: 3, day: 100 },
      'rn-arch-002': { box: 1, seen: 2, correct: 0, day: 100 },
    },
  };

  const ids = reviewQueue(questions, progress, 101, noShuffle).map((q) => q.id);
  assert.ok(!ids.includes('rn-arch-001'), 'коробка 3 — интервал 3 дня, ещё рано');
  assert.ok(ids.includes('rn-arch-002'), 'коробка 1 — доступен сразу');
  assert.ok(ids.includes('rn-perf-001'), 'неотвеченный доступен всегда');
});

test('повторение отдаёт вопрос не больше одного раза за сессию', () => {
  const progress: Progress = {
    'rn-architecture': { 'rn-arch-001': { box: 1, seen: 3, correct: 0, day: 100 } },
  };
  const ids = reviewQueue(questions, progress, 100, noShuffle).map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('работа над ошибками берёт только то, что ниже порога', () => {
  const progress: Progress = {
    'rn-architecture': {
      'rn-arch-001': { box: 1, seen: 4, correct: 1, day: 100 },
      'rn-arch-002': { box: 4, seen: 4, correct: 4, day: 100 },
    },
    'rn-performance': {
      'rn-perf-001': { box: 1, seen: 1, correct: 0, day: 100 },
    },
  };

  assert.deepEqual(
    weakQueue(questions, progress, noShuffle).map((q) => q.id),
    ['rn-arch-001'],
  );
});

test('перемешивание сохраняет состав и не меняет исходный массив', () => {
  const source = [1, 2, 3, 4, 5];
  const copy = [...source];
  const shuffled = shuffle(source);
  assert.deepEqual(source, copy);
  assert.deepEqual([...shuffled].sort(), [...source].sort());
});

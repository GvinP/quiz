import test from 'node:test';
import assert from 'node:assert/strict';
import { record, isDue, isWeak, dueDay, INTERVALS, MAX_BOX } from '../src/progress/leitner.ts';
import { dayNumber } from '../src/progress/day.ts';

test('верный ответ поднимает на коробку, неверный сбрасывает в первую', () => {
  let entry = record(undefined, true, 100);
  assert.equal(entry.box, 2);
  assert.deepEqual([entry.seen, entry.correct], [1, 1]);

  entry = record(entry, true, 100);
  assert.equal(entry.box, 3);

  entry = record(entry, false, 100);
  assert.equal(entry.box, 1);
  assert.deepEqual([entry.seen, entry.correct], [3, 2]);
});

test('коробка не растёт выше последней', () => {
  let entry = record(undefined, true, 0);
  for (let i = 0; i < 10; i += 1) entry = record(entry, true, 0);
  assert.equal(entry.box, MAX_BOX);
});

test('record не мутирует исходную запись', () => {
  const entry = record(undefined, true, 100);
  const before = { ...entry };
  record(entry, false, 101);
  assert.deepEqual(entry, before);
});

test('интервалы повторения отсчитываются от дня ответа', () => {
  const entry = { box: 3, seen: 5, correct: 4, day: 100 };
  assert.equal(dueDay(entry), 100 + INTERVALS[2]);
  assert.equal(isDue(entry, 102), false);
  assert.equal(isDue(entry, 103), true);
});

test('неотвеченный вопрос доступен всегда', () => {
  assert.equal(isDue(undefined, 0), true);
  assert.equal(isDue({ box: 1, seen: 0, correct: 0, day: 999 }, 0), true);
});

test('ошибка возвращает вопрос в тот же день: первая коробка с интервалом 0', () => {
  const entry = record({ box: 4, seen: 9, correct: 8, day: 200 }, false, 200);
  assert.equal(entry.box, 1);
  assert.equal(isDue(entry, 200), true);
});

test('в работу над ошибками попадает только то, что видел минимум дважды', () => {
  assert.equal(isWeak(undefined), false);
  assert.equal(isWeak({ box: 1, seen: 1, correct: 0, day: 0 }), false, 'один показ — рано судить');
  assert.equal(isWeak({ box: 1, seen: 2, correct: 1, day: 0 }), true, '0.5 ниже порога 0.6');
  assert.equal(isWeak({ box: 2, seen: 5, correct: 3, day: 0 }), false, '0.6 не ниже порога');
  assert.equal(isWeak({ box: 2, seen: 5, correct: 4, day: 0 }), false);
});

test('дни считаются по календарю, а не по суткам', () => {
  const lateEvening = new Date(2026, 8, 12, 23, 30);
  const nextMorning = new Date(2026, 8, 13, 7, 0);
  assert.equal(dayNumber(nextMorning) - dayNumber(lateEvening), 1);
});

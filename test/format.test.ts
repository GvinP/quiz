import test from 'node:test';
import assert from 'node:assert/strict';
import { plural, questionsWord, whenNext } from '../src/format.ts';

test('склонение по последней цифре', () => {
  assert.equal(plural(1, 'день', 'дня', 'дней'), 'день');
  assert.equal(plural(2, 'день', 'дня', 'дней'), 'дня');
  assert.equal(plural(5, 'день', 'дня', 'дней'), 'дней');
  assert.equal(plural(21, 'день', 'дня', 'дней'), 'день');
  assert.equal(plural(22, 'день', 'дня', 'дней'), 'дня');
});

test('вторая десятка — исключение', () => {
  for (const n of [11, 12, 13, 14, 15, 19]) {
    assert.equal(plural(n, 'день', 'дня', 'дней'), 'дней', `${n}`);
  }
  assert.equal(plural(111, 'день', 'дня', 'дней'), 'дней');
});

test('вопросы склоняются так же', () => {
  assert.equal(`1 ${questionsWord(1)}`, '1 вопрос');
  assert.equal(`3 ${questionsWord(3)}`, '3 вопроса');
  assert.equal(`40 ${questionsWord(40)}`, '40 вопросов');
});

test('срок повторения читается по-человечески', () => {
  assert.equal(whenNext(null, 100), 'Вопросов пока нет.');
  assert.equal(whenNext(100, 100), 'Можно повторять прямо сейчас.');
  assert.equal(whenNext(99, 100), 'Можно повторять прямо сейчас.');
  assert.equal(whenNext(101, 100), 'Ближайшее — завтра.');
  assert.equal(whenNext(103, 100), 'Ближайшее — через 3 дня.');
  assert.equal(whenNext(121, 100), 'Ближайшее — через 21 день.');
  assert.equal(whenNext(107, 100), 'Ближайшее — через 7 дней.');
});

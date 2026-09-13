import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, DEFAULT_LANGUAGE, isLanguage, namespaceOf } from '../src/i18n/language.ts';
import { STRINGS } from '../src/i18n/strings.ts';

test('распознаётся только известный язык', () => {
  assert.equal(isLanguage('ru'), true);
  assert.equal(isLanguage('en'), true);
  assert.equal(isLanguage('de'), false);
  assert.equal(isLanguage(null), false);
});

test('у языка по умолчанию пространство имён пустое — старые ключи не переезжают', () => {
  assert.equal(namespaceOf(DEFAULT_LANGUAGE), '');
  assert.equal(namespaceOf('en'), 'en_');
});

test('приставка языка не может совпасть с началом имени темы', () => {
  // Темы называются rn-architecture, js-core, cs-fundamentals — если бы языки
  // разделялись дефисом, эти ключи было бы не отличить друг от друга.
  for (const language of LANGUAGES) {
    const namespace = namespaceOf(language);
    assert.ok(namespace === '' || namespace.endsWith('_'), namespace);
  }
});

test('наборы строк совпадают по составу ключей', () => {
  const keys = (language: (typeof LANGUAGES)[number]) => Object.keys(STRINGS[language]).sort();
  const base = keys(DEFAULT_LANGUAGE);
  for (const language of LANGUAGES) {
    assert.deepEqual(keys(language), base, `в наборе ${language} другой состав ключей`);
  }
});

test('ни одна строка не осталась пустой', () => {
  for (const language of LANGUAGES) {
    for (const [key, value] of Object.entries(STRINGS[language])) {
      if (typeof value === 'string') {
        assert.ok(value.trim().length > 0, `${language}.${key} пустая`);
      }
    }
  }
});

test('английские числительные согласуются с числом', () => {
  const en = STRINGS.en;
  assert.equal(en.questionsCount(1), '1 question');
  assert.equal(en.questionsCount(5), '5 questions');
  assert.equal(en.topicsCount(1), '1 topic');
  assert.equal(en.nextInDays(1), 'Next one in 1 day.');
  assert.equal(en.nextInDays(21), 'Next one in 21 days.');
});

test('русские числительные согласуются с числом', () => {
  const ru = STRINGS.ru;
  assert.equal(ru.questionsCount(1), '1 вопрос');
  assert.equal(ru.questionsCount(3), '3 вопроса');
  assert.equal(ru.questionsCount(20), '20 вопросов');
  assert.equal(ru.nextInDays(21), 'Ближайшее — через 21 день.');
});

test('в английском наборе не осталось кириллицы', () => {
  for (const [key, value] of Object.entries(STRINGS.en)) {
    const text = typeof value === 'function' ? String(value(2, 60)) : value;
    assert.ok(!/[а-яё]/i.test(text), `en.${key} содержит кириллицу: ${text}`);
  }
});

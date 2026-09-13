#!/usr/bin/env node
// Проверка файлов вопросов против контракта из docs/quiz-schema.md.
// Запускается локально (npm run validate) и в CI до сборки.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
/** Реестр тем — не тема: он задаёт только порядок и группировку на экране. */
const REGISTRY = 'topics.json';
/** Язык, с которого переводят: с ним сверяется состав остальных. */
const SOURCE_LANGUAGE = 'ru';
const TYPES = ['single', 'multi', 'code-output', 'open'];
const DIFFICULTIES = [1, 2, 3];
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const errors = [];
/** @type {Map<string, string>} id -> файл, в котором он впервые встретился */
let seenIds = new Map();

function fail(where, message) {
  errors.push(`${where}: ${message}`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateQuestion(file, topic, question, index) {
  const where = `${file} → вопрос #${index}${isNonEmptyString(question?.id) ? ` (${question.id})` : ''}`;

  if (typeof question !== 'object' || question === null || Array.isArray(question)) {
    fail(where, 'должен быть объектом');
    return;
  }

  if (!isNonEmptyString(question.id)) {
    fail(where, 'нет обязательного поля id');
  } else {
    if (!ID_PATTERN.test(question.id)) {
      fail(where, `id "${question.id}" не в формате <topic-slug>-NNN (нижний регистр, дефисы)`);
    }
    const previous = seenIds.get(question.id);
    if (previous) {
      fail(where, `id "${question.id}" уже использован в ${previous} — id уникален глобально`);
    } else {
      seenIds.set(question.id, file);
    }
  }

  if (question.topic !== topic) {
    fail(where, `topic "${question.topic}" не совпадает с topic файла "${topic}"`);
  }

  if (!TYPES.includes(question.type)) {
    fail(where, `недопустимый type "${question.type}", ожидается один из: ${TYPES.join(', ')}`);
  }

  if (!isNonEmptyString(question.question)) {
    fail(where, 'нет обязательного поля question');
  }

  if (!isNonEmptyString(question.explanation)) {
    fail(where, 'нет обязательного поля explanation — это главное поле, оно работает как карточка при повторении');
  }

  if (!DIFFICULTIES.includes(question.difficulty)) {
    fail(where, `difficulty должен быть 1, 2 или 3, получено ${JSON.stringify(question.difficulty)}`);
  }

  if (question.followUp !== undefined) {
    if (!Array.isArray(question.followUp) || !question.followUp.every(isNonEmptyString)) {
      fail(where, 'followUp должен быть массивом непустых строк');
    }
  }

  if (question.type === 'open') {
    if (question.options !== undefined) fail(where, 'у open-вопроса не должно быть options');
    if (question.correct !== undefined) fail(where, 'у open-вопроса не должно быть correct');
    return;
  }

  const { options, correct } = question;

  if (!Array.isArray(options) || options.length < 2 || !options.every(isNonEmptyString)) {
    fail(where, 'options должен быть массивом минимум из двух непустых строк');
    return;
  }

  if (!Array.isArray(correct) || correct.length === 0) {
    fail(where, 'correct должен быть непустым массивом индексов');
    return;
  }

  for (const index of correct) {
    if (!Number.isInteger(index) || index < 0 || index >= options.length) {
      fail(where, `correct содержит ${JSON.stringify(index)} — вне границ options (0..${options.length - 1})`);
    }
  }

  if (new Set(correct).size !== correct.length) {
    fail(where, 'correct содержит повторяющиеся индексы');
  }

  if (question.type === 'single' && correct.length !== 1) {
    fail(where, `у single должен быть ровно один правильный ответ, указано ${correct.length}`);
  }

  if (question.type === 'multi' && correct.length === options.length) {
    fail(where, 'у multi правильны все варианты — вопрос ничего не проверяет');
  }
}

function validateFile(dir, file, topics) {
  const label = `${dir}/${file}`;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(DATA_DIR, dir, file), 'utf8'));
  } catch (error) {
    fail(label, `не разбирается как JSON: ${error.message}`);
    return 0;
  }

  const expectedTopic = file.replace(/\.json$/, '');

  if (!isNonEmptyString(parsed.topic)) {
    fail(label, 'нет обязательного поля topic');
  } else if (parsed.topic !== expectedTopic) {
    fail(label, `topic "${parsed.topic}" не совпадает с именем файла — приложение находит темы глобом по data/<язык>`);
  }

  if (!isNonEmptyString(parsed.title)) fail(label, 'нет обязательного поля title');
  if (!Number.isInteger(parsed.version) || parsed.version < 1) {
    fail(label, 'version должен быть целым числом от 1');
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    fail(label, 'questions должен быть непустым массивом');
    return 0;
  }

  parsed.questions.forEach((question, index) => {
    validateQuestion(label, parsed.topic, question, index + 1);
  });

  if (isNonEmptyString(parsed.topic)) topics.set(parsed.topic, parsed);

  return parsed.questions.length;
}

/**
 * Перевод обязан покрывать ровно тот же состав вопросов, что и оригинал:
 * потерянный при переводе вопрос иначе заметишь только на собеседовании.
 */
function validateTranslation(language, topics, source) {
  for (const [topic, translated] of topics) {
    const original = source.get(topic);
    if (!original) {
      fail(`${language}/${topic}.json`, `нет такой темы в ${SOURCE_LANGUAGE}/ — перевод без оригинала`);
      continue;
    }

    const originalIds = original.questions.map((question) => question.id);
    const translatedIds = translated.questions.map((question) => question.id);

    const missing = originalIds.filter((id) => !translatedIds.includes(id));
    const extra = translatedIds.filter((id) => !originalIds.includes(id));

    if (missing.length > 0) {
      fail(`${language}/${topic}.json`, `не переведены вопросы: ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      fail(`${language}/${topic}.json`, `лишние вопросы, которых нет в оригинале: ${extra.join(', ')}`);
    }
    if (missing.length === 0 && extra.length === 0 && originalIds.join() !== translatedIds.join()) {
      fail(`${language}/${topic}.json`, 'порядок вопросов расходится с оригиналом');
    }

    for (const question of translated.questions) {
      const twin = original.questions.find((item) => item.id === question.id);
      if (!twin) continue;
      if (question.type !== twin.type) {
        fail(`${language}/${topic}.json → ${question.id}`, `type "${question.type}" вместо "${twin.type}"`);
      }
      if (question.type !== 'open' && twin.type !== 'open') {
        if ((question.options?.length ?? 0) !== (twin.options?.length ?? 0)) {
          fail(`${language}/${topic}.json → ${question.id}`, 'число вариантов не совпадает с оригиналом');
        } else if (JSON.stringify(question.correct) !== JSON.stringify(twin.correct)) {
          fail(
            `${language}/${topic}.json → ${question.id}`,
            `correct ${JSON.stringify(question.correct)} расходится с оригиналом ${JSON.stringify(twin.correct)} — при переводе переставили варианты`,
          );
        }
      }
    }
  }
}

/**
 * Реестр необязателен: тема, которой в нём нет, всё равно попадёт в
 * приложение — просто в конец списка. Ошибка только в обратную сторону,
 * когда реестр ссылается на несуществующую тему или спорит с ней о названии.
 */
function validateRegistry(language, topics) {
  const label = `${language}/${REGISTRY}`;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(DATA_DIR, language, REGISTRY), 'utf8'));
  } catch (error) {
    fail(label, `не разбирается как JSON: ${error.message}`);
    return;
  }

  if (!Array.isArray(parsed.topics)) {
    fail(label, 'нет массива topics');
    return;
  }

  const seenTopics = new Set();
  const seenOrders = new Map();

  for (const [index, entry] of parsed.topics.entries()) {
    const where = `${label} → запись #${index + 1}${entry?.topic ? ` (${entry.topic})` : ''}`;

    if (!isNonEmptyString(entry?.topic)) {
      fail(where, 'нет поля topic');
      continue;
    }

    if (seenTopics.has(entry.topic)) fail(where, `topic "${entry.topic}" указан дважды`);
    seenTopics.add(entry.topic);

    const file = topics.get(entry.topic);
    if (!file) {
      fail(where, `ссылается на "${entry.topic}", но файла data/${language}/${entry.topic}.json нет`);
      continue;
    }

    if (!isNonEmptyString(entry.title)) {
      fail(where, 'нет поля title');
    } else if (entry.title !== file.title) {
      fail(where, `title "${entry.title}" расходится с файлом: "${file.title}"`);
    }

    if (entry.group !== undefined && !isNonEmptyString(entry.group)) {
      fail(where, 'group должен быть непустой строкой');
    }

    if (entry.order !== undefined) {
      if (!Number.isInteger(entry.order)) {
        fail(where, 'order должен быть целым числом');
      } else if (seenOrders.has(entry.order)) {
        fail(where, `order ${entry.order} уже занят темой "${seenOrders.get(entry.order)}"`);
      } else {
        seenOrders.set(entry.order, entry.topic);
      }
    }
  }
}

const languages = readdirSync(DATA_DIR)
  .filter((entry) => statSync(join(DATA_DIR, entry)).isDirectory())
  .sort((a, b) => (a === SOURCE_LANGUAGE ? -1 : b === SOURCE_LANGUAGE ? 1 : a.localeCompare(b)));

if (languages.length === 0) {
  console.error('В /data нет ни одной папки языка.');
  process.exit(1);
}

let total = 0;
const summary = [];
const source = new Map();

for (const language of languages) {
  const dir = join(DATA_DIR, language);
  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.json') && file !== REGISTRY)
    .sort();

  if (files.length === 0) {
    fail(language, 'папка языка без единой темы');
    continue;
  }

  // id уникальны внутри языка: перевод намеренно повторяет id оригинала.
  seenIds = new Map();

  const topics = new Map();
  let count = 0;
  for (const file of files) count += validateFile(language, file, topics);

  if (readdirSync(dir).includes(REGISTRY)) validateRegistry(language, topics);

  if (language === SOURCE_LANGUAGE) {
    for (const [topic, parsed] of topics) source.set(topic, parsed);
  } else {
    validateTranslation(language, topics, source);
  }

  total += count;
  summary.push(`${language}: ${files.length} тем, ${count} вопросов`);
}

if (errors.length > 0) {
  console.error(`Данные не прошли проверку — ошибок: ${errors.length}\n`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  console.error('');
  process.exit(1);
}

console.log(`${summary.join('; ')}. Всего вопросов: ${total}. Ошибок нет.`);

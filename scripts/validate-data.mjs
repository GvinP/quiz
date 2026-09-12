#!/usr/bin/env node
// Проверка файлов вопросов против контракта из docs/quiz-schema.md.
// Запускается локально (npm run validate) и в CI до сборки.

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const TYPES = ['single', 'multi', 'code-output', 'open'];
const DIFFICULTIES = [1, 2, 3];
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const errors = [];
/** @type {Map<string, string>} id -> файл, в котором он впервые встретился */
const seenIds = new Map();

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

function validateFile(file) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
  } catch (error) {
    fail(file, `не разбирается как JSON: ${error.message}`);
    return 0;
  }

  const expectedTopic = file.replace(/\.json$/, '');

  if (!isNonEmptyString(parsed.topic)) {
    fail(file, 'нет обязательного поля topic');
  } else if (parsed.topic !== expectedTopic) {
    fail(file, `topic "${parsed.topic}" не совпадает с именем файла — приложение находит темы глобом по /data`);
  }

  if (!isNonEmptyString(parsed.title)) fail(file, 'нет обязательного поля title');
  if (!Number.isInteger(parsed.version) || parsed.version < 1) {
    fail(file, 'version должен быть целым числом от 1');
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    fail(file, 'questions должен быть непустым массивом');
    return 0;
  }

  parsed.questions.forEach((question, index) => {
    validateQuestion(file, parsed.topic, question, index + 1);
  });

  return parsed.questions.length;
}

const files = readdirSync(DATA_DIR).filter((file) => file.endsWith('.json')).sort();

if (files.length === 0) {
  console.error('В /data нет ни одного файла тем.');
  process.exit(1);
}

let total = 0;
for (const file of files) {
  total += validateFile(file);
}

if (errors.length > 0) {
  console.error(`Данные не прошли проверку — ошибок: ${errors.length}\n`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  console.error('');
  process.exit(1);
}

console.log(`Проверено тем: ${files.length}, вопросов: ${total}. Ошибок нет.`);

#!/usr/bin/env node
// Экспорт для бота-интервьюера (/bot). Запускается после vite build и пишет:
// - dist/bot/<язык>.json — банк вопросов, бот забирает его по
//   https://<user>.github.io/quiz/bot/ru.json;
// - dist/bot/Code.js — все файлы bot/src одним скриптом, чтобы в редактор
//   Apps Script вставлять один файл, а не девять.
//
// Бот задаёт все вопросы как открытые, поэтому варианты в экспорт не попадают:
// правильные варианты становятся частью эталона, а вопрос берётся из
// openQuestion, если формулировка без вариантов теряет смысл.

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const OUT_DIR = join(ROOT, 'dist', 'bot');
const BOT_SRC = join(ROOT, 'bot', 'src');
/**
 * Порядок склейки. Для Apps Script он не важен — файлы делят одну глобальную
 * область, а на верхнем уровне никто не обращается к чужим константам, — но
 * так скрипт читается сверху вниз: логика, потом обёртки, потом точки входа.
 */
const BOT_FILES = ['Logic', 'Prompts', 'Config', 'Telegram', 'Gemini', 'Store', 'Bank', 'Bot', 'Setup'];
const REGISTRY = 'topics.json';
const SOURCE_LANGUAGE = 'ru';
/** Версия формата экспорта: бот проверяет её и не разбирает чужое. */
const FORMAT = 1;

const CORRECT_LABEL = { ru: 'Правильный ответ', en: 'Correct answer' };

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function topicFiles(language) {
  return readdirSync(join(DATA_DIR, language))
    .filter((file) => file.endsWith('.json') && file !== REGISTRY)
    .sort()
    .map((file) => readJson(join(DATA_DIR, language, file)));
}

function reference(question, language) {
  if (question.type === 'open') return question.explanation;
  const right = question.correct.map((index) => question.options[index]);
  const label = CORRECT_LABEL[language] ?? CORRECT_LABEL.en;
  const answer = right.length === 1 ? `${label}: ${right[0]}` : `${label}:\n${right.map((item) => `- ${item}`).join('\n')}`;
  return `${answer}\n\n${question.explanation}`;
}

function exportLanguage(language, sourceTitles) {
  const files = topicFiles(language);
  // Названия всех тем, включая непереведённые: /stats на английском всё
  // равно покажет тему по-русски, а не голым id.
  const topics = { ...sourceTitles };
  const questions = [];

  for (const file of files) {
    topics[file.topic] = file.title;
    for (const question of file.questions) {
      questions.push({
        id: question.id,
        topic: question.topic,
        d: question.difficulty,
        q: question.openQuestion ?? question.question,
        ref: reference(question, language),
        hints: question.followUp ?? [],
      });
    }
  }

  return { v: FORMAT, lang: language, topics, questions };
}

const languages = readdirSync(DATA_DIR).filter((entry) => statSync(join(DATA_DIR, entry)).isDirectory());
const sourceTitles = Object.fromEntries(topicFiles(SOURCE_LANGUAGE).map((file) => [file.topic, file.title]));

mkdirSync(OUT_DIR, { recursive: true });
const summary = [];
for (const language of languages) {
  const bank = exportLanguage(language, sourceTitles);
  const json = JSON.stringify(bank);
  writeFileSync(join(OUT_DIR, `${language}.json`), json);
  summary.push(`${language}: ${bank.questions.length} вопросов, ${Math.round(json.length / 1024)} КБ`);
}

const present = readdirSync(BOT_SRC).filter((file) => file.endsWith('.js')).map((file) => file.replace(/\.js$/, ''));
const forgotten = present.filter((name) => !BOT_FILES.includes(name));
if (forgotten.length > 0) {
  throw new Error(`bot/src: файлы ${forgotten.join(', ')} не попадут в Code.js — добавь их в BOT_FILES`);
}

const build = process.env.GITHUB_SHA ? ` · сборка ${process.env.GITHUB_SHA.slice(0, 7)}` : '';
const code = [
  `// Бот-интервьюер: все файлы bot/src одним скриптом${build}.`,
  '// Собрано scripts/export-bot.mjs — правь исходники в репозитории, а не этот файл.',
  '',
  ...BOT_FILES.map((name) => `// ===== ${name}.js =====\n\n${readFileSync(join(BOT_SRC, `${name}.js`), 'utf8').trim()}\n`),
].join('\n');
// Склейка ловит то, чего не видно по отдельным файлам: две одноимённые
// константы в разных файлах — это SyntaxError, и Apps Script не сохранит проект.
new vm.Script(code, { filename: 'Code.js' });
writeFileSync(join(OUT_DIR, 'Code.js'), code);

console.log(`Банк для бота: ${summary.join('; ')}; скрипт: ${Math.round(code.length / 1024)} КБ → dist/bot`);

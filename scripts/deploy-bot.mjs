#!/usr/bin/env node
// Обновление бота в Apps Script после мёржа: заливает dist/bot/Code.js в
// проект, создаёт версию и переключает на неё существующее развёртывание —
// URL webhook не меняется. Запускается из deploy.yml после сборки.
//
// Доступ — секрет GAS_DEPLOY (JSON): client_id, client_secret, refresh_token
// OAuth-клиента с правами script.projects и script.deployments, плюс script_id
// и deployment_id. Без секрета шаг молча пропускается: форкам и CI он не нужен.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODE = join(ROOT, 'dist', 'bot', 'Code.js');
const API = 'https://script.googleapis.com/v1/projects';
/** У проекта Apps Script не больше 200 версий — предупреждаем заранее. */
const VERSION_WARNING = 180;

async function accessToken(credentials) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Токен не обновился (${response.status} ${body.error}): секрет GAS_DEPLOY устарел или доступ отозван`);
  }
  return body.access_token;
}

function client(token, scriptId) {
  return async (method, path, data) => {
    const response = await fetch(`${API}/${scriptId}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${body.error?.message ?? ''}`);
    return body;
  };
}

const raw = process.env.GAS_DEPLOY;
if (!raw) {
  console.log('GAS_DEPLOY не задан — обновление бота пропущено.');
  process.exit(0);
}

const credentials = JSON.parse(raw);
const missing = ['client_id', 'client_secret', 'refresh_token', 'script_id', 'deployment_id'].filter((key) => !credentials[key]);
if (missing.length > 0) throw new Error(`В GAS_DEPLOY нет полей: ${missing.join(', ')}`);

const code = readFileSync(CODE, 'utf8');
const build = code.match(/сборка (\w+)/)?.[1] ?? 'local';
const api = client(await accessToken(credentials), credentials.script_id);

const content = await api('GET', '/content');
// Бот вставляется в проект одним файлом. Если файлов кода несколько, не
// угадываем, какой заменить: лишний файл с теми же функциями сломал бы проект.
const scripts = content.files.filter((file) => file.type === 'SERVER_JS');
if (scripts.length !== 1) {
  throw new Error(`В проекте ${scripts.length} файлов кода, ожидался один: ${scripts.map((file) => file.name).join(', ')}`);
}

// Банк вопросов бот читает с Pages на лету, поэтому большинство мёржей код
// не меняют. Новая версия только при изменениях — лимит версий не резиновый.
// Первую строку не сравниваем: в ней хеш коммита, он другой на каждом мёрже.
const withoutHeader = (source) => source.replace(/^[^\n]*\n/, '');
if (withoutHeader(scripts[0].source) === withoutHeader(code)) {
  console.log(`Код бота не изменился (${scripts[0].name}) — развёртывание не трогаю.`);
  process.exit(0);
}

await api('PUT', '/content', {
  files: content.files.map((file) => ({
    name: file.name,
    type: file.type,
    source: file.type === 'SERVER_JS' ? code : file.source,
  })),
});
const version = await api('POST', '/versions', { description: `bot ${build}` });
await api('PUT', `/deployments/${credentials.deployment_id}`, {
  deploymentConfig: {
    scriptId: credentials.script_id,
    versionNumber: version.versionNumber,
    manifestFileName: 'appsscript',
    description: `bot ${build}`,
  },
});

console.log(`Бот обновлён: версия ${version.versionNumber} (${build}), развёртывание ${credentials.deployment_id.slice(0, 12)}…`);
if (version.versionNumber >= VERSION_WARNING) {
  console.log(`::warning::У проекта ${version.versionNumber} версий из 200 — удали старые в Apps Script → Развёртывания.`);
}

// Функции, которые запускаются руками из редактора Apps Script (Run ▶).
// Порядок первого запуска описан в bot/README.md.

const COMMANDS = [
  { command: 'question', description: 'Новый вопрос' },
  { command: 'skip', description: 'Пропустить вопрос' },
  { command: 'lang', description: 'Язык RU/EN' },
  { command: 'stats', description: 'Статистика по темам' },
  { command: 'help', description: 'Справка' },
];

/** Всё разом: значения по умолчанию, листы, команды, триггер, webhook. */
function setup() {
  ensureDefaults();
  ensureSheets();
  setupCommands();
  setupDailyTrigger();
  if (cfg('WEBHOOK_URL')) setupWebhook();
  else console.warn('WEBHOOK_URL не задан: задеплой web app, впиши URL в Script Properties и запусти setupWebhook()');
}

function ensureDefaults() {
  const props = PropertiesService.getScriptProperties();
  for (const key of Object.keys(DEFAULTS)) {
    if (!props.getProperty(key)) props.setProperty(key, DEFAULTS[key]);
  }
  if (!props.getProperty('WEBHOOK_SECRET')) props.setProperty('WEBHOOK_SECRET', Utilities.getUuid().replace(/-/g, ''));
}

/**
 * Только список команд: кнопку меню с Mini App, настроенную в BotFather,
 * это не трогает — за неё отвечает setChatMenuButton, его бот не вызывает.
 */
function setupCommands() {
  console.log(JSON.stringify(tg('setMyCommands', { commands: COMMANDS })));
}

/**
 * Пересоздаёт ежедневный триггер по DAILY_TIME и TIMEZONE. После смены
 * времени или пояса в Script Properties запусти ещё раз. Apps Script
 * срабатывает с разбросом до ±15 минут — точнее он не умеет.
 */
function setupDailyTrigger() {
  removeTriggers('dailyQuestion');
  const time = parseTime(cfg('DAILY_TIME'));
  if (!time) throw new Error(`DAILY_TIME "${cfg('DAILY_TIME')}" — нужен формат ЧЧ:ММ`);
  ScriptApp.newTrigger('dailyQuestion')
    .timeBased()
    .atHour(time[0])
    .nearMinute(time[1])
    .everyDays(1)
    .inTimezone(timezone())
    .create();
  console.log(`Вопрос дня: ${cfg('DAILY_TIME')} (${timezone()})`);
}

/** Секрет в URL: Apps Script не показывает заголовки запроса, secret_token Telegram не прочитать. */
function setupWebhook() {
  ensureDefaults();
  const url = `${requireCfg('WEBHOOK_URL')}?secret=${encodeURIComponent(requireCfg('WEBHOOK_SECRET'))}`;
  console.log(JSON.stringify(tg('setWebhook', { url, allowed_updates: ['message'], drop_pending_updates: true })));
  webhookInfo();
}

/** Проверка после деплоя: last_error_message должен быть пустым. */
function webhookInfo() {
  const info = tg('getWebhookInfo', {}).result || {};
  if (info.url) info.url = info.url.replace(/secret=[^&]+/, 'secret=***');
  console.log(JSON.stringify(info, null, 2));
}

/** Запасной режим без webhook: getUpdates раз в минуту. */
function enablePolling() {
  tg('deleteWebhook', { drop_pending_updates: false });
  removeTriggers('pollUpdates');
  ScriptApp.newTrigger('pollUpdates').timeBased().everyMinutes(1).create();
  console.log('Опрос включён: раз в минуту');
}

function enableWebhook() {
  removeTriggers('pollUpdates');
  setupWebhook();
}

function removeTriggers(handler) {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger);
  }
}

/** Быстрая проверка ключа и модели без Telegram. */
function testGemini() {
  const question = {
    q: 'Что такое замыкание в JavaScript?',
    ref: 'Функция вместе с лексическим окружением, в котором она создана: она видит внешние переменные и после завершения внешней функции.',
    hints: ['Как замыкания связаны с утечками памяти?'],
  };
  console.log(JSON.stringify(reviewAnswer(question, { text: 'Это когда функция помнит переменные снаружи' }, 'ru'), null, 2));
}

/** Проверка токена и CHAT_ID: бот пришлёт вопрос, как по триггеру. */
function testDaily() {
  dailyQuestion();
}

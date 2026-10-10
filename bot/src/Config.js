// Настройки живут в Script Properties (Project Settings → Script Properties).
// Обязательные: TELEGRAM_TOKEN, GEMINI_API_KEY, CHAT_ID, WEBHOOK_URL.
// Остальные получают значения по умолчанию при первом setup().

const DEFAULTS = {
  TIMEZONE: 'Europe/Moscow',
  DAILY_TIME: '11:00',
  GEMINI_MODEL: 'gemini-3.8-flash',
  /** low | medium | high; off — не передавать вовсе (модели до Gemini 3 его не знают). */
  GEMINI_THINKING: 'low',
  QUESTIONS_URL: 'https://gvinp.github.io/quiz/bot/',
};

function cfg(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (value !== null && String(value).trim() !== '') return String(value).trim();
  return DEFAULTS[key] !== undefined ? DEFAULTS[key] : '';
}

function requireCfg(key) {
  const value = cfg(key);
  if (!value) throw new Error(`Не задано Script Property ${key}`);
  return value;
}

function setCfg(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

function timezone() {
  return cfg('TIMEZONE');
}

/** Сегодняшний день в настроенном поясе: «завтра» наступает в полночь по TIMEZONE. */
function today() {
  return dayFromIso(Utilities.formatDate(new Date(), timezone(), 'yyyy-MM-dd'));
}

function nowText() {
  return Utilities.formatDate(new Date(), timezone(), 'yyyy-MM-dd HH:mm');
}

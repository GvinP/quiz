// Банк вопросов с GitHub Pages: dist/bot/<язык>.json из scripts/export-bot.mjs.

const BANK_FORMAT = 1;

function loadBank(lang) {
  const base = cfg('QUESTIONS_URL').replace(/\/?$/, '/');
  const response = UrlFetchApp.fetch(`${base}${lang}.json`, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error(`Банк ${lang}: HTTP ${response.getResponseCode()}`);
  }
  const bank = JSON.parse(response.getContentText());
  if (bank.v !== BANK_FORMAT || !Array.isArray(bank.questions) || bank.questions.length === 0) {
    throw new Error(`Банк ${lang}: неизвестный формат ${bank.v}`);
  }
  return bank;
}

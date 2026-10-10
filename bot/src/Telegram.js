// Тонкая обёртка над Bot API.

function tg(method, payload) {
  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${requireCfg('TELEGRAM_TOKEN')}/${method}`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true,
  });
  let body;
  try {
    body = JSON.parse(response.getContentText());
  } catch (error) {
    body = { ok: false, description: response.getContentText().slice(0, 200) };
  }
  if (!body.ok) console.warn(`Telegram ${method}: ${response.getResponseCode()} ${body.description}`);
  return body;
}

/**
 * HTML с запасным путём: если Telegram не разобрал разметку (или текст
 * длиннее лимита), то же самое уходит простым текстом — лучше без
 * форматирования, чем без ответа.
 */
function send(html) {
  const chatId = requireCfg('CHAT_ID');
  if (html.length <= MESSAGE_LIMIT) {
    const result = tg('sendMessage', {
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
    if (result.ok) return result;
  }
  return tg('sendMessage', { chat_id: chatId, text: truncate(htmlToPlain(html)) });
}

function sendTyping() {
  tg('sendChatAction', { chat_id: requireCfg('CHAT_ID'), action: 'typing' });
}

/** Файл из Telegram как base64 — так его принимает Gemini в inlineData. */
function downloadBase64(fileId) {
  const file = tg('getFile', { file_id: fileId });
  if (!file.ok) throw new Error(`getFile: ${file.description}`);
  const url = `https://api.telegram.org/file/bot${requireCfg('TELEGRAM_TOKEN')}/${file.result.file_path}`;
  return Utilities.base64Encode(UrlFetchApp.fetch(url).getContent());
}

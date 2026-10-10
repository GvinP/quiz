// Вызов Gemini API (generateContent) со структурированным ответом.

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
/** На 429 и 5xx одна повторная попытка: дольше держать webhook нельзя. */
const GEMINI_RETRY_CODES = [429, 500, 502, 503, 504];

function callGemini(instruction, parts, schema) {
  const generationConfig = { responseMimeType: 'application/json', responseJsonSchema: schema };
  // low — быстрее и дешевле: для оценки одного ответа глубокое рассуждение
  // не нужно, а webhook ждёт.
  const thinking = cfg('GEMINI_THINKING');
  if (thinking !== 'off') generationConfig.thinkingConfig = { thinkingLevel: thinking };

  const request = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': requireCfg('GEMINI_API_KEY') },
    payload: JSON.stringify({
      systemInstruction: { parts: [{ text: instruction }] },
      contents: [{ role: 'user', parts }],
      generationConfig,
    }),
    muteHttpExceptions: true,
  };
  const url = `${GEMINI_ENDPOINT}${encodeURIComponent(cfg('GEMINI_MODEL'))}:generateContent`;

  let response = UrlFetchApp.fetch(url, request);
  if (GEMINI_RETRY_CODES.indexOf(response.getResponseCode()) !== -1) {
    Utilities.sleep(1500);
    response = UrlFetchApp.fetch(url, request);
  }
  if (response.getResponseCode() !== 200) {
    throw new Error(`Gemini ${response.getResponseCode()}: ${response.getContentText().slice(0, 500)}`);
  }

  const data = JSON.parse(response.getContentText());
  const candidate = data.candidates && data.candidates[0];
  if (!candidate) {
    throw new Error(`Gemini не вернул ответ: ${JSON.stringify(data.promptFeedback || data).slice(0, 300)}`);
  }
  const output = ((candidate.content && candidate.content.parts) || [])
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join('');
  return normalizeReview(parseModelJson(output));
}

/** Ответ — текст или голосовое; голосовое уходит в модель как есть, без распознавания. */
function answerParts(requestText, answer) {
  const parts = [{ text: requestText }];
  if (answer.audio) parts.push({ inlineData: { mimeType: answer.audio.mimeType, data: answer.audio.data } });
  return parts;
}

function reviewAnswer(question, answer, lang) {
  return callGemini(reviewInstruction(lang), answerParts(reviewRequest(question, answer.text), answer), REVIEW_SCHEMA);
}

function reviewFollowUp(question, state, answer, lang) {
  return callGemini(
    followUpInstruction(lang),
    answerParts(followUpRequest(question, state, answer.text), answer),
    FOLLOW_UP_SCHEMA,
  );
}

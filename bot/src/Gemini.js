// Вызов Gemini API (generateContent) со структурированным ответом.

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
/** Лимит (429) или перегрузка (5xx): основная модель недоступна, пробуем запасную. */
const GEMINI_FALLBACK_CODES = [429, 500, 502, 503, 504];

/** Основная модель, потом запасная; без повторов: дольше держать webhook нельзя. */
function geminiModels() {
  const models = [cfg('GEMINI_MODEL')];
  const fallback = cfg('GEMINI_FALLBACK_MODEL');
  if (fallback && fallback !== 'off' && fallback !== models[0]) models.push(fallback);
  return models;
}

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

  const failures = [];
  for (const model of geminiModels()) {
    let response;
    try {
      response = UrlFetchApp.fetch(`${GEMINI_ENDPOINT}${encodeURIComponent(model)}:generateContent`, request);
    } catch (error) {
      // Таймаут или обрыв сети: UrlFetchApp бросает даже с muteHttpExceptions.
      failures.push(`${model}: ${error.message}`);
      continue;
    }
    const code = response.getResponseCode();
    if (code === 200) return parseGeminiResponse(response.getContentText(), model);
    failures.push(`${model}: ${code} ${geminiErrorText(response.getContentText())}`);
    if (GEMINI_FALLBACK_CODES.indexOf(code) === -1) break;
  }
  throw new Error(`Gemini ${failures.join(' | ')}`);
}

/** Из JSON ошибки Google — только error.message: тело целиком в Telegram не влезет. */
function geminiErrorText(body) {
  try {
    const parsed = JSON.parse(body);
    if (parsed.error && parsed.error.message) return parsed.error.message.slice(0, 200);
  } catch (error) {
    // не JSON — отдадим начало как есть
  }
  return String(body).slice(0, 200);
}

function parseGeminiResponse(body, model) {
  const data = JSON.parse(body);
  const candidate = data.candidates && data.candidates[0];
  if (!candidate) {
    throw new Error(`Gemini ${model} не вернул ответ: ${JSON.stringify(data.promptFeedback || data).slice(0, 300)}`);
  }
  const output = ((candidate.content && candidate.content.parts) || [])
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join('');
  try {
    return normalizeReview(parseModelJson(output));
  } catch (error) {
    throw new Error(`Gemini ${model}: непонятный ответ (${candidate.finishReason || 'нет finishReason'}): ${output.slice(0, 200)}`);
  }
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

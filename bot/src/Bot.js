// Точка входа: webhook (doPost), ежедневный триггер и команды.

/** Telegram повторяет update, пока не получит 200; помним id шесть часов — максимум CacheService. */
const DEDUP_TTL_SECONDS = 6 * 60 * 60;
/** Сообщение старше этого — запоздалый повтор, а не свежий ответ. */
const STALE_SECONDS = 3 * 60 * 60;
/** Сколько ждать, пока закончится обработка предыдущего сообщения. */
const LOCK_WAIT_MS = 60 * 1000;
const MAX_VOICE_SECONDS = 600;

/**
 * Ответ всегда один и тот же и всегда через HtmlService: ответ ContentService
 * Apps Script, по отчётам, отдаёт редиректом 302, Telegram по нему не идёт,
 * считает доставку неудачной и шлёт update снова. Что бы ни случилось
 * внутри — Telegram слышит «ок», а ошибка уходит в журнал выполнений.
 * Если getWebhookInfo всё равно показывает 302 — enablePolling().
 */
function doPost(e) {
  try {
    const secret = cfg('WEBHOOK_SECRET');
    if (secret && e && e.parameter && e.parameter.secret === secret && e.postData) {
      processUpdate(JSON.parse(e.postData.contents));
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
  }
  return HtmlService.createHtmlOutput('ok');
}

function doGet() {
  return HtmlService.createHtmlOutput('ok');
}

/**
 * Дедупликация до любой медленной работы: повтор, пришедший, пока Gemini
 * ещё думает над первым экземпляром, отбрасывается сразу. Короткий
 * пользовательский замок — отдельный от замка обработки, чтобы новое
 * сообщение не терялось, пока обрабатывается предыдущее.
 */
function claimUpdate(updateId) {
  if (typeof updateId !== 'number') return false;
  let lock = null;
  try {
    lock = LockService.getUserLock();
  } catch (error) {
    // Без замка дедупликация всё равно работает: повторы Telegram приходят
    // с интервалом в секунды, а не одновременно.
    console.warn(error);
  }
  if (lock && !lock.tryLock(10 * 1000)) return false;
  try {
    const cache = CacheService.getScriptCache();
    const key = `update_${updateId}`;
    if (cache.get(key)) return false;
    cache.put(key, '1', DEDUP_TTL_SECONDS);
    return true;
  } finally {
    if (lock) lock.releaseLock();
  }
}

function processUpdate(update) {
  if (!update || !claimUpdate(update.update_id)) return;
  const message = update.message;
  if (!message || !message.chat) return;

  const owner = cfg('CHAT_ID');
  if (!owner) {
    // Бот ещё не настроен: подсказываем chat_id, чтобы его было откуда взять.
    tg('sendMessage', { chat_id: message.chat.id, text: `chat_id: ${message.chat.id}` });
    return;
  }
  if (String(message.chat.id) !== owner) return;
  if (message.date && Date.now() / 1000 - message.date > STALE_SECONDS) return;

  withLock(() => handleMessage(message), () => send(strings(loadStateSafe().lang).busy));
}

/** Один обработчик за раз: webhook, триггер и опрос делят одно состояние. */
function withLock(action, onBusy) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    if (onBusy) onBusy();
    return;
  }
  try {
    action();
  } finally {
    lock.releaseLock();
  }
}

function loadStateSafe() {
  try {
    return loadState();
  } catch (error) {
    return { lang: 'ru', stage: 'idle' };
  }
}

function handleMessage(message) {
  const state = loadState();
  const command = commandOf(message.text);
  if (command) return handleCommand(command, state);

  const s = strings(state.lang);
  const voice = message.voice || message.audio;
  const answerText = (message.text || '').trim();
  if (!answerText && !voice) return send(s.onlyTextOrVoice);
  if (state.stage === 'idle') return send(s.noQuestion);
  if (voice && voice.duration > MAX_VOICE_SECONDS) return send(s.tooLong);

  sendTyping();
  const answer = { text: answerText };
  if (voice) {
    try {
      answer.audio = { mimeType: voice.mime_type || 'audio/ogg', data: downloadBase64(voice.file_id) };
    } catch (error) {
      console.error(error);
      return send(s.reviewFailed);
    }
  }

  if (state.stage === 'answer') return handleAnswer(state, answer);
  return handleFollowUpAnswer(state, answer);
}

function handleCommand(command, state) {
  const s = strings(state.lang);
  switch (command) {
    case '/start':
    case '/help':
      return send(escapeHtml(s.help(cfg('DAILY_TIME'))));
    case '/question':
      return askNext(state, false);
    case '/skip':
      if (state.stage === 'answer') return askNext(state, false);
      if (state.stage === 'followup') {
        saveState(closed(state));
        return send(s.closedNoReview);
      }
      return send(s.noQuestion);
    case '/lang': {
      const lang = state.lang === 'en' ? 'ru' : 'en';
      saveState(Object.assign({}, state, { lang }));
      return send(strings(lang).langSwitched);
    }
    case '/stats': {
      let titles = {};
      try {
        titles = loadBank(state.lang).topics;
      } catch (error) {
        console.warn(error);
      }
      return send(formatStats(loadHistory(), titles, state.lang));
    }
    default:
      return send(s.unknownCommand);
  }
}

function closed(state) {
  return { lang: state.lang, stage: 'idle', question: null, lastQuestionId: state.lastQuestionId || '' };
}

/**
 * Новый вопрос. Неотвеченный текущий уходит в историю как пропуск и на
 * повторение не влияет; неотвеченное уточнение просто закрывается.
 */
function askNext(state, daily) {
  const s = strings(state.lang);
  if (state.stage === 'answer' && state.question) {
    appendHistory({
      lang: state.lang,
      questionId: state.question.id,
      topic: state.question.topic,
      stage: 'skipped',
      answer: '',
      feedback: '',
    });
  }

  let bank;
  try {
    bank = loadBank(state.lang);
  } catch (error) {
    console.error(error);
    return send(s.bankFailed);
  }

  const picked = pickQuestion(bank.questions, loadCards(), topicAverages(loadHistory()), today(), {
    exclude: state.lastQuestionId || (state.question && state.question.id),
  });
  const question = Object.assign({ title: bank.topics[picked.topic] || picked.topic }, picked);

  saveState({ lang: state.lang, stage: 'answer', question, lastQuestionId: question.id, askedAt: nowText() });
  return send(formatQuestion(question, state.lang, daily));
}

function handleAnswer(state, answer) {
  const s = strings(state.lang);
  const question = state.question;
  let review;
  try {
    review = reviewAnswer(question, answer, state.lang);
  } catch (error) {
    console.error(error);
    return send(s.reviewFailed);
  }

  appendHistory({
    lang: state.lang,
    questionId: question.id,
    topic: question.topic,
    stage: 'main',
    score: review.score,
    answer: answer.text || `[voice] ${review.summary}`,
    feedback: review.gaps.join('; '),
  });

  const cards = loadCards();
  const previous = cards[question.id];
  saveCard(updateCard(previous, question, review.score, today()), previous && previous.row);

  if (!review.followUp) {
    saveState(closed(state));
    return send(`${formatReview(review, state.lang)}\n\n${s.closed}`);
  }
  saveState(
    Object.assign({}, state, {
      stage: 'followup',
      followUp: review.followUp,
      mainSummary: review.summary || answer.text.slice(0, 500),
      mainScore: review.score,
    }),
  );
  return send(formatReview(review, state.lang));
}

function handleFollowUpAnswer(state, answer) {
  const s = strings(state.lang);
  let review;
  try {
    review = reviewFollowUp(state.question, state, answer, state.lang);
  } catch (error) {
    console.error(error);
    return send(s.reviewFailed);
  }

  appendHistory({
    lang: state.lang,
    questionId: state.question.id,
    topic: state.question.topic,
    stage: 'followup',
    score: review.score,
    answer: answer.text || `[voice] ${review.summary}`,
    feedback: review.comment,
  });
  saveState(closed(state));
  return send(formatFollowUpReview(review, state.lang));
}

/** Ежедневный триггер (setupDailyTrigger). */
function dailyQuestion() {
  withLock(() => askNext(loadState(), true));
}

// ---------------------------------------------------------------- Запасной режим: опрос

/**
 * Если webhook сбоит (в getWebhookInfo висит «Wrong response from the
 * webhook»), бот можно перевести на getUpdates раз в минуту: enablePolling().
 * Обработчик тот же, дедупликация та же.
 */
function pollUpdates() {
  const offset = Number(cfg('POLL_OFFSET')) || 0;
  const response = tg('getUpdates', { offset, timeout: 0, allowed_updates: ['message'] });
  if (!response.ok) return;
  for (const update of response.result) {
    setCfg('POLL_OFFSET', update.update_id + 1);
    try {
      processUpdate(update);
    } catch (error) {
      console.error(error && error.stack ? error.stack : error);
    }
  }
}

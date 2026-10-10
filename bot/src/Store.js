// Google Таблица как хранилище.
//
// State   — ключ/значение: язык, этап, текущий вопрос (снимок целиком, чтобы
//           проверка не скачивала банк заново), уточняющий вопрос.
// History — по строке на ответ: основной, уточнение или пропуск.
// Cards   — по строке на вопрос: коробка Лейтнера и дата следующего показа.

const SHEET_STATE = 'State';
const SHEET_HISTORY = 'History';
const SHEET_CARDS = 'Cards';
const HISTORY_HEADER = ['time', 'lang', 'questionId', 'topic', 'stage', 'score', 'answer', 'feedback'];
const CARDS_HEADER = ['questionId', 'topic', 'box', 'due', 'last', 'seen', 'lastScore', 'dueDate'];
/** В ячейке не больше 50 000 символов; длинный ответ обрезаем с запасом. */
const CELL_LIMIT = 45000;

function book() {
  const id = cfg('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet(name) {
  const found = book().getSheetByName(name);
  if (!found) throw new Error(`Нет листа ${name} — запусти setup()`);
  return found;
}

/**
 * Строки пишутся с апострофом: иначе Таблица превратит ответ «1/2» в дату,
 * «TRUE» — в булево, а начало с «=» — в формулу. Апостроф Таблица не
 * показывает и при чтении отдаёт строку без него. Числа остаются числами —
 * по ним можно строить графики прямо в Таблице.
 */
function cell(value) {
  if (typeof value === 'number') return value;
  const textValue = value === undefined || value === null ? '' : String(value).slice(0, CELL_LIMIT);
  return textValue ? `'${textValue}` : '';
}

function ensureSheet(name, header) {
  const spreadsheet = book();
  const target = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (header && target.getLastRow() === 0) {
    target.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    target.setFrozenRows(1);
  }
  return target;
}

function ensureSheets() {
  ensureSheet(SHEET_STATE, null);
  ensureSheet(SHEET_HISTORY, HISTORY_HEADER);
  ensureSheet(SHEET_CARDS, CARDS_HEADER);
}

// ---------------------------------------------------------------- State

const STATE_JSON_KEYS = ['question'];

function loadState() {
  const values = sheet(SHEET_STATE).getDataRange().getValues();
  const state = { lang: 'ru', stage: 'idle' };
  for (const [key, value] of values) {
    if (!key) continue;
    if (STATE_JSON_KEYS.indexOf(key) !== -1) {
      try {
        state[key] = value ? JSON.parse(value) : null;
      } catch (error) {
        state[key] = null;
      }
    } else {
      state[key] = String(value);
    }
  }
  // Этап без вопроса — значит, состояние испорчено; лучше начать заново.
  if (state.stage !== 'idle' && !state.question) state.stage = 'idle';
  return state;
}

function saveState(state) {
  const rows = Object.keys(state).map((key) => [
    key,
    cell(STATE_JSON_KEYS.indexOf(key) !== -1 ? JSON.stringify(state[key] || null) : state[key]),
  ]);
  const target = sheet(SHEET_STATE);
  target.clearContents();
  target.getRange(1, 1, rows.length, 2).setValues(rows);
}

// ---------------------------------------------------------------- History

function appendHistory(entry) {
  sheet(SHEET_HISTORY).appendRow(
    [nowText(), entry.lang, entry.questionId, entry.topic, entry.stage, entry.score || '', entry.answer, entry.feedback].map(cell),
  );
}

function loadHistory() {
  const values = sheet(SHEET_HISTORY).getDataRange().getValues().slice(1);
  return values.map((row) => ({
    time: row[0],
    lang: row[1],
    questionId: row[2],
    topic: row[3],
    stage: row[4],
    score: Number(row[5]) || 0,
  }));
}

// ---------------------------------------------------------------- Cards

function loadCards() {
  const values = sheet(SHEET_CARDS).getDataRange().getValues();
  const cards = {};
  values.slice(1).forEach((row, index) => {
    if (!row[0]) return;
    cards[row[0]] = {
      row: index + 2,
      id: row[0],
      topic: row[1],
      box: Number(row[2]) || 1,
      due: Number(row[3]) || 0,
      last: Number(row[4]) || 0,
      seen: Number(row[5]) || 0,
      lastScore: Number(row[6]) || 0,
    };
  });
  return cards;
}

/** dueDate в конце — только для глаз: открыть таблицу и увидеть, когда вопрос вернётся. */
function saveCard(card, row) {
  const values = [[card.id, card.topic, card.box, card.due, card.last, card.seen, card.lastScore, isoFromDay(card.due)].map(cell)];
  const target = sheet(SHEET_CARDS);
  const at = row || target.getLastRow() + 1;
  target.getRange(at, 1, 1, values[0].length).setValues(values);
}

import type { Entry } from './types.ts';
import { dayNumber } from './day.ts';

/** Интервалы повторения в днях для коробок 1..5. */
export const INTERVALS = [0, 1, 3, 7, 21] as const;

export const MAX_BOX = INTERVALS.length;

/** Ниже этой доли верных ответов вопрос попадает в работу над ошибками. */
export const WEAK_RATIO = 0.6;

/** Столько раз вопрос должен быть показан, прежде чем судить о нём. */
export const WEAK_MIN_SEEN = 2;

export function newEntry(day: number = dayNumber()): Entry {
  return { box: 1, seen: 0, correct: 0, day };
}

/**
 * Верный ответ поднимает на коробку, неверный сбрасывает в первую.
 * Возвращает новую запись, исходная не меняется.
 */
export function record(entry: Entry | undefined, correct: boolean, day: number = dayNumber()): Entry {
  const base = entry ?? newEntry(day);
  return {
    box: correct ? Math.min(base.box + 1, MAX_BOX) : 1,
    seen: base.seen + 1,
    correct: base.correct + (correct ? 1 : 0),
    day,
  };
}

/** День, начиная с которого вопрос снова пора повторять. */
export function dueDay(entry: Entry): number {
  return entry.day + INTERVALS[Math.min(entry.box, MAX_BOX) - 1];
}

/**
 * Пора ли повторять. Вопрос без записи не показывался ни разу — он всегда
 * доступен. Коробка 1 имеет интервал 0: вопрос доступен сразу, но очередь
 * повторения не показывает его дважды за сессию (см. selectors.ts).
 */
export function isDue(entry: Entry | undefined, today: number = dayNumber()): boolean {
  return entry === undefined || entry.seen === 0 || dueDay(entry) <= today;
}

/** Вопрос, на котором стабильно ошибаешься. */
export function isWeak(entry: Entry | undefined): boolean {
  if (!entry || entry.seen < WEAK_MIN_SEEN) return false;
  return entry.correct / entry.seen < WEAK_RATIO;
}

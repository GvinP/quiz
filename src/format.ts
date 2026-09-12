/**
 * Русские числительные: «21 день», но «11 дней» и «22 дня». Без этого в
 * интерфейсевылезает «через 21 дней».
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export const questionsWord = (count: number): string =>
  plural(count, 'вопрос', 'вопроса', 'вопросов');

/** Человеческий срок до ближайшего повторения. */
export function whenNext(dueDay: number | null, today: number): string {
  if (dueDay === null) return 'Вопросов пока нет.';

  const days = dueDay - today;
  if (days <= 0) return 'Можно повторять прямо сейчас.';
  if (days === 1) return 'Ближайшее — завтра.';
  return `Ближайшее — через ${days} ${plural(days, 'день', 'дня', 'дней')}.`;
}

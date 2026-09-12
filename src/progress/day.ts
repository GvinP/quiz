const MS_IN_DAY = 86_400_000;

/**
 * Дни от эпохи по локальному времени пользователя. Интервалы повторения
 * измеряются в календарных днях, а не в сутках: «завтра» должно наступать
 * в полночь, а не через 24 часа после ответа.
 */
export function dayNumber(date: Date = new Date()): number {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(local.getTime() / MS_IN_DAY);
}

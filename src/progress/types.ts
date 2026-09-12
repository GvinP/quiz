/** Запись прогресса по одному вопросу. Хранится кортежем, см. codec.ts. */
export interface Entry {
  /** Номер коробки Лейтнера, 1..5. */
  box: number;
  /** Сколько раз вопрос показывался. */
  seen: number;
  /** Сколько раз отвечен верно. */
  correct: number;
  /** День последнего ответа — дни от эпохи. */
  day: number;
}

/** Прогресс одной темы: id вопроса → запись. */
export type TopicProgress = Record<string, Entry>;

/** Прогресс целиком: тема → её записи. */
export type Progress = Record<string, TopicProgress>;

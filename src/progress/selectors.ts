import type { Question } from '../data/types.ts';
import type { Progress } from './types.ts';
import { isDue, isWeak } from './leitner.ts';
import { dayNumber } from './day.ts';

const entryOf = (progress: Progress, question: Question) => progress[question.topic]?.[question.id];

/** Детерминированной случайности не нужно — тасуем Фишером–Йейтсом. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Квиз: вопросы темы подряд, в порядке файла. */
export function quizQueue(questions: Question[], topic: string): Question[] {
  return questions.filter((question) => question.topic === topic);
}

/**
 * Повторение: всё, что пора повторить, вперемешку из всех тем.
 * Вопрос попадает в очередь один раз за сессию — иначе ошибка в первой
 * коробке (интервал 0 дней) возвращала бы его бесконечно.
 */
export function reviewQueue(
  questions: Question[],
  progress: Progress,
  today: number = dayNumber(),
  random?: () => number,
): Question[] {
  return shuffle(
    questions.filter((question) => isDue(entryOf(progress, question), today)),
    random,
  );
}

/** Работа над ошибками: где доля верных ответов ниже порога. */
export function weakQueue(questions: Question[], progress: Progress, random?: () => number): Question[] {
  return shuffle(
    questions.filter((question) => isWeak(entryOf(progress, question))),
    random,
  );
}

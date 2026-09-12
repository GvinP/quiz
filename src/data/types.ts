// Типы повторяют контракт из docs/quiz-schema.md.
// Менять их в отрыве от контракта нельзя — сначала правится документ.

export type QuestionType = 'single' | 'multi' | 'code-output' | 'open';

export type Difficulty = 1 | 2 | 3;

/** Вопрос с вариантами ответа: single, multi, code-output. */
export interface ChoiceQuestion {
  id: string;
  topic: string;
  type: Exclude<QuestionType, 'open'>;
  question: string;
  options: string[];
  correct: number[];
  explanation: string;
  followUp?: string[];
  difficulty: Difficulty;
}

/** Вопрос без вариантов: пользователь отвечает вслух и оценивает себя сам. */
export interface OpenQuestion {
  id: string;
  topic: string;
  type: 'open';
  question: string;
  explanation: string;
  followUp?: string[];
  difficulty: Difficulty;
}

export type Question = ChoiceQuestion | OpenQuestion;

export interface TopicFile {
  topic: string;
  title: string;
  version: number;
  questions: Question[];
}

export function isOpen(question: Question): question is OpenQuestion {
  return question.type === 'open';
}

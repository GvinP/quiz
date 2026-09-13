import type { Language } from './language.ts';
import { plural } from '../format.ts';

/** Все тексты интерфейса. Контент вопросов переводится отдельно, в data/<язык>. */
export interface Strings {
  appTitle: string;
  loadingTopics: string;

  topicsCount(count: number): string;
  questionsCount(count: number): string;
  answeredCount(count: number): string;

  resume: string;
  resumeNote(title: string, position: number, total: number): string;

  quiz: string;
  quizNote: string;

  review: string;
  reviewNote: string;
  reviewDue(count: number): string;
  reviewEmpty(next: string): string;
  nextNever: string;
  nextNow: string;
  nextTomorrow: string;
  nextInDays(days: number): string;

  weak: string;
  weakNote: string;
  weakCount(count: number, percent: number): string;
  weakNothingYet: string;
  weakEmpty: string;

  pickTopic: string;
  pickTopicNote: string;
  otherGroup: string;
  back: string;

  exit: string;
  difficulty(level: number): string;
  openHint: string;
  right: string;
  wrong: string;
  followUp: string;
  showAnswer: string;
  gradeKnew: string;
  gradePartly: string;
  gradeMissed: string;
  answer: string;
  next: string;
  toResult: string;

  score(correct: number, total: number): string;
  flawless: string;
  missedCount(count: number): string;
  worthRepeating: string;
  toHome: string;
  restart: string;
}

const ru: Strings = {
  appTitle: 'Квиз по React Native',
  loadingTopics: 'Загрузка тем…',

  topicsCount: (count) => `${count} ${plural(count, 'тема', 'темы', 'тем')}`,
  questionsCount: (count) => `${count} ${plural(count, 'вопрос', 'вопроса', 'вопросов')}`,
  answeredCount: (count) => `отвечено ${count}`,

  resume: 'Продолжить',
  resumeNote: (title, position, total) => `${title} · вопрос ${position} из ${total}`,

  quiz: 'Квиз',
  quizNote: 'Вопросы одной темы подряд',

  review: 'Повторение',
  reviewNote: 'Вперемешку из всех тем',
  reviewDue: (count) =>
    `Вперемешку из всех тем · пора повторить: ${count} ${plural(count, 'вопрос', 'вопроса', 'вопросов')}`,
  reviewEmpty: (next) => `Сейчас нечего повторять. ${next}`,
  nextNever: 'Вопросов пока нет.',
  nextNow: 'Можно повторять прямо сейчас.',
  nextTomorrow: 'Ближайшее — завтра.',
  nextInDays: (days) => `Ближайшее — через ${days} ${plural(days, 'день', 'дня', 'дней')}.`,

  weak: 'Работа над ошибками',
  weakNote: 'Вопросы, на которых стабильно ошибаешься',
  weakCount: (count, percent) =>
    `Доля верных ниже ${percent}% · ${count} ${plural(count, 'вопрос', 'вопроса', 'вопросов')}`,
  weakNothingYet: 'Появится, когда будет на чём ошибаться.',
  weakEmpty: 'Пусто — устойчивых ошибок пока нет.',

  pickTopic: 'Выбери тему',
  pickTopicNote: 'Вопросы пойдут подряд, в порядке файла.',
  otherGroup: 'Остальное',
  back: '← Назад',

  exit: '← Выйти',
  difficulty: (level) => `сложность ${level}`,
  openHint: 'Ответь вслух, потом открой разбор и оцени себя честно.',
  right: 'Верно',
  wrong: 'Неверно',
  followUp: 'Куда копнут дальше',
  showAnswer: 'Показать ответ',
  gradeKnew: 'Знал',
  gradePartly: 'Частично',
  gradeMissed: 'Не знал',
  answer: 'Ответить',
  next: 'Дальше',
  toResult: 'Результат',

  score: (correct, total) => `${correct} из ${total}`,
  flawless: 'Без единой ошибки.',
  missedCount: (count) => `Ушло в работу над ошибками: ${count}.`,
  worthRepeating: 'Что стоит повторить',
  toHome: 'На главную',
  restart: 'Пройти заново',
};

/** В английском множественное число проще: одна форма против всех остальных. */
const s = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const en: Strings = {
  appTitle: 'React Native Quiz',
  loadingTopics: 'Loading topics…',

  topicsCount: (count) => s(count, 'topic'),
  questionsCount: (count) => s(count, 'question'),
  answeredCount: (count) => `${count} answered`,

  resume: 'Continue',
  resumeNote: (title, position, total) => `${title} · question ${position} of ${total}`,

  quiz: 'Quiz',
  quizNote: 'One topic, questions in order',

  review: 'Review',
  reviewNote: 'Mixed across all topics',
  reviewDue: (count) => `Mixed across all topics · ${s(count, 'question')} due`,
  reviewEmpty: (next) => `Nothing to review right now. ${next}`,
  nextNever: 'No questions yet.',
  nextNow: 'You can review right now.',
  nextTomorrow: 'Next one tomorrow.',
  nextInDays: (days) => `Next one in ${s(days, 'day')}.`,

  weak: 'Weak spots',
  weakNote: 'Questions you keep getting wrong',
  weakCount: (count, percent) => `Below ${percent}% correct · ${s(count, 'question')}`,
  weakNothingYet: 'Shows up once there is something to get wrong.',
  weakEmpty: 'Empty — no consistent mistakes yet.',

  pickTopic: 'Pick a topic',
  pickTopicNote: 'Questions run in order, as they appear in the file.',
  otherGroup: 'Other',
  back: '← Back',

  exit: '← Exit',
  difficulty: (level) => `difficulty ${level}`,
  openHint: 'Answer out loud, then open the explanation and grade yourself honestly.',
  right: 'Correct',
  wrong: 'Wrong',
  followUp: 'Where they dig next',
  showAnswer: 'Show answer',
  gradeKnew: 'Knew it',
  gradePartly: 'Partly',
  gradeMissed: 'Missed it',
  answer: 'Answer',
  next: 'Next',
  toResult: 'Result',

  score: (correct, total) => `${correct} of ${total}`,
  flawless: 'Not a single mistake.',
  missedCount: (count) => `Added to weak spots: ${count}.`,
  worthRepeating: 'Worth revisiting',
  toHome: 'Home',
  restart: 'Start over',
};

export const STRINGS: Record<Language, Strings> = { ru, en };

import { useState } from 'react';
import type { Question } from '../data/types.ts';
import { isOpen } from '../data/types.ts';
import { Markdown } from '../components/Markdown.tsx';
import { AnswerOptions } from '../components/AnswerOptions.tsx';
import { Explanation } from '../components/Explanation.tsx';
import { haptic } from '../telegram/webapp.ts';
import { useBackButton } from '../telegram/useBackButton.ts';

export interface AnswerResult {
  question: Question;
  correct: boolean;
}

/** Самооценка на open-вопросе. «Знал» идёт в прогресс как верный ответ. */
export type SelfGrade = 'knew' | 'partly' | 'missed';

interface SessionProps {
  title: string;
  questions: Question[];
  onAnswer: (question: Question, correct: boolean) => void;
  onFinish: (results: AnswerResult[]) => void;
  onExit: () => void;
}

const sameSet = (a: number[], b: number[]): boolean =>
  a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);

/**
 * Движок прохождения, общий для всех трёх режимов: получает готовую очередь и
 * ничего не знает о том, как она собрана.
 */
export function Session({ title, questions, onAnswer, onFinish, onExit }: SessionProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const nativeBack = useBackButton(onExit);

  const question = questions[index];
  const open = isOpen(question);
  const multiple = !open && question.type === 'multi';

  function toggle(option: number) {
    if (revealed) return;
    haptic('tap');
    if (multiple) {
      setSelected((current) =>
        current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
      );
    } else {
      setSelected([option]);
      commit([option]);
    }
  }

  /** Фиксирует ответ: показывает разбор и пишет результат в прогресс. */
  function commit(picked: number[]) {
    if (open || revealed) return;
    const correct = sameSet(picked, question.correct);
    haptic(correct ? 'correct' : 'wrong');
    setRevealed(true);
    setResults((current) => [...current, { question, correct }]);
    onAnswer(question, correct);
  }

  function grade(value: SelfGrade) {
    const correct = value === 'knew';
    haptic(correct ? 'correct' : 'wrong');
    setResults((current) => [...current, { question, correct }]);
    onAnswer(question, correct);
    advance([...results, { question, correct }]);
  }

  function advance(collected: AnswerResult[] = results) {
    if (index + 1 >= questions.length) {
      onFinish(collected);
      return;
    }
    setIndex(index + 1);
    setSelected([]);
    setRevealed(false);
  }

  return (
    <div className="session">
      <header className="session-header">
        {nativeBack ? (
          <span />
        ) : (
          <button type="button" className="link" onClick={onExit}>
            ← Выйти
          </button>
        )}
        <span className="hint">
          {index + 1} / {questions.length}
        </span>
      </header>

      <progress className="bar" value={index} max={questions.length} />

      <article className="question">
        <p className="hint">
          {title} · сложность {question.difficulty}
        </p>
        <Markdown source={question.question} className="question-text" />

        {open ? (
          revealed ? null : (
            <p className="hint">
              Ответь вслух, потом открой разбор и оцени себя честно.
            </p>
          )
        ) : (
          <AnswerOptions
            options={question.options}
            correct={question.correct}
            selected={selected}
            revealed={revealed}
            multiple={multiple}
            onToggle={toggle}
          />
        )}

        {revealed && (
          <>
            {!open && (
              <p className={results[results.length - 1]?.correct ? 'verdict right' : 'verdict wrong'}>
                {results[results.length - 1]?.correct ? 'Верно' : 'Неверно'}
              </p>
            )}
            <Explanation explanation={question.explanation} followUp={question.followUp} />
          </>
        )}
      </article>

      <footer className="actions">
        {open && !revealed && (
          <button type="button" className="primary" onClick={() => setRevealed(true)}>
            Показать ответ
          </button>
        )}

        {open && revealed && (
          <div className="grades">
            <button type="button" className="primary" onClick={() => grade('knew')}>
              Знал
            </button>
            <button type="button" onClick={() => grade('partly')}>
              Частично
            </button>
            <button type="button" onClick={() => grade('missed')}>
              Не знал
            </button>
          </div>
        )}

        {!open && !revealed && multiple && (
          <button
            type="button"
            className="primary"
            disabled={selected.length === 0}
            onClick={() => commit(selected)}
          >
            Ответить
          </button>
        )}

        {!open && revealed && (
          <button type="button" className="primary" onClick={() => advance()}>
            {index + 1 >= questions.length ? 'Результат' : 'Дальше'}
          </button>
        )}
      </footer>
    </div>
  );
}

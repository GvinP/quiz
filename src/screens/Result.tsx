import type { AnswerResult } from './Session.tsx';
import { useBackButton } from '../telegram/useBackButton.ts';

interface ResultProps {
  results: AnswerResult[];
  onRestart: () => void;
  onHome: () => void;
}

/**
 * В списке ошибок нужен опознавательный знак, а не вопрос целиком: блок кода
 * в напоминании занимает пол-экрана и ничего не добавляет.
 */
function summarize(question: string): string {
  const firstLine = question.split('\n').find((line) => line.trim() && !line.startsWith('```'));
  return (firstLine ?? question).replace(/[*_`]/g, '').trim();
}

export function Result({ results, onRestart, onHome }: ResultProps) {
  useBackButton(onHome);

  const correct = results.filter((result) => result.correct).length;
  const missed = results.filter((result) => !result.correct);

  return (
    <div className="screen">
      <div className="content">
        <h1>
          {correct} из {results.length}
        </h1>
        <p className="hint">
          {missed.length === 0
            ? 'Без единой ошибки.'
            : `Ушло в работу над ошибками: ${missed.length}.`}
        </p>

        {missed.length > 0 && (
          <section>
            <h2>Что стоит повторить</h2>
            <ul className="mistakes">
              {missed.map(({ question }) => (
                <li key={question.id}>{summarize(question.question)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="actions">
        <button type="button" className="primary" onClick={onHome}>
          На главную
        </button>
        <button type="button" onClick={onRestart}>
          Пройти заново
        </button>
      </footer>
    </div>
  );
}

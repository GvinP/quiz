import type { AnswerResult } from './Session.tsx';
import { useBackButton } from '../telegram/useBackButton.ts';
import { useStrings } from '../i18n/context.tsx';

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
  const t = useStrings();
  useBackButton(onHome);

  const correct = results.filter((result) => result.correct).length;
  const missed = results.filter((result) => !result.correct);

  return (
    <div className="screen">
      <div className="content">
        <h1>{t.score(correct, results.length)}</h1>
        <p className="hint">
          {missed.length === 0 ? t.flawless : t.missedCount(missed.length)}
        </p>

        {missed.length > 0 && (
          <section>
            <h2>{t.worthRepeating}</h2>
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
          {t.toHome}
        </button>
        <button type="button" onClick={onRestart}>
          {t.restart}
        </button>
      </footer>
    </div>
  );
}

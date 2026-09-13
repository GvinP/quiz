import type { Question, TopicFile } from '../data/types.ts';
import type { Progress } from '../progress/types.ts';
import { reviewQueue, weakQueue, nextDueDay } from '../progress/selectors.ts';
import { dayNumber } from '../progress/day.ts';
import { WEAK_RATIO } from '../progress/leitner.ts';
import { plural, questionsWord, whenNext } from '../format.ts';
import type { ResolvedSession } from '../session/pending.ts';

interface HomeProps {
  topics: TopicFile[];
  questions: Question[];
  progress: Progress;
  pending: ResolvedSession | null;
  onResume: () => void;
  onQuiz: () => void;
  onReview: (questions: Question[]) => void;
  onWeak: (questions: Question[]) => void;
}

interface ModeProps {
  title: string;
  note: string;
  disabled?: boolean;
  onClick: () => void;
}

function Mode({ title, note, disabled, onClick }: ModeProps) {
  return (
    <li>
      <button type="button" className="card" disabled={disabled} onClick={onClick}>
        <span className="card-title">{title}</span>
        <span className="hint">{note}</span>
      </button>
    </li>
  );
}

export function Home({
  topics,
  questions,
  progress,
  pending,
  onResume,
  onQuiz,
  onReview,
  onWeak,
}: HomeProps) {
  const today = dayNumber();
  const due = reviewQueue(questions, progress, today);
  const weak = weakQueue(questions, progress);
  const answered = Object.values(progress).reduce(
    (total, topic) => total + Object.keys(topic).length,
    0,
  );

  return (
    <div className="screen">
      <div className="content">
        <h1>Квиз по React Native</h1>
        <p className="hint">
          {topics.length} {plural(topics.length, 'тема', 'темы', 'тем')}, {questions.length}{' '}
          {questionsWord(questions.length)}
          {answered > 0 && ` · отвечено ${answered}`}
        </p>

        <ul className="cards">
          {pending && (
            <Mode
              title="Продолжить"
              note={`${pending.title} · вопрос ${pending.answers.length + 1} из ${pending.questions.length}`}
              onClick={onResume}
            />
          )}
          <Mode title="Квиз" note="Вопросы одной темы подряд" onClick={onQuiz} />
          <Mode
            title="Повторение"
            note={
              due.length > 0
                ? `Вперемешку из всех тем · пора повторить: ${due.length} ${questionsWord(due.length)}`
                : `Сейчас нечего повторять. ${whenNext(nextDueDay(questions, progress, today), today)}`
            }
            disabled={due.length === 0}
            onClick={() => onReview(due)}
          />
          <Mode
            title="Работа над ошибками"
            note={
              weak.length > 0
                ? `Доля верных ниже ${Math.round(WEAK_RATIO * 100)}% · ${weak.length} ${questionsWord(weak.length)}`
                : answered === 0
                  ? 'Появится, когда будет на чём ошибаться.'
                  : 'Пусто — устойчивых ошибок пока нет.'
            }
            disabled={weak.length === 0}
            onClick={() => onWeak(weak)}
          />
        </ul>
      </div>
    </div>
  );
}

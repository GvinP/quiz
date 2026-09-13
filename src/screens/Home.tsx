import type { Question } from '../data/types.ts';
import type { Progress } from '../progress/types.ts';
import type { Language } from '../i18n/language.ts';
import type { ResolvedSession } from '../session/pending.ts';
import { reviewQueue, weakQueue, nextDueDay } from '../progress/selectors.ts';
import { dayNumber } from '../progress/day.ts';
import { WEAK_RATIO } from '../progress/leitner.ts';
import { useStrings } from '../i18n/context.tsx';
import { LanguageSwitch } from '../components/LanguageSwitch.tsx';

interface HomeProps {
  /** Известно из реестра сразу, до загрузки самих тем. */
  topicCount: number;
  questions: Question[];
  loading: boolean;
  progress: Progress;
  pending: ResolvedSession | null;
  languages: Language[];
  language: Language;
  onLanguage: (language: Language) => void;
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
  topicCount,
  questions,
  loading,
  progress,
  pending,
  languages,
  language,
  onLanguage,
  onResume,
  onQuiz,
  onReview,
  onWeak,
}: HomeProps) {
  const t = useStrings();
  const today = dayNumber();
  const due = reviewQueue(questions, progress, today);
  const weak = weakQueue(questions, progress);
  const answered = Object.values(progress).reduce(
    (total, topic) => total + Object.keys(topic).length,
    0,
  );

  function whenNext(): string {
    const day = nextDueDay(questions, progress, today);
    if (day === null) return t.nextNever;
    const days = day - today;
    if (days <= 0) return t.nextNow;
    if (days === 1) return t.nextTomorrow;
    return t.nextInDays(days);
  }

  return (
    <div className="screen">
      <div className="content">
        <header className="title-row">
          <h1>{t.appTitle}</h1>
          <LanguageSwitch languages={languages} current={language} onChange={onLanguage} />
        </header>

        <p className="hint">
          {t.topicsCount(topicCount)}
          {!loading && `, ${t.questionsCount(questions.length)}`}
          {answered > 0 && ` · ${t.answeredCount(answered)}`}
        </p>

        <ul className="cards">
          {pending && (
            <Mode
              title={t.resume}
              note={t.resumeNote(
                pending.title,
                pending.answers.length + 1,
                pending.questions.length,
              )}
              onClick={onResume}
            />
          )}

          <Mode title={t.quiz} note={t.quizNote} onClick={onQuiz} />

          <Mode
            title={t.review}
            note={
              loading
                ? t.reviewNote
                : due.length > 0
                  ? t.reviewDue(due.length)
                  : t.reviewEmpty(whenNext())
            }
            disabled={loading || due.length === 0}
            onClick={() => onReview(due)}
          />

          <Mode
            title={t.weak}
            note={
              loading
                ? t.weakNote
                : weak.length > 0
                  ? t.weakCount(weak.length, Math.round(WEAK_RATIO * 100))
                  : answered === 0
                    ? t.weakNothingYet
                    : t.weakEmpty
            }
            disabled={loading || weak.length === 0}
            onClick={() => onWeak(weak)}
          />
        </ul>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { topicRefsFor, loadTopics, availableLanguages } from './data/topics.ts';
import { createProgressStore } from './progress/store.ts';
import { pickStore } from './progress/storage.ts';
import { quizQueue } from './progress/selectors.ts';
import { createPendingStore, resolvePending } from './session/pending.ts';
import type { ResolvedSession } from './session/pending.ts';
import { readLanguage, writeLanguage, namespaceOf } from './i18n/language.ts';
import type { Language } from './i18n/language.ts';
import { LanguageProvider } from './i18n/context.tsx';
import { STRINGS } from './i18n/strings.ts';
import { Home } from './screens/Home.tsx';
import { Topics } from './screens/Topics.tsx';
import { Session } from './screens/Session.tsx';
import type { AnswerResult } from './screens/Session.tsx';
import { Result } from './screens/Result.tsx';
import type { Progress } from './progress/types.ts';
import type { Question, TopicFile } from './data/types.ts';

type Screen =
  | { name: 'home' }
  | { name: 'topics' }
  | { name: 'session'; title: string; questions: Question[]; answers?: boolean[] }
  | { name: 'result'; title: string; questions: Question[]; results: AnswerResult[] };

export function App() {
  const [language, setLanguage] = useState<Language>(readLanguage);

  return (
    <LanguageProvider language={language}>
      <Quiz
        key={language}
        language={language}
        onLanguage={(next) => {
          writeLanguage(next);
          setLanguage(next);
        }}
      />
    </LanguageProvider>
  );
}

/**
 * Пересоздаётся при смене языка (key={language} выше): вместе с ним заново
 * читаются темы, прогресс и незаконченная сессия — каждая в своём
 * пространстве имён, чтобы второй проход начинался с чистого листа.
 */
function Quiz({ language, onLanguage }: { language: Language; onLanguage: (l: Language) => void }) {
  const storage = useMemo(() => pickStore(), []);
  const namespace = namespaceOf(language);
  const store = useMemo(() => createProgressStore(storage, namespace), [storage, namespace]);
  const pendingStore = useMemo(() => createPendingStore(storage, namespace), [storage, namespace]);

  const [topics, setTopics] = useState<TopicFile[] | null>(null);
  const [progress, setProgress] = useState<Progress>({});
  const [pending, setPending] = useState<ResolvedSession | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  useEffect(() => {
    void (async () => {
      const [loadedTopics, loadedProgress, saved] = await Promise.all([
        loadTopics(language),
        store.load(),
        pendingStore.load(),
      ]);

      setTopics(loadedTopics);
      setProgress(loadedProgress);

      if (saved) {
        const byId = new Map(
          loadedTopics.flatMap((topic) => topic.questions).map((question) => [question.id, question]),
        );
        const resolved = resolvePending(saved, byId);
        // Банк изменился — сохранённая очередь больше ни на что не ссылается.
        if (resolved) setPending(resolved);
        else void pendingStore.clear();
      }
    })();

    const flush = () => {
      void store.flush();
      void pendingStore.flush();
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [language, store, pendingStore]);

  // Главный экран рисуется сразу: названия и порядок тем известны из реестра,
  // а счётчики режимов появляются, когда догрузятся сами темы.
  const questions = topics?.flatMap((topic) => topic.questions) ?? [];

  function start(title: string, queue: Question[], answers?: boolean[]) {
    setPending(null);
    setScreen({ name: 'session', title, questions: queue, answers });
  }

  /** Выход из сессии: досохраняем и показываем главному экрану свежие счётчики. */
  function leaveSession(next: Screen) {
    void store.flush();
    void pendingStore.flush();
    setProgress({ ...store.snapshot() });
    setScreen(next);
  }

  switch (screen.name) {
    case 'topics':
      if (topics === null) return <p className="hint">{STRINGS[language].loadingTopics}</p>;
      return (
        <Topics
          topics={topics}
          onBack={() => setScreen({ name: 'home' })}
          onPick={(topic) => start(topic.title, quizQueue(topic.questions, topic.topic))}
        />
      );

    case 'session':
      return (
        <Session
          title={screen.title}
          questions={screen.questions}
          initialAnswers={screen.answers}
          onAnswer={(question, correct) => store.record(question.topic, question.id, correct)}
          onProgress={(answers) =>
            pendingStore.save({
              title: screen.title,
              ids: screen.questions.map((question) => question.id),
              answers,
            })
          }
          onFinish={(results) => {
            void pendingStore.clear();
            leaveSession({ ...screen, name: 'result', results });
          }}
          onExit={() => leaveSession({ name: 'home' })}
        />
      );

    case 'result':
      return (
        <Result
          results={screen.results}
          onRestart={() => start(screen.title, screen.questions)}
          onHome={() => setScreen({ name: 'home' })}
        />
      );

    default:
      return (
        <Home
          topicCount={topicRefsFor(language).length}
          questions={questions}
          loading={topics === null}
          progress={progress}
          pending={pending}
          languages={availableLanguages()}
          language={language}
          onLanguage={onLanguage}
          onResume={() => pending && start(pending.title, pending.questions, pending.answers)}
          onQuiz={() => setScreen({ name: 'topics' })}
          onReview={(queue) => start(STRINGS[language].review, queue)}
          onWeak={(queue) => start(STRINGS[language].weak, queue)}
        />
      );
  }
}

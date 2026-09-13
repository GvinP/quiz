import { useEffect, useMemo, useState } from 'react';
import { topicRefs, loadAllTopics } from './data/topics.ts';
import { createProgressStore } from './progress/store.ts';
import { pickStore } from './progress/storage.ts';
import { quizQueue } from './progress/selectors.ts';
import { createPendingStore, resolvePending } from './session/pending.ts';
import type { ResolvedSession } from './session/pending.ts';
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
  const storage = useMemo(() => pickStore(), []);
  const store = useMemo(() => createProgressStore(storage), [storage]);
  const pendingStore = useMemo(() => createPendingStore(storage), [storage]);

  const [topics, setTopics] = useState<TopicFile[] | null>(null);
  const [progress, setProgress] = useState<Progress>({});
  const [pending, setPending] = useState<ResolvedSession | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  useEffect(() => {
    void (async () => {
      const [loadedTopics, loadedProgress, saved] = await Promise.all([
        loadAllTopics(),
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
  }, [store, pendingStore]);

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
      if (topics === null) return <p className="hint">Загрузка тем…</p>;
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
          topicCount={topicRefs.length}
          questions={questions}
          loading={topics === null}
          progress={progress}
          pending={pending}
          onResume={() => pending && start(pending.title, pending.questions, pending.answers)}
          onQuiz={() => setScreen({ name: 'topics' })}
          onReview={(queue) => start('Повторение', queue)}
          onWeak={(queue) => start('Работа над ошибками', queue)}
        />
      );
  }
}

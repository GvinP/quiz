import { useEffect, useMemo, useState } from 'react';
import { topicRefs } from './data/topics.ts';
import { createProgressStore } from './progress/store.ts';
import { pickStore } from './progress/storage.ts';
import { quizQueue } from './progress/selectors.ts';
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
  | { name: 'session'; title: string; questions: Question[] }
  | { name: 'result'; title: string; questions: Question[]; results: AnswerResult[] };

export function App() {
  const store = useMemo(() => createProgressStore(pickStore()), []);
  const [topics, setTopics] = useState<TopicFile[] | null>(null);
  const [progress, setProgress] = useState<Progress>({});
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  useEffect(() => {
    void (async () => {
      const [loadedTopics, loadedProgress] = await Promise.all([
        Promise.all(topicRefs.map((ref) => ref.load())),
        store.load(),
      ]);
      setTopics(loadedTopics);
      setProgress(loadedProgress);
    })();

    // Сессия может закрыться в любой момент — досохраняем на уходе со страницы.
    const flush = () => void store.flush();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [store]);

  if (topics === null) return <p className="hint">Загрузка…</p>;

  const questions = topics.flatMap((topic) => topic.questions);

  /** Выход из сессии: досохраняем и показываем главному экрану свежие счётчики. */
  function leaveSession(next: Screen) {
    void store.flush();
    setProgress({ ...store.snapshot() });
    setScreen(next);
  }

  const start = (title: string, queue: Question[]) =>
    setScreen({ name: 'session', title, questions: queue });

  switch (screen.name) {
    case 'topics':
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
          onAnswer={(question, correct) => store.record(question.topic, question.id, correct)}
          onFinish={(results) => leaveSession({ ...screen, name: 'result', results })}
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
          topics={topics}
          questions={questions}
          progress={progress}
          onQuiz={() => setScreen({ name: 'topics' })}
          onReview={(queue) => start('Повторение', queue)}
          onWeak={(queue) => start('Работа над ошибками', queue)}
        />
      );
  }
}

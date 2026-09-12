import { useEffect, useMemo, useState } from 'react';
import { topicRefs } from './data/topics.ts';
import { createProgressStore } from './progress/store.ts';
import { pickStore } from './progress/storage.ts';
import { quizQueue } from './progress/selectors.ts';
import { Home } from './screens/Home.tsx';
import { Session } from './screens/Session.tsx';
import type { AnswerResult } from './screens/Session.tsx';
import { Result } from './screens/Result.tsx';
import type { Question, TopicFile } from './data/types.ts';

type Screen =
  | { name: 'home' }
  | { name: 'session'; title: string; questions: Question[] }
  | { name: 'result'; title: string; questions: Question[]; results: AnswerResult[] };

export function App() {
  const store = useMemo(() => createProgressStore(pickStore()), []);
  const [topics, setTopics] = useState<TopicFile[] | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  useEffect(() => {
    void (async () => {
      const [loaded] = await Promise.all([
        Promise.all(topicRefs.map((ref) => ref.load())),
        store.load(),
      ]);
      setTopics(loaded);
    })();

    // Сессия может закрыться в любой момент — досохраняем на уходе со страницы.
    const flush = () => void store.flush();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [store]);

  if (topics === null) return <p className="hint">Загрузка…</p>;

  function startQuiz(topic: TopicFile) {
    setScreen({
      name: 'session',
      title: topic.title,
      questions: quizQueue(topic.questions, topic.topic),
    });
  }

  switch (screen.name) {
    case 'session':
      return (
        <Session
          title={screen.title}
          questions={screen.questions}
          onAnswer={(question, correct) => store.record(question.topic, question.id, correct)}
          onFinish={(results) => {
            void store.flush();
            setScreen({ ...screen, name: 'result', results });
          }}
          onExit={() => {
            void store.flush();
            setScreen({ name: 'home' });
          }}
        />
      );

    case 'result':
      return (
        <Result
          results={screen.results}
          onRestart={() =>
            setScreen({ name: 'session', title: screen.title, questions: screen.questions })
          }
          onHome={() => setScreen({ name: 'home' })}
        />
      );

    default:
      return <Home topics={topics} onPickTopic={startQuiz} />;
  }
}

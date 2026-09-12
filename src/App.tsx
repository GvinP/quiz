import { useEffect, useState } from 'react';
import { topicRefs } from './data/topics';
import { isTelegram } from './telegram/webapp';
import type { TopicFile } from './data/types';

// Каркас: экраны режимов появятся на следующих шагах. Сейчас задача экрана —
// подтвердить, что темы находятся глобом и сборка едет на Pages по /quiz/.
export function App() {
  const [topics, setTopics] = useState<TopicFile[] | null>(null);

  useEffect(() => {
    Promise.all(topicRefs.map((ref) => ref.load())).then(setTopics);
  }, []);

  return (
    <main>
      <h1>Квиз по React Native</h1>
      <p className="hint">
        {isTelegram() ? 'Запущено как Telegram Mini App' : 'Запущено в браузере'}
      </p>
      {topics === null ? (
        <p className="hint">Загрузка тем…</p>
      ) : (
        <ul>
          {topics.map((topic) => (
            <li key={topic.topic}>
              {topic.title} — {topic.questions.length} вопросов
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

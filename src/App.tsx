import { useEffect, useMemo, useState } from 'react';
import { topicRefs } from './data/topics.ts';
import { isTelegram } from './telegram/webapp.ts';
import { createProgressStore } from './progress/store.ts';
import { pickStore } from './progress/storage.ts';
import { reviewQueue, weakQueue } from './progress/selectors.ts';
import type { Progress } from './progress/types.ts';
import type { Question, TopicFile } from './data/types.ts';

// Отладочный экран третьего шага: экраны режимов появятся следующими.
// Задача — проверить с телефона, что прогресс переживает перезапуск.
export function App() {
  const store = useMemo(() => createProgressStore(pickStore()), []);
  const [topics, setTopics] = useState<TopicFile[] | null>(null);
  const [progress, setProgress] = useState<Progress>({});

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

  const questions: Question[] = topics?.flatMap((topic) => topic.questions) ?? [];
  const answered = Object.values(progress).reduce(
    (total, topic) => total + Object.keys(topic).length,
    0,
  );

  async function answerFirst(correct: boolean) {
    const [first] = questions;
    if (!first) return;
    store.record(first.topic, first.id, correct);
    await store.flush();
    setProgress({ ...store.snapshot() });
  }

  async function reset() {
    await store.clear();
    setProgress({});
  }

  if (topics === null) return <p className="hint">Загрузка…</p>;

  return (
    <main>
      <h1>Квиз по React Native</h1>
      <p className="hint">{isTelegram() ? 'Telegram Mini App' : 'Браузер'}</p>

      <ul>
        {topics.map((topic) => (
          <li key={topic.topic}>
            {topic.title} — {topic.questions.length} вопросов
          </li>
        ))}
      </ul>

      <h2>Прогресс</h2>
      <ul>
        <li>Хранилище: {pickStore().kind === 'cloud' ? 'Telegram CloudStorage' : 'localStorage'}</li>
        <li>Записей: {answered}</li>
        <li>Пора повторить: {reviewQueue(questions, progress).length}</li>
        <li>В работе над ошибками: {weakQueue(questions, progress).length}</li>
      </ul>

      <p className="hint">
        Кнопки ниже пишут ответ в первый вопрос — чтобы проверить, что прогресс
        переживает перезапуск. Уедут вместе с этим экраном.
      </p>
      <button type="button" onClick={() => void answerFirst(true)}>
        Ответить верно
      </button>{' '}
      <button type="button" onClick={() => void answerFirst(false)}>
        Ответить неверно
      </button>{' '}
      <button type="button" onClick={() => void reset()}>
        Сбросить
      </button>
    </main>
  );
}

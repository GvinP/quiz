import type { TopicFile } from '../data/types.ts';
import { useBackButton } from '../telegram/useBackButton.ts';

interface TopicsProps {
  topics: TopicFile[];
  onPick: (topic: TopicFile) => void;
  onBack: () => void;
}

export function Topics({ topics, onPick, onBack }: TopicsProps) {
  const nativeBack = useBackButton(onBack);

  return (
    <div className="screen">
      <div className="content">
        {!nativeBack && (
          <header className="session-header">
            <button type="button" className="link" onClick={onBack}>
              ← Назад
            </button>
          </header>
        )}

        <h1>Выбери тему</h1>
        <p className="hint">Вопросы пойдут подряд, в порядке файла.</p>

        <ul className="cards">
          {topics.map((topic) => (
            <li key={topic.topic}>
              <button type="button" className="card" onClick={() => onPick(topic)}>
                <span className="card-title">{topic.title}</span>
                <span className="hint">{topic.questions.length} вопросов</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

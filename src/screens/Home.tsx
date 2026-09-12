import type { TopicFile } from '../data/types.ts';

interface HomeProps {
  topics: TopicFile[];
  onPickTopic: (topic: TopicFile) => void;
}

export function Home({ topics, onPickTopic }: HomeProps) {
  return (
    <div className="screen">
      <h1>Квиз по React Native</h1>
      <p className="hint">Выбери тему — вопросы пойдут подряд.</p>

      <ul className="topics">
        {topics.map((topic) => (
          <li key={topic.topic}>
            <button type="button" className="topic" onClick={() => onPickTopic(topic)}>
              <span className="topic-title">{topic.title}</span>
              <span className="hint">{topic.questions.length} вопросов</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

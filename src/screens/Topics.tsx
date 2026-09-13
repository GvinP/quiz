import type { TopicFile } from '../data/types.ts';
import { topicRefs } from '../data/topics.ts';
import { questionsWord } from '../format.ts';
import { useBackButton } from '../telegram/useBackButton.ts';

interface TopicsProps {
  topics: TopicFile[];
  onPick: (topic: TopicFile) => void;
  onBack: () => void;
}

const meta = new Map(topicRefs.map((ref) => [ref.topic, ref]));

interface Group {
  name: string | undefined;
  topics: TopicFile[];
}

/**
 * Порядок и группы берутся из реестра. Тема, которой в нём нет, попадает в
 * конец — добавление файла не требует правок ни здесь, ни в реестре.
 */
function grouped(topics: TopicFile[]): Group[] {
  const sorted = [...topics].sort((a, b) => {
    const left = meta.get(a.topic);
    const right = meta.get(b.topic);
    return (
      (left?.order ?? Number.MAX_SAFE_INTEGER) - (right?.order ?? Number.MAX_SAFE_INTEGER) ||
      a.topic.localeCompare(b.topic)
    );
  });

  const groups: Group[] = [];
  for (const topic of sorted) {
    const name = meta.get(topic.topic)?.group;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.topics.push(topic);
    else groups.push({ name, topics: [topic] });
  }
  return groups;
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

        {grouped(topics).map((group) => (
          <section key={group.name ?? 'прочее'}>
            <h3>{group.name ?? 'Остальное'}</h3>
            <ul className="cards">
              {group.topics.map((topic) => (
                <li key={topic.topic}>
                  <button type="button" className="card" onClick={() => onPick(topic)}>
                    <span className="card-title">{topic.title}</span>
                    <span className="hint">
                      {topic.questions.length} {questionsWord(topic.questions.length)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

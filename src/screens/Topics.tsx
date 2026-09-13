import type { TopicFile } from '../data/types.ts';
import { topicRefsFor } from '../data/topics.ts';
import { useLanguage, useStrings } from '../i18n/context.tsx';
import { useBackButton } from '../telegram/useBackButton.ts';

interface TopicsProps {
  topics: TopicFile[];
  onPick: (topic: TopicFile) => void;
  onBack: () => void;
}

interface Group {
  name: string | undefined;
  topics: TopicFile[];
}

export function Topics({ topics, onPick, onBack }: TopicsProps) {
  const t = useStrings();
  const language = useLanguage();
  const nativeBack = useBackButton(onBack);
  const meta = new Map(topicRefsFor(language).map((ref) => [ref.topic, ref]));

  /**
   * Порядок и группы берутся из реестра. Тема, которой в нём нет, попадает в
   * конец — добавление файла не требует правок ни здесь, ни в реестре.
   */
  const groups: Group[] = [];
  const sorted = [...topics].sort((a, b) => {
    const left = meta.get(a.topic)?.order ?? Number.MAX_SAFE_INTEGER;
    const right = meta.get(b.topic)?.order ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.topic.localeCompare(b.topic);
  });

  for (const topic of sorted) {
    const name = meta.get(topic.topic)?.group;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.topics.push(topic);
    else groups.push({ name, topics: [topic] });
  }

  return (
    <div className="screen">
      <div className="content">
        {!nativeBack && (
          <header className="session-header">
            <button type="button" className="link" onClick={onBack}>
              {t.back}
            </button>
          </header>
        )}

        <h1>{t.pickTopic}</h1>
        <p className="hint">{t.pickTopicNote}</p>

        {groups.map((group) => (
          <section key={group.name ?? '—'}>
            <h3>{group.name ?? t.otherGroup}</h3>
            <ul className="cards">
              {group.topics.map((topic) => (
                <li key={topic.topic}>
                  <button type="button" className="card" onClick={() => onPick(topic)}>
                    <span className="card-title">{topic.title}</span>
                    <span className="hint">{t.questionsCount(topic.questions.length)}</span>
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

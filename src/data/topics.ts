import type { TopicFile } from './types.ts';

/** Запись реестра data/topics.json — только оформление списка, не источник тем. */
interface RegistryEntry {
  topic: string;
  title: string;
  group?: string;
  order?: number;
}

const REGISTRY_FILE = 'topics.json';

/**
 * Темы находятся глобом по /data, а не по реестру: Vite раскрывает его на
 * сборке, поэтому новый файл подхватывается без единой правки кода.
 * eager: false — каждая тема уезжает в свой чанк и грузится по требованию.
 */
const loaders = import.meta.glob<TopicFile>('../../data/*.json', {
  import: 'default',
});

/**
 * Реестр необязателен и нужен только чтобы задать порядок и группировку:
 * на тринадцати темах плоский алфавитный список читается плохо. Тема, которой
 * в реестре нет, всё равно попадёт в приложение — просто в конец.
 */
const registries = import.meta.glob<{ topics: RegistryEntry[] }>('../../data/topics.json', {
  eager: true,
  import: 'default',
});

const registry = new Map(
  Object.values(registries)
    .flatMap((value) => value?.topics ?? [])
    .map((entry) => [entry.topic, entry]),
);

export interface TopicRef {
  topic: string;
  file: string;
  /** Название из реестра — известно до загрузки самой темы. */
  title?: string;
  group?: string;
  order: number;
  load: () => Promise<TopicFile>;
}

export const topicRefs: TopicRef[] = Object.entries(loaders)
  .map(([path, load]) => ({ file: path.slice(path.lastIndexOf('/') + 1), load }))
  .filter(({ file }) => file !== REGISTRY_FILE)
  .map(({ file, load }) => {
    const topic = file.replace(/\.json$/, '');
    const entry = registry.get(topic);
    return {
      topic,
      file,
      title: entry?.title,
      group: entry?.group,
      order: entry?.order ?? Number.MAX_SAFE_INTEGER,
      load,
    };
  })
  .sort((a, b) => a.order - b.order || a.file.localeCompare(b.file));

export function loadAllTopics(): Promise<TopicFile[]> {
  return Promise.all(topicRefs.map((ref) => ref.load()));
}

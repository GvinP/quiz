import type { TopicFile } from './types';

/**
 * Темы находятся глобом по /data, а не по реестру: Vite раскрывает его на
 * сборке, поэтому новый файл в /data подхватывается без единой правки кода.
 * eager: false — каждая тема уезжает в свой чанк и грузится по требованию.
 */
const loaders = import.meta.glob<TopicFile>('../../data/*.json', {
  import: 'default',
});

export interface TopicRef {
  topic: string;
  file: string;
  load: () => Promise<TopicFile>;
}

/** Список тем в алфавитном порядке по имени файла. */
export const topicRefs: TopicRef[] = Object.entries(loaders)
  .map(([path, load]) => {
    const file = path.slice(path.lastIndexOf('/') + 1);
    return { topic: file.replace(/\.json$/, ''), file, load };
  })
  .sort((a, b) => a.file.localeCompare(b.file));

export function loadAllTopics(): Promise<TopicFile[]> {
  return Promise.all(topicRefs.map((ref) => ref.load()));
}

import type { TopicFile } from './types.ts';
import type { Language } from '../i18n/language.ts';
import { LANGUAGES, isLanguage } from '../i18n/language.ts';

/** Запись реестра data/<язык>/topics.json — только оформление списка. */
interface RegistryEntry {
  topic: string;
  title: string;
  group?: string;
  order?: number;
}

const REGISTRY_FILE = 'topics.json';

/**
 * Темы находятся глобом по data/<язык>, а не по реестру: Vite раскрывает его
 * на сборке, поэтому новый файл подхватывается без единой правки кода.
 * eager: false — каждая тема уезжает в свой чанк и грузится по требованию.
 */
const loaders = import.meta.glob<TopicFile>('../../data/*/*.json', {
  import: 'default',
});

/**
 * Реестр необязателен и нужен только чтобы задать порядок и группировку:
 * на десятке тем плоский алфавитный список читается плохо. Тема, которой в
 * реестре нет, всё равно попадёт в приложение — просто в конец.
 */
const registries = import.meta.glob<{ topics: RegistryEntry[] }>('../../data/*/topics.json', {
  eager: true,
  import: 'default',
});

function partsOf(path: string): { language: string; file: string } {
  const segments = path.split('/');
  return { language: segments[segments.length - 2], file: segments[segments.length - 1] };
}

const registryFor = (language: Language) => {
  const entry = Object.entries(registries).find(
    ([path]) => partsOf(path).language === language,
  );
  return new Map((entry?.[1]?.topics ?? []).map((item) => [item.topic, item]));
};

export interface TopicRef {
  topic: string;
  language: Language;
  /** Название из реестра — известно до загрузки самой темы. */
  title?: string;
  group?: string;
  order: number;
  load: () => Promise<TopicFile>;
}

const byLanguage = new Map<Language, TopicRef[]>();

for (const language of LANGUAGES) {
  const registry = registryFor(language);

  const refs = Object.entries(loaders)
    .map(([path, load]) => ({ ...partsOf(path), load }))
    .filter((item) => item.language === language && item.file !== REGISTRY_FILE)
    .map(({ file, load }) => {
      const topic = file.replace(/\.json$/, '');
      const entry = registry.get(topic);
      return {
        topic,
        language,
        title: entry?.title,
        group: entry?.group,
        order: entry?.order ?? Number.MAX_SAFE_INTEGER,
        load,
      };
    })
    .sort((a, b) => a.order - b.order || a.topic.localeCompare(b.topic));

  byLanguage.set(language, refs);
}

export const topicRefsFor = (language: Language): TopicRef[] => byLanguage.get(language) ?? [];

export const loadTopics = (language: Language): Promise<TopicFile[]> =>
  Promise.all(topicRefsFor(language).map((ref) => ref.load()));

/** Языки, на которых реально есть хоть одна тема — только их и предлагаем. */
export const availableLanguages = (): Language[] =>
  LANGUAGES.filter((language) => topicRefsFor(language).length > 0);

export { isLanguage };

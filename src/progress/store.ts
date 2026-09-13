import type { Entry, Progress, TopicProgress } from './types.ts';
import type { KeyValueStore } from './storage.ts';
import { encode, decode } from './codec.ts';
import { record as recordAnswer } from './leitner.ts';
import { dayNumber } from './day.ts';

export const KEY_PREFIX = 'progress_';

/** Задержка перед записью: CloudStorage ходит по сети, писать на каждый ответ дорого. */
export const FLUSH_DELAY = 800;

/**
 * Ключи CloudStorage допускают только A-Z, a-z, 0-9, _ и -, поэтому
 * двоеточие из чернового формата (`progress:topic`) использовать нельзя.
 *
 * `namespace` разводит языки: второй проход по тем же вопросам на другом
 * языке должен начинаться с чистого листа, иначе всё сразу числится
 * выученным. Это приставка перед именем ключа, а не часть имени темы, —
 * иначе `progress_en-…` было бы не отличить от темы, начинающейся с `en-`.
 */
function makeKeys(namespace: string) {
  const prefix = `${namespace}${KEY_PREFIX}`;

  return {
    keyFor: (topic: string, chunk: number): string =>
      `${prefix}${topic.replace(/[^A-Za-z0-9_-]/g, '_')}__${chunk}`,

    parseKey: (key: string): { topic: string; chunk: number } | null => {
      if (!key.startsWith(prefix)) return null;
      const match = /^(.*)__(\d+)$/.exec(key.slice(prefix.length));
      return match ? { topic: match[1], chunk: Number(match[2]) } : null;
    },
  };
}

export interface ProgressStore {
  /** Читает прогресс из хранилища. Вызывается один раз на старте. */
  load(): Promise<Progress>;
  /** Текущее состояние в памяти, без похода в хранилище. */
  snapshot(): Progress;
  entry(topic: string, id: string): Entry | undefined;
  /** Записывает ответ и планирует отложенное сохранение. */
  record(topic: string, id: string, correct: boolean, day?: number): Entry;
  /** Немедленно сохраняет всё несохранённое. */
  flush(): Promise<void>;
  /** Стирает весь прогресс — и из памяти, и из хранилища. */
  clear(): Promise<void>;
}

export function createProgressStore(store: KeyValueStore, namespace = ''): ProgressStore {
  const { keyFor, parseKey } = makeKeys(namespace);
  let progress: Progress = {};
  const dirty = new Set<string>();
  /** Сколько ключей занимала тема при последней записи — лишние надо удалить. */
  const chunkCount = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing: Promise<void> = Promise.resolve();

  async function writeTopic(topic: string): Promise<void> {
    const chunks = encode(progress[topic] ?? {});
    const previous = chunkCount.get(topic) ?? 0;

    for (const [index, chunk] of chunks.entries()) {
      await store.setItem(keyFor(topic, index), chunk);
    }

    const stale: string[] = [];
    for (let index = chunks.length; index < previous; index += 1) {
      stale.push(keyFor(topic, index));
    }
    await store.removeItems(stale);

    chunkCount.set(topic, chunks.length);
  }

  async function flush(): Promise<void> {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }

    const topics = [...dirty];
    dirty.clear();
    if (topics.length === 0) return writing;

    // Записи выстраиваются в очередь: параллельные setItem в CloudStorage
    // могут переупорядочиться, а нам важен последний победивший.
    writing = writing.then(async () => {
      for (const topic of topics) {
        try {
          await writeTopic(topic);
        } catch {
          // Не сохранилось — прогресс остаётся в памяти до следующего flush.
          dirty.add(topic);
        }
      }
    });

    return writing;
  }

  function schedule(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      void flush();
    }, FLUSH_DELAY);
  }

  return {
    async load() {
      let keys: string[];
      try {
        keys = await store.getKeys();
      } catch {
        return progress;
      }

      const parsed = keys
        .map((key) => ({ key, parts: parseKey(key) }))
        .filter((item): item is { key: string; parts: { topic: string; chunk: number } } =>
          item.parts !== null,
        );

      if (parsed.length === 0) return progress;

      let values: Record<string, string>;
      try {
        values = await store.getItems(parsed.map((item) => item.key));
      } catch {
        return progress;
      }

      const byTopic = new Map<string, string[]>();
      for (const { key, parts } of parsed) {
        const value = values[key];
        if (value === undefined) continue;
        const chunks = byTopic.get(parts.topic) ?? [];
        chunks.push(value);
        byTopic.set(parts.topic, chunks);
      }

      const loaded: Progress = {};
      for (const [topic, chunks] of byTopic) {
        loaded[topic] = decode(chunks);
        chunkCount.set(topic, chunks.length);
      }

      progress = loaded;
      return progress;
    },

    snapshot: () => progress,

    entry: (topic, id) => progress[topic]?.[id],

    record(topic, id, correct, day = dayNumber()) {
      const topicProgress: TopicProgress = { ...(progress[topic] ?? {}) };
      const updated = recordAnswer(topicProgress[id], correct, day);
      topicProgress[id] = updated;
      progress = { ...progress, [topic]: topicProgress };
      dirty.add(topic);
      schedule();
      return updated;
    },

    flush,

    async clear() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      dirty.clear();
      progress = {};
      chunkCount.clear();

      const keys = await store.getKeys();
      await store.removeItems(keys.filter((key) => parseKey(key) !== null));
    },
  };
}

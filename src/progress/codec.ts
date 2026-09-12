import type { Entry, TopicProgress } from './types.ts';

/**
 * Значение CloudStorage ограничено 4096 байтами на ключ, поэтому формат
 * максимально плотный: запись — кортеж [box, seen, correct, day], день —
 * число дней от эпохи вместо ISO-строки. Формат описан в docs/quiz-schema.md.
 */

export const FORMAT_VERSION = 1;

/** Запас от лимита в 4096 байт: перелив дешевле, чем потерянная запись. */
export const CHUNK_LIMIT = 3800;

type Tuple = [box: number, seen: number, correct: number, day: number];

interface Payload {
  v: number;
  d: Record<string, Tuple>;
}

const byteLength = (value: string): number => new TextEncoder().encode(value).length;

function isTuple(value: unknown): value is Tuple {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

function encodePayload(entries: Array<[string, Entry]>): string {
  const d: Record<string, Tuple> = {};
  for (const [id, entry] of entries) {
    d[id] = [entry.box, entry.seen, entry.correct, entry.day];
  }
  return JSON.stringify({ v: FORMAT_VERSION, d } satisfies Payload);
}

/**
 * Режет прогресс темы на куски, каждый из которых влезает в один ключ.
 * Куски самодостаточны: порядок при чтении неважен, потери одного куска
 * не ломают остальные.
 */
export function encode(progress: TopicProgress): string[] {
  const entries = Object.entries(progress);
  if (entries.length === 0) return [];

  const chunks: string[] = [];
  let current: Array<[string, Entry]> = [];

  for (const entry of entries) {
    const next = [...current, entry];
    if (current.length > 0 && byteLength(encodePayload(next)) > CHUNK_LIMIT) {
      chunks.push(encodePayload(current));
      current = [entry];
    } else {
      current = next;
    }
  }

  chunks.push(encodePayload(current));
  return chunks;
}

/**
 * Собирает прогресс из кусков. Битый или чужой по версии кусок пропускается:
 * потерять часть истории повторений лучше, чем уронить приложение на старте.
 */
export function decode(chunks: string[]): TopicProgress {
  const progress: TopicProgress = {};

  for (const chunk of chunks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(chunk);
    } catch {
      continue;
    }

    if (typeof parsed !== 'object' || parsed === null) continue;
    const payload = parsed as Partial<Payload>;
    if (payload.v !== FORMAT_VERSION || typeof payload.d !== 'object' || payload.d === null) continue;

    for (const [id, tuple] of Object.entries(payload.d)) {
      if (!isTuple(tuple)) continue;
      const [box, seen, correct, day] = tuple;
      progress[id] = { box, seen, correct, day };
    }
  }

  return progress;
}

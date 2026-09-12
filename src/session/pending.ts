import type { Question } from '../data/types.ts';
import type { KeyValueStore } from '../progress/storage.ts';

/**
 * Незаконченная сессия. Главный сценарий — пять минут в очереди, а тема это
 * двадцать вопросов: без этого каждый заход начинался бы сначала.
 *
 * Точка возврата — первый неотвеченный вопрос, то есть answers.length. Ответ
 * уже записан в прогресс в момент, когда он дан, поэтому вернуть человека на
 * разобранный вопрос значило бы засчитать его дважды.
 */
export interface PendingSession {
  title: string;
  ids: string[];
  answers: boolean[];
}

export const PENDING_KEY = 'session_current';

const FORMAT_VERSION = 1;
const LIMIT = 3800;

interface Payload {
  v: number;
  t: string;
  q: string[];
  r: number[];
}

export function encodePending(session: PendingSession): string {
  return JSON.stringify({
    v: FORMAT_VERSION,
    t: session.title,
    q: session.ids,
    r: session.answers.map((correct) => (correct ? 1 : 0)),
  } satisfies Payload);
}

export function decodePending(raw: string | undefined): PendingSession | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const payload = parsed as Partial<Payload>;

  if (payload.v !== FORMAT_VERSION) return null;
  if (typeof payload.t !== 'string') return null;
  if (!Array.isArray(payload.q) || !payload.q.every((id) => typeof id === 'string')) return null;
  if (!Array.isArray(payload.r) || !payload.r.every((value) => value === 0 || value === 1)) return null;
  if (payload.r.length >= payload.q.length || payload.q.length === 0) return null;

  return { title: payload.t, ids: payload.q, answers: payload.r.map((value) => value === 1) };
}

export interface ResolvedSession {
  title: string;
  questions: Question[];
  answers: boolean[];
}

/**
 * Сопоставляет сохранённые id с текущим контентом. Если хоть один вопрос
 * исчез — банк изменился, и восстанавливать нечего: номера вопросов уже не
 * те, а молча подсунуть другой вопрос хуже, чем начать заново.
 */
export function resolvePending(
  session: PendingSession,
  byId: Map<string, Question>,
): ResolvedSession | null {
  const questions: Question[] = [];

  for (const id of session.ids) {
    const question = byId.get(id);
    if (!question) return null;
    questions.push(question);
  }

  return { title: session.title, questions, answers: session.answers };
}

export interface PendingStore {
  load(): Promise<PendingSession | null>;
  save(session: PendingSession): void;
  clear(): Promise<void>;
  flush(): Promise<void>;
}

/** Задержка перед записью: сохранять на каждый тап по сети незачем. */
export const SAVE_DELAY = 400;

export function createPendingStore(store: KeyValueStore): PendingStore {
  let queued: PendingSession | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing: Promise<void> = Promise.resolve();

  function write(value: string | null): Promise<void> {
    writing = writing.then(async () => {
      try {
        if (value === null) await store.removeItems([PENDING_KEY]);
        else await store.setItem(PENDING_KEY, value);
      } catch {
        // Не сохранилось — сессия просто не восстановится, это не повод падать.
      }
    });
    return writing;
  }

  function stopTimer() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  async function flush(): Promise<void> {
    stopTimer();
    if (queued === null) return writing;

    const encoded = encodePending(queued);
    queued = null;
    // Слишком длинная очередь в один ключ не влезет — тогда просто не
    // сохраняем: потерять возможность продолжить лучше, чем битый ключ.
    if (new TextEncoder().encode(encoded).length > LIMIT) return writing;
    return write(encoded);
  }

  return {
    async load() {
      try {
        const values = await store.getItems([PENDING_KEY]);
        return decodePending(values[PENDING_KEY]);
      } catch {
        return null;
      }
    },

    save(session) {
      queued = session;
      stopTimer();
      timer = setTimeout(() => {
        timer = undefined;
        void flush();
      }, SAVE_DELAY);
    },

    flush,

    async clear() {
      stopTimer();
      queued = null;
      return write(null);
    },
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPendingStore,
  decodePending,
  encodePending,
  resolvePending,
  PENDING_KEY,
} from '../src/session/pending.ts';
import type { PendingSession } from '../src/session/pending.ts';
import type { KeyValueStore } from '../src/progress/storage.ts';
import type { Question } from '../src/data/types.ts';

const session: PendingSession = {
  title: 'React Native: архитектура',
  ids: ['rn-arch-001', 'rn-arch-002', 'rn-arch-003'],
  answers: [true, false],
};

const question = (id: string): Question => ({
  id,
  topic: 'rn-architecture',
  type: 'single',
  question: id,
  options: ['а', 'б'],
  correct: [0],
  explanation: '…',
  difficulty: 1,
});

function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const store: KeyValueStore = {
    kind: 'local',
    getKeys: async () => [...data.keys()],
    getItems: async (keys) => {
      const out: Record<string, string> = {};
      for (const key of keys) {
        const value = data.get(key);
        if (value !== undefined) out[key] = value;
      }
      return out;
    },
    setItem: async (key, value) => void data.set(key, value),
    removeItems: async (keys) => keys.forEach((key) => data.delete(key)),
  };
  return { store, data };
}

test('сессия переживает кодирование и чтение', () => {
  assert.deepEqual(decodePending(encodePending(session)), session);
});

test('точка возврата — первый неотвеченный вопрос', () => {
  const decoded = decodePending(encodePending(session));
  assert.equal(decoded?.answers.length, 2, 'два ответа уже даны');
  assert.equal(decoded?.ids[decoded.answers.length], 'rn-arch-003', 'возвращаемся к третьему');
});

test('дописанная до конца сессия не восстанавливается', () => {
  const finished = { ...session, answers: [true, false, true] };
  assert.equal(decodePending(encodePending(finished)), null);
});

test('мусор и чужая версия не ломают чтение', () => {
  assert.equal(decodePending(undefined), null);
  assert.equal(decodePending('не json'), null);
  assert.equal(decodePending('{"v":2,"t":"x","q":["a"],"r":[]}'), null);
  assert.equal(decodePending('{"v":1,"t":"x"}'), null);
  assert.equal(decodePending('{"v":1,"t":"x","q":[],"r":[]}'), null);
});

test('исчезнувший из банка вопрос отменяет восстановление', () => {
  const full = new Map(session.ids.map((id) => [id, question(id)]));
  assert.ok(resolvePending(session, full));

  const partial = new Map(full);
  partial.delete('rn-arch-002');
  assert.equal(resolvePending(session, partial), null);
});

test('восстановление отдаёт вопросы в исходном порядке очереди', () => {
  const byId = new Map(session.ids.map((id) => [id, question(id)]));
  const resolved = resolvePending(session, byId);
  assert.deepEqual(resolved?.questions.map((q) => q.id), session.ids);
  assert.deepEqual(resolved?.answers, session.answers);
  assert.equal(resolved?.title, session.title);
});

test('сохранение и чтение через хранилище', async () => {
  const fake = fakeStore();
  const store = createPendingStore(fake.store);
  store.save(session);
  await store.flush();

  assert.deepEqual([...fake.data.keys()], [PENDING_KEY]);
  assert.deepEqual(await createPendingStore(fake.store).load(), session);
});

test('последнее состояние побеждает, промежуточные не пишутся', async () => {
  const fake = fakeStore();
  const store = createPendingStore(fake.store);
  store.save({ ...session, answers: [true] });
  store.save({ ...session, answers: [true, false] });
  await store.flush();

  const loaded = await createPendingStore(fake.store).load();
  assert.deepEqual(loaded?.answers, [true, false]);
});

test('очистка убирает ключ и не трогает прогресс', async () => {
  const fake = fakeStore({ 'progress_rn-architecture__0': '{"v":1,"d":{}}' });
  const store = createPendingStore(fake.store);
  store.save(session);
  await store.flush();
  await store.clear();

  assert.deepEqual([...fake.data.keys()], ['progress_rn-architecture__0']);
  assert.equal(await store.load(), null);
});

test('недоступное хранилище не роняет загрузку', async () => {
  const broken: KeyValueStore = {
    kind: 'cloud',
    getKeys: async () => [],
    getItems: async () => {
      throw new Error('нет сети');
    },
    setItem: async () => {},
    removeItems: async () => {},
  };
  assert.equal(await createPendingStore(broken).load(), null);
});

test('слишком длинная очередь не сохраняется вместо порчи ключа', async () => {
  const fake = fakeStore();
  const store = createPendingStore(fake.store);
  const huge: PendingSession = {
    title: 'Повторение',
    ids: Array.from({ length: 400 }, (_, i) => `rn-arch-${String(i).padStart(3, '0')}`),
    answers: [true],
  };
  store.save(huge);
  await store.flush();
  assert.equal(fake.data.size, 0);
});

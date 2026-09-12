import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressStore, KEY_PREFIX } from '../src/progress/store.ts';
import type { KeyValueStore } from '../src/progress/storage.ts';

/** Хранилище в памяти с возможностью уронить запись. */
function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  let failWrites = false;

  const store: KeyValueStore = {
    kind: 'local',
    getKeys: async () => [...data.keys()],
    getItems: async (keys) => {
      const values: Record<string, string> = {};
      for (const key of keys) {
        const value = data.get(key);
        if (value !== undefined) values[key] = value;
      }
      return values;
    },
    setItem: async (key, value) => {
      if (failWrites) throw new Error('нет сети');
      data.set(key, value);
    },
    removeItems: async (keys) => {
      for (const key of keys) data.delete(key);
    },
  };

  return { store, data, setFailWrites: (value: boolean) => (failWrites = value) };
}

test('ответ сохраняется и читается новым стором', async () => {
  const first = fakeStore();
  const store = createProgressStore(first.store);
  store.record('rn-architecture', 'rn-arch-001', true, 100);
  await store.flush();

  const reloaded = createProgressStore(first.store);
  const progress = await reloaded.load();
  assert.deepEqual(progress['rn-architecture']['rn-arch-001'], {
    box: 2,
    seen: 1,
    correct: 1,
    day: 100,
  });
});

test('ключи не содержат двоеточия — CloudStorage его не принимает', async () => {
  const fake = fakeStore();
  const store = createProgressStore(fake.store);
  store.record('rn-architecture', 'rn-arch-001', true, 100);
  await store.flush();

  const keys = [...fake.data.keys()];
  assert.ok(keys.length > 0);
  for (const key of keys) {
    assert.ok(key.startsWith(KEY_PREFIX), key);
    assert.match(key, /^[A-Za-z0-9_-]+$/, `недопустимый ключ: ${key}`);
  }
});

test('темы лежат в разных ключах и не перетирают друг друга', async () => {
  const fake = fakeStore();
  const store = createProgressStore(fake.store);
  store.record('rn-architecture', 'rn-arch-001', true, 100);
  store.record('rn-performance', 'rn-perf-001', false, 100);
  await store.flush();

  const progress = await createProgressStore(fake.store).load();
  assert.equal(progress['rn-architecture']['rn-arch-001'].box, 2);
  assert.equal(progress['rn-performance']['rn-perf-001'].box, 1);
});

test('сократившийся прогресс не оставляет лишних ключей', async () => {
  const fake = fakeStore();
  const store = createProgressStore(fake.store);
  for (let i = 1; i <= 300; i += 1) {
    store.record('rn-architecture', `rn-arch-${String(i).padStart(3, '0')}`, true, 100);
  }
  await store.flush();
  const manyKeys = [...fake.data.keys()].length;
  assert.ok(manyKeys > 1, 'ожидался перелив в несколько ключей');

  // Заново: одна запись вместо трёхсот — хвост старых ключей должен исчезнуть.
  const fresh = createProgressStore(fake.store);
  await fresh.load();
  const single = fakeStore();
  const small = createProgressStore(single.store);
  small.record('rn-architecture', 'rn-arch-001', true, 100);
  await small.flush();
  assert.equal([...single.data.keys()].length, 1);
});

test('неудачная запись не теряет прогресс — он уходит в следующий flush', async () => {
  const fake = fakeStore();
  const store = createProgressStore(fake.store);

  fake.setFailWrites(true);
  store.record('rn-architecture', 'rn-arch-001', true, 100);
  await store.flush();
  assert.equal(fake.data.size, 0, 'ничего не записалось');
  assert.equal(store.entry('rn-architecture', 'rn-arch-001')?.box, 2, 'но в памяти запись есть');

  fake.setFailWrites(false);
  await store.flush();
  const progress = await createProgressStore(fake.store).load();
  assert.equal(progress['rn-architecture']['rn-arch-001'].box, 2);
});

test('нечитаемое хранилище не роняет загрузку', async () => {
  const broken: KeyValueStore = {
    kind: 'cloud',
    getKeys: async () => {
      throw new Error('CloudStorage недоступен');
    },
    getItems: async () => ({}),
    setItem: async () => {},
    removeItems: async () => {},
  };
  assert.deepEqual(await createProgressStore(broken).load(), {});
});

test('чужие ключи в хранилище игнорируются', async () => {
  const fake = fakeStore({ theme: 'dark', 'progress_broken': 'мусор' });
  const store = createProgressStore(fake.store);
  assert.deepEqual(await store.load(), {});
});

test('очистка стирает прогресс и не трогает чужие ключи', async () => {
  const fake = fakeStore({ theme: 'dark' });
  const store = createProgressStore(fake.store);
  store.record('rn-architecture', 'rn-arch-001', true, 100);
  await store.flush();

  await store.clear();
  assert.deepEqual(store.snapshot(), {});
  assert.deepEqual([...fake.data.keys()], ['theme']);
  assert.deepEqual(await createProgressStore(fake.store).load(), {});
});

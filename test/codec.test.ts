import test from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, CHUNK_LIMIT, FORMAT_VERSION } from '../src/progress/codec.ts';
import type { TopicProgress } from '../src/progress/types.ts';

const sample: TopicProgress = {
  'rn-arch-001': { box: 2, seen: 3, correct: 2, day: 20709 },
  'rn-arch-002': { box: 5, seen: 8, correct: 8, day: 20700 },
};

const byteLength = (value: string) => new TextEncoder().encode(value).length;

test('кодирование и обратное чтение не теряют данные', () => {
  assert.deepEqual(decode(encode(sample)), sample);
});

test('пустой прогресс не занимает ни одного ключа', () => {
  assert.deepEqual(encode({}), []);
  assert.deepEqual(decode([]), {});
});

test('запись укладывается примерно в 35 байт', () => {
  const [chunk] = encode(sample);
  assert.ok(byteLength(chunk) / Object.keys(sample).length < 45, `получилось ${chunk}`);
});

test('большая тема режется на куски по лимиту, и все записи переживают round-trip', () => {
  const big: TopicProgress = {};
  for (let i = 1; i <= 300; i += 1) {
    big[`rn-arch-${String(i).padStart(3, '0')}`] = { box: 3, seen: 12, correct: 9, day: 20709 };
  }

  const chunks = encode(big);
  assert.ok(chunks.length > 1, 'ожидался перелив в несколько ключей');
  for (const chunk of chunks) {
    assert.ok(byteLength(chunk) <= CHUNK_LIMIT, `кусок ${byteLength(chunk)} байт превысил лимит`);
  }
  assert.deepEqual(decode(chunks), big);
});

test('порядок кусков при чтении не важен', () => {
  const big: TopicProgress = {};
  for (let i = 1; i <= 300; i += 1) {
    big[`rn-perf-${String(i).padStart(3, '0')}`] = { box: 1, seen: 1, correct: 0, day: 20000 };
  }
  assert.deepEqual(decode(encode(big).reverse()), big);
});

test('битый кусок пропускается, остальные читаются', () => {
  const decoded = decode([...encode(sample), 'не json', '{"v":1}', '']);
  assert.deepEqual(decoded, sample);
});

test('кусок чужой версии игнорируется', () => {
  const foreign = JSON.stringify({ v: FORMAT_VERSION + 1, d: { 'rn-arch-009': [1, 1, 1, 1] } });
  assert.deepEqual(decode([...encode(sample), foreign]), sample);
});

test('запись неверной формы пропускается, соседние — нет', () => {
  const broken = JSON.stringify({
    v: FORMAT_VERSION,
    d: { 'rn-arch-010': [1, 2], 'rn-arch-011': [1, 2, 3, 4] },
  });
  const decoded = decode([broken]);
  assert.deepEqual(Object.keys(decoded), ['rn-arch-011']);
});

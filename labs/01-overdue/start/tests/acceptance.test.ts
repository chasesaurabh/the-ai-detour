import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
const at = '2026-11-21T12:00:00Z';

test('future negative-offset deadline is excluded', async t => {
  const { store } = await fixture(t);
  await store.add('Future', 2, '2026-11-21T08:00:00-06:00');
  assert.deepEqual(await store.overdue(at), []);
});
test('past positive-offset deadline is included', async t => {
  const { store } = await fixture(t);
  const id = await store.add('Past', 2, '2026-11-21T13:00:00+02:00');
  assert.deepEqual((await store.overdue(at)).map(x => x.id), [id]);
});
test('equal instant is excluded', async t => {
  const { store } = await fixture(t);
  await store.add('Equal', 2, '2026-11-21T06:00:00-06:00');
  assert.deepEqual(await store.overdue(at), []);
});
test('same-day earlier deadline is included', async t => {
  const { store } = await fixture(t);
  const id = await store.add('Earlier', 2, '2026-11-21T11:59:59Z');
  assert.deepEqual((await store.overdue(at)).map(x => x.id), [id]);
});
test('closed and undated tickets are excluded', async t => {
  const { store } = await fixture(t);
  await store.add('Undated');
  const id = await store.add('Closed', 2, '2026-11-20T01:00:00Z');
  await store.close(id);
  assert.deepEqual(await store.overdue(at), []);
});
test('evaluation offset does not change the result', async t => {
  const { store } = await fixture(t);
  await store.add('Earlier', 2, '2026-11-21T11:00:00Z');
  assert.deepEqual(await store.overdue(at), await store.overdue('2026-11-21T06:00:00-06:00'));
});
test('orders by instant then ID', async t => {
  const { store } = await fixture(t);
  const later = await store.add('Later', 2, '2026-11-21T04:00:00-06:00');
  const earlier = await store.add('Earlier', 2, '2026-11-21T10:00:00+02:00');
  const tied = await store.add('Tied', 2, '2026-11-21T08:00:00Z');
  assert.deepEqual((await store.overdue(at)).map(x => x.id), [...[earlier, tied].sort(), later]);
});
test('evaluation needs a timezone', async t => { const { store } = await fixture(t); await assert.rejects(store.overdue('2026-11-21T12:00:00'), /timezone/); });
test('invalid evaluation is rejected', async t => { const { store } = await fixture(t); await assert.rejects(store.overdue('yesterday')); });
test('query preserves stored values', async t => {
  const { store } = await fixture(t);
  await store.add('Original', 2, '2026-11-21T13:00:00+02:00');
  const before = await store.list();
  await store.overdue(at);
  assert.deepEqual(await store.list(), before);
});
test('date boundary uses the instant', async t => {
  const { store } = await fixture(t);
  await store.add('Next UTC day', 2, '2026-11-20T23:30:00-02:00');
  assert.deepEqual(await store.overdue('2026-11-21T00:30:00Z'), []);
});
test('fractional seconds are respected', async t => {
  const { store } = await fixture(t);
  const id = await store.add('Earlier', 2, '2026-11-21T12:00:00.100Z');
  assert.deepEqual((await store.overdue('2026-11-21T12:00:00.200Z')).map(x => x.id), [id]);
});

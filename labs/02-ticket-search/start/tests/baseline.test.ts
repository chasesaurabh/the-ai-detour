import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
import { Store } from '../src/store.js';

test('persists a literal title across connections', async t => {
  const { store, database } = await fixture(t);
  const title = 'Investigate {"$ne":null}';
  const id = await store.add(title);
  const second = await Store.connect(database);
  try { assert.deepEqual(await second.list(), [{ id, title, status: 'open', priority: 2, dueAt: null }]); }
  finally { await second.disconnect(); }
});
test('closed tickets are excluded', async t => {
  const { store } = await fixture(t);
  const id = await store.add('Closed', 2, '2026-11-20T12:00:00Z');
  await store.close(id);
  assert.deepEqual(await store.overdue('2026-11-21T12:00:00Z'), []);
});
test('same-offset overdue ticket is selected', async t => {
  const { store } = await fixture(t);
  const id = await store.add('Past', 2, '2026-11-21T11:00:00Z');
  assert.deepEqual((await store.overdue('2026-11-21T12:00:00Z')).map(x => x.id), [id]);
});
test('empty title is rejected', async t => { const { store } = await fixture(t); await assert.rejects(store.add(' '), /Title/); });
test('invalid priority is rejected', async t => { const { store } = await fixture(t); await assert.rejects(store.add('Item', 4), /Priority/); });
test('due timestamp needs a timezone', async t => { const { store } = await fixture(t); await assert.rejects(store.add('Item', 2, '2026-11-21T12:00:00'), /timezone/); });

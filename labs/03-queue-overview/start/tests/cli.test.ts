import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture } from './helpers.js';
import { localUri } from '../src/store.js';

function cli(database: string, args: string[], status = 0): any {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli.js', import.meta.url)), '--db', database, ...args], {
    encoding: 'utf8', timeout: 15000, env: { ...process.env, MONGODB_URI: localUri },
  });
  assert.equal(result.status, status, result.stderr);
  return status === 0 ? JSON.parse(result.stdout) : result.stderr;
}
test('persists and selects tickets across CLI processes', async t => {
  const { database } = await fixture(t);
  cli(database, ['init']);
  const past = cli(database, ['add', 'Earlier', '--due', '2026-11-21T13:00:00+02:00']).id;
  cli(database, ['add', 'Later', '--due', '2026-11-21T08:00:00-06:00']);
  assert.equal(cli(database, ['list']).length, 2);
  assert.deepEqual(cli(database, ['overdue', '--as-of', '2026-11-21T12:00:00Z']).map((r: { id: string }) => r.id), [past]);
  cli(database, ['close', past]);
  assert.deepEqual(cli(database, ['overdue', '--as-of', '2026-11-21T12:00:00Z']), []);
});
test('naive evaluation is a CLI error', async t => { const { database } = await fixture(t); assert.match(cli(database, ['overdue', '--as-of', '2026-11-21T12:00:00'], 2), /timezone/); });
test('unknown ID is a CLI error', async t => { const { database } = await fixture(t); assert.match(cli(database, ['close', '000000000000000000000000'], 2), /does not exist/); });

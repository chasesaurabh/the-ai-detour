import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';

// Contract checks run outside the candidate workspace. Run its TypeScript build first.
const [workspaceArg, reportArg] = process.argv.slice(2);
if (!workspaceArg || !reportArg) throw new Error('Usage: npm run agent:verify -- <candidate> <report.json>');
const workspace = resolve(workspaceArg);
const { Store, localUri } = await import(pathToFileURL(join(workspace, 'dist/src/store.js')).href);
const database = 'detour_test_' + randomUUID().replaceAll('-', '');
const store = await Store.connect(database);
const client = new MongoClient(localUri);
await client.connect();
const results: { name: string; passed: boolean; error?: string }[] = [];
async function check(name: string, fn: () => unknown) {
  try { await fn(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) }); }
}
function cli(args: string[], expected = 0) {
  const result = spawnSync(process.execPath, [join(workspace, 'dist/src/cli.js'), '--db', database, ...args], {
    encoding: 'utf8', timeout: 15000, env: { ...process.env, MONGODB_URI: localUri }, windowsHide: true,
  });
  assert.equal(result.status, expected, result.stderr);
  if (expected !== 0) { assert.equal(result.stdout, ''); assert.ok(result.stderr.trim()); return; }
  return JSON.parse(result.stdout);
}
try {
  const ids: string[] = [];
  for (const [title, priority] of [['Export [CSV].*', 1], ['EXPORT normal', 1], ['Other work', 3], ['Export (legacy) \\ path', 2], ['Export closed', 1]] as const) {
    ids.push(await store.add(title, priority, '2026-11-21T08:00:00-06:00'));
  }
  await store.close(ids[4]);
  const before = await store.list();
  await check('default search returns original shapes in ID order', () => assert.deepEqual(cli(['search']), before));
  await check('combined filters use AND', () => assert.deepEqual(cli(['search', '--status', 'open', '--priority', '1', '--text', 'export']).map((x: any) => x.id), ids.slice(0, 2)));
  await check('literal regex metacharacters and backslash', () => {
    for (const [text, index] of [['[CSV].*', 0], ['.*', 0], ['(', 3], ['\\', 3]] as const) {
      assert.deepEqual(cli(['search', '--text', text]).map((x: any) => x.id), [ids[index]]);
    }
  });
  await check('nonempty whitespace preserved as literal substring', () => assert.deepEqual(cli(['search', '--text', '  ']), []));
  await check('pagination follows filtering and stable sort', () => {
    assert.deepEqual(cli(['search', '--status', 'open', '--limit', '01', '--offset', '01']).map((x: any) => x.id), [ids[1]]);
    assert.deepEqual(cli(['search', '--offset', '100']), []);
  });
  await check('closed status can be selected', () => assert.deepEqual(cli(['search', '--status', 'closed']).map((x: any) => x.id), [ids[4]]));
  await check('invalid numeric CLI syntax rejected', () => {
    for (const flag of ['--limit', '--offset', '--priority']) {
      for (const value of ['-1', '+1', '1.0', '1e1', ' 1', 'Infinity', '9007199254740992']) cli(['search', flag, value], 2);
    }
    for (const [flag, value] of [['--limit', '0'], ['--limit', '101'], ['--priority', '0'], ['--priority', '4']]) cli(['search', flag!, value!], 2);
  });
  await check('invalid text status and positional arguments rejected', () => {
    cli(['search', '--text', ''], 2); cli(['search', '--status', 'pending'], 2); cli(['search', 'extra'], 2);
  });
  await check('search flags cannot leak into other commands', () => {
    for (const [flag, value] of [['--status', 'open'], ['--text', 'Export'], ['--limit', '1'], ['--offset', '0']]) {
      for (const base of [['list'], ['init'], ['add', 'Unexpected'], ['close', ids[0]!], ['overdue', '--as-of', '2026-11-21T12:00:00Z']]) cli([...base, flag!, value!], 2);
    }
    cli(['search', '--due', '2026-11-21T12:00:00Z'], 2);
    cli(['search', '--as-of', '2026-11-21T12:00:00Z'], 2);
  });
  await check('search and rejected commands preserve stored records', async () => assert.deepEqual(await store.list(), before));
  await check('default page limit is 20', async () => {
    for (let i = 0; i < 22; i++) await store.add('Pagination fixture ' + i);
    assert.equal(cli(['search']).length, 20);
    assert.equal(cli(['search', '--limit', '100']).length, 27);
  });
  await client.db(database).collection('tickets').deleteMany({});
  await check('Store validates inputs on empty collections', async () => {
    for (const options of [{ status: 'pending' }, { priority: 0 }, { priority: 1.5 }, { text: '' }, { limit: 0 }, { limit: 101 }, { limit: NaN }, { offset: -1 }, { offset: Infinity }, { offset: Number.MAX_SAFE_INTEGER + 1 }, { offset: 1.2 }]) {
      await assert.rejects(async () => store.search(options));
    }
    assert.deepEqual(await store.search({}), []);
  });
} finally {
  await store.disconnect();
  await client.db(database).dropDatabase();
  await client.close();
}
writeFileSync(resolve(reportArg), JSON.stringify({ observedAt: new Date().toISOString(), node: process.version, checks: results, passed: results.filter(x => x.passed).length, total: results.length }, null, 2));
console.log(results.map(x => `${x.passed ? 'PASS' : 'FAIL'} ${x.name}`).join('\n'));
if (results.some(x => !x.passed)) process.exitCode = 1;

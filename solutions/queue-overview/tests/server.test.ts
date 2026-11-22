import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { fixture } from './helpers.js';

const entry = fileURLToPath(new URL('../src/server.js', import.meta.url));
const defaultCutoff = '2026-11-21T14:00:00Z';
const validQuery = new URLSearchParams({ asOf: defaultCutoff }).toString();

async function startServer(t: TestContext) {
  const data = await fixture(t);
  const child = spawn(process.execPath, [entry, '--db', data.database, '--port', '0'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const closed = once(child, 'close');
  let stdout = '';
  let stderr = '';
  let startupLine = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  t.after(async () => {
    child.kill();
    await closed;
    assert.equal(stdout, startupLine ? startupLine + '\n' : '');
  });
  const lines = createInterface({ input: child.stdout });
  try {
    const line = await Promise.race([
      once(lines, 'line', { signal: AbortSignal.timeout(10000) }).then(([line]) => String(line)),
      closed.then(() => { throw new Error(`Server exited before listening: ${stderr}`); }),
    ]);
    startupLine = line;
    const { port } = JSON.parse(line);
    assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
    assert.deepEqual(JSON.parse(line), { port });
    return { ...data, base: `http://127.0.0.1:${port}` };
  } finally {
    lines.close();
  }
}

test('summary counts open priorities and compares due instants without leaking or changing records', async t => {
  const { base, store } = await startServer(t);
  await store.add('Private past', 1, '2026-11-21T15:59:59.999+02:00');
  await store.add('Private equal', 2, '2026-11-21T08:00:00-06:00');
  await store.add('Private future', 3, '2026-11-21T08:00:00.001-06:00');
  await store.add('Private undated', 1);
  await store.close(await store.add('Private closed', 2, '2026-11-20T14:00:00Z'));
  const before = await store.list();

  const response = await fetch(`${base}/api/summary?asOf=2026-11-21T16%3A00%3A00%2B02%3A00`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
  assert.deepEqual(await response.json(), { open: 4, closed: 1, overdue: 1, byPriority: { 1: 2, 2: 1, 3: 1 } });
  assert.deepEqual(await store.list(), before);
});

test('empty summaries, invalid queries, unsupported methods and unknown paths', async t => {
  const { base } = await startServer(t);
  const empty = await fetch(`${base}/api/summary?${validQuery}`);
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { open: 0, closed: 0, overdue: 0, byPriority: { 1: 0, 2: 0, 3: 0 } });

  for (const query of ['', 'asOf=', `${validQuery}&${validQuery}`, `${validQuery}&extra=1`,
    'asOf=2026-11-21T14:00:00', 'asOf=2026-02-30T14:00:00Z', 'asOf=2026-11-21T16:00:00+02:00']) {
    const response = await fetch(`${base}/api/summary?${query}`);
    assert.equal(response.status, 400, query);
    const body = await response.json();
    assert.equal(typeof body.error, 'string');
    assert.deepEqual(Object.keys(body), ['error']);
  }

  for (const path of ['/', `/api/summary?${validQuery}`]) {
    const response = await fetch(base + path, { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET');
    await response.json();
  }
  const missing = await fetch(`${base}/missing`);
  assert.equal(missing.status, 404);
  await missing.json();
});

test('overview loads initial counts, refreshes with an encoded offset, and displays errors as text', async t => {
  const { base, store } = await startServer(t);
  await store.add('<private-title>', 2, '2026-11-21T13:00:00Z');
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html/);
  const html = await response.text();
  assert.match(html, /<h1>Queue overview<\/h1>/);
  assert.match(html, /<label for="as-of">/);
  assert.match(html, /<button id="refresh" type="submit">Refresh<\/button>/);
  assert.match(html, /id="error" role="alert"/);
  assert.doesNotMatch(html, /<private-title>/);

  const ids = ['open-count', 'overdue-count', 'closed-count', 'priority-1', 'priority-2', 'priority-3'];
  const nodes = new Map(ids.concat('error').map(id => {
    assert.ok(html.includes(`id="${id}"`));
    return [id, { textContent: '' }];
  }));
  const input = { value: /id="as-of"[^>]*value="([^"]*)"/.exec(html)?.[1] };
  assert.equal(input.value, defaultCutoff);
  let submit: ((event: { preventDefault(): void }) => Promise<void>) | undefined;
  const form = { addEventListener: (event: string, handler: typeof submit) => {
    assert.equal(event, 'submit');
    submit = handler;
  } };
  const requests: string[] = [];
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script);
  await runInNewContext(script, {
    document: { getElementById: (id: string) => id === 'as-of' ? input : id === 'summary-form' ? form : nodes.get(id) },
    URLSearchParams,
    fetch: (path: string) => { requests.push(path); return fetch(base + path); },
  });
  assert.deepEqual(ids.map(id => nodes.get(id)?.textContent), ['1', '1', '0', '0', '1', '0']);

  assert.ok(submit);
  let prevented = false;
  const event = { preventDefault: () => { prevented = true; } };
  input.value = '2026-11-21T15:00:00+02:00';
  await submit(event);
  assert.ok(prevented);
  assert.match(requests[1] ?? '', /%2B02%3A00$/);
  assert.equal(nodes.get('overdue-count')?.textContent, '0');

  input.value = 'invalid';
  await submit(event);
  assert.match(nodes.get('error')?.textContent ?? '', /explicit timezone/);
  assert.equal(nodes.get('open-count')?.textContent, '—');
});

test('invalid startup arguments exit nonzero without announcing a port', () => {
  for (const args of [[], ['--port', '0'], ['--db', 'detour_invalid'],
    ['--db', 'bad-name', '--port', '0'], ['--db', 'detour_invalid', '--port', '65536'],
    ['--db', 'detour_invalid', '--port', '-1'], ['--db', 'detour_invalid', '--port', '1.5'],
    ['--db', 'detour_invalid', '--port', '0', '--port', '0'],
    ['--db', 'detour_invalid', '--port', '0', '--unknown']]) {
    const result = spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', timeout: 10000 });
    assert.ifError(result.error);
    assert.equal(result.status, 2, args.join(' '));
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.trim());
  }
});

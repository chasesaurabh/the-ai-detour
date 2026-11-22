import { once } from 'node:events';
import { createServer, type ServerResponse } from 'node:http';
import { parseArgs } from 'node:util';
import { overviewPage } from './overview.js';
import { instant, Store } from './store.js';

function json(response: ServerResponse, status: number, data: object): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

async function serve(): Promise<void> {
  const { values, tokens } = parseArgs({
    options: { db: { type: 'string' }, port: { type: 'string' } },
    tokens: true,
  });
  if (!values.db || tokens.filter(token => token.kind === 'option' && token.name === 'db').length !== 1) {
    throw new Error('Pass --db with one database name');
  }
  const port = Number(values.port);
  if (!values.port || /[^0-9]/.test(values.port) || port > 65535 ||
      tokens.filter(token => token.kind === 'option' && token.name === 'port').length !== 1) {
    throw new Error('Pass --port with one integer from 0 through 65535');
  }

  const store = await Store.connect(values.db);
  const server = createServer(async (request, response) => {
    const target = request.url ?? '';
    const queryStart = target.indexOf('?');
    const path = queryStart === -1 ? target : target.slice(0, queryStart);
    if (path !== '/' && path !== '/api/summary') {
      return json(response, 404, { error: 'Not found' });
    }
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return json(response, 405, { error: 'Method not allowed' });
    }
    if (path === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(overviewPage);
      return;
    }

    const query = new URLSearchParams(queryStart === -1 ? '' : target.slice(queryStart + 1));
    const asOf = query.get('asOf');
    if (asOf === null || query.size !== 1) {
      return json(response, 400, { error: 'Pass exactly one asOf parameter and no other query parameters' });
    }
    let cutoff: number;
    try {
      cutoff = instant(asOf);
    } catch (error) {
      return json(response, 400, { error: error instanceof Error ? error.message : 'Invalid timestamp' });
    }
    try {
      json(response, 200, await store.summary(cutoff));
    } catch {
      json(response, 500, { error: 'Unable to read queue summary' });
    }
  });

  try {
    const listening = once(server, 'listening');
    server.listen(port, '127.0.0.1');
    await listening;
  } catch (error) {
    await store.disconnect();
    throw error;
  }

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
  process.stdout.write(JSON.stringify({ port: address.port }) + '\n');

  const shutdown = () => server.close(() => void store.disconnect().catch(reportFailure));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

function reportFailure(error: unknown): void {
  process.stderr.write((error instanceof Error ? error.message : 'Server failed') + '\n');
  process.exitCode = 2;
}

await serve().catch(reportFailure);

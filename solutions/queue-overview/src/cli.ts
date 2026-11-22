import { parseArgs } from 'node:util';
import { Store, localUri } from './store.js';

let store: Store | undefined;
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      db: { type: 'string' }, priority: { type: 'string' },
      due: { type: 'string' }, 'as-of': { type: 'string' },
    },
  });
  const [command, argument] = positionals;
  if (!values.db) throw new Error('Pass --db with a database name');
  if (!['init', 'add', 'close', 'list', 'overdue'].includes(command ?? '')) throw new Error('Expected init, add, close, list or overdue');
  const needsArgument = command === 'add' || command === 'close';
  if (positionals.length !== (needsArgument ? 2 : 1)) throw new Error('Unexpected or missing argument');
  if (command !== 'add' && (values.priority !== undefined || values.due !== undefined)) throw new Error('--priority and --due require add');
  if (command !== 'overdue' && values['as-of'] !== undefined) throw new Error('--as-of requires overdue');
  if (command === 'overdue' && !values['as-of']) throw new Error('Pass --as-of with an explicit timezone');
  store = await Store.connect(values.db, process.env.MONGODB_URI ?? localUri);
  let result: unknown;
  switch (command) {
    case 'init': result = { ready: true }; break;
    case 'add': result = { id: await store.add(argument!, Number(values.priority ?? 2), values.due ?? null) }; break;
    case 'close': await store.close(argument!); result = { closed: argument }; break;
    case 'list': result = await store.list(); break;
    case 'overdue': result = await store.overdue(values['as-of']!); break;
  }
  process.stdout.write(JSON.stringify(result) + '\n');
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : 'Command failed') + '\n');
  process.exitCode = 2;
} finally {
  await store?.disconnect();
}

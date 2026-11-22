import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import { MongoClient } from 'mongodb';
import { Store, localUri } from '../src/store.js';

// Each test owns a unique disposable database on the local teaching server.
export async function fixture(t: TestContext) {
  const database = 'detour_test_' + randomUUID().replaceAll('-', '');
  const store = await Store.connect(database, localUri);
  t.after(async () => {
    await store.disconnect();
    const client = new MongoClient(localUri);
    try {
      await client.connect();
      if (!/^detour_test_[a-f0-9]{32}$/.test(database)) throw new Error('Refusing unsafe test cleanup');
      await client.db(database).dropDatabase();
    } finally { await client.close(); }
  });
  return { database, store };
}

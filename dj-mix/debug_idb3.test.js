import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createDownloadBatchStore } from './lib/downloadBatchStore.js';
beforeEach(() => {
  global.indexedDB = new IDBFactory();
  global.IDBKeyRange = IDBKeyRange;
});
test('debug under jsdom', async () => {
  console.log('typeof indexedDB (bare) =', typeof indexedDB);
  console.log('global.indexedDB === indexedDB ?', global.indexedDB === indexedDB);
  const store = createDownloadBatchStore({ dbName: 'debug-3' });
  const created = await store.createBatch({ batch: { id: 'b1', status: 'running' }, items: [] });
  console.log('created =', created);
  const got = await store.getBatch('b1');
  console.log('got =', got);
});

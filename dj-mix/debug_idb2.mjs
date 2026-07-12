import { IDBFactory } from 'fake-indexeddb';
import { createDownloadBatchStore } from './lib/downloadBatchStore.js';

globalThis.indexedDB = new IDBFactory();

const store = createDownloadBatchStore({ dbName: 'debug-2' });

const created = await store.createBatch({
  batch: { id: 'b1', status: 'running' },
  items: [{ id: 'b1::a', batchId: 'b1' }],
});
console.log('created =', created);

const got = await store.getBatch('b1');
console.log('got =', got);

import { IDBFactory } from 'fake-indexeddb';

globalThis.indexedDB = new IDBFactory();

function openDb(dbName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      console.log('onupgradeneeded fired, creating stores');
      db.createObjectStore('batches', { keyPath: 'id' });
      const items = db.createObjectStore('items', { keyPath: 'id' });
      items.createIndex('batchId', 'batchId', { unique: false });
    };
    req.onsuccess = () => { console.log('open success'); resolve(req.result); };
    req.onerror = () => { console.log('open error', req.error); reject(req.error); };
  });
}

const db = await openDb('debug-1');
console.log('db opened', db.name, db.version, [...db.objectStoreNames]);

await new Promise((resolve, reject) => {
  const tx = db.transaction(['batches', 'items'], 'readwrite');
  tx.objectStore('batches').put({ id: 'b1', status: 'running' });
  tx.objectStore('items').put({ id: 'b1::a', batchId: 'b1' });
  tx.oncomplete = () => { console.log('write tx complete'); db.close(); resolve(); };
  tx.onerror = () => { console.log('write tx error', tx.error); db.close(); reject(tx.error); };
});

const db2 = await openDb('debug-1');
console.log('db2 opened', db2.name, db2.version, [...db2.objectStoreNames]);

const got = await new Promise((resolve, reject) => {
  const tx = db2.transaction('batches', 'readonly');
  const req = tx.objectStore('batches').get('b1');
  req.onsuccess = () => { db2.close(); resolve(req.result); };
  req.onerror = () => { db2.close(); reject(req.error); };
});

console.log('got', got);

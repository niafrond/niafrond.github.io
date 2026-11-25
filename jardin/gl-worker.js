// Web Worker (module) : génération des instances 3D d'une zone. La logique est dans `gl-worker-core.js`.
import { runJob, transferablesOf } from './gl-worker-core.js';

self.onmessage = (e) => {
  const { id, job } = e.data || {};
  try {
    const res = runJob(job);
    self.postMessage({ id, res }, transferablesOf(res));
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};

// Pool de Web Workers pour la génération 3D (repli synchrone si les Workers sont indisponibles).
import { runJob } from './gl-worker-core.js';

/** Nombre de workers : min(cœurs − 1, 8), au moins 1. */
export function poolSize(cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2) {
  return Math.max(1, Math.min(Math.floor(cores) - 1, 8));
}

/**
 * Crée un pool. `run(jobs)` → `{results, ms, workers}` (`workers` = 0 en mode synchrone).
 * Les résultats sont dans l'ordre des tâches.
 */
export function createPool({ size = poolSize(), forceSync = false } = {}) {
  let workers = [];
  if (!forceSync && typeof Worker !== 'undefined') {
    try {
      for (let i = 0; i < size; i++) workers.push(new Worker(new URL('./gl-worker.js', import.meta.url), { type: 'module' }));
    } catch (e) {
      workers.forEach((w) => w.terminate());
      workers = [];
    }
  }
  let disposed = false;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function runSync(jobs) {
    const t0 = now();
    const results = jobs.map((j) => runJob(j));
    return { results, ms: Math.round(now() - t0), workers: 0 };
  }

  async function run(jobs) {
    if (!workers.length || !jobs.length) return runSync(jobs);
    const t0 = now();
    const results = new Array(jobs.length);
    let next = 0; let failed = false;
    await new Promise((resolve) => {
      let pending = jobs.length;
      const done = () => { if (--pending === 0) resolve(); };
      const feed = (w) => {
        if (next >= jobs.length || failed) return;
        const i = next++;
        const onMsg = (ev) => {
          w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr);
          if (ev.data.error) { failed = true; resolve(); return; }
          results[i] = ev.data.res;
          done(); feed(w);
        };
        const onErr = () => {
          w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr);
          failed = true; resolve();
        };
        w.addEventListener('message', onMsg); w.addEventListener('error', onErr);
        w.postMessage({ id: i, job: jobs[i] });
      };
      workers.forEach(feed);
    });
    if (failed || results.some((r) => !r) || disposed) {
      // un worker a échoué (module non chargeable…) : on refait en synchrone et on abandonne le pool
      workers.forEach((w) => w.terminate()); workers = [];
      return runSync(jobs);
    }
    return { results, ms: Math.round(now() - t0), workers: workers.length };
  }

  return {
    get size() { return workers.length; },
    run,
    dispose() { disposed = true; workers.forEach((w) => w.terminate()); workers = []; },
  };
}

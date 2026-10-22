// Jeu hors ligne : enregistrement du service worker (sw.js) qui sert le jeu depuis le téléphone. Le pré-téléchargement des musiques et dessins
// en arrière-plan viendra s'ajouter ici. Tout est inoffensif si le navigateur n'a pas de service worker (file://, navigateur ancien).

/** URL d'enregistrement : le suffixe `?v=<build>` (celui des modules, voir index.html) change à chaque release, donc installe un nouveau service worker. */
export const serviceWorkerUrl = build => `./sw.js?v=${encodeURIComponent(build)}`;

export function canUseServiceWorker(env = globalThis) {
    const nav = env.navigator;
    return Boolean(nav && 'serviceWorker' in nav && env.isSecureContext !== false && env.location && /^https?:$/.test(env.location.protocol));
}

/** Enregistre le service worker ; retourne l'enregistrement, ou null (build inconnu, navigateur sans service worker, échec). Ne lève jamais. */
export async function registerServiceWorker(env = globalThis) {
    const build = String(env.__match3Build || '0');
    if (build === '0' || !canUseServiceWorker(env)) return null;   // '0' : version.js illisible (hors ligne sans cache, file://)
    try {
        return await env.navigator.serviceWorker.register(serviceWorkerUrl(build), { scope: './' });
    } catch (e) {
        return null;
    }
}

/** Enregistre une fois la page chargée, pour ne pas concurrencer le démarrage du jeu. */
export function registerServiceWorkerWhenLoaded(env = globalThis) {
    const doc = env.document;
    if (!doc || doc.readyState === 'complete') return registerServiceWorker(env);
    env.addEventListener('load', () => { registerServiceWorker(env); }, { once: true });
    return Promise.resolve(null);
}

// ── Pré-téléchargement de tout le jeu (≈ 120 Mo de musiques et de dessins) ────────────────────────────────────────────
// Le service worker (sw.js) range dans `match3-media-v1` tout média qu'il voit passer : il suffit donc de demander chaque fichier du manifeste
// (precache-manifest.json). Reprenable (ce qui est déjà en cache avec la bonne empreinte n'est pas redemandé), prudent (quota, hors ligne,
// économiseur de données) et sans effet sur le jeu (2 téléchargements à la fois, en tâche de fond).

export const MEDIA_CACHE = 'match3-media-v1';
export const MANIFEST_URL = './precache-manifest.json';

// Espace laissé libre sur l'appareil : on ne remplit jamais le stockage jusqu'au bout.
const QUOTA_MARGIN = 60e6;

export const formatMegabytes = bytes => `${(bytes / 1e6).toFixed(bytes >= 1e7 ? 0 : 1)} Mo`;

function mediaUrl(env, path) {
    return new URL(path, env.location.href).href;
}

async function readHashes(env, cache) {
    try {
        const res = await cache.match(new URL('__hashes.json', new URL('./', env.location.href)).href);
        return res ? await res.json() : {};
    } catch (e) {
        return {};
    }
}

async function loadManifest(env) {
    const res = await env.fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`manifeste HTTP ${res.status}`);
    return res.json();
}

// Contrôle de la page par le service worker : sans lui, rien ne serait rangé en cache.
async function hasController(env, waitMs = 8000) {
    const sw = env.navigator && env.navigator.serviceWorker;
    if (!sw) return false;
    if (sw.controller) return true;
    return new Promise(resolve => {
        const done = ok => { clearTimeout(timer); sw.removeEventListener && sw.removeEventListener('controllerchange', onChange); resolve(ok); };
        const onChange = () => done(Boolean(sw.controller));
        const timer = setTimeout(() => done(Boolean(sw.controller)), waitMs);
        sw.addEventListener && sw.addEventListener('controllerchange', onChange);
    });
}

/**
 * @returns {{ start, pause, clear, refresh, subscribe, state }} `state` : { phase, total, done, bytesTotal, bytesDone, failed, reason }
 *   phase : 'idle' | 'running' | 'paused' | 'done' | 'partial' | 'unsupported' ; reason (partial/paused/unsupported) : 'quota' | 'errors' | 'offline' | 'not-cached' | 'no-service-worker'
 */
export function createPrefetcher(env = globalThis, { concurrency = 2, retries = 2, retryDelayMs = 1500, settleMs = 400 } = {}) {
    const listeners = new Set();
    let state = { phase: 'idle', total: 0, done: 0, bytesTotal: 0, bytesDone: 0, failed: 0, reason: null };
    let running = null;
    let stopRequested = false;
    let manifest = null;

    const emit = () => { const snapshot = { ...state }; listeners.forEach(fn => { try { fn(snapshot); } catch (e) { /* un écouteur défaillant ne bloque pas le téléchargement */ } }); };
    const set = patch => { state = { ...state, ...patch }; emit(); };
    const hasCaches = () => Boolean(env.caches && env.fetch);

    // Médias déjà en cache (avec l'empreinte du manifeste) : recalcul depuis le cache, source de vérité.
    async function scan() {
        manifest = manifest || await loadManifest(env);
        const cache = await env.caches.open(MEDIA_CACHE);
        const hashes = await readHashes(env, cache);
        const missing = [];
        let done = 0, bytesDone = 0;
        for (const m of manifest.media) {
            const cached = hashes[m.p] === m.h && await cache.match(new URL(m.p, new URL('./', env.location.href)).href);
            if (cached) { done++; bytesDone += m.s; } else missing.push(m);
        }
        return { missing, done, bytesDone, total: manifest.media.length, bytesTotal: manifest.media.reduce((sum, m) => sum + m.s, 0) };
    }

    async function refresh() {
        if (!hasCaches()) { set({ phase: 'unsupported', reason: 'no-service-worker' }); return state; }
        try {
            const s = await scan();
            const complete = s.missing.length === 0;
            set({ total: s.total, done: s.done, bytesTotal: s.bytesTotal, bytesDone: s.bytesDone, failed: 0, reason: null,
                phase: complete ? 'done' : (running ? state.phase : 'idle') });
        } catch (e) { /* hors ligne sans manifeste en cache : l'état précédent reste affiché */ }
        return state;
    }

    async function freeBytes() {
        try {
            const est = env.navigator.storage && await env.navigator.storage.estimate();
            return est && est.quota ? est.quota - (est.usage || 0) : Infinity;
        } catch (e) { return Infinity; }
    }

    async function downloadOne(m) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            if (stopRequested) return false;
            try {
                // `X-Prefetch` : le service worker télécharge et range lui-même le fichier, puis répond 204 sans corps (rien à recevoir sur le thread principal)
                const res = await env.fetch(mediaUrl(env, m.p), { headers: { 'X-Prefetch': '1' } });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                if (res.status !== 204) await res.arrayBuffer();   // ancien service worker : réponse complète, rangée pendant qu'on la lit
                return true;
            } catch (e) {
                if (attempt < retries) await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)));
            }
        }
        return false;
    }

    async function run() {
        stopRequested = false;
        if (!hasCaches() || !(await hasController(env))) { set({ phase: 'unsupported', reason: 'no-service-worker' }); return; }
        if (env.navigator.onLine === false) { set({ phase: 'paused', reason: 'offline' }); return; }
        try { env.navigator.storage && env.navigator.storage.persist && env.navigator.storage.persist(); } catch (e) { /* demande facultative */ }
        let s;
        try { s = await scan(); } catch (e) { set({ phase: 'paused', reason: 'offline' }); return; }
        set({ phase: 'running', reason: null, total: s.total, done: s.done, bytesTotal: s.bytesTotal, bytesDone: s.bytesDone, failed: 0 });
        if (s.missing.length === 0) { set({ phase: 'done' }); return; }

        // Quota : on prend dans l'ordre du manifeste (petits dessins, puis musiques) tant qu'il reste de la place, marge comprise
        let budget = (await freeBytes()) - QUOTA_MARGIN;
        const queue = [];
        let truncated = false;
        for (const m of s.missing) {
            if (m.s > budget) { truncated = true; continue; }
            budget -= m.s;
            queue.push(m);
        }

        let failed = 0;
        const worker = async () => {
            while (queue.length && !stopRequested) {
                if (env.navigator.onLine === false) { stopRequested = true; set({ phase: 'paused', reason: 'offline' }); return; }
                const m = queue.shift();
                if (await downloadOne(m)) set({ done: state.done + 1, bytesDone: state.bytesDone + m.s });
                else { failed++; set({ failed }); }
            }
        };
        await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

        if (stopRequested) { if (state.phase === 'running') set({ phase: 'paused', reason: 'pause' }); return; }
        // Le service worker range la copie et note l'empreinte un instant après la fin de lecture : on relit le cache quelques fois avant de conclure
        let after = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            after = await scan().catch(() => null);
            if (!after || after.missing.length === 0) break;
            await new Promise(resolve => setTimeout(resolve, settleMs));
        }
        if (after && after.missing.length === 0) set({ phase: 'done', reason: null, done: after.done, bytesDone: after.bytesDone, failed: 0 });
        else set({ phase: 'partial', reason: truncated ? 'quota' : failed ? 'errors' : 'not-cached' });
    }

    return {
        get state() { return { ...state }; },
        subscribe(fn) { listeners.add(fn); fn({ ...state }); return () => listeners.delete(fn); },
        refresh,
        /** Lance (ou reprend) le téléchargement ; une seule exécution à la fois. */
        start() {
            if (!running) running = run().catch(() => set({ phase: 'partial', reason: 'errors' })).finally(() => { running = null; });
            return running;
        },
        pause() { stopRequested = true; return running || Promise.resolve(); },
        /** Supprime les médias téléchargés (le cœur du jeu reste, le jeu continue de fonctionner en ligne). */
        async clear() {
            await this.pause();
            if (hasCaches()) await env.caches.delete(MEDIA_CACHE);
            manifest = null;
            set({ phase: 'idle', done: 0, bytesDone: 0, failed: 0, reason: null });
            return refresh();
        }
    };
}

/**
 * Démarre le téléchargement en arrière-plan une fois la page chargée et le navigateur au repos, sauf économiseur de données (l'utilisateur peut
 * alors le lancer à la main depuis les Options). Reprend tout seul au retour du réseau.
 */
export function startBackgroundPrefetch(prefetcher, env = globalThis, { idleDelayMs = 8000 } = {}) {
    const conn = env.navigator && (env.navigator.connection || env.navigator.mozConnection);
    const saveData = Boolean(conn && conn.saveData);
    const launch = () => { if (!saveData && env.navigator.onLine !== false) prefetcher.start(); };
    const schedule = () => (env.requestIdleCallback ? env.requestIdleCallback(launch, { timeout: idleDelayMs }) : setTimeout(launch, idleDelayMs));
    if (env.addEventListener) env.addEventListener('online', () => { if (!saveData && prefetcher.state.phase === 'paused' && prefetcher.state.reason === 'offline') prefetcher.start(); });
    const run = () => { prefetcher.refresh().then(schedule); };
    if (!env.document || env.document.readyState === 'complete') run();
    else env.addEventListener('load', run, { once: true });
}

const REASONS = {
    quota: 'espace insuffisant sur l\'appareil', errors: 'certains fichiers n\'ont pas pu être téléchargés', offline: 'en attente du réseau',
    pause: 'en pause', 'not-cached': 'téléchargement non conservé', 'no-service-worker': 'indisponible sur ce navigateur'
};

/** Libellé et action du bouton « Jeu hors ligne » des Options pour un état donné. */
export function describeOffline(state) {
    const part = `${formatMegabytes(state.bytesDone)} / ${formatMegabytes(state.bytesTotal)}`;
    const percent = state.bytesTotal ? Math.floor(100 * state.bytesDone / state.bytesTotal) : 0;
    switch (state.phase) {
        case 'done': return { text: `Prêt hors ligne (${formatMegabytes(state.bytesTotal)})`, button: 'Supprimer', action: 'clear' };
        case 'running': return { text: `Téléchargement ${percent} % (${part})`, button: 'Pause', action: 'pause' };
        case 'paused': return { text: `${state.reason === 'offline' ? 'En attente du réseau' : 'En pause'} (${part})`, button: 'Reprendre', action: 'start' };
        case 'partial': return { text: `Incomplet : ${REASONS[state.reason] || 'erreur'} (${part})`, button: 'Réessayer', action: 'start' };
        case 'unsupported': return { text: 'Indisponible sur ce navigateur', button: null, action: null };
        default: return { text: state.bytesTotal ? `Non téléchargé (${part})` : 'Non téléchargé', button: 'Télécharger', action: 'start' };
    }
}

/** Relie l'état du pré-téléchargement à la ligne « Jeu hors ligne » des Options (statut + bouton). */
export function bindOfflineOptions(prefetcher, statusEl, buttonEl) {
    if (!statusEl || !buttonEl) return () => {};
    let action = null;
    const unsubscribe = prefetcher.subscribe(state => {
        const d = describeOffline(state);
        statusEl.textContent = d.text;
        buttonEl.hidden = !d.button;
        buttonEl.textContent = d.button || '';
        action = d.action;
    });
    buttonEl.addEventListener('click', () => { if (action && prefetcher[action]) prefetcher[action](); });
    return unsubscribe;
}

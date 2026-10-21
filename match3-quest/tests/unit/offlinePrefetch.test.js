import { FakeCaches } from './fixtures/fakeCaches.js';
import { createPrefetcher, startBackgroundPrefetch, describeOffline, bindOfflineOptions, formatMegabytes, MEDIA_CACHE } from '../../offlineCache.js';

const SCOPE = 'https://site.test/match3-quest/';
const MEDIA = [
    { p: 'sprites/spellfx/a.png', s: 30e6, h: 'ha' },
    { p: 'sprites/ultimates/b.png', s: 30e6, h: 'hb' },
    { p: 'audio/music/c.mp3', s: 30e6, h: 'hc' }
];
const manifest = media => ({ version: 1, core: [], media });

// Faux environnement de page : réseau, Cache Storage, service worker (qui range ce qu'il voit passer, comme sw.js), stockage et connexion.
function makeEnv({ media = MEDIA, online = true, controller = true, quota = Infinity, usage = 0, saveData = false, swCaches = true, failures = {}, legacySw = false } = {}) {
    const caches = new FakeCaches();
    const calls = [];
    const prefetchHeaders = [];   // en-tête X-Prefetch de chaque téléchargement
    const statuses = [];          // statut de chaque réponse de média (204 = le service worker a tout fait)
    const stats = { inflight: 0, maxInflight: 0, hold: null };
    const attempts = {};
    const env = {
        calls, stats, caches,
        location: { href: `${SCOPE}index.html` },
        navigator: {
            onLine: online,
            serviceWorker: controller ? { controller: {} } : { controller: null, addEventListener() {}, removeEventListener() {} },
            storage: { estimate: async () => ({ quota, usage }), persist: async () => true },
            connection: { saveData }
        },
        fetch: async (input, init = {}) => {
            const url = new URL(input, SCOPE).href;
            if (url.endsWith('precache-manifest.json')) return new Response(JSON.stringify(manifest(media)));
            calls.push(url);
            prefetchHeaders.push(init.headers && init.headers['X-Prefetch']);
            stats.inflight++; stats.maxInflight = Math.max(stats.maxInflight, stats.inflight);
            try {
                await new Promise(resolve => setImmediate(resolve));
                if (stats.hold) await stats.hold(url);
                const path = url.slice(SCOPE.length);
                attempts[path] = (attempts[path] || 0) + 1;
                if ((failures[path] || 0) >= attempts[path]) throw new TypeError('Failed to fetch');
                const entry = media.find(m => m.p === path);
                if (!entry) return new Response('absent', { status: 404 });
                if (swCaches) {
                    const cache = await caches.open(MEDIA_CACHE);
                    await cache.put(url, new Response('x'));
                    const hashesKey = `${SCOPE}__hashes.json`;
                    const hashes = (await cache.match(hashesKey)) ? await (await cache.match(hashesKey)).json() : {};
                    hashes[path] = entry.h;
                    await cache.put(hashesKey, new Response(JSON.stringify(hashes)));
                }
                // nouveau service worker : il a tout fait, réponse 204 sans corps ; ancien : le fichier complet
                const res = init.headers && init.headers['X-Prefetch'] && !legacySw ? new Response(null, { status: 204 }) : new Response('x');
                statuses.push(res.status);
                return res;
            } finally { stats.inflight--; }
        }
    };
    env.attempts = attempts;
    env.prefetchHeaders = prefetchHeaders;
    env.statuses = statuses;
    return env;
}

const quick = { retryDelayMs: 0, settleMs: 0 };
const seed = async (env, items) => {
    const cache = await env.caches.open(MEDIA_CACHE);
    const hashes = {};
    for (const m of items) { await cache.put(`${SCOPE}${m.p}`, new Response('x')); hashes[m.p] = m.h; }
    await cache.put(`${SCOPE}__hashes.json`, new Response(JSON.stringify(hashes)));
};

describe('createPrefetcher', () => {
    test('refresh : compte ce qui est déjà en cache avec la bonne empreinte', async () => {
        const env = makeEnv();
        await seed(env, [MEDIA[0]]);
        const cache = await env.caches.open(MEDIA_CACHE);
        const hashes = JSON.parse((await (await cache.match(`${SCOPE}__hashes.json`)).text()));
        hashes['sprites/ultimates/b.png'] = 'ANCIENNE';   // présent mais périmé : à retélécharger
        await cache.put(`${SCOPE}sprites/ultimates/b.png`, new Response('vieux'));
        await cache.put(`${SCOPE}__hashes.json`, new Response(JSON.stringify(hashes)));
        const pf = createPrefetcher(env, quick);
        const s = await pf.refresh();
        expect(s).toMatchObject({ phase: 'idle', total: 3, done: 1, bytesDone: 30e6, bytesTotal: 90e6 });
        await seed(env, MEDIA);
        expect((await pf.refresh()).phase).toBe('done');
    });

    test('start : télécharge seulement ce qui manque, dans l\'ordre du manifeste, 2 à la fois, progression croissante', async () => {
        const env = makeEnv();
        await seed(env, [MEDIA[0]]);
        const pf = createPrefetcher(env, quick);
        const seen = [];
        pf.subscribe(s => seen.push(s.bytesDone));
        await pf.start();
        expect(env.calls).toEqual([`${SCOPE}sprites/ultimates/b.png`, `${SCOPE}audio/music/c.mp3`]);
        expect(env.stats.maxInflight).toBeLessThanOrEqual(2);
        expect(pf.state).toMatchObject({ phase: 'done', done: 3, bytesDone: 90e6, failed: 0 });
        expect(seen).toEqual([...seen].sort((a, b) => a - b));
        // déjà tout en cache : rien à refaire
        env.calls.length = 0;
        await pf.start();
        expect(env.calls).toEqual([]);
        expect(pf.state.phase).toBe('done');
    });

    test('chaque téléchargement est confié au service worker (en-tête X-Prefetch) : la page ne reçoit aucun corps', async () => {
        const env = makeEnv();
        const pf = createPrefetcher(env, quick);
        await pf.start();
        expect(env.prefetchHeaders).toEqual(['1', '1', '1']);
        expect(env.statuses).toEqual([204, 204, 204]);
        expect(pf.state).toMatchObject({ phase: 'done', done: 3, failed: 0 });
    });

    test('ancien service worker (réponse complète au lieu de 204) : le fichier est lu en entier et le téléchargement aboutit', async () => {
        const env = makeEnv({ legacySw: true });
        const pf = createPrefetcher(env, quick);
        await pf.start();
        expect(env.statuses).toEqual([200, 200, 200]);
        expect(pf.state).toMatchObject({ phase: 'done', done: 3, failed: 0 });
    });

    test('une seule exécution à la fois', async () => {
        const env = makeEnv();
        const pf = createPrefetcher(env, quick);
        const a = pf.start(), b = pf.start();
        expect(a).toBe(b);
        await a;
        expect(env.calls.length).toBe(3);
    });

    test('quota : ne dépasse jamais l\'espace libre moins la marge, et le dit', async () => {
        const none = makeEnv({ quota: 200e6, usage: 150e6 });   // 50 Mo libres < marge de 60 Mo
        const pfNone = createPrefetcher(none, quick);
        await pfNone.start();
        expect(none.calls).toEqual([]);
        expect(pfNone.state).toMatchObject({ phase: 'partial', reason: 'quota', done: 0 });

        const some = makeEnv({ quota: 260e6, usage: 130e6 });   // 130 Mo libres - 60 Mo de marge = 70 Mo : deux fichiers de 30 Mo
        const pfSome = createPrefetcher(some, quick);
        await pfSome.start();
        expect(some.calls.length).toBe(2);
        expect(pfSome.state).toMatchObject({ phase: 'partial', reason: 'quota', done: 2 });
    });

    test('nouvelles tentatives sur erreur réseau ; un fichier définitivement en échec n\'arrête pas les autres', async () => {
        const env = makeEnv({ failures: { 'sprites/ultimates/b.png': 2, 'audio/music/c.mp3': 99 } });
        const pf = createPrefetcher(env, { ...quick, retries: 2 });
        await pf.start();
        expect(env.attempts['sprites/ultimates/b.png']).toBe(3);   // 2 échecs puis succès
        expect(env.attempts['audio/music/c.mp3']).toBe(3);         // abandonné après 1 essai + 2 reprises
        expect(pf.state).toMatchObject({ phase: 'partial', reason: 'errors', done: 2, failed: 1 });
    });

    test('un 404 compte comme un échec', async () => {
        const env = makeEnv({ media: [...MEDIA, { p: 'audio/music/inconnu.mp3', s: 1e6, h: 'hx' }] });
        env.fetch = (orig => async (input, init) => {
            const url = new URL(input, SCOPE).href;
            if (url.endsWith('inconnu.mp3')) { env.calls.push(url); return new Response('absent', { status: 404 }); }
            return orig(input, init);
        })(env.fetch);
        const pf = createPrefetcher(env, { ...quick, retries: 0 });
        await pf.start();
        expect(pf.state).toMatchObject({ phase: 'partial', reason: 'errors', failed: 1, done: 3 });
    });

    test('sans service worker qui contrôle la page : rien n\'est téléchargé (il ne serait pas conservé)', async () => {
        const env = makeEnv({ controller: false });
        const pf = createPrefetcher(env, quick);
        // le délai d'attente du contrôle est de 8 s : on le court-circuite
        const realSetTimeout = global.setTimeout;
        global.setTimeout = (fn, ms) => realSetTimeout(fn, ms === 8000 ? 0 : ms);
        try { await pf.start(); } finally { global.setTimeout = realSetTimeout; }
        expect(env.calls).toEqual([]);
        expect(pf.state).toMatchObject({ phase: 'unsupported', reason: 'no-service-worker' });
    });

    test('téléchargement non conservé par le service worker : annoncé, pas faussement « prêt »', async () => {
        const env = makeEnv({ swCaches: false });
        const pf = createPrefetcher(env, quick);
        await pf.start();
        expect(pf.state).toMatchObject({ phase: 'partial', reason: 'not-cached' });
    });

    test('hors ligne : en pause sans rien demander ; reprise automatique au retour du réseau', async () => {
        const env = makeEnv({ online: false });
        const pf = createPrefetcher(env, quick);
        const listeners = {};
        const page = { ...env, document: { readyState: 'complete' }, addEventListener: (t, fn) => { listeners[t] = fn; }, requestIdleCallback: fn => fn() };
        startBackgroundPrefetch(pf, page, { idleDelayMs: 0 });
        await new Promise(resolve => setImmediate(resolve));
        await pf.start();
        expect(env.calls).toEqual([]);
        expect(pf.state).toMatchObject({ phase: 'paused', reason: 'offline' });
        env.navigator.onLine = true;
        listeners.online();
        await pf.start();
        expect(pf.state.phase).toBe('done');
        expect(env.calls.length).toBe(3);
    });

    test('pause puis reprise : les fichiers déjà reçus ne sont pas redemandés', async () => {
        const env = makeEnv();
        let release;
        env.stats.hold = () => new Promise(resolve => { release = resolve; });
        const pf = createPrefetcher(env, { ...quick, concurrency: 1 });
        const run = pf.start();
        while (!release) await new Promise(resolve => setImmediate(resolve));   // un téléchargement est en cours
        const paused = pf.pause();
        release(); env.stats.hold = null;
        await paused; await run;
        expect(pf.state).toMatchObject({ phase: 'paused', reason: 'pause' });
        const firstRound = env.calls.length;
        expect(firstRound).toBeLessThan(3);
        await pf.start();
        expect(pf.state.phase).toBe('done');
        expect(env.calls.length).toBe(3);   // chaque fichier une seule fois au total
    });

    test('clear : supprime les médias téléchargés et revient à « non téléchargé »', async () => {
        const env = makeEnv();
        const pf = createPrefetcher(env, quick);
        await pf.start();
        expect(pf.state.phase).toBe('done');
        const s = await pf.clear();
        expect((await env.caches.open(MEDIA_CACHE)).map.size).toBe(0);   // (ouvrir un cache le recrée vide, comme la vraie API)
        expect(s).toMatchObject({ phase: 'idle', done: 0, bytesDone: 0 });
    });
});

describe('startBackgroundPrefetch', () => {
    const page = (env, over = {}) => ({ ...env, document: { readyState: 'complete' }, addEventListener() {}, requestIdleCallback: fn => fn(), ...over });

    test('démarre tout seul quand la page est chargée et le navigateur au repos', async () => {
        const env = makeEnv();
        const pf = createPrefetcher(env, quick);
        startBackgroundPrefetch(pf, page(env), { idleDelayMs: 0 });
        await new Promise(resolve => setTimeout(resolve, 30));
        await pf.start();
        expect(pf.state.phase).toBe('done');
    });

    test('économiseur de données : ne démarre pas tout seul (l\'utilisateur peut le lancer depuis les Options)', async () => {
        const env = makeEnv({ saveData: true });
        const pf = createPrefetcher(env, quick);
        startBackgroundPrefetch(pf, page(env), { idleDelayMs: 0 });
        await new Promise(resolve => setTimeout(resolve, 30));
        expect(env.calls).toEqual([]);
        expect(pf.state.phase).toBe('idle');
        await pf.start();
        expect(pf.state.phase).toBe('done');
    });

    test('attend la fin du chargement de la page', async () => {
        const env = makeEnv();
        const pf = createPrefetcher(env, quick);
        const handlers = {};
        startBackgroundPrefetch(pf, page(env, { document: { readyState: 'loading' }, addEventListener: (t, fn) => { handlers[t] = fn; } }), { idleDelayMs: 0 });
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(env.calls).toEqual([]);
        handlers.load();
        await new Promise(resolve => setTimeout(resolve, 40));
        expect(env.calls.length).toBe(3);
    });
});

describe('interface des Options', () => {
    test('libellés et boutons selon l\'état', () => {
        const base = { total: 3, bytesTotal: 90e6, bytesDone: 45e6, done: 1, failed: 0, reason: null };
        expect(describeOffline({ ...base, phase: 'idle', bytesDone: 0 })).toMatchObject({ text: 'Non téléchargé (0.0 Mo / 90 Mo)', button: 'Télécharger', action: 'start' });
        expect(describeOffline({ ...base, phase: 'running' })).toMatchObject({ text: 'Téléchargement 50 % (45 Mo / 90 Mo)', button: 'Pause', action: 'pause' });
        expect(describeOffline({ ...base, phase: 'paused', reason: 'offline' })).toMatchObject({ text: 'En attente du réseau (45 Mo / 90 Mo)', button: 'Reprendre', action: 'start' });
        expect(describeOffline({ ...base, phase: 'partial', reason: 'quota' }).text).toContain('espace insuffisant');
        expect(describeOffline({ ...base, phase: 'partial', reason: 'errors' })).toMatchObject({ button: 'Réessayer', action: 'start' });
        expect(describeOffline({ ...base, phase: 'done', bytesDone: 90e6 })).toMatchObject({ text: 'Prêt hors ligne (90 Mo)', button: 'Supprimer', action: 'clear' });
        expect(describeOffline({ ...base, phase: 'unsupported' })).toMatchObject({ button: null, action: null });
        expect(formatMegabytes(119.6e6)).toBe('120 Mo');
        expect(formatMegabytes(4.9e6)).toBe('4.9 Mo');
    });

    test('bindOfflineOptions : le statut suit l\'état et le bouton déclenche l\'action courante', async () => {
        const env = makeEnv();
        const pf = createPrefetcher(env, quick);
        const statusEl = { textContent: '' };
        const handlers = [];
        const buttonEl = { hidden: true, textContent: '', addEventListener: (t, fn) => handlers.push(fn) };
        bindOfflineOptions(pf, statusEl, buttonEl);
        expect(statusEl.textContent).toBe('Non téléchargé');
        expect(buttonEl).toMatchObject({ hidden: false, textContent: 'Télécharger' });
        handlers[0]();   // clic : lance le téléchargement
        await pf.start();
        expect(statusEl.textContent).toBe('Prêt hors ligne (90 Mo)');
        expect(buttonEl.textContent).toBe('Supprimer');
        handlers[0]();   // clic : supprime
        await new Promise(resolve => setTimeout(resolve, 30));
        expect(pf.state.phase).toBe('idle');
        expect(bindOfflineOptions(pf, null, null)).toEqual(expect.any(Function));   // éléments absents : sans effet
    });
});

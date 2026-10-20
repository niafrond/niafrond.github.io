import { readFileSync } from 'fs';
import vm from 'vm';
import { registerServiceWorker, registerServiceWorkerWhenLoaded, serviceWorkerUrl, canUseServiceWorker } from '../../offlineCache.js';

// sw.js est exécuté tel quel dans un faux environnement de worker (caches, réseau et minuteries simulés).
const SW_CODE = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://site.test';
const SCOPE = `${ORIGIN}/match3-quest/`;

class FakeCache {
    constructor() { this.map = new Map(); }
    keyOf(req) { return typeof req === 'string' ? req : req.url; }
    async put(req, res) { this.map.set(this.keyOf(req), { body: Buffer.from(await res.arrayBuffer()), status: res.status, headers: [...res.headers] }); }
    async match(req, opts = {}) {
        const key = this.keyOf(req);
        let hit = this.map.get(key);
        if (!hit && opts.ignoreSearch) for (const [k, v] of this.map) if (k.split('?')[0] === key.split('?')[0]) { hit = v; break; }
        return hit ? new Response(hit.body, { status: hit.status, headers: hit.headers }) : undefined;
    }
    async delete(req) { return this.map.delete(this.keyOf(req)); }
    text(key) { return this.map.has(key) ? this.map.get(key).body.toString() : undefined; }
}
class FakeCaches {
    constructor() { this.stores = new Map(); }
    async open(name) { if (!this.stores.has(name)) this.stores.set(name, new FakeCache()); return this.stores.get(name); }
    async keys() { return [...this.stores.keys()]; }
    async delete(name) { return this.stores.delete(name); }
}

const MANIFEST = {
    version: 1,
    core: ['index.html', 'game.js', 'style.css', 'sprites/generated.js'],
    media: [{ p: 'audio/music/a.mp3', s: 10, h: 'h1' }, { p: 'sprites/ultimates/x.png', s: 3, h: 'h2' }]
};

function loadSw({ build = 'B1', files = {} } = {}) {
    const server = { online: true, hold: null, calls: [], files: {
        [`${SCOPE}precache-manifest.json`]: JSON.stringify(MANIFEST),
        [`${SCOPE}index.html`]: 'INDEX',
        [`${ORIGIN}/version.js`]: 'VERSION',
        ...Object.fromEntries(MANIFEST.core.filter(p => p !== 'index.html').map(p => [`${SCOPE}${p}`, `CORE:${p}`])),
        [`${SCOPE}audio/music/a.mp3`]: '0123456789',
        [`${SCOPE}sprites/ultimates/x.png`]: 'PNG',
        ...files
    } };
    const caches = new FakeCaches();
    const timers = [];
    const listeners = {};
    const state = { skipped: false, claimed: false };
    const sandbox = {
        URL, Response, Headers, Promise, Buffer, JSON, Object, Array, Math, parseInt, String, RegExp, Error, Date,
        caches,
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        clearTimeout: id => { if (timers[id - 1]) timers[id - 1].fn = null; },
        fetch: async (input, init = {}) => {
            const requested = new URL(typeof input === 'string' ? input : input.url, SCOPE);
            server.calls.push({ url: requested.href, init });
            if (server.hold) await server.hold;
            if (!server.online) throw new TypeError('Failed to fetch');
            // comme un serveur de fichiers statiques : la requête de dossier sert index.html, la query string est ignorée
            const path = requested.pathname.endsWith('/') ? `${requested.pathname}index.html` : requested.pathname;
            const url = `${requested.origin}${path}`;
            const body = server.files[url];
            if (body === undefined) return new Response('absent', { status: 404 });
            const res = new Response(body, { status: 200 });
            if (server.redirected && server.redirected.has(url)) Object.defineProperty(res, 'redirected', { value: true });   // comme `serve` : index.html → /index
            return res;
        }
    };
    sandbox.self = {
        location: { href: `${SCOPE}sw.js?v=${build}`, origin: ORIGIN },
        registration: { scope: SCOPE },
        addEventListener: (type, fn) => { listeners[type] = fn; },
        skipWaiting: () => { state.skipped = true; return Promise.resolve(); },
        clients: { claim: () => { state.claimed = true; return Promise.resolve(); } }
    };
    vm.runInNewContext(SW_CODE, sandbox, { filename: 'sw.js' });
    const lifecycle = async type => { let p; listeners[type]({ waitUntil: x => { p = x; } }); await p; };
    const request = (path, { headers = {}, mode = 'cors', method = 'GET' } = {}) => ({
        url: path.startsWith('http') ? path : `${SCOPE}${path}`, method, mode, headers: new Headers(headers)
    });
    // null si le service worker laisse passer la requête (pas de respondWith)
    const fetchEvent = req => { let p = null; listeners.fetch({ request: req, respondWith: x => { p = Promise.resolve(x); } }); return p; };
    const firePendingTimers = () => timers.forEach(t => { if (t.fn) { const fn = t.fn; t.fn = null; fn(); } });
    const flush = () => new Promise(resolve => setImmediate(resolve));
    return { server, caches, listeners, state, lifecycle, request, fetchEvent, firePendingTimers, flush, timers };
}

describe('sw.js — installation et activation', () => {
    test('installe le cœur, le manifeste et version.js dans un cache propre au build, puis prend la main', async () => {
        const sw = loadSw({ build: 'B1' });
        await sw.lifecycle('install');
        const core = await sw.caches.open('match3-core-vB1');
        [...MANIFEST.core.map(p => `${SCOPE}${p}`), `${SCOPE}precache-manifest.json`, `${ORIGIN}/version.js`].forEach(key => expect(core.map.has(key)).toBe(true));
        expect(core.text(`${SCOPE}game.js`)).toBe('CORE:game.js');
        expect(sw.state.skipped).toBe(true);
        // les médias ne sont pas téléchargés à l'installation
        expect(sw.server.calls.some(c => c.url.includes('/audio/music/'))).toBe(false);
    });

    test('une réponse redirigée (serveur qui réécrit index.html) est rangée sans la marque « redirected », sinon elle ne pourrait pas servir une navigation', async () => {
        const sw = loadSw();
        sw.server.redirected = new Set([`${SCOPE}index.html`]);
        await sw.lifecycle('install');
        const core = await sw.caches.open('match3-core-vB1');
        const stored = await core.match(`${SCOPE}index.html`);
        expect(await stored.text()).toBe('INDEX');
        expect(stored.redirected).toBe(false);
        // et la mise à jour par le réseau (page d'accueil) fait de même
        sw.server.files[`${SCOPE}index.html`] = 'INDEX-2';
        await (await sw.fetchEvent(sw.request(SCOPE, { mode: 'navigate' }))).text();
        await sw.flush(); await sw.flush();
        expect((await core.match(`${SCOPE}index.html`)).redirected).toBe(false);
        expect(core.text(`${SCOPE}index.html`)).toBe('INDEX-2');
    });

    test('un fichier du cœur manquant fait échouer l\'installation (l\'ancienne version reste active)', async () => {
        const sw = loadSw({ files: { [`${SCOPE}game.js`]: undefined } });
        delete sw.server.files[`${SCOPE}game.js`];
        await expect(sw.lifecycle('install')).rejects.toThrow(/404/);
        expect(sw.state.skipped).toBe(false);
    });

    test('met à jour les médias déjà en cache dont l\'empreinte a changé et retire ceux qui ne sont plus au manifeste', async () => {
        const sw = loadSw();
        const media = await sw.caches.open('match3-media-v1');
        await media.put(`${SCOPE}audio/music/a.mp3`, new Response('old'));
        await media.put(`${SCOPE}audio/music/gone.mp3`, new Response('gone'));
        await media.put(`${SCOPE}sprites/ultimates/x.png`, new Response('PNG'));
        await media.put(`${SCOPE}__hashes.json`, new Response(JSON.stringify({ 'audio/music/a.mp3': 'OLD', 'audio/music/gone.mp3': 'g', 'sprites/ultimates/x.png': 'h2' })));
        await sw.lifecycle('install');
        expect(media.text(`${SCOPE}audio/music/a.mp3`)).toBe('0123456789');
        expect(media.map.has(`${SCOPE}audio/music/gone.mp3`)).toBe(false);
        expect(JSON.parse(media.text(`${SCOPE}__hashes.json`))).toEqual({ 'audio/music/a.mp3': 'h1', 'sprites/ultimates/x.png': 'h2' });
        // le dessin à jour n'est pas retéléchargé
        expect(sw.server.calls.filter(c => c.url.endsWith('x.png')).length).toBe(0);
    });

    test('l\'activation supprime les anciens caches du cœur, garde le cache média et prend le contrôle des pages', async () => {
        const sw = loadSw({ build: 'B2' });
        for (const name of ['match3-core-vB1', 'match3-core-vB2', 'match3-media-v1', 'autre-app']) await sw.caches.open(name);
        await sw.lifecycle('activate');
        expect([...sw.caches.stores.keys()].sort()).toEqual(['autre-app', 'match3-core-vB2', 'match3-media-v1']);
        expect(sw.state.claimed).toBe(true);
    });
});

describe('sw.js — requêtes', () => {
    const installed = async opts => { const sw = loadSw(opts); await sw.lifecycle('install'); sw.server.calls.length = 0; return sw; };

    test('ignore ce qui n\'est pas du jeu : autre méthode, autre origine, autre application du site', async () => {
        const sw = await installed();
        expect(sw.fetchEvent(sw.request('game.js', { method: 'POST' }))).toBeNull();
        expect(sw.fetchEvent(sw.request('https://cdn.test/lib.js'))).toBeNull();
        expect(sw.fetchEvent(sw.request(`${ORIGIN}/dj-mix/index.html`))).toBeNull();
    });

    test('cœur : servi depuis le cache sans réseau, quel que soit le suffixe ?v= du build courant', async () => {
        const sw = await installed();
        sw.server.online = false;
        const res = await sw.fetchEvent(sw.request('game.js?v=B1'));
        expect(await res.text()).toBe('CORE:game.js');
        expect(sw.server.calls.length).toBe(0);
    });

    test('une URL ?v= d\'un autre build va au réseau (pas de mélange de versions en ligne), et ne retombe sur le cache que hors ligne', async () => {
        const sw = await installed();
        sw.server.files[`${SCOPE}game.js`] = 'CORE-PLUS-RECENT';
        const online = await sw.fetchEvent(sw.request('game.js?v=AUTRE'));
        expect(await online.text()).toBe('CORE-PLUS-RECENT');
        expect(sw.server.calls.length).toBe(1);
        sw.server.online = false;
        const offline = await sw.fetchEvent(sw.request('game.js?v=AUTRE'));
        expect(await offline.text()).toBe('CORE:game.js');
    });

    test('page d\'accueil : réseau d\'abord (mise à jour du cache), hors ligne repli sur le cache', async () => {
        const sw = await installed();
        sw.server.files[`${SCOPE}index.html`] = 'INDEX-2';
        const online = await sw.fetchEvent(sw.request(SCOPE, { mode: 'navigate' }));
        expect(await online.text()).toBe('INDEX-2');
        await sw.flush();
        expect((await sw.caches.open('match3-core-vB1')).text(`${SCOPE}index.html`)).toBe('INDEX-2');
        sw.server.online = false;
        const offline = await sw.fetchEvent(sw.request('index.html', { mode: 'navigate' }));
        expect(await offline.text()).toBe('INDEX-2');
    });

    test('réseau lent : après le délai, la page d\'accueil vient du cache, puis le cache se met à jour avec la réponse tardive', async () => {
        const sw = await installed();
        let release; sw.server.hold = new Promise(r => { release = r; });
        sw.server.files[`${SCOPE}index.html`] = 'INDEX-NEUF';
        const pending = sw.fetchEvent(sw.request(SCOPE, { mode: 'navigate' }));
        await sw.flush();
        sw.firePendingTimers();
        expect(await (await pending).text()).toBe('INDEX');
        release();
        await sw.flush(); await sw.flush();
        expect((await sw.caches.open('match3-core-vB1')).text(`${SCOPE}index.html`)).toBe('INDEX-NEUF');
    });

    test('version.js : réseau d\'abord, repli sur le cache hors ligne', async () => {
        const sw = await installed();
        sw.server.files[`${ORIGIN}/version.js`] = 'VERSION-2';
        expect(await (await sw.fetchEvent(sw.request(`${ORIGIN}/version.js`))).text()).toBe('VERSION-2');
        sw.server.online = false;
        expect(await (await sw.fetchEvent(sw.request(`${ORIGIN}/version.js`))).text()).toBe('VERSION-2');
    });

    test('hors ligne et rien en cache : erreur réseau (pas de réponse inventée)', async () => {
        const sw = loadSw();
        sw.server.online = false;
        const res = await sw.fetchEvent(sw.request('index.html', { mode: 'navigate' }));
        expect(res.type).toBe('error');
    });

    test('médias : réseau une fois, puis cache (clé sans ?v=), empreinte du manifeste mémorisée', async () => {
        const sw = await installed();
        const first = await sw.fetchEvent(sw.request('audio/music/a.mp3?v=B1'));
        expect(await first.text()).toBe('0123456789');
        await sw.flush(); await sw.flush();
        const media = await sw.caches.open('match3-media-v1');
        expect(media.text(`${SCOPE}audio/music/a.mp3`)).toBe('0123456789');
        expect(JSON.parse(media.text(`${SCOPE}__hashes.json`))).toEqual({ 'audio/music/a.mp3': 'h1' });
        sw.server.online = false;
        sw.server.calls.length = 0;
        const again = await sw.fetchEvent(sw.request('audio/music/a.mp3?v=AUTRE'));   // le média ne change qu'avec son empreinte
        expect(await again.text()).toBe('0123456789');
        expect(sw.server.calls.length).toBe(0);
    });

    test('médias : un 404 n\'est pas mis en cache', async () => {
        const sw = await installed();
        const res = await sw.fetchEvent(sw.request('sprites/ultimates/inconnu.png'));
        expect(res.status).toBe(404);
        await sw.flush();
        expect((await sw.caches.open('match3-media-v1')).map.has(`${SCOPE}sprites/ultimates/inconnu.png`)).toBe(false);
    });

    test('médias : lectures partielles (Range) servies depuis le cache, absentes du cache → réseau sans rien stocker', async () => {
        const sw = await installed();
        await (await sw.fetchEvent(sw.request('audio/music/a.mp3'))).text();
        await sw.flush(); await sw.flush();
        const part = async range => sw.fetchEvent(sw.request('audio/music/a.mp3', { headers: { Range: range } })).then(r => r);
        const mid = await part('bytes=2-5');
        expect(mid.status).toBe(206);
        expect(await mid.text()).toBe('2345');
        expect(mid.headers.get('Content-Range')).toBe('bytes 2-5/10');
        expect(await (await part('bytes=7-')).text()).toBe('789');
        expect(await (await part('bytes=-3')).text()).toBe('789');
        expect((await part('bytes=20-30')).status).toBe(416);

        const other = await installed();
        const res = await other.fetchEvent(other.request('audio/music/a.mp3', { headers: { Range: 'bytes=0-3' } }));
        expect(res.status).toBe(200);   // le faux réseau ignore Range : on vérifie surtout l'absence de mise en cache
        await other.flush();
        expect((await other.caches.open('match3-media-v1')).map.has(`${SCOPE}audio/music/a.mp3`)).toBe(false);
    });
});

describe('offlineCache.js — enregistrement', () => {
    const env = (over = {}) => {
        const calls = [];
        return {
            calls,
            __match3Build: '20261020201631854',
            isSecureContext: true,
            location: { protocol: 'https:' },
            navigator: { serviceWorker: { register: async (...a) => { calls.push(a); return { scope: 'x' }; } } },
            ...over
        };
    };

    test('l\'URL porte le build, donc chaque release installe un nouveau service worker', () => {
        expect(serviceWorkerUrl('20261020201631854')).toBe('./sw.js?v=20261020201631854');
    });

    test('enregistre sw.js avec la portée du dossier du jeu', async () => {
        const e = env();
        expect(await registerServiceWorker(e)).toEqual({ scope: 'x' });
        expect(e.calls).toEqual([['./sw.js?v=20261020201631854', { scope: './' }]]);
    });

    test('ne fait rien sans build connu, hors contexte sécurisé, en file:// ou sans service worker ; ne lève jamais', async () => {
        expect(await registerServiceWorker(env({ __match3Build: '0' }))).toBeNull();
        expect(await registerServiceWorker(env({ isSecureContext: false }))).toBeNull();
        expect(await registerServiceWorker(env({ location: { protocol: 'file:' } }))).toBeNull();
        expect(await registerServiceWorker(env({ navigator: {} }))).toBeNull();
        expect(canUseServiceWorker(env({ navigator: {} }))).toBe(false);
        const failing = env({ navigator: { serviceWorker: { register: async () => { throw new Error('refusé'); } } } });
        expect(await registerServiceWorker(failing)).toBeNull();
    });

    test('attend la fin du chargement de la page', async () => {
        const e = env({ document: { readyState: 'loading' }, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } });
        await registerServiceWorkerWhenLoaded(e);
        expect(e.calls.length).toBe(0);
        e.listeners.load();
        await new Promise(resolve => setImmediate(resolve));
        expect(e.calls.length).toBe(1);
        const ready = env({ document: { readyState: 'complete' } });
        await registerServiceWorkerWhenLoaded(ready);
        expect(ready.calls.length).toBe(1);
    });
});

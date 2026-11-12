/**
 * music.js — Lecteur de la musique du jeu : pistes MP3 pré-enregistrées (`audio/music/`), jouées en boucle.
 *
 * Plus aucune synthèse en temps réel : les pistes sont rendues une fois pour toutes par `tools/audio/render.mjs`
 * (voir tools/audio/README.md), donc pas de saccade même sur un appareil lent.
 *
 * Deux modes de lecture, même mixage (gain par piste → gain maître : volume, fondus, atténuation) :
 *  - en flux (navigateur) : un élément <audio> par piste, branché sur le contexte audio. Le navigateur décode au fil de la lecture :
 *    aucune piste entière en mémoire (une piste de 3 min décodée pèse 60 à 75 Mo), pas de décodage en bloc à chaque changement de scène ;
 *  - décodée (repli : navigateur sans <audio> raccordable, lecture refusée, tests) : la piste est téléchargée et décodée en entier.
 *
 * ── API ──────────────────────────────────────────────────────────────────────
 *   setMusicEnvironment({ getContext, getVolume, isMuted, fetch?, baseUrl?, timer? })
 *       getContext() -> AudioContext|null   (ne doit pas lever ; null/suspendu = on réessaie plus tard)
 *       getVolume()  -> 0..1                (volume musique utilisateur, réévalué à chaque tick)
 *       isMuted()    -> boolean             (idem)
 *       fetch/baseUrl/timer/random : optionnels (tests)
 *       createAudio() -> HTMLAudioElement  optionnel (défaut : `new Audio()` si le navigateur en a) ; null = toujours le mode décodé
 *   setMusicScene(sceneId, { biome?, boss?, variant? }) -> boolean
 *       Démarre/enchaîne (fondu enchaîné ~1,2 s) la piste de la scène (voir musicTracks.js). No-op si c'est déjà la
 *       bonne piste. Retourne false si la scène est inconnue. Ne lève jamais.
 *   stopMusic({ fadeMs })  pauseMusic() / resumeMusic()  isMusicPlaying()  getSceneList()
 *   preloadMusic(sceneId, options)  Télécharge et décode la piste d'une scène sans la jouer (combat : prête avant le contact avec l'ennemi).
 */
import { SCENE_IDS, BIOMES, trackCandidates, trackUrl, playlist } from './musicTracks.js';
import { getMatch3Version } from './version.js';

export { SCENE_IDS, BIOMES };

const FADE_S = 1.2;           // fondu enchaîné entre pistes
const FAST_IN_S = 0.06;       // combat et boss : la musique attaque tout de suite (juste de quoi éviter un clic)
const FAST_OUT_S = 0.4;       // ... et la piste précédente s'efface vite
const MUSIC_GAIN = 0.35;      // niveau des pistes (normalisées) par rapport au volume utilisateur
const TICK_MS = 250;          // volume / mute / visibilité : léger, aucun calcul audio
const RETRY_MS = 8000;        // piste introuvable ou réseau en panne : nouvel essai après ce délai
const CACHE_SIZE = 3;         // pistes décodées gardées en mémoire (courante, précédente, une de plus)
const STREAM_READY_MS = 12000;   // lecture en flux : délai pour que la piste soit jouable, sinon elle est tenue pour introuvable
const STREAM_HOLD_MS = 400;      // musique coupée / en pause : l'élément <audio> est mis en pause après ce délai (le temps du fondu)
const PRELOAD_SIZE = 1;          // pistes en flux préparées d'avance (combat)

const SCENE_LABELS = {
    title: 'Écran titre', menu: 'Menus', village: 'Village', house: 'Maison', wild: 'Terres sauvages',
    sanctuary: 'Sanctuaire', moon: 'Pic de la Lune', ending: 'Épilogue', combat: 'Combat', boss: 'Boss',
    victory: 'Victoire', defeat: 'Défaite',
    'puzzle-push': 'Énigme des jarres', 'puzzle-mirror': 'Énigme des miroirs', 'puzzle-slide': 'Énigme des charrettes',
    'change-village': 'Chang\'e : village', 'change-puzzle': 'Chang\'e : soins', 'change-farewell': 'Chang\'e : adieu'
};

export function getSceneList() {
    return SCENE_IDS.map((id) => ({ id, label: SCENE_LABELS[id], biomes: id === 'village' || id === 'wild' }));
}

const defaultTimer = {
    set(fn, ms) { const id = setInterval(fn, ms); if (id && typeof id.unref === 'function') id.unref(); return id; },
    clear(id) { clearInterval(id); }
};

const S = {
    env: { getContext: () => null, getVolume: () => 0.6, isMuted: () => false, fetch: null, baseUrl: null, random: Math.random, timer: defaultTimer,
        createAudio: typeof Audio === 'function' ? () => new Audio() : null },
    desired: null,        // { key, candidates, state: 'idle'|'loading'|'playing'|'failed', retryAt }
    current: null,        // { key, gain, ctx } + { source } (piste décodée) ou { el, node } (lecture en flux)
    preloaded: new Map(), // clé de piste -> lecteur en flux prêt à jouer (voir preloadMusic)
    streamBlocked: false, // le navigateur a refusé la lecture en flux (lecture automatique interdite) : mode décodé jusqu'à la fin de la session
    holdSince: 0,         // instant depuis lequel la musique doit se taire (pause de l'élément <audio> après STREAM_HOLD_MS)
    master: null, masterCtx: null,
    cache: new Map(),     // clé de piste -> AudioBuffer (ordre = récence)
    loading: new Map(),   // clé de piste -> Promise<AudioBuffer|null>
    failed: new Map(),    // clé de piste -> instant du dernier échec
    paused: false, timerId: null, lastTarget: -1,
    duckFactor: 1, duckUntil: 0   // baisse passagère (voir duckMusic)
};

export function setMusicEnvironment(env = {}) {
    for (const k of ['getContext', 'getVolume', 'isMuted', 'fetch', 'baseUrl', 'random', 'createAudio']) if (env[k] !== undefined) S.env[k] = env[k];
    if (env.timer && typeof env.timer.set === 'function') S.env.timer = env.timer;
}

const safe = (fn, fallback) => { try { return fn(); } catch (_) { return fallback; } };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const now = () => Date.now();

const isForeground = () => (typeof document === 'undefined' ? true : !document.hidden);

function resolveUrl(path) {
    const base = S.env.baseUrl || (typeof import.meta !== 'undefined' ? import.meta.url : undefined);
    return safe(() => new URL(path, base).href, path);
}

function decode(ctx, data) {
    return new Promise((resolve, reject) => {
        const p = ctx.decodeAudioData(data, resolve, reject);   // Safari ancien : callbacks ; sinon : promesse
        if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
}

async function loadTrack(ctx, key) {
    if (S.cache.has(key)) {
        const buf = S.cache.get(key);
        S.cache.delete(key); S.cache.set(key, buf);   // récence
        return buf;
    }
    if (S.failed.has(key) && now() - S.failed.get(key) < RETRY_MS) return null;
    if (S.loading.has(key)) return S.loading.get(key);
    const doFetch = S.env.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!doFetch) return null;
    const promise = (async () => {
        try {
            // `?v=<version>` : à chaque release le navigateur retélécharge la piste, jamais une ancienne copie en cache
            const res = await doFetch(`${resolveUrl(trackUrl(key))}?v=${getMatch3Version()}`);
            if (!res || !res.ok) throw new Error(`HTTP ${res && res.status}`);
            const buf = await decode(ctx, await res.arrayBuffer());
            S.cache.set(key, buf);
            while (S.cache.size > CACHE_SIZE) S.cache.delete(S.cache.keys().next().value);
            return buf;
        } catch (_) {
            S.failed.set(key, now());
            return null;
        } finally {
            S.loading.delete(key);
        }
    })();
    S.loading.set(key, promise);
    return promise;
}

function ensureMaster(ctx) {
    if (S.master && S.masterCtx === ctx) return S.master;
    S.current = null;               // ancien contexte : on repart de zéro
    S.master = ctx.createGain();
    S.master.gain.value = 0;
    S.master.connect(ctx.destination);
    S.masterCtx = ctx;
    S.lastTarget = -1;
    return S.master;
}

function fadeOutAndStop(entry, fadeS, ctx) {
    if (!entry) return;
    const t = ctx.currentTime;
    const d = Math.max(0.02, fadeS);
    safe(() => {
        entry.gain.gain.cancelScheduledValues(t);
        entry.gain.gain.setValueAtTime(entry.gain.gain.value, t);
        entry.gain.gain.linearRampToValueAtTime(0, t + d);
    });
    if (entry.el) { later(() => releaseStream(entry), (d + 0.05) * 1000); return; }
    safe(() => entry.source.stop(t + d + 0.05));
    entry.source.onended = () => { safe(() => entry.source.disconnect()); safe(() => entry.gain.disconnect()); };
}

// ── Lecture en flux ──────────────────────────────────────────────────────────
const later = (fn, ms) => safe(() => { const id = setTimeout(fn, ms); if (id && typeof id.unref === 'function') id.unref(); return id; });
const canStream = ctx => Boolean(S.env.createAudio) && !S.streamBlocked && typeof ctx.createMediaElementSource === 'function';

// Libère un lecteur en flux : arrêt, abandon du téléchargement en cours, nœuds débranchés.
function releaseStream(entry) {
    if (!entry || !entry.el) return;
    const el = entry.el;
    safe(() => el.pause());
    safe(() => { el.removeAttribute('src'); el.load(); });
    if (entry.node) safe(() => entry.node.disconnect());
    if (entry.gain) safe(() => entry.gain.disconnect());
}

// Prépare un élément <audio> pour la piste (le navigateur commence à la charger s'il l'autorise : Wi-Fi, ordinateur).
function openStream(key) {
    const el = safe(() => S.env.createAudio(), null);
    if (!el) return null;
    safe(() => {
        el.preload = 'auto';
        el.loop = true;
        // `?v=<version>` : à chaque release le navigateur retélécharge la piste, jamais une ancienne copie en cache
        el.src = `${resolveUrl(trackUrl(key))}?v=${getMatch3Version()}`;
        el.load();
    });
    return { key, el };
}

// Lance une piste en flux (déjà préparée par preloadMusic, sinon ouverte ici). Retourne 'playing', 'missing' (piste introuvable ou réseau
// muet : candidate suivante), 'blocked' (lecture refusée par le navigateur : repli sur le mode décodé) ou 'stale' (la scène a changé).
// Seul le résultat de `play()` fait foi : selon l'appareil (iOS, Android en réseau mobile), rien n'est chargé avant la lecture, donc aucun
// événement de préchargement n'est attendu.
async function playStream(ctx, key, desired) {
    if (S.failed.has(key) && now() - S.failed.get(key) < RETRY_MS) return 'missing';
    const stream = S.preloaded.get(key) || openStream(key);
    S.preloaded.delete(key);
    if (!stream) return 'blocked';
    const master = ensureMaster(ctx);
    const gain = ctx.createGain();
    safe(() => gain.gain.setValueAtTime(0, ctx.currentTime));   // muette tant que le fondu d'entrée n'est pas lancé
    const entry = { key, el: stream.el, node: null, gain, ctx };
    let outcome = 'playing';
    try {
        entry.node = ctx.createMediaElementSource(stream.el);
        entry.node.connect(gain);
        gain.connect(master);
        let timer = null;
        const slow = new Promise((resolve) => { timer = later(() => resolve('slow'), STREAM_READY_MS); });
        const started = await Promise.race([Promise.resolve(stream.el.play()), slow]);
        if (timer !== null) clearTimeout(timer);
        if (started === 'slow') outcome = 'missing';
    } catch (err) {
        // NotAllowedError : lecture automatique interdite (aucun geste reconnu) → mode décodé pour la suite ; sinon piste introuvable / illisible
        outcome = err && err.name === 'NotAllowedError' ? 'blocked' : entry.node ? 'missing' : 'blocked';
    }
    if (outcome === 'playing' && S.desired !== desired) outcome = 'stale';
    if (outcome !== 'playing') {
        releaseStream(entry);
        if (outcome === 'missing') S.failed.set(key, now());
        if (outcome === 'blocked') S.streamBlocked = true;
        return outcome;
    }
    const t = ctx.currentTime;
    safe(() => {
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(1, t + (desired.fast ? FAST_IN_S : FADE_S));
    });
    const previous = S.current;
    S.current = entry;
    fadeOutAndStop(previous, desired.fast ? FAST_OUT_S : FADE_S, ctx);
    return 'playing';
}

// L'élément <audio> ne tourne que si on l'entend : onglet masqué, musique coupée ou en pause, il est mis en pause (sinon il continue à
// télécharger et à décoder pour rien, y compris dans un contexte audio suspendu) ; il reprend là où il s'était arrêté.
function syncStreamPlayback(audible) {
    const cur = S.current;
    if (!cur || !cur.el) { S.holdSince = 0; return; }
    if (audible) {
        S.holdSince = 0;
        if (cur.el.paused) safe(() => { const p = cur.el.play(); if (p && typeof p.catch === 'function') p.catch(() => {}); });
        return;
    }
    if (!S.holdSince) S.holdSince = now();
    if (!cur.el.paused && (!isForeground() || now() - S.holdSince >= STREAM_HOLD_MS)) safe(() => cur.el.pause());
}

function startTrack(ctx, key, buffer, fast = false) {
    const master = ensureMaster(ctx);
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + (fast ? FAST_IN_S : FADE_S));
    gain.connect(master);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start(0);
    const previous = S.current;
    S.current = { key, source, gain, ctx };
    fadeOutAndStop(previous, fast ? FAST_OUT_S : FADE_S, ctx);
}

// Charge la première piste disponible parmi les candidates (précise, puis repli) et la lance si la scène n'a pas changé.
async function pickAndPlay(ctx, desired) {
    for (const key of desired.candidates) {
        if (canStream(ctx)) {
            const outcome = await playStream(ctx, key, desired);
            if (outcome === 'stale') return;
            if (outcome === 'playing') { desired.state = 'playing'; return; }
            if (outcome === 'missing') continue;
            // 'blocked' : on retombe sur la piste décodée, comme avant
        }
        const buf = await loadTrack(ctx, key);
        if (S.desired !== desired) return;                              // la scène a changé pendant le chargement
        if (buf) { startTrack(ctx, key, buf, desired.fast); desired.state = 'playing'; return; }
    }
    desired.state = 'failed';
    desired.retryAt = now() + RETRY_MS;
}

function tickInner() {
    const ctx = safe(() => S.env.getContext(), null);
    // Onglet masqué ou musique coupée : on ne relance pas un contexte mis en veille exprès (batterie, voir sound.js).
    const wanted = isForeground() && !safe(() => S.env.isMuted(), false);
    syncStreamPlayback(wanted && !S.paused && (Number(safe(() => S.env.getVolume(), 0)) || 0) > 0);
    if (ctx && wanted && (ctx.state === 'suspended' || ctx.state === 'interrupted')) safe(() => ctx.resume().catch(() => {}));
    if (!ctx || ctx.state === 'suspended' || ctx.state === 'interrupted' || ctx.state === 'closed') return;   // on réessaiera
    if (S.masterCtx && S.masterCtx !== ctx) { releaseStream(S.current); S.master = null; S.masterCtx = null; S.current = null; }

    const d = S.desired;
    if (d && (d.state === 'idle' || (d.state === 'failed' && d.retryAt <= now()))) {
        d.state = 'loading';
        pickAndPlay(ctx, d).catch(() => { d.state = 'failed'; d.retryAt = now() + RETRY_MS; });
    }

    if (S.master) {
        const vol = clamp(Number(safe(() => S.env.getVolume(), 0)) || 0, 0, 1);
        const muted = Boolean(safe(() => S.env.isMuted(), false));
        const hold = muted || S.paused || vol <= 0 || !isForeground();
        const ducked = S.duckUntil > now();
        const target = hold ? 0 : vol * MUSIC_GAIN * (ducked ? S.duckFactor : 1);
        if (Math.abs(target - S.lastTarget) > 0.001) {
            safe(() => S.master.gain.setTargetAtTime(target, ctx.currentTime, hold ? 0.08 : ducked ? 0.03 : 0.2));   // baisse vive, remontée douce
            S.lastTarget = target;
        }
    }
}
function tick() { try { tickInner(); } catch (_) { /* jamais d'exception vers le jeu */ } }

function ensureTimer() {
    if (S.timerId !== null) return;
    S.timerId = safe(() => S.env.timer.set(tick, TICK_MS), null);
    if (S.timerId === null) S.timerId = -1;
}
function stopTimer() {
    if (S.timerId !== null && S.timerId !== -1) safe(() => S.env.timer.clear(S.timerId));
    S.timerId = null;
}

export function setMusicScene(sceneId, options = {}) {
    const candidates = trackCandidates(sceneId, options || {});
    if (!candidates.length) return false;
    // version traditionnelle (`<clé>-b`) d'abord, piste de base en repli si elle manque ; combat ordinaire : toujours `combat-1`
    const list = playlist(sceneId, candidates);
    const key = list.join('|');   // deux scènes qui jouent la même liste (ex. deux ennemis ordinaires) ne relancent pas la piste
    if (S.desired && S.desired.key === key) return true;
    S.desired = { key, candidates: list, state: 'idle', retryAt: 0, fast: sceneId === 'combat' || sceneId === 'boss' };
    ensureTimer();
    tick();
    return true;
}

/**
 * Télécharge et décode à l'avance la piste d'une scène sans la jouer (ex. le combat, pendant l'exploration) : quand la scène
 * démarre, la piste est déjà prête et la musique attaque sans attente. Sans effet si le contexte audio n'existe pas encore.
 */
export function preloadMusic(sceneId, options = {}) {
    const ctx = safe(() => S.env.getContext(), null);
    if (!ctx || ctx.state === 'closed') return false;
    const first = playlist(sceneId, trackCandidates(sceneId, options || {}))[0];
    if (!first) return false;
    if (canStream(ctx)) {
        // lecture en flux : un élément <audio> déjà chargé (début de piste en tampon), que la scène n'aura plus qu'à lancer
        if (S.preloaded.has(first) || (S.current && S.current.key === first)) return true;
        const stream = openStream(first);
        if (!stream) return false;
        S.preloaded.set(first, stream);
        while (S.preloaded.size > PRELOAD_SIZE) { const old = S.preloaded.keys().next().value; releaseStream(S.preloaded.get(old)); S.preloaded.delete(old); }
        return true;
    }
    loadTrack(ctx, first).catch(() => {});
    return true;
}

export function stopMusic({ fadeMs = 1200 } = {}) {
    S.desired = null;
    S.paused = false;
    const ctx = safe(() => S.env.getContext(), null);
    if (S.current && ctx) fadeOutAndStop(S.current, Math.max(0, Number(fadeMs) || 0) / 1000, ctx);
    else if (S.current && S.current.el) releaseStream(S.current);
    else if (S.current) safe(() => S.current.source.stop());
    S.current = null;
    stopTimer();
}

/**
 * Baisse légèrement la musique (× `factor`, 0..1) pendant `ms` millisecondes, puis la remonte en douceur : à appeler quand un
 * effet sonore important (sort, coup d'arme) joue. Plusieurs appels rapprochés prolongent la baisse sans l'accentuer.
 */
export function duckMusic(factor = 0.6, ms = 500) {
    S.duckFactor = clamp(Number(factor) || 1, 0.05, 1);
    S.duckUntil = Math.max(S.duckUntil, now() + Math.max(0, Number(ms) || 0));
    tick();
    safe(() => { const id = setTimeout(tick, Math.max(0, Number(ms) || 0) + 40); if (id && typeof id.unref === 'function') id.unref(); });   // remontée sans attendre le tick suivant
}

export function pauseMusic() { S.paused = true; tick(); }
export function resumeMusic() { S.paused = false; tick(); }

export function isMusicPlaying() {
    if (S.paused || !S.desired || !S.current) return false;
    return S.current.ctx.state !== 'suspended';
}

/** Accès interne pour les tests. */
export const __internals = {
    tick, state: S,
    reset() {
        stopMusic({ fadeMs: 0 });
        S.preloaded.forEach(releaseStream); S.preloaded.clear();
        S.cache.clear(); S.loading.clear(); S.failed.clear(); S.master = null; S.masterCtx = null; S.lastTarget = -1;
        S.streamBlocked = false; S.holdSince = 0;
    }
};

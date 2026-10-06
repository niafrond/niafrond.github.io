/**
 * music.js — Lecteur de la musique du jeu : pistes MP3 pré-enregistrées (`audio/music/`), jouées en boucle.
 *
 * Plus aucune synthèse en temps réel : les pistes sont rendues une fois pour toutes par `tools/audio/render.mjs`
 * (voir tools/audio/README.md), donc pas de saccade même sur un appareil lent. Une seule piste est décodée en mémoire
 * à la fois (plus la précédente pendant le fondu) ; elle est téléchargée à la demande.
 *
 * ── API ──────────────────────────────────────────────────────────────────────
 *   setMusicEnvironment({ getContext, getVolume, isMuted, fetch?, baseUrl?, timer? })
 *       getContext() -> AudioContext|null   (ne doit pas lever ; null/suspendu = on réessaie plus tard)
 *       getVolume()  -> 0..1                (volume musique utilisateur, réévalué à chaque tick)
 *       isMuted()    -> boolean             (idem)
 *       fetch/baseUrl/timer : optionnels (tests)
 *   setMusicScene(sceneId, { biome?, boss?, variant? }) -> boolean
 *       Démarre/enchaîne (fondu enchaîné ~1,2 s) la piste de la scène (voir musicTracks.js). No-op si c'est déjà la
 *       bonne piste. Retourne false si la scène est inconnue. Ne lève jamais.
 *   stopMusic({ fadeMs })  pauseMusic() / resumeMusic()  isMusicPlaying()  getSceneList()
 */
import { SCENE_IDS, BIOMES, trackCandidates, trackUrl } from './musicTracks.js';

export { SCENE_IDS, BIOMES };

const FADE_S = 1.2;           // fondu enchaîné entre pistes
const MUSIC_GAIN = 0.35;      // niveau des pistes (normalisées) par rapport au volume utilisateur
const TICK_MS = 250;          // volume / mute / visibilité : léger, aucun calcul audio
const RETRY_MS = 8000;        // piste introuvable ou réseau en panne : nouvel essai après ce délai
const CACHE_SIZE = 3;         // pistes décodées gardées en mémoire (courante, précédente, une de plus)

const SCENE_LABELS = {
    title: 'Écran titre', menu: 'Menus', village: 'Village', house: 'Maison', wild: 'Terres sauvages',
    sanctuary: 'Sanctuaire', moon: 'Pic de la Lune', ending: 'Épilogue', combat: 'Combat', boss: 'Boss',
    victory: 'Victoire', defeat: 'Défaite'
};

export function getSceneList() {
    return SCENE_IDS.map((id) => ({ id, label: SCENE_LABELS[id], biomes: id === 'village' || id === 'wild' }));
}

const defaultTimer = {
    set(fn, ms) { const id = setInterval(fn, ms); if (id && typeof id.unref === 'function') id.unref(); return id; },
    clear(id) { clearInterval(id); }
};

const S = {
    env: { getContext: () => null, getVolume: () => 0.6, isMuted: () => false, fetch: null, baseUrl: null, timer: defaultTimer },
    desired: null,        // { key, candidates, state: 'idle'|'loading'|'playing'|'failed', retryAt }
    current: null,        // { key, source, gain, ctx }
    master: null, masterCtx: null,
    cache: new Map(),     // clé de piste -> AudioBuffer (ordre = récence)
    loading: new Map(),   // clé de piste -> Promise<AudioBuffer|null>
    failed: new Map(),    // clé de piste -> instant du dernier échec
    paused: false, timerId: null, lastTarget: -1
};

export function setMusicEnvironment(env = {}) {
    for (const k of ['getContext', 'getVolume', 'isMuted', 'fetch', 'baseUrl']) if (env[k] !== undefined) S.env[k] = env[k];
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
            const res = await doFetch(resolveUrl(trackUrl(key)));
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
    safe(() => entry.source.stop(t + d + 0.05));
    entry.source.onended = () => { safe(() => entry.source.disconnect()); safe(() => entry.gain.disconnect()); };
}

function startTrack(ctx, key, buffer) {
    const master = ensureMaster(ctx);
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + FADE_S);
    gain.connect(master);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start(0);
    const previous = S.current;
    S.current = { key, source, gain, ctx };
    fadeOutAndStop(previous, FADE_S, ctx);
}

// Charge la première piste disponible parmi les candidates (précise, puis repli) et la lance si la scène n'a pas changé.
async function pickAndPlay(ctx, desired) {
    for (const key of desired.candidates) {
        const buf = await loadTrack(ctx, key);
        if (S.desired !== desired) return;                              // la scène a changé pendant le chargement
        if (buf) { startTrack(ctx, key, buf); desired.state = 'playing'; return; }
    }
    desired.state = 'failed';
    desired.retryAt = now() + RETRY_MS;
}

function tickInner() {
    const ctx = safe(() => S.env.getContext(), null);
    if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) safe(() => ctx.resume().catch(() => {}));
    if (!ctx || ctx.state === 'suspended' || ctx.state === 'interrupted' || ctx.state === 'closed') return;   // on réessaiera
    if (S.masterCtx && S.masterCtx !== ctx) { S.master = null; S.masterCtx = null; S.current = null; }

    const d = S.desired;
    if (d && (d.state === 'idle' || (d.state === 'failed' && d.retryAt <= now()))) {
        d.state = 'loading';
        pickAndPlay(ctx, d).catch(() => { d.state = 'failed'; d.retryAt = now() + RETRY_MS; });
    }

    if (S.master) {
        const vol = clamp(Number(safe(() => S.env.getVolume(), 0)) || 0, 0, 1);
        const muted = Boolean(safe(() => S.env.isMuted(), false));
        const hold = muted || S.paused || vol <= 0 || !isForeground();
        const target = hold ? 0 : vol * MUSIC_GAIN;
        if (Math.abs(target - S.lastTarget) > 0.001) {
            safe(() => S.master.gain.setTargetAtTime(target, ctx.currentTime, hold ? 0.08 : 0.15));
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
    const key = candidates.join('|');
    if (S.desired && S.desired.key === key) return true;
    S.desired = { key, candidates, state: 'idle', retryAt: 0 };
    ensureTimer();
    tick();
    return true;
}

export function stopMusic({ fadeMs = 1200 } = {}) {
    S.desired = null;
    S.paused = false;
    const ctx = safe(() => S.env.getContext(), null);
    if (S.current && ctx) fadeOutAndStop(S.current, Math.max(0, Number(fadeMs) || 0) / 1000, ctx);
    else if (S.current) safe(() => S.current.source.stop());
    S.current = null;
    stopTimer();
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
    reset() { stopMusic({ fadeMs: 0 }); S.cache.clear(); S.loading.clear(); S.failed.clear(); S.master = null; S.masterCtx = null; S.lastTarget = -1; }
};

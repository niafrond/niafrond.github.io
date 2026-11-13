// Pause globale quand la fenêtre perd le focus (ou que l'onglet est masqué) : minuteries (chute des tuiles, tour de l'IA,
// cinématiques…), requestAnimationFrame, animations CSS/Web, chrono et audio sont gelés, puis repartent là où ils s'étaient arrêtés.
// Installé une fois au chargement (index.html) AVANT les autres modules, pour que tous les setTimeout du jeu soient pausables.

export const PAUSED_CLASS = 'focus-paused';
export const PAUSE_EVENT = 'focuspausechange';

export function installFocusPause(win = globalThis) {
    if (!win) return null;
    if (win.__focusPauseInstalled) return win.__focusPauseInstalled;
    const doc = win.document;
    const nativeSet = win.setTimeout.bind(win), nativeClear = win.clearTimeout.bind(win);
    const nativeRaf = win.requestAnimationFrame?.bind(win), nativeCaf = win.cancelAnimationFrame?.bind(win);
    const now = () => (win.performance?.now ? win.performance.now() : Date.now());
    let paused = false, nextId = 1e9;
    const timers = new Map();   // id -> { fn, args, delay, repeat, start, real }
    const frames = new Map();   // id -> { cb, real }
    const pausedAnims = new Set();

    const arm = (id, t, wait) => {
        t.start = now(); t.delay = wait;
        t.real = nativeSet(() => {
            if (!timers.has(id)) return;
            if (t.repeat) arm(id, t, t.repeat); else timers.delete(id);
            t.fn(...t.args);
        }, wait);
    };
    const makeSet = repeat => (fn, delay, ...args) => {
        if (typeof fn !== 'function') return nativeSet(fn, delay, ...args);
        const wait = Math.max(0, Number(delay) || 0), id = nextId++;
        const t = { fn, args, repeat: repeat ? Math.max(1, wait) : 0, start: now(), delay: wait, real: null };
        timers.set(id, t);
        if (!paused) arm(id, t, wait);
        return id;
    };
    const clear = id => {
        const t = timers.get(id);
        if (t) { nativeClear(t.real); timers.delete(id); } else nativeClear(id);
    };
    const runFrame = (id, f) => { f.real = nativeRaf(ts => { if (paused) { f.real = null; return; } frames.delete(id); f.cb(ts); }); };

    win.setTimeout = makeSet(false);
    win.setInterval = makeSet(true);
    win.clearTimeout = clear;
    win.clearInterval = clear;
    if (nativeRaf) {
        win.requestAnimationFrame = cb => { const id = nextId++, f = { cb, real: null }; frames.set(id, f); if (!paused) runFrame(id, f); return id; };
        win.cancelAnimationFrame = id => { const f = frames.get(id); if (f) { nativeCaf(f.real); frames.delete(id); } else nativeCaf(id); };
    }

    const pause = () => {
        if (paused) return;
        paused = true;
        const t0 = now();
        for (const t of timers.values()) { nativeClear(t.real); t.real = null; t.delay = Math.max(0, t.delay - (t0 - t.start)); }
        for (const f of frames.values()) { nativeCaf?.(f.real); f.real = null; }
        try { doc.getAnimations?.().forEach(a => { if (a.playState === 'running') { a.pause(); pausedAnims.add(a); } }); } catch (e) { /* animations indisponibles */ }
        doc.documentElement?.classList.add(PAUSED_CLASS);
        doc.dispatchEvent(new win.CustomEvent(PAUSE_EVENT, { detail: { paused: true } }));
    };
    const resume = () => {
        if (!paused) return;
        paused = false;
        doc.documentElement?.classList.remove(PAUSED_CLASS);
        for (const [id, t] of timers) arm(id, t, t.delay);
        for (const [id, f] of frames) runFrame(id, f);
        pausedAnims.forEach(a => { try { a.play(); } catch (e) { /* animation annulée entre-temps */ } });
        pausedAnims.clear();
        doc.dispatchEvent(new win.CustomEvent(PAUSE_EVENT, { detail: { paused: false } }));
    };
    const hasFocus = () => !doc.hidden && (typeof doc.hasFocus !== 'function' || doc.hasFocus());

    win.addEventListener('blur', e => { if (e.target === win) pause(); });
    win.addEventListener('focus', e => { if (e.target === win && !doc.hidden) resume(); });
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) pause(); else if (hasFocus()) resume(); });

    const api = { pause, resume, isPaused: () => paused };
    win.__focusPauseInstalled = api;
    return api;
}

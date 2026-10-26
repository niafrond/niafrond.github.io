// Temps de jeu (menu Options), mémorisé par appareil dans localStorage : aujourd'hui, hier, cette semaine (depuis lundi), total.
// Le chrono n'avance que lorsque la page est visible ; les jours sont ceux du fuseau local.
// Le temps de jeu « réel » (`real`) ne compte en plus que si le joueur a agi (clic, touche, toucher) dans les dernières IDLE_LIMIT_MS.

export const PLAYTIME_STORAGE_KEY = 'match3quest.playtime';
const IDLE_LIMIT_MS = 60000;   // sans action au-delà, le jeu est allumé mais pas vraiment utilisé
const KEEP_DAYS = 14;   // le détail par jour est élagué ; le total, lui, est conservé

const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function loadCounter(raw) {
    const days = {};
    Object.entries(raw?.days || {}).forEach(([k, v]) => { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v > 0) days[k] = Math.floor(v); });
    return { total: Math.max(0, Math.floor(raw?.total) || 0), days };
}

function load() {
    try {
        const raw = JSON.parse(localStorage.getItem(PLAYTIME_STORAGE_KEY) || '{}');
        return { ...loadCounter(raw), real: loadCounter(raw.real) };
    } catch (e) { return { total: 0, days: {}, real: { total: 0, days: {} } }; }
}

function save(data) {
    const cutoff = dayKey(new Date(Date.now() - KEEP_DAYS * 86400000));
    [data, data.real].forEach(c => Object.keys(c.days).forEach(k => { if (k < cutoff) delete c.days[k]; }));
    try { localStorage.setItem(PLAYTIME_STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignoré */ }
}

// Ajoute `seconds` de jeu au jour de `now` ; `realSeconds` (≤ seconds) est la part où le joueur utilisait vraiment le jeu.
export function addPlayTime(seconds, now = new Date(), realSeconds = 0) {
    if (!(seconds > 0)) return;
    const data = load();
    const k = dayKey(now);
    data.days[k] = (data.days[k] || 0) + seconds;
    data.total += seconds;
    if (realSeconds > 0) {
        data.real.days[k] = (data.real.days[k] || 0) + realSeconds;
        data.real.total += realSeconds;
    }
    save(data);
}

// { today, yesterday, week, total } en secondes. La semaine commence le lundi.
export function playTimeStats(now = new Date()) {
    return statsOf(load(), now);
}

// Mêmes valeurs pour le temps de jeu réel (page visible et joueur actif).
export function realPlayTimeStats(now = new Date()) {
    return statsOf(load().real, now);
}

function statsOf({ total, days }, now) {
    const at = offset => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset); return d; };
    const sinceMonday = (now.getDay() + 6) % 7;
    let week = 0;
    for (let i = 0; i <= sinceMonday; i++) week += days[dayKey(at(i))] || 0;
    return { today: days[dayKey(at(0))] || 0, yesterday: days[dayKey(at(1))] || 0, week, total };
}

// 3725 → « 1 h 02 », 125 → « 2 min », 20 → « 20 s ».
export function formatDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    if (s < 60) return `${s} s`;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

// Démarre le chrono : une seconde de jeu est comptée par seconde passée page visible, et une seconde de jeu réel si le joueur
// a agi dans les IDLE_LIMIT_MS précédentes. `onTick` sert à rafraîchir l'affichage.
export function startPlayTimeTracking(onTick) {
    let last = Date.now();
    let lastInput = last;
    let pending = 0;
    let pendingReal = 0;
    if (typeof document !== 'undefined') {
        const touch = () => { lastInput = Date.now(); };
        ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'].forEach(ev => document.addEventListener(ev, touch, { passive: true, capture: true }));
    }
    const tick = () => {
        const now = Date.now();
        const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
        if (visible) {
            const dt = Math.min(now - last, 5000) / 1000;   // plafond : une veille ne compte pas
            pending += dt;
            if (now - lastInput <= IDLE_LIMIT_MS) pendingReal += dt;
        }
        last = now;
        const whole = Math.floor(pending);
        if (whole > 0) {
            const real = Math.min(whole, Math.floor(pendingReal));
            addPlayTime(whole, new Date(now), real);
            pending -= whole;
            pendingReal -= real;
        }
        onTick?.();
    };
    return setInterval(tick, 1000);
}

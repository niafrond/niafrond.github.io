// Temps de jeu (menu Options), mémorisé par appareil dans localStorage : aujourd'hui, hier, cette semaine (depuis lundi), total.
// Le chrono n'avance que lorsque la page est visible ; les jours sont ceux du fuseau local.

export const PLAYTIME_STORAGE_KEY = 'match3quest.playtime';
const KEEP_DAYS = 14;   // le détail par jour est élagué ; le total, lui, est conservé

const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function load() {
    try {
        const raw = JSON.parse(localStorage.getItem(PLAYTIME_STORAGE_KEY) || '{}');
        const days = {};
        Object.entries(raw.days || {}).forEach(([k, v]) => { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v > 0) days[k] = Math.floor(v); });
        return { total: Math.max(0, Math.floor(raw.total) || 0), days };
    } catch (e) { return { total: 0, days: {} }; }
}

function save(data) {
    const cutoff = dayKey(new Date(Date.now() - KEEP_DAYS * 86400000));
    Object.keys(data.days).forEach(k => { if (k < cutoff) delete data.days[k]; });
    try { localStorage.setItem(PLAYTIME_STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignoré */ }
}

// Ajoute `seconds` de jeu au jour de `now`.
export function addPlayTime(seconds, now = new Date()) {
    if (!(seconds > 0)) return;
    const data = load();
    const k = dayKey(now);
    data.days[k] = (data.days[k] || 0) + seconds;
    data.total += seconds;
    save(data);
}

// { today, yesterday, week, total } en secondes. La semaine commence le lundi.
export function playTimeStats(now = new Date()) {
    const { total, days } = load();
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

// Démarre le chrono : une seconde de jeu est comptée par seconde passée page visible. `onTick` sert à rafraîchir l'affichage.
export function startPlayTimeTracking(onTick) {
    let last = Date.now();
    let pending = 0;
    const tick = () => {
        const now = Date.now();
        const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
        if (visible) pending += Math.min(now - last, 5000) / 1000;   // plafond : une veille ne compte pas
        last = now;
        const whole = Math.floor(pending);
        if (whole > 0) { addPlayTime(whole, new Date(now)); pending -= whole; }
        onTick?.();
    };
    return setInterval(tick, 1000);
}

/**
 * spellFx.js — Mini-animations pixel art des sorts (planches `sprites/spellfx/<id>.png`, générées par
 * `tools/gen-spellfx.mjs`). Plus le sort coûte cher, plus l'animation est grande et détaillée.
 *
 * Le lecteur est purement CSS (planche + `steps()`), sans canvas ni timer. L'animation se joue UNE fois puis reste sur sa dernière image. L'index est chargé en tâche de fond ;
 * tant qu'il n'est pas là (ou si une planche manque), `spellFxHtml` renvoie null et l'annonce garde son icône.
 */
const INDEX_URL = './sprites/spellfx/index.json';
const SCALE_BY_SIZE = { 32: 3, 48: 2, 64: 2, 96: 1.5, 128: 1.5 };   // taille affichée : 96 → 192 px

let index = null;        // { id: { name, frames, size, fps, tier } }
let byName = null;       // NOM EN MAJUSCULES -> id
let loading = null;

const norm = (s) => String(s || '').trim().toUpperCase();

export function setSpellFxIndex(data) {
    index = data && typeof data === 'object' ? data : {};
    byName = new Map(Object.entries(index).map(([id, e]) => [norm(e.name), id]));
}

export function preloadSpellFx() {
    if (index || loading || typeof fetch !== 'function') return loading;
    const url = typeof import.meta !== 'undefined' ? new URL(INDEX_URL, import.meta.url).href : INDEX_URL;
    loading = fetch(url).then(r => (r && r.ok ? r.json() : null)).then(d => { if (d) setSpellFxIndex(d); }).catch(() => {});
    return loading;
}

export function spellFxIdForTitle(title) {
    return byName ? (byName.get(norm(title)) || null) : null;
}

/** Durée (ms) de l'animation d'un sort, ou 0 si absente. */
export function spellFxDurationMs(idOrTitle) {
    const id = index && (index[idOrTitle] ? idOrTitle : spellFxIdForTitle(idOrTitle));
    const e = id && index[id];
    return e ? Math.round(e.frames / (e.fps || 10) * 1000) : 0;
}

/** HTML de l'animation d'un sort (par id ou par titre d'annonce), ou null si absente. */
export function spellFxHtml(idOrTitle) {
    if (!index) return null;
    const id = index[idOrTitle] ? idOrTitle : spellFxIdForTitle(idOrTitle);
    const e = id && index[id];
    if (!e) return null;
    const scale = SCALE_BY_SIZE[e.size] || 2;
    const px = e.size * scale;
    const url = typeof import.meta !== 'undefined' ? new URL(`./sprites/spellfx/${id}.png`, import.meta.url).href : `./sprites/spellfx/${id}.png`;
    const dur = (e.frames / (e.fps || 10)).toFixed(2);
    const style = `--steps:${e.frames - 1};--px:${px}px;--dur:${dur}s;width:${px}px;height:${px}px;background-image:url(${url});background-size:${px * e.frames}px ${px}px`;
    return `<div class="spellfx" data-spell="${id}" aria-hidden="true" style="${style}"></div>`;
}

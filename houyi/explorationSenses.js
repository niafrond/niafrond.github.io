// Perception du joueur : aura, caches invisibles et mimiques, coffres refermés, repère posé sur la carte, brouillard de guerre.
// Extrait de exploration.js (ré-exporté par celui-ci).
import { isVillage } from './world/levelDesign.js';
import { canWalkOnWater, currentScreen, isEntityVisible, isTerrainBlocked } from './exploration.js';

// ── Aura, caches invisibles et mimiques ──────────────────────────────
// Talent « Perception du qì » (gǎn qì, 感氣 ; identifiants « aura » dans le code ; niveau AURA_LEVEL) : le héros ressent les caches invisibles (`chest.hidden`) à moins de AURA_RANGE cases
// (onde de plus en plus forte à mesure qu'il s'en approche, vibration sur mobile). Sans lui, on ne les trouve qu'en butant dessus.
// Un coffre `mimic` est une créature déguisée : l'ouvrir déclenche un combat, pour un butin maigre (`mimicGold`).
export const AURA_LEVEL = 8;
export const AURA_RANGE = 9;
export const MIMIC_NAME = 'Mimique';
export const MIMIC_SPRITE = 'mimique';   // dessin dédié : un coffre vivant (tools/sprite-overrides.mjs)
export const hasAura = playerLevel => Math.floor(playerLevel || 0) >= AURA_LEVEL;

// La perception ne reste pas allumée : on touche le héros pour la lancer, PERCEPTION_MS durant (`rt.perceptionUntil`, jamais sauvegardé).
export const PERCEPTION_MS = 5000;
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
export const perceptionActive = (session, now = nowMs()) => (session.rt.perceptionUntil || 0) > now;

// Cache invisible non ouverte la plus proche, n'importe où sur la carte : { chest, dist, dx, dy, angle } ou null.
export function nearestHidden(session) {
    const screen = currentScreen(session);
    let best = null;
    for (const c of screen.chests || []) {
        if (!c.hidden || session.data.openedChests.includes(c.id) || !isEntityVisible(session, c)) continue;
        const dx = c.x - session.data.x, dy = c.y - session.data.y;
        const dist = Math.hypot(dx, dy);
        if (!best || dist < best.dist) best = { chest: c, dist, dx, dy, angle: Math.atan2(dy, dx) };
    }
    return best;
}

// Lance la perception (clic sur le héros) : { ok: false, reason: 'level' } sans le talent, { ok: true, found } sinon (found : une cache existe encore).
export function startPerception(session, playerLevel, now = nowMs()) {
    if (!hasAura(playerLevel)) return { ok: false, reason: 'level' };
    session.rt.perceptionUntil = now + PERCEPTION_MS;
    return { ok: true, found: Boolean(nearestHidden(session)), until: session.rt.perceptionUntil };
}

// Lecture de la perception en cours : null si inactive, sans talent ou sans cache ; sinon direction (angle en radians) et force (0..1,
// de plus en plus forte à mesure qu'on s'approche : 0,1 au-delà de AURA_RANGE, 1 au contact).
export function auraSignal(session, playerLevel, now = nowMs()) {
    if (!hasAura(playerLevel) || !perceptionActive(session, now)) return null;
    const near = nearestHidden(session);
    if (!near) return null;
    const strength = near.dist >= AURA_RANGE ? 0.1 : Math.max(0.1, Math.min(1, 1 - (near.dist - 1) / (AURA_RANGE - 1)));
    return { dist: near.dist, strength, angle: near.angle, dx: near.dx, dy: near.dy };
}

// Un coffre est-il dessiné ? Les caches ne se montrent qu'à qui a le talent, perception lancée, une fois tout près.
export const isChestShown = (session, chest, playerLevel, now = nowMs()) =>
    !chest.hidden || (hasAura(playerLevel) && perceptionActive(session, now) && Math.hypot(chest.x - session.data.x, chest.y - session.data.y) <= 2.2);

// ── Coffres refermés ─────────────────────────────────────────────────
// Quand le héros revient sur une carte, certains coffres déjà ouverts se referment : ce sont désormais des mimiques (butin maigre, combat).
// Jamais touchés : coffres d'objet de quête ou à énigme, cibles d'un objectif de quête, coffres cités comme condition (`showWhen`, `requires`…)
// par un personnage, un ennemi, une sortie ou une quête (les rouvrir défairait la progression), coffre sous les pieds du héros.
export const RECLOSE_CHANCE = 0.35, RECLOSE_MAX = 3;
const CONDITION_KEYS = ['showWhen', 'hideWhen', 'requires', 'weakenedBy', 'unsealedBy', 'shieldedBy', 'lockedBy', 'needs'];

function protectedChestIds(session) {
    const cache = session.rt.protectedChests;
    if (cache) return cache;
    const ids = new Set();
    const take = v => { if (typeof v === 'string') ids.add(v); else if (Array.isArray(v)) v.forEach(take); };
    Object.values(session.screens).forEach(sc => {
        [sc.npcs, sc.chests, sc.enemies, sc.exits].forEach(list => (list || []).forEach(e => CONDITION_KEYS.forEach(k => take(e[k]))));
    });
    (session.quests || []).forEach(q => {
        take(q.requires);
        (q.objectives || []).forEach(o => { if (o.type === 'chest') take(o.target); });
    });
    return (session.rt.protectedChests = ids);
}

const reclosable = (session, chest, guarded) =>
    session.data.openedChests.includes(chest.id) && !chest.mimic && !chest.questItem && !chest.puzzle && !guarded.has(chest.id)
    && !(chest.x === session.data.x && chest.y === session.data.y);

// Referme quelques coffres ouverts de la carte courante ; retourne les identifiants refermés.
export function reclosePastChests(session) {
    const screen = currentScreen(session);
    if (isVillage(screen)) return [];   // pas de mimique dans les villages et hameaux
    const returns = session.data.returns[screen.id] = (session.data.returns[screen.id] || 0) + 1;
    const guarded = protectedChestIds(session);
    const closed = [];
    for (const chest of screen.chests || []) {
        if (closed.length >= RECLOSE_MAX) break;
        if (!reclosable(session, chest, guarded)) continue;
        const roll = Math.abs(Math.sin((chest.x + 1) * 127.1 + (chest.y + 1) * 311.7 + returns * 74.7 + [...chest.id].reduce((a, ch) => a + ch.charCodeAt(0), 0)) * 43758.5453) % 1;
        if (roll >= RECLOSE_CHANCE) continue;
        session.data.openedChests = session.data.openedChests.filter(id => id !== chest.id);
        if (!session.data.mimicked.includes(chest.id)) session.data.mimicked.push(chest.id);
        closed.push(chest.id);
    }
    return closed;
}

// Un coffre est-il (devenu) une mimique ?
export const isMimicChest = (session, chest) => Boolean(chest.mimic) || session.data.mimicked.includes(chest.id);

// ── Repère posé sur la carte (minimap plein écran) ───────────────────
// Un repère temporaire (`rt.marker`, jamais sauvegardé) tient lieu de marqueur de quête : une flèche d'une autre couleur y mène. Il disparaît dès
// que le héros arrive dessus. Il appartient à la carte où il est posé (invisible ailleurs, retrouvé au retour).
export function setMarker(session, x, y) {
    const screen = currentScreen(session);
    if (!Number.isInteger(x) || !Number.isInteger(y) || isTerrainBlocked(screen, x, y, canWalkOnWater(session))) return false;
    if (x === session.data.x && y === session.data.y) return false;
    session.rt.marker = { screenId: screen.id, x, y };
    return true;
}
export const clearMarker = session => { session.rt.marker = null; };
export const markerOf = session => (session.rt.marker && session.rt.marker.screenId === session.data.screenId ? session.rt.marker : null);

// ── Brouillard de guerre ─────────────────────────────────────────────
// Chaque carte garde le masque des cases vues par le héros (rayon FOG_RADIUS autour de lui à chaque pas, définitivement). Les cases jamais
// vues sont voilées dans la vue principale (explorationView.js `drawFogOfWar`, personnages et ennemis compris), la minimap et la carte
// plein écran. Sauvegardé dans `data.fog`.
export const FOG_RADIUS = 6;
const fogCache = new WeakMap();   // data.fog -> { [écran]: Uint8Array }

function decodeFog(text, n) {
    const mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        const nib = parseInt(text[i >> 2] || '0', 16) || 0;
        mask[i] = (nib >> (i & 3)) & 1;
    }
    return mask;
}
function encodeFog(mask) {
    let out = '';
    for (let i = 0; i < mask.length; i += 4) out += ((mask[i] || 0) | (mask[i + 1] || 0) << 1 | (mask[i + 2] || 0) << 2 | (mask[i + 3] || 0) << 3).toString(16);
    return out;
}
// Masque (w*h, 1 = vu) d'une carte ; créé à la demande.
export function fogMask(session, screen = currentScreen(session)) {
    const store = session.data.fog || (session.data.fog = {});
    let cache = fogCache.get(store);
    if (!cache) { cache = {}; fogCache.set(store, cache); }
    if (!cache[screen.id]) cache[screen.id] = decodeFog(store[screen.id] || '', screen.w * screen.h);
    return cache[screen.id];
}
// Dévoile les cases proches du héros ; retourne true si le masque a changé (la minimap se repeint alors).
export function revealFog(session, radius = FOG_RADIUS) {
    const screen = currentScreen(session);
    if (!screen) return false;
    const mask = fogMask(session, screen);
    const { x: hx, y: hy } = session.data;
    let changed = false;
    for (let y = Math.max(0, hy - radius); y <= Math.min(screen.h - 1, hy + radius); y++) {
        for (let x = Math.max(0, hx - radius); x <= Math.min(screen.w - 1, hx + radius); x++) {
            const i = y * screen.w + x;
            if (!mask[i] && (x - hx) ** 2 + (y - hy) ** 2 <= radius * radius + 1) { mask[i] = 1; changed = true; }
        }
    }
    if (changed) { session.data.fog[screen.id] = encodeFog(mask); session.rt.fogRev = (session.rt.fogRev || 0) + 1; }
    return changed;
}

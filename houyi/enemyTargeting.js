// IA de ciblage des ennemis : qui l'ennemi frappe-t-il ? Module pur (sans DOM), testé dans tests/unit/enemyTargeting.test.js.
//
// Chaque membre vivant de l'équipe (Hou Yi : id « assassin », et les compagnons) reçoit un poids ; l'ennemi tire au sort selon ces poids. Règles :
//  1. Menace en temps réel : chaque action d'un personnage (arme, sort, objet…) augmente sa menace (plus s'il inflige de gros dégâts), qui s'estompe avec le temps
//     (demi-vie de THREAT_HALF_LIFE_MS). Qui agit souvent, et fort, est ciblé en priorité (+ jusqu'à THREAT_WEIGHT selon sa part de menace).
//  2. Achèvement : un personnage presque à terre attire les coups (×2 sous 30 % de PV ; Hou Yi ×2,2 sous 35 %).
//  3. Variété : on évite de frapper la même cible de suite (×0,4 pour la dernière cible, aucune chance au troisième coup d'affilée, ×0,8 pour l'avant-dernière), sauf
//     pour achever un personnage presque à terre (sous 20 % de PV : aucune pénalité).
//  4. Hou Yi est le chef : un léger avantage de base (×1,15), sans plus : il n'est plus visé systématiquement.
//  5. Hors de combat : jamais visé ; si seul Hou Yi est debout, c'est lui.

export const HERO_ID = 'assassin';
export const THREAT_HALF_LIFE_MS = 20000;
export const THREAT_WEIGHT = 3;
const HISTORY_MAX = 6;

const decayed = (entry, now) => (entry ? entry.v * Math.pow(0.5, Math.max(0, now - entry.at) / THREAT_HALF_LIFE_MS) : 0);

/** Menace actuelle de `id` (estompée au fil du temps). `threat` : { [id]: { v, at } }. */
export const threatOf = (threat, id, now = Date.now()) => decayed(threat?.[id], now);

/** Un personnage vient d'agir : sa menace augmente de 1 + dégâts / 20. */
export function addThreat(threat, id, damage = 0, now = Date.now()) {
    if (!threat || !id) return;
    threat[id] = { v: threatOf(threat, id, now) + 1 + Math.max(0, Number(damage) || 0) / 20, at: now };
}

/** Mémorise la cible choisie (les dernières seulement). */
export function rememberTarget(history, id) {
    history.push(id);
    while (history.length > HISTORY_MAX) history.shift();
}

/**
 * Poids de ciblage de chaque membre.
 * @param {Array<{ id: string, hpPct: number }>} members membres vivants (hpPct : 0..1)
 * @returns {Record<string, number>}
 */
export function targetWeights({ members, threat = {}, history = [], now = Date.now() }) {
    const total = members.reduce((s, m) => s + threatOf(threat, m.id, now), 0);
    const last = history[history.length - 1], before = history[history.length - 2];
    let streak = 0;
    for (let i = history.length - 1; i >= 0 && history[i] === last; i--) streak++;
    const out = {};
    members.forEach(m => {
        let w = 1 + (total > 0 ? THREAT_WEIGHT * threatOf(threat, m.id, now) / total : 0);
        const hero = m.id === HERO_ID;
        if (hero) w *= 1.15;
        if (m.hpPct < (hero ? 0.35 : 0.3)) w *= hero ? 2.2 : 2;
        if (m.hpPct >= 0.2) {
            if (m.id === last) w *= streak >= 2 ? 0 : 0.4;
            else if (m.id === before) w *= 0.8;
        }
        out[m.id] = w;
    });
    return out;
}

/** Id du membre visé (HERO_ID pour Hou Yi). `members` ne contient que des personnages debout ; vide → Hou Yi. */
export function pickPartyTarget({ members, threat = {}, history = [], now = Date.now(), rng = Math.random }) {
    if (!members?.length) return HERO_ID;
    if (members.length === 1) return members[0].id;
    const weights = targetWeights({ members, threat, history, now });
    let r = rng() * members.reduce((s, m) => s + weights[m.id], 0);
    for (const m of members) if ((r -= weights[m.id]) < 0) return m.id;
    return members[members.length - 1].id;
}

/**
 * combatFlow.js — Règles pures du déroulé d'un combat (sans DOM : testable).
 *  - annonces (début de combat, avantage du terrain) : durée minimale 2 s, fermables ensuite par un clic ;
 *  - attente active d'une condition d'affichage (barre de PV réellement vidée avant l'écran de fin) ;
 *  - coups d'ouverture : seule l'embuscade en offre un (la faiblesse repérée n'en donne plus) ;
 *  - ligne « Faiblesse » de l'infobulle de l'ennemi : seulement si elle a été repérée.
 */
export const MIN_ANNOUNCE_MS = 2000;          // une annonce reste affichée au moins 2 s
export const ANNOUNCE_LINE_MS = 1000;         // durée de lecture ajoutée par ligne d'avantage du terrain (× vitesse des animations)
export const HP_BAR_POLL_MS = 50;
export const HP_BAR_MAX_WAIT_MS = 6000;       // filet de sécurité : l'écran de fin ne reste jamais bloqué plus longtemps
export const HP_BAR_EMPTY_PAUSE_MS = 350;     // courte pause barre vide avant l'écran de fin (× vitesse des animations)

/** Nombre de coups d'ouverture gratuits : l'embuscade en offre un, la faiblesse repérée aucun. */
export function openingStrikeCount(prep) {
    return (prep?.tags || []).filter(tag => tag === 'ambush').length;
}

/** La faiblesse de mana de l'ennemi n'est affichée que si elle a été repérée (tag 'observed' → prep.weaknessRevealed). */
export function isWeaknessShown(prep) {
    return Boolean(prep?.weaknessRevealed);
}

/** Durée automatique d'une annonce : 2 s minimum, plus un temps de lecture par ligne d'avantage. */
export function announceDurationMs(lineCount = 0, factor = 1) {
    return MIN_ANNOUNCE_MS + Math.max(0, lineCount) * ANNOUNCE_LINE_MS * factor;
}

/**
 * Annonce chronométrée. Se termine toute seule après `autoMs` (jamais moins de `minMs`) ; skip() ne la termine
 * qu'une fois `minMs` écoulées. onDone est appelé une seule fois.
 */
export function createAnnouncement({ minMs = MIN_ANNOUNCE_MS, autoMs = minMs, onDone = null, now = () => Date.now() } = {}) {
    const startedAt = now();
    let done = false;
    let timer = null;
    const finish = () => {
        if (done) return false;
        done = true;
        clearTimeout(timer);
        onDone?.();
        return true;
    };
    timer = setTimeout(finish, Math.max(minMs, autoMs));
    const canSkip = () => !done && now() - startedAt >= minMs;
    return {
        canSkip,
        skip: () => (canSkip() ? finish() : false),
        isDone: () => done,
        /** Termine sans condition (combat abandonné, nouveau combat…). */
        cancel: () => finish()
    };
}

/** Appelle cb dès que isReady() est vrai (sondage), ou après maxMs quoi qu'il arrive. Renvoie une fonction d'annulation. */
export function waitUntil(isReady, cb, { pollMs = HP_BAR_POLL_MS, maxMs = HP_BAR_MAX_WAIT_MS } = {}) {
    let finished = false;
    let timer = null;
    const startedAt = Date.now();
    const finish = () => { if (finished) return; finished = true; clearTimeout(timer); cb(); };
    const tick = () => {
        if (finished) return;
        let ready = false;
        try { ready = Boolean(isReady()); } catch { ready = true; }
        if (ready || Date.now() - startedAt >= maxMs) { finish(); return; }
        timer = setTimeout(tick, pollMs);
    };
    tick();
    return () => { finished = true; clearTimeout(timer); };
}

/**
 * La barre de PV d'un combattant est-elle vraiment vide à l'écran ?
 * @param {{ shownValue: number|null, animating: boolean }} bar  valeur affichée (null : pas de barre) et animation en cours
 */
export function isHpBarEmpty({ shownValue, animating }) {
    if (animating) return false;
    if (shownValue === null || shownValue === undefined || Number.isNaN(shownValue)) return true;   // pas de barre à l'écran
    return shownValue <= 0;
}

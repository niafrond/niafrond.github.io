/**
 * actionGuard.js — Anti-« bourrinage » des actions du joueur en combat (module pur, sans DOM : testable).
 *
 * Deux règles :
 *  1. Après une action sur le plateau (échange, chaîne de combos), armes / objets / sorts restent bloqués tant que le
 *     plateau se résout, puis encore BOARD_SETTLE_MS ms (un clic d'arme juste après un échange ne doit pas passer).
 *  2. Après une action du joueur (arme, objet, sort), un délai de ACTION_COOLDOWN_MS ms interdit tout nouveau clic :
 *     marteler le bouton ne déclenche jamais deux coups pour un seul point d'action.
 */
export const ACTION_COOLDOWN_MS = 600;
export const BOARD_SETTLE_MS = 450;
export const BOARD_BUSY_TIMEOUT_MS = 15000; // filet de sécurité : un plateau « occupé » ne bloque jamais plus longtemps

export function createActionGuard(now = () => Date.now()) {
    let boardBusySince = null;
    let lastBoardActionAt = -Infinity;
    let lastPlayerActionAt = -Infinity;

    const isBoardBusy = () => {
        if (boardBusySince === null) return false;
        if (now() - boardBusySince > BOARD_BUSY_TIMEOUT_MS) { boardBusySince = null; return false; }
        return true;
    };

    return {
        /** Le plateau commence à résoudre un échange/une chaîne. */
        beginBoardAction() { boardBusySince = now(); lastBoardActionAt = now(); },
        /** Le plateau a fini (ou l'échange a été annulé). */
        endBoardAction() { boardBusySince = null; lastBoardActionAt = now(); },
        /** Le joueur vient d'utiliser une arme, un objet ou un sort. */
        markPlayerAction() { lastPlayerActionAt = now(); },
        isBoardBusy,
        /** @returns {null|'board'|'settling'|'cooldown'} raison du blocage, null si l'action est permise */
        blockReason() {
            if (isBoardBusy()) return 'board';
            if (now() - lastBoardActionAt < BOARD_SETTLE_MS) return 'settling';
            if (now() - lastPlayerActionAt < ACTION_COOLDOWN_MS) return 'cooldown';
            return null;
        },
        reset() { boardBusySince = null; lastBoardActionAt = -Infinity; lastPlayerActionAt = -Infinity; }
    };
}

/** Instance partagée par board.js et game.js. */
export const actionGuard = createActionGuard();

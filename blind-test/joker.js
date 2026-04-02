/**
 * joker.js — Logique des jokers (application, états, effets)
 *
 * Types :
 *  STEAL  🎯 Vole SCORE.STEAL_AMOUNT pts à une cible (utilisable après avoir gagné un round)
 *  DOUBLE ⚡ Prochain gain ×2
 *  BLOCK  🛡️ Cible : jokers désactivés + gains/pertes = 0 pendant 1 round
 */

import { JOKER, SCORE, MSG } from './constants.js';

/**
 * Crée le stock initial de jokers pour un joueur
 */
export function initialJokers() {
  return {
    [JOKER.STEAL]: 1,
    [JOKER.DOUBLE]: 1,
    [JOKER.BLOCK]: 1,
  };
}

/**
 * Retourne true si le joueur peut utiliser ce joker :
 *  - en a encore en stock
 *  - n'est pas bloqué ce round
 */
export function canUseJoker(player, jokerType, currentRound) {
  if (player.blockedUntilRound > currentRound) return false;
  return (player.jokers[jokerType] ?? 0) > 0;
}

/**
 * Applique un joker sur l'état de la partie (côté host).
 *
 * @param {Object} state — état de jeu (modifié en place)
 * @param {string} fromId — peerId du joueur qui joue le joker
 * @param {string} jokerType — JOKER.STEAL | JOKER.DOUBLE | JOKER.BLOCK
 * @param {string|null} targetId — peerId de la cible (null si DOUBLE)
 * @returns {{ valid: boolean, message?: string }}
 */
export function applyJoker(state, fromId, jokerType, targetId) {
  const from = state.players.find(p => p.id === fromId);
  if (!from) return { valid: false, message: 'Joueur introuvable' };

  if (!canUseJoker(from, jokerType, state.currentRound)) {
    return { valid: false, message: 'Joker indisponible' };
  }

  const target = targetId ? state.players.find(p => p.id === targetId) : null;

  switch (jokerType) {
    case JOKER.STEAL: {
      if (!target) return { valid: false, message: 'Cible requise pour Voler' };
      // Pas d'effet si la cible est bloquée (gains/pertes = 0)
      const stolen = target.blockedUntilRound > state.currentRound ? 0 : SCORE.STEAL_AMOUNT;
      from.score += stolen;
      target.score = Math.max(0, target.score - stolen);
      from.jokers[JOKER.STEAL]--;
      break;
    }

    case JOKER.DOUBLE: {
      from.doubleActive = true;
      from.jokers[JOKER.DOUBLE]--;
      break;
    }

    case JOKER.BLOCK: {
      if (!target) return { valid: false, message: 'Cible requise pour Bloquer' };
      target.blockedUntilRound = state.currentRound + 1;
      from.jokers[JOKER.BLOCK]--;
      break;
    }

    default:
      return { valid: false, message: 'Type de joker inconnu' };
  }

  return { valid: true };
}

/**
 * Calcule le score final pour un joueur qui répond correctement,
 * en tenant compte de DOUBLE et BLOCK.
 */
export function computeCorrectScore(player, baseScore, currentRound) {
  if (player.blockedUntilRound > currentRound) return 0;
  const multiplier = player.doubleActive ? 2 : 1;
  player.doubleActive = false;
  return baseScore * multiplier;
}

/**
 * Calcule le malus pour un joueur qui répond mal (mode CLASSIC_MALUS).
 * Retourne 0 si le joueur est bloqué.
 */
export function computeWrongScore(player, malus, currentRound) {
  if (player.blockedUntilRound > currentRound) return 0;
  return malus; // négatif (ex: -5)
}

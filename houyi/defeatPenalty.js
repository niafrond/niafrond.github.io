// Coût d'une défaite selon la difficulté choisie (Options > Jeu). Module pur (sans DOM), appliqué par game.js (restoreTeamAfterDefeat).
// Par défaut (« Auto », « Histoire », « Facile », « Normal ») une défaite ne coûte rien : l'équipe se relève en pleine forme.
// En « Difficile » et « Expert », elle coûte l'équivalent de l'or d'UN combat gagné au niveau du héros (moyenne de gameTurnFlow.js :
// 3 × niveau + moyenne du bonus aléatoire), jamais plus que l'or porté. Assez pour donner un enjeu, pas assez pour bloquer la partie.
// Valeur validée par l'agent Équilibrage (SPECS.md, 2026-11-22).
export const DEFEAT_PENALTY_DIFFICULTIES = ['hard', 'expert'];

/** Or moyen d'une victoire contre un ennemi de ce niveau (profil 1,0) : 3 × niveau + (2 × niveau + 5) / 2 + 1, arrondi. */
export const averageVictoryGold = level => Math.round(4 * Math.max(1, Math.floor(level || 1)) + 3.5);

/** Or perdu à la défaite (0 hors difficile/expert ; plafonné à l'or porté). */
export function defeatGoldLoss(level, gold, difficulty) {
    if (!DEFEAT_PENALTY_DIFFICULTIES.includes(difficulty)) return 0;
    return Math.max(0, Math.min(Math.floor(gold || 0), averageVictoryGold(level)));
}

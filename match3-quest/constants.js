// Constantes globales utilisées par le jeu
export const colors = ["red","blue","green","yellow","purple"];
// Taille du plateau (cases par côté) : 8 en combat ordinaire, 10 contre un boss (setBoardSize, appelé au début du combat par game.js).
// Liaison vivante : les modules qui importent `boardSize` voient la nouvelle valeur.
export const BASE_BOARD_SIZE = 8;
export const BOSS_BOARD_SIZE = 10;
export let boardSize = BASE_BOARD_SIZE;
export function setBoardSize(n) { boardSize = Math.max(3, Math.floor(n) || BASE_BOARD_SIZE); return boardSize; }

// Limites communes au joueur, aux ennemis et aux boss : 4 sorts équipés au plus, 2 armes (main droite + main gauche).
export const MAX_ACTIVE_SPELLS = 4;
export const MAX_WEAPONS = 2;

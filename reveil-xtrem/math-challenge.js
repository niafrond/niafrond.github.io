// Génération des calculs aléatoires à résoudre pour désactiver une alarme.
//
// Le nombre de calculs à résoudre (alarm.problemsCount, voir alarms.js) est
// réglable indépendamment de la difficulté : la difficulté ne contrôle que
// le type/la taille des nombres de CHAQUE calcul (ci-dessous), pas combien
// il faut en résoudre.

// Suggestion affichée/pré-remplie dans l'écran d'édition quand on choisit une
// difficulté pour une NOUVELLE alarme — l'utilisateur reste libre de l'ajuster.
export const SUGGESTED_PROBLEMS_COUNT = { easy: 1, medium: 2, hard: 3 };

export const DIFFICULTY_LABELS = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addOrSub(minA, maxA, minB, maxB) {
  const op = Math.random() < 0.5 ? '+' : '−';
  let a = randInt(minA, maxA);
  let b = randInt(minB, maxB);
  if (op === '−' && b > a) [a, b] = [b, a];
  return { text: `${a} ${op} ${b}`, answer: op === '+' ? a + b : a - b };
}

/**
 * GIVEN une difficulté — WHEN un problème est demandé — THEN :
 * - easy   : addition à un chiffre (0-9 + 0-9)
 * - medium : addition OU soustraction à deux chiffres (10-50)
 * - hard   : addition/soustraction à deux chiffres (50-99 / 20-60) OU
 *            multiplication (table de 3 à 12)
 */
export function generateProblem(difficulty) {
  switch (difficulty) {
    case 'medium':
      return addOrSub(10, 50, 10, 50);
    case 'hard': {
      if (Math.random() < 0.4) {
        const a = randInt(3, 12);
        const b = randInt(3, 12);
        return { text: `${a} × ${b}`, answer: a * b };
      }
      return addOrSub(50, 99, 20, 60);
    }
    case 'easy':
    default:
      return addOrSub(0, 9, 0, 9);
  }
}

export function suggestedProblemsCount(difficulty) {
  return SUGGESTED_PROBLEMS_COUNT[difficulty] ?? SUGGESTED_PROBLEMS_COUNT.easy;
}

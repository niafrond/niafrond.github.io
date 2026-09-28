// Génération des calculs aléatoires à résoudre pour désactiver une alarme.
//
// 5 niveaux calqués sur ceux d'Alarm Clock Xtreme (slider "Très facile" à
// "Très difficile"). Le nombre de calculs à résoudre (alarm.problemsCount,
// voir alarms.js) est réglable indépendamment de la difficulté : la
// difficulté ne contrôle que le type/la taille des nombres de CHAQUE calcul
// (ci-dessous), pas combien il faut en résoudre.

// Ordre d'affichage sur le slider de l'écran d'édition (index 0 = le plus facile).
export const DIFFICULTY_ORDER = ['veryEasy', 'easy', 'medium', 'hard', 'veryHard'];

export const DIFFICULTY_LABELS = {
  veryEasy: 'Très facile',
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
  veryHard: 'Très difficile',
};

// Suggestion affichée/pré-remplie dans l'écran d'édition quand on choisit une
// difficulté pour une NOUVELLE alarme — l'utilisateur reste libre de l'ajuster.
export const SUGGESTED_PROBLEMS_COUNT = {
  veryEasy: 1,
  easy: 1,
  medium: 2,
  hard: 2,
  veryHard: 3,
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

// Ex. "112 − 62 − 27" : trois nombres enchaînés, jamais de résultat négatif
// (bascule sur "+" quand la soustraction passerait sous 10).
function chainedAddOrSub() {
  let total = randInt(100, 199);
  let text = String(total);
  for (let i = 0; i < 2; i++) {
    const n = randInt(10, 99);
    const useMinus = total - n >= 10;
    total = useMinus ? total - n : total + n;
    text += ` ${useMinus ? '−' : '+'} ${n}`;
  }
  return { text, answer: total };
}

// Ex. "9 × 31 − 264" : une multiplication suivie d'une soustraction qui
// reste positive (c toujours strictement inférieur au produit).
function multiplyThenSubtract() {
  const a = randInt(3, 12);
  const b = randInt(15, 40);
  const product = a * b;
  const c = randInt(Math.max(1, Math.floor(product * 0.3)), Math.max(2, product - 10));
  return { text: `${a} × ${b} − ${c}`, answer: product - c };
}

/**
 * GIVEN une difficulté — WHEN un problème est demandé — THEN :
 * - veryEasy : addition/soustraction à un chiffre (0-9), ex. "6 − 2"
 * - easy     : un nombre à deux chiffres (10-20) et un à un chiffre (1-9), ex. "15 − 8"
 * - medium   : deux nombres à deux chiffres (10-50), ex. "36 − 19"
 * - hard     : trois nombres enchaînés (100-199 puis deux fois 10-99), ex. "112 − 62 − 27"
 * - veryHard : une multiplication (3-12 × 15-40) suivie d'une soustraction, ex. "9 × 31 − 264"
 */
export function generateProblem(difficulty) {
  switch (difficulty) {
    case 'easy':
      return addOrSub(10, 20, 1, 9);
    case 'medium':
      return addOrSub(10, 50, 10, 50);
    case 'hard':
      return chainedAddOrSub();
    case 'veryHard':
      return multiplyThenSubtract();
    case 'veryEasy':
    default:
      return addOrSub(0, 9, 0, 9);
  }
}

export function suggestedProblemsCount(difficulty) {
  return SUGGESTED_PROBLEMS_COUNT[difficulty] ?? SUGGESTED_PROBLEMS_COUNT.veryEasy;
}

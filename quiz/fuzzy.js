/**
 * fuzzy.js — Validation floue des réponses (fautes d'orthographe tolérées)
 * Adapté de blind-test/fuzzy.js pour une réponse unique (pas artiste/titre).
 */

/**
 * Normalise un texte pour la comparaison :
 * - lowercase, trim
 * - suppression des accents
 * - suppression des articles courants
 * - suppression de la ponctuation
 */
export function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, ' ')
    .replace(/\b(le|la|les|l|the|un|une|a|an|de|du|des|d|feat|ft|vs)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distance de Levenshtein entre deux chaînes */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function normalizeStrict(str) {
  return normalize(str).replace(/\s/g, '');
}

function getThreshold(strictRefLen) {
  if (strictRefLen <= 3) return 0;
  if (strictRefLen <= 5) return 1;
  return Math.floor(strictRefLen / 4) + 1;
}

/**
 * Vérifie si `guess` correspond à `reference` avec tolérance aux fautes.
 */
export function fuzzyMatch(guess, reference) {
  const g = normalize(guess);
  const r = normalize(reference);
  if (!g || !r) return false;
  if (g === r) return true;

  const gs = normalizeStrict(guess);
  const rs = normalizeStrict(reference);
  if (gs === rs) return true;

  const dist = levenshtein(gs, rs);
  return dist <= getThreshold(rs.length);
}

/**
 * Valide la réponse du joueur par rapport à la bonne réponse.
 * Renvoie true si la réponse est correcte (fuzzy).
 */
export function validateAnswer(guess, correctAnswer) {
  return fuzzyMatch(guess, correctAnswer);
}

/**
 * Calcule le "score de proximité" entre guess et reference.
 * Renvoie 0 si correct, la distance sinon (utile pour feedback "presque !")
 */
export function proximityScore(guess, reference) {
  const gs = normalizeStrict(guess);
  const rs = normalizeStrict(reference);
  if (!gs || !rs) return Infinity;
  return levenshtein(gs, rs);
}

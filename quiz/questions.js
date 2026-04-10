/**
 * questions.js — Récupération et normalisation des questions
 *
 * Source primaire  : The Trivia API (https://the-trivia-api.com/v2/questions)
 *   - Supporte le français via le paramètre `language=fr`
 *   - Gratuit, sans clé API, CORS activé
 *
 * Source secondaire : QuizzAPI v2 (https://quizzapi.jomoreschi.fr/api/v2/quiz)
 *   - API francophone participative
 *   - Gratuit, sans clé API, CORS activé
 *   - Difficulties : facile | normal | difficile
 *
 * Source de secours : questions françaises intégrées (environ 100 questions)
 */

import { BUNDLED_QUESTIONS } from './questions-data.js';

const TRIVIA_API_BASE = 'https://the-trivia-api.com/v2/questions';
const QUIZZ_API_BASE = 'https://quizzapi.jomoreschi.fr/api/v2/quiz';

/**
 * Correspondance entre les clés de difficulté internes et les valeurs attendues
 * par QuizzAPI v2.
 */
const DIFFICULTY_TO_QUIZZAPI = {
  easy: 'facile',
  medium: 'normal',
  hard: 'difficile',
};

/**
 * Correspondance entre les clés de catégorie internes (The Trivia API) et les
 * slugs de catégorie QuizzAPI v2.
 * Les catégories sans équivalent (reunion, children, photo) ne sont pas listées
 * car elles sont traitées en local-only.
 */
const CATEGORY_TO_QUIZZAPI = {
  history: 'histoire',
  general_knowledge: 'culture_generale',
  geography: 'geographie',
  music: 'musique',
  film_and_tv: 'cinema_et_television',
  science: 'sciences',
  sport_and_leisure: 'sport',
  arts_and_literature: 'arts_et_litterature',
  food_and_drink: 'cuisine_et_boissons',
  society_and_culture: 'societe_et_culture',
};

/** Nombre minimum de questions valides attendues en réponse de l'API */
const MIN_QUESTIONS_THRESHOLD = 3;

/**
 * Vérifie si une URL d'image est accessible dans le navigateur (timeout 5 s).
 * Utilise un élément Image pour éviter les restrictions CORS.
 * En dehors d'un navigateur (tests Node.js), résout toujours à true.
 *
 * @param {string} url
 * @returns {Promise<boolean>}
 */
function isImageReachable(url) {
  if (typeof Image === 'undefined') return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 5000);
    const img = new Image();
    img.onload  = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}

/**
 * Parcourt les questions contenant une imageUrl et remplace celles dont
 * l'image est inaccessible par une question bundlée photo valide.
 * Les vérifications sont faites en parallèle pour minimiser le délai.
 *
 * @param {Array} questions — liste de questions normalisées
 * @returns {Promise<Array>}
 */
async function filterReachablePhotoQuestions(questions) {
  const photoIndices = questions.map((q, i) => q.imageUrl ? i : -1).filter(i => i >= 0);
  if (photoIndices.length === 0) return questions;

  // Vérifier toutes les images sélectionnées en parallèle
  const reachability = await Promise.all(photoIndices.map(i => isImageReachable(questions[i].imageUrl)));
  const unreachableIndices = photoIndices.filter((_, j) => !reachability[j]);
  if (unreachableIndices.length === 0) return questions;

  console.warn(`[Quiz] ${unreachableIndices.length} photo(s) inaccessible(s), remplacement en cours…`);

  // Construire un pool de remplacement depuis les questions bundlées non encore sélectionnées
  const usedIds = new Set(questions.map(q => q.id));
  const pool = shuffle(BUNDLED_QUESTIONS.filter(q => q.imageUrl && !usedIds.has(q.id)));

  if (pool.length === 0) return questions;

  // Vérifier toutes les photos du pool en parallèle pour trouver des remplaçants valides
  const poolReachability = await Promise.all(pool.map(q => isImageReachable(q.imageUrl)));
  const reachablePool = pool.filter((_, i) => poolReachability[i]);

  const result = [...questions];
  let repl = 0;
  for (const idx of unreachableIndices) {
    if (repl >= reachablePool.length) break;
    const candidate = reachablePool[repl++];
    result[idx] = { ...candidate, choices: shuffle([candidate.correctAnswer, ...candidate.incorrectAnswers]) };
  }
  return result;
}

/** Mélange un tableau */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Normalise un objet question depuis The Trivia API */
function normalizeApiQuestion(q) {
  const allAnswers = [q.correctAnswer, ...(q.incorrectAnswers ?? [])];
  return {
    id: q.id ?? crypto.randomUUID(),
    text: q.question?.text ?? String(q.question),
    correctAnswer: q.correctAnswer,
    choices: shuffle(allAnswers),
    category: q.category ?? 'general_knowledge',
    difficulty: q.difficulty ?? 'medium',
    trivia: q.trivia ?? null,
  };
}

/** Normalise un objet question depuis QuizzAPI v2 */
function normalizeQuizzApiQuestion(q) {
  const difficultyMap = { facile: 'easy', normal: 'medium', difficile: 'hard' };
  const allAnswers = [q.answer, ...(q.badAnswers ?? [])];
  return {
    id: `quizzapi-${q.id}`,
    text: String(q.question),
    correctAnswer: q.answer,
    choices: shuffle(allAnswers),
    category: q.category?.slug ?? q.category ?? 'general_knowledge',
    difficulty: difficultyMap[q.difficulty] ?? 'medium',
    trivia: null,
  };
}

/**
 * Récupère des questions depuis QuizzAPI v2.
 *
 * @param {{ count?: number, categories?: string[], difficulties?: string[] }} opts
 * @returns {Promise<Array>}
 *
 * Notes:
 * - La catégorie n'est envoyée en filtre que si une seule catégorie est demandée
 *   (l'API n'accepte qu'un slug à la fois).
 * - La difficulté n'est envoyée en filtre que si une seule difficulté est demandée;
 *   plusieurs difficultés sont filtrées côté client après réception.
 */
async function fetchFromQuizzApi({ count = 10, categories = [], difficulties = [] } = {}) {
  const params = new URLSearchParams({ limit: String(count) });

  // Mapper les catégories internes vers les slugs QuizzAPI
  const quizzApiCategories = categories
    .map(c => CATEGORY_TO_QUIZZAPI[c])
    .filter(Boolean);
  if (quizzApiCategories.length === 1) {
    params.append('category', quizzApiCategories[0]);
  }

  // Mapper les difficultés internes vers les valeurs QuizzAPI (une seule à la fois)
  const quizzApiDifficulties = difficulties
    .map(d => DIFFICULTY_TO_QUIZZAPI[d])
    .filter(Boolean);
  if (quizzApiDifficulties.length === 1) {
    params.append('difficulty', quizzApiDifficulties[0]);
  }

  const res = await fetch(`${QUIZZ_API_BASE}?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.quizzes) || data.quizzes.length < Math.min(count, MIN_QUESTIONS_THRESHOLD)) {
    throw new Error('Trop peu de questions reçues');
  }
  let questions = data.quizzes.map(normalizeQuizzApiQuestion);
  // Post-filter par difficulté si plusieurs ont été demandées
  if (difficulties.length > 1) {
    questions = questions.filter(q => difficulties.includes(q.difficulty));
  }
  return questions;
}

/**
 * Catégories disponibles uniquement dans les questions intégrées (pas via l'API).
 * Pour ces catégories, l'appel API est ignoré.
 */
const LOCAL_ONLY_CATEGORIES = ['reunion', 'children', 'photo'];

/**
 * Récupère des questions depuis The Trivia API avec langue française.
 * Bascule sur les questions intégrées en cas d'échec.
 *
 * @param {{ count?: number, categories?: string[], difficulties?: string[] }} opts
 * @returns {Promise<Array>}
 */
export async function fetchQuestions({ count = 10, categories = [], difficulties = [] } = {}) {
  const params = new URLSearchParams({ limit: String(count), language: 'fr' });
  if (categories.length > 0) params.append('categories', categories.join(','));
  if (difficulties.length === 1) params.append('difficulty', difficulties[0]);

  let apiQuestions = [];
  // Skip API if all selected categories are local-only (e.g. reunion)
  const skipApi = categories.length > 0 && categories.every(c => LOCAL_ONLY_CATEGORIES.includes(c));
  if (!skipApi) {
    try {
      const res = await fetch(`${TRIVIA_API_BASE}?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length < Math.min(count, MIN_QUESTIONS_THRESHOLD)) {
        throw new Error('Trop peu de questions reçues');
      }
      apiQuestions = data.map(normalizeApiQuestion);
      // Post-filter by difficulties when multiple are selected (API only accepts one)
      if (difficulties.length > 1) {
        apiQuestions = apiQuestions.filter(q => difficulties.includes(q.difficulty));
      }
    } catch (err) {
      console.warn('[Quiz] API indisponible, utilisation des questions intégrées :', err.message);
    }
  }

  if (apiQuestions.length >= count) return filterReachablePhotoQuestions(apiQuestions);

  // Compléter avec QuizzAPI v2 si l'API primaire a renvoyé trop peu
  const needed = count - apiQuestions.length;
  const primaryIds = new Set(apiQuestions.map(q => q.id));
  if (!skipApi) {
    try {
      const quizzApiQuestions = await fetchFromQuizzApi({ count: needed, categories, difficulties });
      const newQuestions = quizzApiQuestions.filter(q => !primaryIds.has(q.id));
      apiQuestions = [...apiQuestions, ...newQuestions];
    } catch (err) {
      console.warn('[Quiz] QuizzAPI indisponible, utilisation des questions intégrées :', err.message);
    }
  }

  if (apiQuestions.length >= count) return apiQuestions.slice(0, count);

  // Compléter avec des questions intégrées si les deux APIs ont renvoyé trop peu
  const remaining = count - apiQuestions.length;
  const apiIds = new Set(apiQuestions.map(q => q.id));
  const bundled = getBundledQuestions(remaining, categories, difficulties).filter(q => !apiIds.has(q.id));
  return filterReachablePhotoQuestions([...apiQuestions, ...bundled].slice(0, count));
}

/** Renvoie des questions depuis le jeu intégré */
function getBundledQuestions(count, categories, difficulties) {
  let pool = BUNDLED_QUESTIONS;
  if (categories.length > 0) pool = pool.filter(q => categories.includes(q.category));
  if (difficulties.length > 0) pool = pool.filter(q => difficulties.includes(q.difficulty));

  // Si le filtre combiné donne trop peu, relâcher progressivement
  if (pool.length < Math.min(count, MIN_QUESTIONS_THRESHOLD)) {
    // Garder les catégories, ignorer la difficulté
    if (categories.length > 0) pool = BUNDLED_QUESTIONS.filter(q => categories.includes(q.category));
    // Si encore trop peu, ignorer les deux filtres
    if (pool.length < MIN_QUESTIONS_THRESHOLD) pool = BUNDLED_QUESTIONS;
  }

  return shuffle(pool)
    .slice(0, count)
    .map(q => ({ ...q, choices: shuffle([q.correctAnswer, ...q.incorrectAnswers]) }));
}


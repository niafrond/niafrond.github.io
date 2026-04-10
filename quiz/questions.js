/**
 * questions.js — Récupération et normalisation des questions
 *
 * Source primaire : The Trivia API (https://the-trivia-api.com/v2/questions)
 *   - Supporte le français via le paramètre `language=fr`
 *   - Gratuit, sans clé API, CORS activé
 *
 * Source de secours : questions françaises intégrées (environ 100 questions)
 */

import { BUNDLED_QUESTIONS } from './questions-data.js';

const TRIVIA_API_BASE = 'https://the-trivia-api.com/v2/questions';

/** Nombre minimum de questions valides attendues en réponse de l'API */
const MIN_QUESTIONS_THRESHOLD = 3;

/** Mélange un tableau */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Normalise un objet question depuis l'API */
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

/**
 * Catégories disponibles uniquement dans les questions intégrées (pas via l'API).
 * Pour ces catégories, l'appel API est ignoré.
 */
const LOCAL_ONLY_CATEGORIES = ['reunion', 'children'];

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

  if (apiQuestions.length >= count) return apiQuestions;

  // Compléter avec des questions intégrées si l'API a renvoyé trop peu
  const needed = count - apiQuestions.length;
  const apiIds = new Set(apiQuestions.map(q => q.id));
  const bundled = getBundledQuestions(needed, categories, difficulties).filter(q => !apiIds.has(q.id));
  return [...apiQuestions, ...bundled].slice(0, count);
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


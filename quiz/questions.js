/**
 * questions.js — Récupération et normalisation des questions
 *
 * Source primaire : The Trivia API (https://the-trivia-api.com/v2/questions)
 *   - Supporte le français via le paramètre `language=fr`
 *   - Gratuit, sans clé API, CORS activé
 *
 * Source de secours : questions françaises intégrées (environ 100 questions)
 */

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
  };
}

/**
 * Catégories disponibles uniquement dans les questions intégrées (pas via l'API).
 * Pour ces catégories, l'appel API est ignoré.
 */
const LOCAL_ONLY_CATEGORIES = ['reunion'];

/**
 * Récupère des questions depuis The Trivia API avec langue française.
 * Bascule sur les questions intégrées en cas d'échec.
 *
 * @param {{ count?: number, category?: string, difficulty?: string }} opts
 * @returns {Promise<Array>}
 */
export async function fetchQuestions({ count = 10, category = '', difficulty = '' } = {}) {
  const params = new URLSearchParams({ limit: String(count), language: 'fr' });
  if (category) params.append('categories', category);
  if (difficulty) params.append('difficulty', difficulty);

  let apiQuestions = [];
  if (!LOCAL_ONLY_CATEGORIES.includes(category)) {
    try {
      const res = await fetch(`${TRIVIA_API_BASE}?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length < Math.min(count, MIN_QUESTIONS_THRESHOLD)) {
        throw new Error('Trop peu de questions reçues');
      }
      apiQuestions = data.map(normalizeApiQuestion);
    } catch (err) {
      console.warn('[Quiz] API indisponible, utilisation des questions intégrées :', err.message);
    }
  }

  if (apiQuestions.length >= count) return apiQuestions;

  // Compléter avec des questions intégrées si l'API a renvoyé trop peu
  const needed = count - apiQuestions.length;
  const apiIds = new Set(apiQuestions.map(q => q.id));
  const bundled = getBundledQuestions(needed, category, difficulty).filter(q => !apiIds.has(q.id));
  return [...apiQuestions, ...bundled].slice(0, count);
}

/** Renvoie des questions depuis le jeu intégré */
function getBundledQuestions(count, category, difficulty) {
  let pool = BUNDLED_QUESTIONS;
  if (category) pool = pool.filter(q => q.category === category);
  if (difficulty) pool = pool.filter(q => q.difficulty === difficulty);

  // Si le filtre combiné donne trop peu, relâcher progressivement
  if (pool.length < Math.min(count, MIN_QUESTIONS_THRESHOLD)) {
    // Garder la catégorie, ignorer la difficulté
    if (category) pool = BUNDLED_QUESTIONS.filter(q => q.category === category);
    // Si encore trop peu, ignorer les deux filtres
    if (pool.length < MIN_QUESTIONS_THRESHOLD) pool = BUNDLED_QUESTIONS;
  }

  return shuffle(pool)
    .slice(0, count)
    .map(q => ({ ...q, choices: shuffle([q.correctAnswer, ...q.incorrectAnswers]) }));
}

// ─── Questions françaises intégrées (~100 questions) ──────────────────────────
// Utilisées en fallback si l'API est inaccessible

const BUNDLED_QUESTIONS = [
  // ── Histoire ──────────────────────────────────────────────────────────────
  { id: 'h01', category: 'history', difficulty: 'easy',
    text: 'En quelle année a eu lieu la Révolution française ?',
    correctAnswer: '1789', incorrectAnswers: ['1776', '1804', '1815'] },
  { id: 'h02', category: 'history', difficulty: 'easy',
    text: 'Qui était le premier Président de la Ve République française ?',
    correctAnswer: 'Charles de Gaulle', incorrectAnswers: ['Georges Pompidou', 'François Mitterrand', 'Valéry Giscard d\'Estaing'] },
  { id: 'h03', category: 'history', difficulty: 'easy',
    text: 'En quelle année le mur de Berlin est-il tombé ?',
    correctAnswer: '1989', incorrectAnswers: ['1987', '1991', '1985'] },
  { id: 'h04', category: 'history', difficulty: 'easy',
    text: 'Quel roi de France était surnommé "le Roi-Soleil" ?',
    correctAnswer: 'Louis XIV', incorrectAnswers: ['Louis XV', 'Louis XVI', 'François Ier'] },
  { id: 'h05', category: 'history', difficulty: 'easy',
    text: 'En quelle année Christophe Colomb a-t-il découvert l\'Amérique ?',
    correctAnswer: '1492', incorrectAnswers: ['1488', '1500', '1497'] },
  { id: 'h06', category: 'history', difficulty: 'medium',
    text: 'En quelle année Napoléon Bonaparte a-t-il été exilé à Sainte-Hélène ?',
    correctAnswer: '1815', incorrectAnswers: ['1814', '1821', '1808'] },
  { id: 'h07', category: 'history', difficulty: 'medium',
    text: 'Quel empire a été le plus grand de l\'histoire par superficie ?',
    correctAnswer: 'L\'empire mongol', incorrectAnswers: ['L\'empire britannique', 'L\'empire romain', 'L\'empire ottoman'] },
  { id: 'h08', category: 'history', difficulty: 'easy',
    text: 'Quelle guerre s\'est terminée avec le traité de Versailles en 1919 ?',
    correctAnswer: 'La Première Guerre mondiale', incorrectAnswers: ['La Seconde Guerre mondiale', 'La guerre franco-prussienne', 'La guerre de Crimée'] },
  { id: 'h09', category: 'history', difficulty: 'medium',
    text: 'Quel pharaon est associé au tombeau découvert en 1922 dans la Vallée des Rois ?',
    correctAnswer: 'Toutankhamon', incorrectAnswers: ['Ramsès II', 'Akhenaton', 'Séti Ier'] },
  { id: 'h10', category: 'history', difficulty: 'easy',
    text: 'Qui a peint la Joconde ?',
    correctAnswer: 'Léonard de Vinci', incorrectAnswers: ['Michel-Ange', 'Raphaël', 'Botticelli'] },
  { id: 'h11', category: 'history', difficulty: 'medium',
    text: 'En quelle année les femmes ont-elles obtenu le droit de vote en France ?',
    correctAnswer: '1944', incorrectAnswers: ['1920', '1936', '1958'] },
  { id: 'h12', category: 'history', difficulty: 'hard',
    text: 'Quel traité a mis fin à la guerre de Trente Ans en 1648 ?',
    correctAnswer: 'La paix de Westphalie', incorrectAnswers: ['Le traité de Vienne', 'La paix d\'Utrecht', 'Le traité de Nimègue'] },

  // ── Géographie ────────────────────────────────────────────────────────────
  { id: 'g01', category: 'geography', difficulty: 'medium',
    text: 'Quelle est la capitale de l\'Australie ?',
    correctAnswer: 'Canberra', incorrectAnswers: ['Sydney', 'Melbourne', 'Brisbane'] },
  { id: 'g02', category: 'geography', difficulty: 'easy',
    text: 'Quel est le plus long fleuve du monde ?',
    correctAnswer: 'Le Nil', incorrectAnswers: ['L\'Amazone', 'Le Yangtsé', 'Le Mississippi'] },
  { id: 'g03', category: 'geography', difficulty: 'easy',
    text: 'Dans quel pays se trouve le Machu Picchu ?',
    correctAnswer: 'Pérou', incorrectAnswers: ['Mexique', 'Bolivie', 'Équateur'] },
  { id: 'g04', category: 'geography', difficulty: 'easy',
    text: 'Quel est le plus petit pays du monde ?',
    correctAnswer: 'Vatican', incorrectAnswers: ['Monaco', 'Saint-Marin', 'Liechtenstein'] },
  { id: 'g05', category: 'geography', difficulty: 'easy',
    text: 'Quelle est la plus haute montagne du monde ?',
    correctAnswer: 'Mont Everest', incorrectAnswers: ['K2', 'Kangchenjunga', 'Mont Blanc'] },
  { id: 'g06', category: 'geography', difficulty: 'easy',
    text: 'Quel est le plus grand désert chaud du monde ?',
    correctAnswer: 'Le Sahara', incorrectAnswers: ['Le désert d\'Arabie', 'Le Gobi', 'Le Namib'] },
  { id: 'g07', category: 'geography', difficulty: 'easy',
    text: 'Quel océan est le plus grand ?',
    correctAnswer: 'L\'océan Pacifique', incorrectAnswers: ['L\'océan Atlantique', 'L\'océan Indien', 'L\'océan Arctique'] },
  { id: 'g08', category: 'geography', difficulty: 'medium',
    text: 'Quelle ville est la plus peuplée du monde ?',
    correctAnswer: 'Tokyo', incorrectAnswers: ['Delhi', 'Shanghai', 'São Paulo'] },
  { id: 'g09', category: 'geography', difficulty: 'easy',
    text: 'Quel est le pays le plus grand du monde ?',
    correctAnswer: 'La Russie', incorrectAnswers: ['Le Canada', 'La Chine', 'Les États-Unis'] },
  { id: 'g10', category: 'geography', difficulty: 'medium',
    text: 'Quel est le plus long fleuve d\'Europe ?',
    correctAnswer: 'La Volga', incorrectAnswers: ['Le Danube', 'Le Rhin', 'La Loire'] },
  { id: 'g11', category: 'geography', difficulty: 'medium',
    text: 'Combien de pays composent l\'Amérique du Sud ?',
    correctAnswer: '12', incorrectAnswers: ['10', '14', '11'] },
  { id: 'g12', category: 'geography', difficulty: 'easy',
    text: 'Quelle est la capitale du Brésil ?',
    correctAnswer: 'Brasília', incorrectAnswers: ['Rio de Janeiro', 'São Paulo', 'Salvador'] },

  // ── Sciences ──────────────────────────────────────────────────────────────
  { id: 's01', category: 'science', difficulty: 'easy',
    text: 'Quel est le symbole chimique de l\'or ?',
    correctAnswer: 'Au', incorrectAnswers: ['Ag', 'Fe', 'Cu'] },
  { id: 's02', category: 'science', difficulty: 'medium',
    text: 'Combien d\'os possède le corps humain adulte ?',
    correctAnswer: '206', incorrectAnswers: ['196', '216', '186'] },
  { id: 's03', category: 'science', difficulty: 'easy',
    text: 'Quelle planète est la plus grande du système solaire ?',
    correctAnswer: 'Jupiter', incorrectAnswers: ['Saturne', 'Uranus', 'Neptune'] },
  { id: 's04', category: 'science', difficulty: 'easy',
    text: 'Quel gaz est le plus abondant dans l\'atmosphère terrestre ?',
    correctAnswer: 'L\'azote', incorrectAnswers: ['L\'oxygène', 'Le dioxyde de carbone', 'L\'argon'] },
  { id: 's05', category: 'science', difficulty: 'easy',
    text: 'Qui a théorisé la relativité générale ?',
    correctAnswer: 'Albert Einstein', incorrectAnswers: ['Isaac Newton', 'Nikola Tesla', 'Max Planck'] },
  { id: 's06', category: 'science', difficulty: 'easy',
    text: 'Quel est le numéro atomique de l\'hydrogène ?',
    correctAnswer: '1', incorrectAnswers: ['2', '6', '8'] },
  { id: 's07', category: 'science', difficulty: 'medium',
    text: 'Combien de chromosomes possède une cellule humaine normale ?',
    correctAnswer: '46', incorrectAnswers: ['23', '48', '42'] },
  { id: 's08', category: 'science', difficulty: 'easy',
    text: 'Quelle est la formule chimique de l\'eau ?',
    correctAnswer: 'H₂O', incorrectAnswers: ['CO₂', 'H₂O₂', 'NaCl'] },
  { id: 's09', category: 'science', difficulty: 'medium',
    text: 'À combien de degrés Celsius l\'eau bout-elle au niveau de la mer ?',
    correctAnswer: '100', incorrectAnswers: ['90', '110', '95'] },
  { id: 's10', category: 'science', difficulty: 'hard',
    text: 'Quelle particule subatomique a une charge électrique positive ?',
    correctAnswer: 'Le proton', incorrectAnswers: ['L\'électron', 'Le neutron', 'Le quark'] },
  { id: 's11', category: 'science', difficulty: 'medium',
    text: 'Quel scientifique a découvert la pénicilline ?',
    correctAnswer: 'Alexander Fleming', incorrectAnswers: ['Louis Pasteur', 'Marie Curie', 'Joseph Lister'] },
  { id: 's12', category: 'science', difficulty: 'easy',
    text: 'Combien de planètes compte notre système solaire ?',
    correctAnswer: '8', incorrectAnswers: ['9', '7', '10'] },

  // ── Culture Générale ──────────────────────────────────────────────────────
  { id: 'c01', category: 'general_knowledge', difficulty: 'medium',
    text: 'Quelle est la langue la plus parlée dans le monde ?',
    correctAnswer: 'Le mandarin', incorrectAnswers: ['L\'anglais', 'L\'espagnol', 'L\'hindi'] },
  { id: 'c02', category: 'general_knowledge', difficulty: 'easy',
    text: 'Combien de couleurs comporte un arc-en-ciel ?',
    correctAnswer: '7', incorrectAnswers: ['6', '8', '5'] },
  { id: 'c03', category: 'general_knowledge', difficulty: 'easy',
    text: 'Quelle est la monnaie officielle du Japon ?',
    correctAnswer: 'Le yen', incorrectAnswers: ['Le won', 'Le yuan', 'Le dong'] },
  { id: 'c04', category: 'general_knowledge', difficulty: 'easy',
    text: 'Combien de joueurs composent une équipe de football ?',
    correctAnswer: '11', incorrectAnswers: ['10', '12', '9'] },
  { id: 'c05', category: 'general_knowledge', difficulty: 'medium',
    text: 'En quelle année ont eu lieu les premiers Jeux Olympiques modernes ?',
    correctAnswer: '1896', incorrectAnswers: ['1900', '1888', '1904'] },
  { id: 'c06', category: 'general_knowledge', difficulty: 'easy',
    text: 'Quelle est la devise de la France ?',
    correctAnswer: 'Liberté, Égalité, Fraternité', incorrectAnswers: ['Honneur et Patrie', 'Liberté, Justice, Fraternité', 'Unité, Travail, Progrès'] },
  { id: 'c07', category: 'general_knowledge', difficulty: 'medium',
    text: 'Quel est l\'instrument à cordes le plus grand de l\'orchestre ?',
    correctAnswer: 'La contrebasse', incorrectAnswers: ['Le violoncelle', 'La harpe', 'La guitare basse'] },
  { id: 'c08', category: 'general_knowledge', difficulty: 'easy',
    text: 'Quel est l\'animal le plus rapide du monde ?',
    correctAnswer: 'Le guépard', incorrectAnswers: ['Le lion', 'L\'antilope', 'Le faucon pèlerin'] },
  { id: 'c09', category: 'general_knowledge', difficulty: 'easy',
    text: 'Combien de secondes y a-t-il dans une heure ?',
    correctAnswer: '3600', incorrectAnswers: ['600', '1800', '7200'] },
  { id: 'c10', category: 'general_knowledge', difficulty: 'medium',
    text: 'Quel est le numéro d\'urgence européen ?',
    correctAnswer: '112', incorrectAnswers: ['999', '911', '118'] },

  // ── Cinéma & TV ───────────────────────────────────────────────────────────
  { id: 'f01', category: 'film_and_tv', difficulty: 'easy',
    text: 'Quel acteur joue Tony Stark / Iron Man dans les films Marvel ?',
    correctAnswer: 'Robert Downey Jr.', incorrectAnswers: ['Chris Evans', 'Chris Hemsworth', 'Mark Ruffalo'] },
  { id: 'f02', category: 'film_and_tv', difficulty: 'easy',
    text: 'Quel film Disney raconte l\'histoire d\'un poisson-clown cherchant son fils ?',
    correctAnswer: 'Le Monde de Nemo', incorrectAnswers: ['Dumbo', 'Bambi', 'L\'Île au trésor'] },
  { id: 'f03', category: 'film_and_tv', difficulty: 'medium',
    text: 'Quelle actrice française a remporté l\'Oscar de la meilleure actrice en 2012 ?',
    correctAnswer: 'Marion Cotillard', incorrectAnswers: ['Audrey Tautou', 'Isabelle Huppert', 'Juliette Binoche'] },
  { id: 'f04', category: 'film_and_tv', difficulty: 'medium',
    text: 'Dans quel film Jodie Foster joue-t-elle la détective Clarice Starling ?',
    correctAnswer: 'Le Silence des agneaux', incorrectAnswers: ['Panic Room', 'Contact', 'Nell'] },
  { id: 'f05', category: 'film_and_tv', difficulty: 'medium',
    text: 'Quel film a remporté la Palme d\'Or à Cannes en 2019 ?',
    correctAnswer: 'Parasite', incorrectAnswers: ['Titane', 'Portrait de la jeune fille en feu', 'Once Upon a Time in Hollywood'] },
  { id: 'f06', category: 'film_and_tv', difficulty: 'easy',
    text: 'Qui a réalisé la trilogie "Le Seigneur des Anneaux" ?',
    correctAnswer: 'Peter Jackson', incorrectAnswers: ['Ridley Scott', 'James Cameron', 'Steven Spielberg'] },
  { id: 'f07', category: 'film_and_tv', difficulty: 'easy',
    text: 'Dans quelle série trouve-t-on la famille Stark de Winterfell ?',
    correctAnswer: 'Game of Thrones', incorrectAnswers: ['Vikings', 'The Last Kingdom', 'Outlander'] },
  { id: 'f08', category: 'film_and_tv', difficulty: 'medium',
    text: 'Quel film de Stanley Kubrick se passe à bord d\'une station spatiale en route vers Jupiter ?',
    correctAnswer: '2001 : l\'Odyssée de l\'espace', incorrectAnswers: ['Full Metal Jacket', 'Eyes Wide Shut', 'Barry Lyndon'] },
  { id: 'f09', category: 'film_and_tv', difficulty: 'easy',
    text: 'Dans quel pays a été créée la série "La Casa de Papel" ?',
    correctAnswer: 'Espagne', incorrectAnswers: ['Mexique', 'Colombie', 'Argentine'] },
  { id: 'f10', category: 'film_and_tv', difficulty: 'medium',
    text: 'Quel réalisateur français est connu pour la trilogie "Trois couleurs" ?',
    correctAnswer: 'Krzysztof Kieślowski', incorrectAnswers: ['Jean-Luc Godard', 'François Truffaut', 'Claude Chabrol'] },

  // ── Sport ─────────────────────────────────────────────────────────────────
  { id: 'sp01', category: 'sport_and_leisure', difficulty: 'medium',
    text: 'Combien de fois la France a-t-elle remporté la Coupe du Monde de football ?',
    correctAnswer: '2', incorrectAnswers: ['1', '3', '4'] },
  { id: 'sp02', category: 'sport_and_leisure', difficulty: 'easy',
    text: 'Quel pays a remporté le plus de Coupes du Monde de football ?',
    correctAnswer: 'Brésil', incorrectAnswers: ['Allemagne', 'Italie', 'Argentine'] },
  { id: 'sp03', category: 'sport_and_leisure', difficulty: 'medium',
    text: 'Quelle est la longueur officielle d\'un marathon ?',
    correctAnswer: '42,195 km', incorrectAnswers: ['40 km', '45 km', '41 km'] },
  { id: 'sp04', category: 'sport_and_leisure', difficulty: 'easy',
    text: 'Quel athlète est surnommé "La Foudre" ou "Lightning Bolt" ?',
    correctAnswer: 'Usain Bolt', incorrectAnswers: ['Carl Lewis', 'Mo Farah', 'Yohan Blake'] },
  { id: 'sp05', category: 'sport_and_leisure', difficulty: 'easy',
    text: 'Combien de joueurs composent une équipe de basketball ?',
    correctAnswer: '5', incorrectAnswers: ['6', '7', '4'] },
  { id: 'sp06', category: 'sport_and_leisure', difficulty: 'easy',
    text: 'Quel est le surnom de l\'équipe nationale de rugby de Nouvelle-Zélande ?',
    correctAnswer: 'Les All Blacks', incorrectAnswers: ['Les Springboks', 'Les Wallabies', 'Les Pumas'] },
  { id: 'sp07', category: 'sport_and_leisure', difficulty: 'easy',
    text: 'Sur quelle surface se joue le tournoi de Roland-Garros ?',
    correctAnswer: 'Terre battue', incorrectAnswers: ['Gazon', 'Surface dure', 'Moquette'] },
  { id: 'sp08', category: 'sport_and_leisure', difficulty: 'medium',
    text: 'Quel nageur a remporté le plus de médailles d\'or olympiques de l\'histoire ?',
    correctAnswer: 'Michael Phelps', incorrectAnswers: ['Mark Spitz', 'Ian Thorpe', 'Ryan Lochte'] },
  { id: 'sp09', category: 'sport_and_leisure', difficulty: 'medium',
    text: 'Dans quelle ville se sont déroulés les Jeux Olympiques d\'été de 2024 ?',
    correctAnswer: 'Paris', incorrectAnswers: ['Los Angeles', 'Tokyo', 'Londres'] },
  { id: 'sp10', category: 'sport_and_leisure', difficulty: 'medium',
    text: 'Quel joueur de tennis a remporté le plus grand nombre de tournois du Grand Chelem ?',
    correctAnswer: 'Novak Djokovic', incorrectAnswers: ['Rafael Nadal', 'Roger Federer', 'Pete Sampras'] },

  // ── Musique ───────────────────────────────────────────────────────────────
  { id: 'm01', category: 'music', difficulty: 'easy',
    text: 'Quel groupe de rock britannique a enregistré l\'album "Abbey Road" ?',
    correctAnswer: 'Les Beatles', incorrectAnswers: ['The Rolling Stones', 'The Who', 'Led Zeppelin'] },
  { id: 'm02', category: 'music', difficulty: 'easy',
    text: 'Quelle chanteuse française a chanté "Non, je ne regrette rien" ?',
    correctAnswer: 'Édith Piaf', incorrectAnswers: ['Dalida', 'Barbara', 'Mireille Mathieu'] },
  { id: 'm03', category: 'music', difficulty: 'easy',
    text: 'Qui est l\'artiste derrière l\'album "Thriller" (1982) ?',
    correctAnswer: 'Michael Jackson', incorrectAnswers: ['Prince', 'Madonna', 'David Bowie'] },
  { id: 'm04', category: 'music', difficulty: 'easy',
    text: 'Quel compositeur classique était sourd en composant sa 9e symphonie ?',
    correctAnswer: 'Beethoven', incorrectAnswers: ['Mozart', 'Bach', 'Schubert'] },
  { id: 'm05', category: 'music', difficulty: 'easy',
    text: 'Quel groupe est connu pour la chanson "Bohemian Rhapsody" ?',
    correctAnswer: 'Queen', incorrectAnswers: ['The Beatles', 'Led Zeppelin', 'Pink Floyd'] },
  { id: 'm06', category: 'music', difficulty: 'easy',
    text: 'Dans quel pays est né Bob Marley ?',
    correctAnswer: 'Jamaïque', incorrectAnswers: ['Cuba', 'Barbade', 'Trinité-et-Tobago'] },
  { id: 'm07', category: 'music', difficulty: 'medium',
    text: 'Quelle artiste française a représenté la France à l\'Eurovision en 2021 avec "Voilà" ?',
    correctAnswer: 'Barbara Pravi', incorrectAnswers: ['Amir', 'Alma', 'Bilal Hassani'] },
  { id: 'm08', category: 'music', difficulty: 'medium',
    text: 'Quel chanteur français est connu pour l\'album "La Fête" et "Partir un jour" ?',
    correctAnswer: 'Indochine', incorrectAnswers: ['Téléphone', 'Bashung', 'Cabrel'] },
  { id: 'm09', category: 'music', difficulty: 'easy',
    text: 'Quel rappeur américain est connu sous le nom "Eminem" ?',
    correctAnswer: 'Marshall Mathers', incorrectAnswers: ['Shawn Carter', 'Dwayne Carter', 'Curtis Jackson'] },
  { id: 'm10', category: 'music', difficulty: 'medium',
    text: 'De quel pays est originaire le groupe ABBA ?',
    correctAnswer: 'Suède', incorrectAnswers: ['Norvège', 'Danemark', 'Finlande'] },

  // ── Arts & Littérature ────────────────────────────────────────────────────
  { id: 'a01', category: 'arts_and_literature', difficulty: 'easy',
    text: 'Qui a écrit "Les Misérables" ?',
    correctAnswer: 'Victor Hugo', incorrectAnswers: ['Gustave Flaubert', 'Émile Zola', 'Alexandre Dumas'] },
  { id: 'a02', category: 'arts_and_literature', difficulty: 'easy',
    text: 'Quel peintre est connu pour ses tableaux de tournesols et ses nuits étoilées ?',
    correctAnswer: 'Vincent van Gogh', incorrectAnswers: ['Claude Monet', 'Paul Gauguin', 'Paul Cézanne'] },
  { id: 'a03', category: 'arts_and_literature', difficulty: 'medium',
    text: 'Qui a écrit "À la recherche du temps perdu" ?',
    correctAnswer: 'Marcel Proust', incorrectAnswers: ['Albert Camus', 'Jean-Paul Sartre', 'André Gide'] },
  { id: 'a04', category: 'arts_and_literature', difficulty: 'easy',
    text: 'Quel musée parisien abrite la Joconde ?',
    correctAnswer: 'Le Louvre', incorrectAnswers: ['Le musée d\'Orsay', 'Le musée Picasso', 'Le Centre Pompidou'] },
  { id: 'a05', category: 'arts_and_literature', difficulty: 'easy',
    text: 'Qui a écrit "Le Petit Prince" ?',
    correctAnswer: 'Antoine de Saint-Exupéry', incorrectAnswers: ['Jules Verne', 'Jules Renard', 'Jean de La Fontaine'] },
  { id: 'a06', category: 'arts_and_literature', difficulty: 'medium',
    text: 'Quel mouvement artistique est associé à Salvador Dalí ?',
    correctAnswer: 'Le surréalisme', incorrectAnswers: ['Le cubisme', 'Le dadaïsme', 'L\'expressionnisme'] },
  { id: 'a07', category: 'arts_and_literature', difficulty: 'medium',
    text: 'Quel auteur français a reçu le prix Nobel de littérature en 1957 ?',
    correctAnswer: 'Albert Camus', incorrectAnswers: ['Jean-Paul Sartre', 'André Gide', 'François Mauriac'] },
  { id: 'a08', category: 'arts_and_literature', difficulty: 'easy',
    text: 'Qui a écrit "Don Quichotte" ?',
    correctAnswer: 'Miguel de Cervantes', incorrectAnswers: ['William Shakespeare', 'Dante Alighieri', 'Voltaire'] },

  // ── Cuisine & Boissons ────────────────────────────────────────────────────
  { id: 'cu01', category: 'food_and_drink', difficulty: 'easy',
    text: 'De quel pays est originaire la paella ?',
    correctAnswer: 'Espagne', incorrectAnswers: ['Italie', 'Portugal', 'Mexique'] },
  { id: 'cu02', category: 'food_and_drink', difficulty: 'easy',
    text: 'De quel pays est originaire la recette du sushi ?',
    correctAnswer: 'Japon', incorrectAnswers: ['Chine', 'Corée du Sud', 'Vietnam'] },
  { id: 'cu03', category: 'food_and_drink', difficulty: 'easy',
    text: 'Quel est l\'ingrédient principal de la guacamole ?',
    correctAnswer: 'Avocat', incorrectAnswers: ['Tomate', 'Poivron', 'Oignon'] },
  { id: 'cu04', category: 'food_and_drink', difficulty: 'easy',
    text: 'Quelle boisson alcoolisée est produite à partir de la canne à sucre ?',
    correctAnswer: 'Le rhum', incorrectAnswers: ['Le whisky', 'La vodka', 'Le gin'] },
  { id: 'cu05', category: 'food_and_drink', difficulty: 'medium',
    text: 'Quel fromage français est protégé et vient de la région du Rouerge ?',
    correctAnswer: 'Le Roquefort', incorrectAnswers: ['Le Camembert', 'Le Brie', 'Le Comté'] },
  { id: 'cu06', category: 'food_and_drink', difficulty: 'easy',
    text: 'Quel fruit est utilisé pour faire le vin ?',
    correctAnswer: 'Le raisin', incorrectAnswers: ['La pomme', 'La poire', 'La cerise'] },
  { id: 'cu07', category: 'food_and_drink', difficulty: 'medium',
    text: 'Dans quelle ville française est originaire la quiche ?',
    correctAnswer: 'Lorraine (région)', incorrectAnswers: ['Bretagne', 'Alsace', 'Normandie'] },

  // ── Société & Culture ─────────────────────────────────────────────────────
  { id: 'sc01', category: 'society_and_culture', difficulty: 'easy',
    text: 'Quel réseau social a été fondé par Mark Zuckerberg en 2004 ?',
    correctAnswer: 'Facebook', incorrectAnswers: ['Twitter', 'MySpace', 'Instagram'] },
  { id: 'sc02', category: 'society_and_culture', difficulty: 'easy',
    text: 'Quel est le nom du président américain élu en 2008 ?',
    correctAnswer: 'Barack Obama', incorrectAnswers: ['George W. Bush', 'Bill Clinton', 'John McCain'] },
  { id: 'sc03', category: 'society_and_culture', difficulty: 'medium',
    text: 'Quelle organisation internationale a son siège à Genève, en Suisse ?',
    correctAnswer: 'La Croix-Rouge internationale', incorrectAnswers: ['L\'ONU', 'L\'UNESCO', 'L\'OTAN'] },
  { id: 'sc04', category: 'society_and_culture', difficulty: 'medium',
    text: 'En quelle année a été fondée l\'Union européenne (traité de Maastricht) ?',
    correctAnswer: '1993', incorrectAnswers: ['1985', '1957', '2002'] },
  { id: 'sc05', category: 'society_and_culture', difficulty: 'easy',
    text: 'Quel est le symbole chimique du fer ?',
    correctAnswer: 'Fe', incorrectAnswers: ['Fe2', 'Ir', 'F'] },

  // ── Questions difficiles supplémentaires ─────────────────────────────────
  { id: 'hrd01', category: 'history', difficulty: 'hard',
    text: 'Quel édit de 1598 accordait la liberté de culte aux protestants en France ?',
    correctAnswer: 'L\'édit de Nantes', incorrectAnswers: ['L\'édit de Fontainebleau', 'L\'édit de Villers-Cotterêts', 'L\'édit de Moulins'] },
  { id: 'hrd02', category: 'history', difficulty: 'hard',
    text: 'En quelle année a eu lieu la célèbre bataille de Marignan, victoire de François Ier ?',
    correctAnswer: '1515', incorrectAnswers: ['1512', '1519', '1525'] },
  { id: 'hrd03', category: 'history', difficulty: 'hard',
    text: 'Quel est le nom du premier code de lois écrit, promulgué en Mésopotamie vers 1750 av. J.-C. ?',
    correctAnswer: 'Le Code de Hammurabi', incorrectAnswers: ['Le Code d\'Ur-Nammu', 'Les Lois de Manu', 'Le Code de Lipit-Ishtar'] },
  { id: 'hrd04', category: 'history', difficulty: 'hard',
    text: 'Lors de quelle bataille Alexandre le Grand a-t-il définitivement vaincu Darius III en 331 av. J.-C. ?',
    correctAnswer: 'Gaugamèles', incorrectAnswers: ['Issos', 'Granique', 'Hydaspe'] },
  { id: 'hrd05', category: 'history', difficulty: 'hard',
    text: 'En quelle année l\'Empire romain d\'Occident a-t-il officiellement pris fin ?',
    correctAnswer: '476', incorrectAnswers: ['410', '455', '493'] },
  { id: 'hrd06', category: 'history', difficulty: 'hard',
    text: 'Quel tsar russe a fondé la ville de Saint-Pétersbourg en 1703 ?',
    correctAnswer: 'Pierre le Grand', incorrectAnswers: ['Catherine II', 'Ivan le Terrible', 'Alexandre Ier'] },
  { id: 'hrd07', category: 'history', difficulty: 'hard',
    text: 'Quel est le nom du dernier empereur aztèque, capturé par Hernán Cortés en 1521 ?',
    correctAnswer: 'Cuauhtémoc', incorrectAnswers: ['Moctezuma II', 'Cuitláhuac', 'Axayácatl'] },
  { id: 'hrd08', category: 'history', difficulty: 'hard',
    text: 'Quel pays a lancé le premier satellite artificiel de l\'histoire, Spoutnik 1, en 1957 ?',
    correctAnswer: 'L\'URSS', incorrectAnswers: ['Les États-Unis', 'La Chine', 'Le Royaume-Uni'] },
  { id: 'hrd09', category: 'geography', difficulty: 'hard',
    text: 'Quelle est la plus longue frontière terrestre entre deux pays au monde ?',
    correctAnswer: 'Canada – États-Unis', incorrectAnswers: ['Russie – Kazakhstan', 'Chine – Mongolie', 'Brésil – Pérou'] },
  { id: 'hrd10', category: 'geography', difficulty: 'hard',
    text: 'Quel pays possède le plus grand nombre d\'îles au monde ?',
    correctAnswer: 'Suède', incorrectAnswers: ['Indonésie', 'Philippines', 'Norvège'] },
  { id: 'hrd11', category: 'geography', difficulty: 'hard',
    text: 'Dans quel pays se trouve le lac Titicaca, le plus haut lac navigable du monde ?',
    correctAnswer: 'À la frontière du Pérou et de la Bolivie', incorrectAnswers: ['Équateur', 'Chili', 'Argentine'] },
  { id: 'hrd12', category: 'geography', difficulty: 'hard',
    text: 'Quelle est la capitale actuelle du Kazakhstan (renommée en 2019) ?',
    correctAnswer: 'Nur-Sultan (Astana)', incorrectAnswers: ['Almaty', 'Chymkent', 'Aktobe'] },
  { id: 'hrd13', category: 'science', difficulty: 'hard',
    text: 'Combien d\'électrons peut contenir au maximum la couche électronique M d\'un atome ?',
    correctAnswer: '18', incorrectAnswers: ['8', '32', '2'] },
  { id: 'hrd14', category: 'science', difficulty: 'hard',
    text: 'Quel élément chimique possède le point de fusion le plus élevé ?',
    correctAnswer: 'Le tungstène', incorrectAnswers: ['Le platine', 'L\'osmium', 'Le carbone'] },
  { id: 'hrd15', category: 'science', difficulty: 'hard',
    text: 'Quelle loi décrit la relation entre pression et volume d\'un gaz parfait à température constante ?',
    correctAnswer: 'La loi de Boyle-Mariotte', incorrectAnswers: ['La loi de Charles', 'La loi de Gay-Lussac', 'La loi d\'Avogadro'] },
  { id: 'hrd16', category: 'science', difficulty: 'hard',
    text: 'Quel est le nom de la particule médiatrice de la force électromagnétique ?',
    correctAnswer: 'Le photon', incorrectAnswers: ['Le gluon', 'Le boson W', 'Le graviton'] },
  { id: 'hrd17', category: 'science', difficulty: 'hard',
    text: 'Quelle structure de l\'ADN a été décrite pour la première fois par Watson et Crick en 1953 ?',
    correctAnswer: 'La double hélice', incorrectAnswers: ['La triple hélice', 'La structure en feuillet', 'Le tétramère'] },
  { id: 'hrd18', category: 'film_and_tv', difficulty: 'hard',
    text: 'Quel film de Michelangelo Antonioni a remporté la Palme d\'Or à Cannes en 1960 ?',
    correctAnswer: 'L\'Avventura', incorrectAnswers: ['La Dolce Vita', 'Blow-Up', '8½'] },
  { id: 'hrd19', category: 'film_and_tv', difficulty: 'hard',
    text: 'Quel cinéaste japonais a réalisé "Les Sept Samouraïs" (1954) ?',
    correctAnswer: 'Akira Kurosawa', incorrectAnswers: ['Yasujirō Ozu', 'Kenji Mizoguchi', 'Nagisa Ōshima'] },
  { id: 'hrd20', category: 'sport_and_leisure', difficulty: 'hard',
    text: 'Quel pays a remporté la première Coupe du Monde de football en 1930 ?',
    correctAnswer: 'Uruguay', incorrectAnswers: ['Argentine', 'Brésil', 'Italie'] },
  { id: 'hrd21', category: 'sport_and_leisure', difficulty: 'hard',
    text: 'Combien de Ballons d\'Or Lionel Messi avait-il remportés à fin 2024 ?',
    correctAnswer: '8', incorrectAnswers: ['7', '6', '9'] },
  { id: 'hrd22', category: 'music', difficulty: 'hard',
    text: 'Quel compositeur romantique polonais est surnommé "le poète du piano" ?',
    correctAnswer: 'Frédéric Chopin', incorrectAnswers: ['Franz Liszt', 'Robert Schumann', 'Claude Debussy'] },
  { id: 'hrd23', category: 'music', difficulty: 'hard',
    text: 'Quel est le vrai nom de Lady Gaga ?',
    correctAnswer: 'Stefani Germanotta', incorrectAnswers: ['Alicia Moore', 'Robyn Fenty', 'Belcalis Almánzar'] },
  { id: 'hrd24', category: 'arts_and_literature', difficulty: 'hard',
    text: 'Qui a écrit le roman "Ulysse" (1922), chef-d\'œuvre du modernisme ?',
    correctAnswer: 'James Joyce', incorrectAnswers: ['Virginia Woolf', 'William Faulkner', 'T.S. Eliot'] },
  { id: 'hrd25', category: 'arts_and_literature', difficulty: 'hard',
    text: 'Quel architecte espagnol a conçu la Sagrada Família à Barcelone ?',
    correctAnswer: 'Antoni Gaudí', incorrectAnswers: ['Santiago Calatrava', 'Rafael Moneo', 'Ricardo Bofill'] },
  { id: 'hrd26', category: 'general_knowledge', difficulty: 'hard',
    text: 'Quel est le symbole chimique du tungstène (wolfram) ?',
    correctAnswer: 'W', incorrectAnswers: ['Tu', 'Wf', 'Tn'] },
  { id: 'hrd27', category: 'food_and_drink', difficulty: 'hard',
    text: 'Quelle technique culinaire consiste à cuire des aliments sous vide dans un bain d\'eau à température précise ?',
    correctAnswer: 'La cuisson sous vide (sous-vide)', incorrectAnswers: ['Le confit', 'La cuisson basse température au four', 'Le bain-marie'] },
  { id: 'hrd28', category: 'society_and_culture', difficulty: 'hard',
    text: 'Quel philosophe grec a fondé l\'Académie, la première grande institution philosophique occidentale ?',
    correctAnswer: 'Platon', incorrectAnswers: ['Socrate', 'Aristote', 'Épicure'] },

  // ── Île de la Réunion ─────────────────────────────────────────────────────
  { id: 're01', category: 'reunion', difficulty: 'easy',
    text: 'Quelle est la capitale de l\'île de La Réunion ?',
    correctAnswer: 'Saint-Denis', incorrectAnswers: ['Saint-Pierre', 'Saint-Paul', 'Le Port'] },
  { id: 're02', category: 'reunion', difficulty: 'easy',
    text: 'Dans quel océan se trouve l\'île de La Réunion ?',
    correctAnswer: 'L\'océan Indien', incorrectAnswers: ['L\'océan Atlantique', 'L\'océan Pacifique', 'La mer Méditerranée'] },
  { id: 're03', category: 'reunion', difficulty: 'easy',
    text: 'Quel est le nom du volcan actif de La Réunion ?',
    correctAnswer: 'Le Piton de la Fournaise', incorrectAnswers: ['Le Piton des Neiges', 'Le Maïdo', 'Le Grand Bénare'] },
  { id: 're04', category: 'reunion', difficulty: 'easy',
    text: 'Quel est le point culminant de l\'île de La Réunion ?',
    correctAnswer: 'Le Piton des Neiges', incorrectAnswers: ['Le Piton de la Fournaise', 'Le Maïdo', 'Le Grand Bénare'] },
  { id: 're05', category: 'reunion', difficulty: 'easy',
    text: 'Quel est le numéro de département de La Réunion ?',
    correctAnswer: '974', incorrectAnswers: ['971', '972', '976'] },
  { id: 're06', category: 'reunion', difficulty: 'easy',
    text: 'Quelle monnaie est utilisée à La Réunion ?',
    correctAnswer: 'L\'euro', incorrectAnswers: ['Le franc CFA', 'Le franc réunionnais', 'Le dollar'] },
  { id: 're07', category: 'reunion', difficulty: 'easy',
    text: 'En quelle année La Réunion est-elle devenue un département français ?',
    correctAnswer: '1946', incorrectAnswers: ['1848', '1963', '1974'] },
  { id: 're08', category: 'reunion', difficulty: 'easy',
    text: 'Quel plat réunionnais consiste en une sauce tomate épicée avec des saucisses ?',
    correctAnswer: 'Le rougail saucisse', incorrectAnswers: ['Le carry poulet', 'Le boucané', 'Le vindaye'] },
  { id: 're09', category: 'reunion', difficulty: 'easy',
    text: 'Quelle épice locale donne une couleur jaune aux plats réunionnais ?',
    correctAnswer: 'Le curcuma (safran péi)', incorrectAnswers: ['Le gingembre', 'La cannelle', 'Le cumin'] },
  { id: 're10', category: 'reunion', difficulty: 'medium',
    text: 'Comment s\'appelle le plat traditionnel réunionnais à base de riz et de sauce mijotée ?',
    correctAnswer: 'Le carry', incorrectAnswers: ['Le colombo', 'Le boucané', 'Le rougail'] },
  { id: 're11', category: 'reunion', difficulty: 'medium',
    text: 'Quels sont les trois cirques de La Réunion ?',
    correctAnswer: 'Cilaos, Mafate et Salazie', incorrectAnswers: ['Cilaos, Bras-Panon et Salazie', 'Mafate, Salazie et Saint-Denis', 'Cilaos, Mafate et Piton'] },
  { id: 're12', category: 'reunion', difficulty: 'medium',
    text: 'Quel est le nom de l\'aéroport international principal de La Réunion ?',
    correctAnswer: 'Roland Garros', incorrectAnswers: ['Pierrefonds', 'Saint-Denis Sud', 'La Rivière des Galets'] },
  { id: 're13', category: 'reunion', difficulty: 'medium',
    text: 'Quel oiseau rapace endémique est le symbole de La Réunion ?',
    correctAnswer: 'Le Papangue', incorrectAnswers: ['Le Paille-en-queue', 'Le Tuit-tuit', 'Le Cardinal'] },
  { id: 're14', category: 'reunion', difficulty: 'medium',
    text: 'Quel site de La Réunion est classé au Patrimoine mondial de l\'UNESCO depuis 2010 ?',
    correctAnswer: 'Les Pitons, cirques et remparts', incorrectAnswers: ['Le lagon de Saint-Gilles', 'Le Grand Bénare', 'La forêt de Bébour'] },
  { id: 're15', category: 'reunion', difficulty: 'medium',
    text: 'Quel est le principal produit agricole exporté par La Réunion ?',
    correctAnswer: 'La canne à sucre', incorrectAnswers: ['La vanille', 'L\'ananas', 'Le café'] },
  { id: 're16', category: 'reunion', difficulty: 'medium',
    text: 'Comment appelle-t-on le point de vue panoramique culminant à 2 205 m d\'altitude sur le cirque de Mafate ?',
    correctAnswer: 'Le Maïdo', incorrectAnswers: ['Le Belvédère', 'La Roche Écrite', 'Le Grand Bénare'] },
  { id: 're17', category: 'reunion', difficulty: 'medium',
    text: 'En quelle année l\'esclavage a-t-il été aboli à La Réunion ?',
    correctAnswer: '1848', incorrectAnswers: ['1794', '1835', '1862'] },
  { id: 're18', category: 'reunion', difficulty: 'hard',
    text: 'Sous quel nom a-t-on appelé l\'île de La Réunion lors de sa première colonisation française au XVIIe siècle ?',
    correctAnswer: 'Île Bourbon', incorrectAnswers: ['Île de France', 'Île Mascareignes', 'Île Dauphine'] },
  { id: 're19', category: 'reunion', difficulty: 'hard',
    text: 'Quel est le nom du sentier de grande randonnée qui traverse l\'intégralité de l\'île de La Réunion du nord au sud ?',
    correctAnswer: 'GR R2', incorrectAnswers: ['GR R1', 'GR 20', 'GR R3'] },
  { id: 're20', category: 'reunion', difficulty: 'hard',
    text: 'Quel peuple a été massivement importé comme main-d\'œuvre à La Réunion après l\'abolition de l\'esclavage ?',
    correctAnswer: 'Les engagés indiens', incorrectAnswers: ['Les engagés chinois', 'Les engagés malgaches', 'Les engagés vietnamiens'] },
];

// Fonctions pures de l'IA ennemie (temps de réflexion, tirage de l'action).
// Isolées de enemyAI.js pour être testables sans charger le jeu ; l'aléatoire est injecté (`rand` renvoie un nombre dans [0, 1[).

/** Facteur appliqué au temps de réflexion : les ennemis de haut niveau réagissent plus vite (jamais sous la moitié). */
export function thinkingTimeFactor(level) {
    if (level >= 15) return 0.5;   // le palier le plus haut doit être testé en premier
    if (level >= 10) return 0.7;
    return 1;
}

/**
 * Tire une action parmi celles réellement disponibles, pondérée par leur `probability`.
 * Les probabilités sont renormalisées sur les seules options présentes : quand sorts ou armes
 * sont indisponibles, leur part n'est plus perdue au profit de la dernière option.
 * Si aucune probabilité n'est exploitable, le tirage est uniforme. Liste vide : null (repli à gérer par l'appelant).
 * @param {Array<{probability:number}>} options - Options disponibles, dans l'ordre de priorité
 * @param {() => number} rand - Source d'aléatoire dans [0, 1[
 */
export function pickWeightedOption(options, rand = Math.random) {
    if (!Array.isArray(options) || options.length === 0) return null;
    const weights = options.map(o => (Number.isFinite(o.probability) && o.probability > 0 ? o.probability : 0));
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) return options[Math.min(options.length - 1, Math.floor(rand() * options.length))];

    const target = rand() * total;
    let cumulative = 0;
    for (let i = 0; i < options.length; i++) {
        cumulative += weights[i];
        if (target < cumulative && weights[i] > 0) return options[i];
    }
    // Garde-fou flottant : dernière option de poids non nul
    for (let i = options.length - 1; i >= 0; i--) if (weights[i] > 0) return options[i];
    return options[options.length - 1];
}

// Compare l'ancien et le nouvel avantage lié à l'écart de niveau (combatStats.js) : chances finales de critique / blocage.
// Usage : node match3-quest/tools/simulate-level-edge.mjs   (reproductible, aucune part d'aléatoire)
import { levelEdgeBonus, STAT_CHANCE_CAP } from '../combatStats.js';

// Ancienne formule (avant lot 2), conservée ici uniquement pour la comparaison.
const legacy = (gap, raw) => gap === 0 ? raw : Math.floor(raw * Math.min(4, 1 + 0.25 * gap + 0.1 * gap * gap)) + 5 * gap;
const cap = v => Math.min(STAT_CHANCE_CAP, v);

// Valeurs brutes réalistes d'Atk (crit) / Déf (blocage) : ennemi niv. 3 ≈ 7, niv. 10 ≈ 18, niv. 20 ≈ 33 (3 + 1,5 × niveau), héros équipé 10 à 60.
const RAWS = [0, 7, 18, 33, 60];
const rows = [];
for (const raw of RAWS) {
    for (let gap = 0; gap <= 4; gap++) {
        const before = cap(legacy(gap, raw));
        const after = cap(levelEdgeBonus({ levelEdge: gap }, raw));
        rows.push({ 'Atk/Déf brute': raw, 'écart': gap, 'avant (%)': before, 'après (%)': after, 'bonus avant': before - cap(raw), 'bonus après': after - cap(raw) });
    }
}
console.table(rows);

// Sorts du héros qui posent une altération à l'ennemi (Muet, Maudit, Pétrifié, Endormi, Épuisé, Corrompu). Voir alterations.js.
// Les sorts lancés PAR l'ennemi contre le héros passent par applyStandardSpellEffects (game.js).
import { enemy, log, showCombatAnimation } from './game.js';
import { inflictAlteration, alterationOfSpell } from './alterations.js';

export function applyAlterEnemy(spell) {
    const alt = alterationOfSpell(spell);
    if(!alt) return false;
    if(!inflictAlteration(enemy, alt.key, alt.turns, alt.extra)) {
        showCombatAnimation({ icon: alt.label.icon, title: spell.name.toUpperCase(), damage: 'Résisté', target: `→ ${enemy.name} est immunisé` }, true);
        log(`${spell.name} : ${enemy.name} résiste (immunisé aux effets négatifs).`);
        return true;
    }
    showCombatAnimation({ icon: alt.label.icon, title: spell.name.toUpperCase(), damage: `${alt.label.name} ${alt.turns} tours`, target: `→ ${enemy.name}` }, true);
    log(`${spell.name} : ${enemy.name} est ${alt.label.name.toLowerCase()} pendant ${alt.turns} tours (${alt.label.text}).`);
    return true;
}

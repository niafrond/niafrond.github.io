// Sorts qui posent une altération à l'ennemi (Muet, Maudit, Pétrifié, Endormi, Épuisé, Corrompu). Voir alterations.js.
import { enemy, log, showCombatAnimation } from './game.js';
import { inflictAlteration } from './alterations.js';

const LABELS = {
    muted: { icon: 'mask', name: 'Muet', text: 'ne peut plus lancer de sorts' },
    cursed: { icon: 'ghost', name: 'Maudit', text: 'subit davantage de dégâts' },
    petrified: { icon: 'rock', name: 'Pétrifié', text: 'ne peut plus bloquer ni parer' },
    asleep: { icon: 'moon', name: 'Endormi', text: 'n\'agit plus tant qu\'il ne subit pas de dégâts' },
    exhausted: { icon: 'hourglass', name: 'Épuisé', text: 'perd du qì chaque tour' },
    corrupted: { icon: 'blood', name: 'Corrompu', text: 'ses soins deviennent des dégâts' }
};

// Spell: { alteration, duration, cursePct?, exhaustDrain? }
export function applyAlterEnemy(spell) {
    const label = LABELS[spell.alteration];
    if(!label) return false;
    const extra = {};
    if(spell.alteration === 'cursed' && spell.cursePct) extra.cursePct = spell.cursePct;
    if(spell.alteration === 'exhausted' && spell.exhaustDrain) extra.exhaustDrain = spell.exhaustDrain;
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    if(!inflictAlteration(enemy, spell.alteration, turns, extra)) {
        showCombatAnimation({ icon: label.icon, title: spell.name.toUpperCase(), damage: 'Résisté', target: `→ ${enemy.name} est immunisé` }, true);
        log(`${spell.name} : ${enemy.name} résiste (immunisé aux effets négatifs).`);
        return true;
    }
    showCombatAnimation({ icon: label.icon, title: spell.name.toUpperCase(), damage: `${label.name} ${turns} tours`, target: `→ ${enemy.name}` }, true);
    log(`${spell.name} : ${enemy.name} est ${label.name.toLowerCase()} pendant ${turns} tours (${label.text}).`);
    return true;
}

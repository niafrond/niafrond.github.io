// Sorts de classe qui détruisent ou remplacent les flèches d'action (tuiles « combat ») : templier, barbare, assassin.
import { player, log, showCombatAnimation, addManaForColor } from './game.js';
import { board, renderBoard } from './board.js';
import { isJokerTile } from './joker.js';
import { flyManaGain } from './manaFlight.js';
import { colors } from './constants.js';

const ACTION_TILE = 'combat';

const actionGemIndices = () => board.map((tile, i) => (tile === ACTION_TILE ? i : -1)).filter(i => i >= 0);

// Forge des Légions : N gâteaux de lune (couleurs, ni jokers ni flèches ni crânes) deviennent des flèches d'action.
export function applyColorsToActionGems(spell) {
    const candidates = board.map((tile, i) => (colors.includes(tile) && !isJokerTile(tile) ? i : -1)).filter(i => i >= 0);
    if(candidates.length === 0) {
        log(`${spell.name} : aucun gâteau de lune à transformer.`);
        return false;
    }
    const count = Math.min(Math.max(1, Math.floor(spell.gemCount || 1)), candidates.length);
    for(let n = 0; n < count; n++) {
        const k = Math.floor(Math.random() * candidates.length);
        board[candidates.splice(k, 1)[0]] = ACTION_TILE;
    }
    renderBoard();
    showCombatAnimation({ icon: 'sword', title: spell.name.toUpperCase(), damage: `${count} flèches créées`, target: '→ Plateau' }, true);
    log(`${spell.name} transforme ${count} gâteaux de lune en flèches d'action !`);
    return true;
}

// Moisson d'Acier : les flèches d'action sont détruites, chacune donne du qì de la couleur du sort.
export function applyActionGemsToMana(spell) {
    const found = actionGemIndices();
    if(found.length === 0) {
        log(`${spell.name} : aucune flèche d'action à détruire.`);
        return false;
    }
    found.forEach(i => { board[i] = null; });
    const color = spell.manaColor || 'blue';
    const gained = addManaForColor(player, color, found.length * Math.max(1, Math.floor(spell.manaPerGem || 1)), { applyGainBonus: false }).gained;
    if(gained > 0) flyManaGain(true, { [color]: gained });
    renderBoard();
    showCombatAnimation({ icon: 'star', title: spell.name.toUpperCase(), heal: `+${gained} qì`, target: `${found.length} flèches détruites` }, true);
    log(`${spell.name} détruit ${found.length} flèches d'action et donne ${gained} qì ${color}.`);
    return true;
}

// Lames Brisées : les flèches d'action deviennent des crânes (soleils ardents).
export function applyActionGemsToSkulls(spell) {
    const found = actionGemIndices();
    if(found.length === 0) {
        log(`${spell.name} : aucune flèche d'action à transformer.`);
        return false;
    }
    found.forEach(i => { board[i] = 'skull'; });
    renderBoard();
    showCombatAnimation({ icon: 'skull', title: spell.name.toUpperCase(), damage: `${found.length} flèches → crânes`, target: '→ Plateau' }, true);
    log(`${spell.name} transforme ${found.length} flèches d'action en soleils ardents !`);
    return true;
}

// Mue d'Acier : les flèches d'action deviennent des gâteaux de lune de la couleur du sort, 1 point d'action chacune.
export function applyActionGemsToColor(spell) {
    const found = actionGemIndices();
    if(found.length === 0) {
        log(`${spell.name} : aucune flèche d'action à transformer.`);
        return false;
    }
    const color = colors.includes(spell.gemColor) ? spell.gemColor : 'purple';
    found.forEach(i => { board[i] = color; });
    player.combatPoints = (player.combatPoints || 0) + found.length;
    renderBoard();
    showCombatAnimation({ icon: 'moon', title: spell.name.toUpperCase(), damage: `${found.length} flèches → ${color}`, target: `+${found.length} point(s) d'action` }, true);
    log(`${spell.name} transforme ${found.length} flèches d'action en gâteaux de lune ${color} (+${found.length} point(s) d'action).`);
    return true;
}

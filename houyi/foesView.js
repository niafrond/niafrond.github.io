// Barre des ennemis du combat (jusqu'à 3) : une pastille par ennemi (nom, barre de vie) sous la fiche de l'ennemi ciblé.
// Après avoir choisi une attaque ciblée, on touche l'ennemi voulu (jamais de cible mémorisée) ; les sorts et armes « de zone » (targeting.js) touchent toutes les pastilles.
// Cachée quand il n'y a qu'un ennemi. Données : gameState.foes (foes.js).
import { escapeHtml } from './escapeHtml.js';
import { gameState } from './game.js';
import { allFoes, pickTarget, isPickingTarget, cancelTargetPick } from './foes.js';
import { isAlive } from './enemyGroup.js';
import { playSfx } from './sound.js';

let bound = false;

export function renderFoeBar() {
    const box = typeof document !== 'undefined' ? document.getElementById('foe-bar') : null;
    if (!box) return;
    const foes = allFoes();
    const picking = isPickingTarget();
    const show = gameState.combatState === 'active' && foes.length > 1;
    box.hidden = !show;
    if (!show) { box.innerHTML = ''; return; }
    box.innerHTML = foes.map((f, i) => {
        const pct = Math.max(0, Math.min(100, Math.round(100 * (f.hp || 0) / Math.max(1, f.maxHp || 1))));
        const cls = `foe-chip${isAlive(f) ? '' : ' down'}${picking && isAlive(f) ? ' pickable' : ''}`;
        return `<button type="button" class="${cls}" data-foe="${i}" ${isAlive(f) ? '' : 'disabled'} aria-label="${escapeHtml(f.name)}, ${pct} % de vie${picking && isAlive(f) ? ', toucher pour viser' : ''}">`
            + `<span class="foe-name">${escapeHtml(f.name)}${f.summonedBy ? ' ✦' : ''}</span>`
            + `<span class="foe-hp"><span style="width:${pct}%"></span></span></button>`;
    }).join('');
    if (!bound) {
        bound = true;
        document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && isPickingTarget()) { cancelTargetPick(); } });
        box.addEventListener('click', ev => {
            const chip = ev.target.closest?.('.foe-chip');
            if (!chip || gameState.combatState !== 'active' || !isPickingTarget()) return;   // on ne vise qu'après avoir choisi une attaque
            if (pickTarget(allFoes()[Number(chip.dataset.foe)])) playSfx('uiClick');
        });
    }
}

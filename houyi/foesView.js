// Barre des ennemis du combat (jusqu'à 3) : une pastille par ennemi (nom, barre de vie) sous la fiche de l'ennemi ciblé.
// Après avoir choisi une attaque ciblée, on touche l'ennemi voulu (jamais de cible mémorisée) ; les sorts et armes « de zone » (targeting.js) touchent toutes les pastilles.
// Cachée quand il n'y a qu'un ennemi. Données : gameState.foes (foes.js).
import { escapeHtml } from './escapeHtml.js';
import { statusBadgesHtml } from './statusBadges.js';
import { gameState } from './game.js';
import { allFoes, pickTarget, isPickingTarget, cancelTargetPick, foeChargeProgress } from './foes.js';
import { isAlive } from './enemyGroup.js';
import { playSfx } from './sound.js';
import { enemyNameLabel, enemyNameAsHanzi, toggleEnemyNameAsHanzi, enemyNameIsHanzi } from './bestiaryNames.js';
import { bindEnemyStuffLongPress } from './gameTooltips.js';
import { updateStats } from './gameHud.js';

let bound = false;

export function renderFoeBar() {
    const box = typeof document !== 'undefined' ? document.getElementById('foe-bar') : null;
    if (!box) return;
    const foes = allFoes();
    const picking = isPickingTarget();
    const show = gameState.combatState === 'active' && foes.filter(isAlive).length > 1;   // un seul ennemi debout : la fiche complète reprend (gameHud.js)
    box.hidden = !show;
    if (!show) { box.innerHTML = ''; return; }
    box.innerHTML = foes.map((f, i) => {
        const pct = Math.max(0, Math.min(100, Math.round(100 * (f.hp || 0) / Math.max(1, f.maxHp || 1))));
        const cls = `foe-chip${isAlive(f) ? '' : ' down'}${picking && isAlive(f) ? ' pickable' : ''}`;
        return `<button type="button" class="${cls}" data-foe="${i}" ${isAlive(f) ? '' : 'disabled'} aria-label="${escapeHtml(f.name)}, ${pct} % de vie${picking && isAlive(f) ? ', toucher pour viser' : ''}">`
            + `<span class="foe-name${enemyNameIsHanzi(f) ? ' name-hanzi' : ''}">${escapeHtml(enemyNameLabel(f, enemyNameAsHanzi()))}${f.summonedBy ? ' ✦' : ''}</span>`
            + (statusBadgesHtml(f) || '')
            + `<span class="foe-hp"><span style="width:${pct}%"></span></span>`
            + `<span class="foe-charge" title="Chargement"><span style="width:${Math.round(100 * foeChargeProgress(f))}%"></span></span></button>`;
    }).join('');
    if (!bound) {
        bound = true;
        // Appui long sur une pastille : traduction du nom, force et faiblesse (même infobulle que la fiche de l'ennemi). Posé AVANT le clic : il lui passe la main.
        let pressed = null;
        box.addEventListener('pointerdown', ev => { const chip = ev.target.closest?.('.foe-chip'); pressed = chip ? allFoes()[Number(chip.dataset.foe)] : null; }, true);
        bindEnemyStuffLongPress(box, () => pressed?.name || '', () => pressed || allFoes()[0]);
        document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && isPickingTarget()) { cancelTargetPick(); } });
        box.addEventListener('click', ev => {
            const chip = ev.target.closest?.('.foe-chip');
            if (!chip || gameState.combatState !== 'active') return;
            if (isPickingTarget()) { if (pickTarget(allFoes()[Number(chip.dataset.foe)])) playSfx('uiClick'); return; }   // choix de la cible d'une attaque
            toggleEnemyNameAsHanzi();   // sinon : le clic bascule les noms entre caractères chinois et pinyin (fiche de l'ennemi comprise)
            updateStats();
        });
    }
}

/** Rafraîchit seulement les barres de chargement des pastilles (appelé à chaque pas du ticker, sans redessiner la barre). */
export function refreshFoeCharges() {
    const box = typeof document !== 'undefined' ? document.getElementById('foe-bar') : null;
    if (!box || box.hidden) return;
    const foes = allFoes();
    box.querySelectorAll('.foe-chip').forEach(chip => {
        const bar = chip.querySelector('.foe-charge > span');
        const foe = foes[Number(chip.dataset.foe)];
        if (bar && foe) bar.style.width = `${Math.round(100 * foeChargeProgress(foe))}%`;
    });
}

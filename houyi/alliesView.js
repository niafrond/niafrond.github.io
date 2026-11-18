// Barre des compagnons en combat : une carte par compagnon de l'équipe (portrait, nom, classe, barre de vie). Hors de combat à 0 PV : carte grisée.
// Les compagnons partagent le qì de Hou Yi (aucune réserve propre). Données : gameState.allies (allies.js).
import { gbaSprite, loadGbaSprites } from './sprites/index.js';
import { escapeHtml } from './escapeHtml.js';
import { CLASS_SHORT } from './classRoster.js';
import { gameState } from './game.js';

const portrait = key => {
    try { return gbaSprite(key, 'front') || ''; } catch { return ''; }
};

/** (Re)dessine la barre des compagnons ; masquée hors combat ou sans compagnon dans l'équipe. */
export function renderAllyBar() {
    const box = typeof document !== 'undefined' ? document.getElementById('ally-bar') : null;
    if (!box) return;
    const allies = Object.values(gameState.allies || {});
    box.hidden = gameState.combatState !== 'active' || !allies.length;
    if (box.hidden) { box.innerHTML = ''; return; }
    box.innerHTML = allies.map(a => {
        const pct = Math.max(0, Math.min(100, Math.round(a.hp / a.maxHp * 100)));
        const src = portrait(a.sprite);
        return `<div class="ally-card${a.ko ? ' ko' : ''}" title="${escapeHtml(`${a.name} · ${CLASS_SHORT[a.classId]} · ${a.hp}/${a.maxHp} PV${a.ko ? ' (hors de combat)' : ''}`)}">`
            + `${src ? `<img class="ally-portrait" src="${src}" alt="" width="22" height="22">` : '<span class="ally-portrait"></span>'}`
            + `<span class="ally-name">${escapeHtml(a.short)}</span>`
            + `<span class="ally-hp" role="progressbar" aria-label="PV de ${escapeHtml(a.name)}" aria-valuemin="0" aria-valuemax="${a.maxHp}" aria-valuenow="${a.hp}"><i style="width:${pct}%"></i></span></div>`;
    }).join('');
}

/** Charge les dessins des compagnons de l'équipe puis redessine la barre. */
export function prepareAllyPortraits() {
    const keys = Object.values(gameState.allies || {}).map(a => a.sprite);
    if (!keys.length) { renderAllyBar(); return Promise.resolve(); }
    return Promise.resolve(loadGbaSprites(keys)).catch(() => {}).then(renderAllyBar);
}

// Onglet « Compétences » (affichage et actions) ; le balisage est dans skillsMarkup.js, la logique dans skills.js et transe.js.
import { player, gameState, log, saveUpdate } from './game.js';
import { wornStuff } from './stuff.js';
import { teachers, toggleSupport } from './skills.js';
import { skillsTabHtml } from './skillsMarkup.js';
import { toggleLoadout } from './classRoster.js';
import { equipAllyWeapon } from './allyWeapons.js';
import { bindCharTabs } from './charTabs.js';

let selectedId = null;

export function renderSkillsTab() {
    const root = document.getElementById('skills-view');
    if (!root) return;
    bindCharTabs(root, 'skills', renderSkillsTab);   // un onglet par personnage (charTabs.js)
    root.innerHTML = skillsTabHtml(player, teachers(player, wornStuff(player)), selectedId, gameState.combatState !== 'active');
}

function onClick(ev) {
    const cl = ev.target.closest('[data-toggle-class]');
    if (cl) {
        if (gameState.combatState === 'active') return;
        const res = toggleLoadout(player, cl.dataset.toggleClass);
        log(res.message);
        if (res.ok) saveUpdate();
        renderSkillsTab();
        return;
    }
    const toggle = ev.target.closest('[data-toggle-skill]');
    if (toggle) {   // les compétences de soutien s'allument et s'éteignent à tout moment, dans la limite des Fulu
        const res = toggleSupport(player, toggle.dataset.toggleSkill);
        log(res.message);
        if (res.ok) saveUpdate();
        renderSkillsTab();
        return;
    }
    const row = ev.target.closest('[data-skill]');
    if (row) { selectedId = row.dataset.skill; renderSkillsTab(); }
}

function init() {
    document.addEventListener('skills-tab-open', renderSkillsTab);
    document.addEventListener('stuff-changed', renderSkillsTab);
    document.getElementById('skills-view')?.addEventListener('click', onClick);
    document.getElementById('skills-view')?.addEventListener('change', ev => {   // arme d'un compagnon (hors combat)
        const sel = ev.target.closest?.('[data-ally-weapon]');
        if (!sel || gameState.combatState === 'active') return;
        const res = equipAllyWeapon(player, sel.dataset.allyWeapon, sel.value);
        log(res.message);
        if (res.ok) saveUpdate();
        renderSkillsTab();
    });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

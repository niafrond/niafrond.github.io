// Onglet « Compétences » (affichage et actions) ; le balisage est dans skillsMarkup.js, la logique dans skills.js et transe.js.
import { player, gameState, log, saveUpdate } from './game.js';
import { wornStuff } from './stuff.js';
import { teachers, toggleSupport } from './skills.js';
import { skillsTabHtml } from './skillsMarkup.js';
import { toggleLoadout } from './classRoster.js';

let selectedId = null;

export function renderSkillsTab() {
    const root = document.getElementById('skills-view');
    if (!root) return;
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
    if (toggle) {
        if (gameState.combatState === 'active') return;
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
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

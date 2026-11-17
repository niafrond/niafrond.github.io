// Onglet « Compétences » : ce que l'équipement porté enseigne (progression en PA), les compétences apprises, les Fulu et la Xiūxiān.
// La logique est dans skills.js et transe.js.
import { player, gameState, log, saveUpdate } from './game.js';
import { wornStuff } from './stuff.js';
import { escapeHtml } from './escapeHtml.js';
import {
    SKILLS, getSkill, isSupport, skillsTaughtBy, teachers, normalizeSkills, isLearned, progressOf, toggleSupport,
    magikolithCapacity, usedMagikoliths
} from './skills.js';
import { TRANSE_TURNS, TRANSE_EFFECTS } from './transe.js';
import { playerClasses } from './classes.js';

const CLASS_NAMES = { sorcerer: 'Mage', assassin: 'Rôdeur', templar: 'Commandant', barbarian: 'Guerrier' };

function skillLine(skill) {
    const learned = isLearned(player, skill.id);
    const state = normalizeSkills(player);
    const kind = isSupport(skill) ? `Soutien · ${skill.cost} Fulu` : 'Action · commande de combat';
    const pct = learned ? 100 : Math.round(progressOf(player, skill.id) / skill.ap * 100);
    const status = learned
        ? (isSupport(skill)
            ? `<button type="button" class="rc-btn" data-toggle-skill="${skill.id}"${gameState.combatState === 'active' ? ' disabled' : ''}>${state.active.includes(skill.id) ? 'Désactiver' : 'Activer'}</button>`
            : '<span class="rc-chip">Apprise</span>')
        : `<span class="rc-stats">${progressOf(player, skill.id)} / ${skill.ap} PA</span>`;
    return `<div class="skill-row${learned ? ' learned' : ''}${state.active.includes(skill.id) ? ' active' : ''}">
        <div class="skill-main"><strong>${escapeHtml(skill.name)}</strong> <span class="rc-chip">${escapeHtml(kind)}</span>
        <div class="skill-desc">${escapeHtml(skill.description)}</div>
        <progress value="${pct}" max="100" aria-label="Progression de ${escapeHtml(skill.name)}"></progress></div>
        <div class="skill-side">${status}</div></div>`;
}

function teacherBlock(item, label) {
    const ids = skillsTaughtBy(item);
    return `<div class="skill-teacher"><h4>${escapeHtml(label)} : ${escapeHtml(item.name || item.id)}</h4>${ids.map(id => skillLine(getSkill(id))).join('')}</div>`;
}

export function renderSkillsTab() {
    const root = document.getElementById('skills-view');
    if (!root) return;
    const state = normalizeSkills(player);
    const stuffList = wornStuff(player);
    const gear = teachers(player, stuffList);
    const weapon = gear[0] && gear[0] === (player.equippedWeapon || player.equipment?.rightHand) ? gear[0] : null;
    const used = usedMagikoliths(player);
    const cap = magikolithCapacity(player);
    const transeRows = Object.entries(TRANSE_EFFECTS).map(([cls, e]) => `<li><strong>${escapeHtml(CLASS_NAMES[cls] || playerClasses[cls]?.name || cls)}</strong> : ${escapeHtml(e.text)}</li>`).join('');
    const learned = state.learned.map(getSkill).filter(Boolean);
    root.innerHTML = `
        <p class="skills-intro">L'équipement porté enseigne des compétences : chaque victoire donne des <strong>PA</strong> qui les font progresser. Une fois apprise, une compétence est acquise pour toujours.</p>
        <div class="skills-cap" role="status"><strong>Fulu</strong> : ${used} / ${cap} utilisées (compétences de soutien activées).</div>
        <h3>Enseigné par votre équipement</h3>
        ${weapon ? teacherBlock(weapon, 'Arme') : '<p class="shop-empty">Aucune arme en main.</p>'}
        ${stuffList.map(s => teacherBlock(s, 'Stuff')).join('')}
        <h3>Compétences apprises (${learned.length} / ${SKILLS.length})</h3>
        ${learned.length ? learned.map(skillLine).join('') : '<p class="shop-empty">Rien d\'appris pour l\'instant : combattez avec votre équipement.</p>'}
        <h3>Xiūxiān</h3>
        <p>La jauge se remplit quand vous subissez des dégâts. Pleine, la Xiūxiān se déclenche toute seule pour ${TRANSE_TURNS} tours. En combat, vous choisissez une classe par tour : son effet s'applique.</p>
        <ul class="transe-list">${transeRows}</ul>
        <p>L'ultime ne se lance que pendant la Xiūxiān, avec la classe Mage antique (sorcier) choisie pour le tour.</p>`;
}

function onClick(ev) {
    const btn = ev.target.closest('[data-toggle-skill]');
    if (!btn) return;
    if (gameState.combatState === 'active') return;
    const res = toggleSupport(player, btn.dataset.toggleSkill);
    log(res.message);
    if (res.ok) saveUpdate();
    renderSkillsTab();
}

function init() {
    document.addEventListener('skills-tab-open', renderSkillsTab);
    document.addEventListener('stuff-changed', renderSkillsTab);
    document.getElementById('skills-view')?.addEventListener('click', onClick);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

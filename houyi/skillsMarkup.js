// Onglet « Compétences » : balisage (module pur, sans DOM ni accès au jeu : testable et prévisualisable hors du jeu).
// Présentation inspirée des menus de capacités des jeux de rôle japonais : en-tête du héros avec son compteur de Fulu, grille à deux colonnes
// (gemme pleine = activée, gemme creuse = apprise mais éteinte, gemme grise = pas encore apprise), coût en Fulu à droite, fiche d'information.
import { SKILLS, getSkill, isSupport, skillsTaughtBy, normalizeSkills, isLearned, progressOf, magikolithCapacity, usedMagikoliths } from './skills.js';
import { TRANSE_TURNS, TRANSE_EFFECTS } from './transe.js';
import { CLASS_IDS, CLASS_SHORT, MAX_USABLE_CLASSES, BIOME_CLASS_LIMITS, normalizeRoster } from './classRoster.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GEM = '<svg class="gem-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 L14 5 L14 11 L8 15 L2 11 L2 5Z"/><path class="gem-facet" d="M2 5 L8 8 L14 5 M8 8 L8 15"/></svg>';
const BOLT = '<svg class="gem-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 1 L3 9 H7.5 L6.5 15 L13 6.5 H8.5Z"/></svg>';

/** État d'une compétence : active | learned | training (enseignée par l'équipement porté) | locked. */
export function skillState(hero, skill, taughtNow) {
    const state = normalizeSkills(hero);
    if (isLearned(hero, skill.id)) return isSupport(skill) ? (state.active.includes(skill.id) ? 'active' : 'learned') : 'learned';
    return taughtNow.has(skill.id) ? 'training' : 'locked';
}

const STATE_LABEL = { active: 'Activée', learned: 'Apprise', training: 'En apprentissage', locked: 'Pas encore enseignée' };

/** Qui enseigne quoi : Map id de compétence → noms des objets portés qui l'enseignent. */
export function taughtMap(gear) {
    const map = new Map();
    gear.forEach(item => skillsTaughtBy(item).forEach(id => map.set(id, [...(map.get(id) || []), item.name || item.id])));
    return map;
}

const gems = (used, cap) => Array.from({ length: cap }, (_, i) => `<i class="fulu-pip${i < used ? ' on' : ''}"></i>`).join('');

function row(hero, skill, taught, selectedId) {
    const st = skillState(hero, skill, taught);
    const cost = isSupport(skill) ? skill.cost : '·';
    return `<button type="button" class="ab-row ab-${st}${skill.id === selectedId ? ' selected' : ''}" data-skill="${skill.id}" aria-pressed="${skill.id === selectedId}">
        <span class="ab-gem">${isSupport(skill) ? GEM : BOLT}</span>
        <span class="ab-name">${esc(skill.name)}</span>
        <span class="ab-cost" title="${isSupport(skill) ? 'Coût en Fulu' : 'Commande de combat'}">${cost}</span>
    </button>`;
}

function infoPanel(hero, skill, taught, canToggle) {
    if (!skill) return '<div class="ab-info"><p class="ab-hint">Touchez une compétence pour voir sa fiche.</p></div>';
    const st = skillState(hero, skill, taught);
    const have = progressOf(hero, skill.id);
    const pct = st === 'active' || st === 'learned' ? 100 : Math.round(have / skill.ap * 100);
    const stars = Math.min(3, Math.floor(pct / 33.4));
    const star = n => `<span class="ab-star${n < stars || pct >= 100 ? ' on' : ''}">★</span>`;
    const who = taught.get(skill.id);
    const action = isSupport(skill) && (st === 'active' || st === 'learned')
        ? `<button type="button" class="ab-toggle" data-toggle-skill="${skill.id}"${canToggle ? '' : ' disabled'}>${st === 'active' ? 'Éteindre' : 'Allumer'}</button>` : '';
    return `<div class="ab-info">
        <div class="ab-info-head"><strong>${esc(skill.name)}</strong><span class="ab-state ab-state-${st}">${STATE_LABEL[st]}</span></div>
        <p class="ab-desc">${esc(skill.description)}</p>
        <div class="ab-line"><span>${isSupport(skill) ? 'Soutien' : 'Action'}</span><span>${isSupport(skill) ? `${skill.cost} Fulu` : 'commande de combat'}</span></div>
        <div class="ab-line"><span>PA</span><span class="ab-stars" aria-label="${pct} %">${star(0)}${star(1)}${star(2)} <em>${st === 'locked' ? skill.ap : `${Math.min(have, skill.ap)} / ${skill.ap}`}</em></span></div>
        <div class="ab-bar"><div class="ab-bar-fill" style="width:${pct}%"></div></div>
        <div class="ab-line"><span>Équip.</span><span>${who ? esc(who.join(', ')) : 'aucun objet porté ne l\'enseigne'}</span></div>
        ${action}
    </div>`;
}

const BIOME_NAMES = { volcano: 'Volcan', gobi: 'Gobi', riverbed: 'Fleuve', bamboo: 'Bambous', storm: 'Tonnerre', savanna: 'Fauves', coast: 'Côte', tides: 'Hautes-Eaux', fusang: 'Fusang', moon: 'Lune', paddy: 'Rizières' };

/** Classes de combat : celles que Hou Yi connaît, dont 4 au plus sont utilisables en combat ; classes à rencontrer ; biomes qui en brident. */
export function classesHtml(hero, canToggle = true) {
    const roster = normalizeRoster(hero);
    const rows = CLASS_IDS.map(id => {
        const owned = roster.owned.includes(id), on = roster.loadout.includes(id);
        const action = owned ? `<button type="button" class="cl-toggle" data-toggle-class="${id}"${canToggle ? '' : ' disabled'}>${on ? 'Retirer' : 'Utiliser'}</button>` : '<span class="cl-lock">À rencontrer</span>';
        return `<div class="cl-row${on ? ' on' : ''}${owned ? '' : ' locked'}"><span class="cl-name">${esc(CLASS_SHORT[id])}</span>${action}</div>`;
    }).join('');
    const limits = Object.entries(BIOME_CLASS_LIMITS).map(([biome, l]) => `<li><strong>${esc(BIOME_NAMES[biome] || biome)}</strong> : ${l.classes.map(c => esc(CLASS_SHORT[c])).join(', ')} bridé${l.classes.length > 1 ? 's' : ''} (${esc(l.reason)})</li>`).join('');
    return `<div class="cl-panel"><div class="cl-head"><strong>Classes de combat</strong><span>${roster.loadout.length} / ${MAX_USABLE_CLASSES}</span></div>
        <div class="cl-grid">${rows}</div>
        <details class="cl-limits"><summary>Biomes qui brident des classes</summary><ul>${limits}</ul>
        <p>Il reste toujours une classe utilisable : mêlez-les pour tirer parti de chaque région.</p></details></div>`;
}

/**
 * Balisage complet de l'onglet. hero : { name, level, hp, maxHp, skills } ; gear : objets portés qui enseignent (arme, stuff) ;
 * selectedId : compétence affichée dans la fiche ; canToggle : faux en combat.
 */
export function skillsTabHtml(hero, gear, selectedId, canToggle = true) {
    normalizeSkills(hero);
    const used = usedMagikoliths(hero), cap = magikolithCapacity(hero);
    const taught = taughtMap(gear);
    const order = { active: 0, learned: 1, training: 2, locked: 3 };
    const list = [...SKILLS].sort((a, b) => order[skillState(hero, a, taught)] - order[skillState(hero, b, taught)]);
    const selected = getSkill(selectedId) || list[0];
    const learnedCount = hero.skills.learned.length;
    const transe = Object.entries(TRANSE_EFFECTS).map(([cls, e]) => `<li>${esc(({ sorcerer: 'Mage', assassin: 'Rôdeur', templar: 'Commandant', barbarian: 'Guerrier' })[cls])} : ${esc(e.text)}</li>`).join('');
    return `<div class="ab-screen">
        <div class="ab-header">
            <div class="ab-hero"><strong>${esc(hero.name || 'Hou Yi')}</strong> <span class="ab-lv">Niv. ${hero.level || 1}</span>
                <div class="ab-hp">PV ${hero.hp ?? hero.maxHp ?? 0} / ${hero.maxHp ?? 0}</div></div>
            <div class="ab-fulu" role="status" aria-label="Fulu utilisés"><span class="ab-fulu-ic">${GEM}</span><span class="ab-fulu-num"><b>${used}</b> / ${cap}</span><span class="ab-fulu-label">Fulu</span></div>
        </div>
        <div class="fulu-meter" aria-hidden="true">${gems(used, cap)}</div>
        ${classesHtml(hero, canToggle)}
        <div class="ab-body">
            <div class="ab-grid" role="list">${list.map(s => row(hero, s, taught, selected.id)).join('')}</div>
            ${infoPanel(hero, selected, taught, canToggle)}
        </div>
        <p class="ab-legend"><span class="lg lg-active">${GEM}</span> activée <span class="lg lg-learned">${GEM}</span> apprise <span class="lg lg-training">${GEM}</span> en apprentissage <span class="lg lg-locked">${GEM}</span> à débloquer · ${learnedCount} / ${SKILLS.length} apprises</p>
        <details class="ab-xiu"><summary>Xiūxiān</summary>
            <p>La jauge se remplit quand vous subissez des dégâts. Pleine, la Xiūxiān se déclenche toute seule pour ${TRANSE_TURNS} tours ; en combat, une classe par tour : son effet s'applique.</p>
            <ul>${transe}</ul><p>L'ultime ne se lance que pendant la Xiūxiān, avec le Mage choisi pour le tour.</p></details>
    </div>`;
}

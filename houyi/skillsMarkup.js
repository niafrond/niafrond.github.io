// Onglet « Compétences » : balisage (module pur, sans DOM ni accès au jeu : testable et prévisualisable hors du jeu).
// Présentation inspirée des menus de capacités des jeux de rôle japonais : en-tête du héros avec son compteur de Fulu, grille à deux colonnes
// (gemme pleine = activée, gemme creuse = apprise mais éteinte, gemme grise = pas encore apprise), coût en Fulu à droite, fiche d'information.
import { visibleSkills, markSeen, getSkill, isSupport, skillsTaughtBy, normalizeSkills, isLearned, progressOf, magikolithCapacity, usedMagikoliths } from './skills.js';
import { TRANSE_TURNS, TRANSE_EFFECTS } from './transe.js';
import { CLASS_IDS, CLASS_SHORT, MAX_USABLE_CLASSES, START_CLASS, BIOME_CLASS_LIMITS, normalizeRoster } from './classRoster.js';
import { ALLIES, memberName, allyMaxHp } from './allies.js';
import { weaponsFor, allyEquippedWeapon } from './allyWeapons.js';
import { allyWeaponBonus } from './weapons.js';

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
export function taughtMap(gear, hero = null) {
    const map = new Map();
    const owned = hero ? normalizeRoster(hero).owned : [];   // classes obtenues : l'équipement enseigne aussi leurs compétences
    gear.forEach(item => skillsTaughtBy(item, owned).forEach(id => map.set(id, [...(map.get(id) || []), item.name || item.id])));
    return map;
}

const gems = (used, cap) => Array.from({ length: cap }, (_, i) => `<i class="fulu-pip${i < used ? ' on' : ''}"></i>`).join('');

function row(hero, skill, taught, selectedId) {
    const st = skillState(hero, skill, taught);
    const cost = isSupport(skill) ? skill.cost : '·';
    return `<button type="button" class="ab-row ab-${st}${skill.id === selectedId ? ' selected' : ''}" data-skill="${skill.id}" aria-pressed="${skill.id === selectedId}">
        <span class="ab-gem">${isSupport(skill) ? GEM : BOLT}</span>
        <span class="ab-name">${esc(skill.name)}${skill.classId ? ` <small class="ab-class">${esc(CLASS_SHORT[skill.classId])}</small>` : ''}</span>
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
        ${skill.classId ? `<div class="ab-line"><span>Classe</span><span>${esc(CLASS_SHORT[skill.classId])} (effet seulement quand elle joue)</span></div>` : ''}
        <div class="ab-line"><span>${isSupport(skill) ? 'Soutien' : 'Action'}</span><span>${isSupport(skill) ? `${skill.cost} Fulu` : 'commande de combat'}</span></div>
        <div class="ab-line"><span>PA</span><span class="ab-stars" aria-label="${pct} %">${star(0)}${star(1)}${star(2)} <em>${st === 'locked' ? skill.ap : `${Math.min(have, skill.ap)} / ${skill.ap}`}</em></span></div>
        <div class="ab-bar"><div class="ab-bar-fill" style="width:${pct}%"></div></div>
        <div class="ab-line"><span>Équip.</span><span>${who ? esc(who.join(', ')) : 'aucun objet porté ne l\'enseigne'}</span></div>
        ${action}
    </div>`;
}

const BIOME_NAMES = { volcano: 'Volcan', gobi: 'Gobi', riverbed: 'Fleuve', bamboo: 'Bambous', storm: 'Tonnerre', savanna: 'Fauves', coast: 'Côte', tides: 'Hautes-Eaux', fusang: 'Fusang', moon: 'Lune', paddy: 'Rizières' };

/** Équipe de combat : Hou Yi (Chasseur) et les compagnons recrutés (3 au plus en combat) ; biomes qui brident des classes. Aucun spoil : seuls les compagnons déjà recrutés figurent. */
export function classesHtml(hero, canToggle = true) {
    const roster = normalizeRoster(hero);
    const rows = CLASS_IDS.filter(id => roster.owned.includes(id)).map(id => {
        const on = roster.loadout.includes(id);
        const isHero = id === START_CLASS;
        const ally = ALLIES[id];
        // Hou Yi est toujours de l'équipe ; un compagnon seul recruté n'a rien à échanger tant que l'équipe a de la place.
        const action = isHero || roster.owned.length <= 1 ? '' : `<button type="button" class="cl-toggle" data-toggle-class="${id}"${canToggle ? '' : ' disabled'}>${on ? 'Retirer' : 'Appeler'}</button>`;
        const detail = isHero ? 'Hou Yi' : `${esc(ally.name)} · ${allyMaxHp(hero, id)} PV`;
        // Arme du compagnon (réglée hors combat) : choisie parmi les armes de son type que Hou Yi a trouvées ou achetées.
        let weapon = '';
        if (!isHero) {
            const eq = allyEquippedWeapon(hero, id), choices = weaponsFor(hero, id);
            const opts = ['<option value="">Mains nues</option>', ...choices.map(w => `<option value="${esc(w.id)}"${eq?.id === w.id ? ' selected' : ''}>${esc(w.name)} (+${allyWeaponBonus(w)})</option>`)].join('');
            weapon = `<label class="cl-weapon">Arme <select data-ally-weapon="${id}"${canToggle ? '' : ' disabled'}>${opts}</select></label>`;
        }
        return `<div class="cl-row${on ? ' on' : ''}" title="${esc(detail)}"><span class="cl-name">${esc(memberName(id))} <small>${esc(CLASS_SHORT[id])}</small></span>${weapon}${action}</div>`;
    }).join('');
    const limits = Object.entries(BIOME_CLASS_LIMITS).map(([biome, l]) => {
        const known = l.classes.filter(c => roster.owned.includes(c));
        return known.length ? `<li><strong>${esc(BIOME_NAMES[biome] || biome)}</strong> : ${known.map(c => esc(memberName(c))).join(', ')} bridé${known.length > 1 ? 's' : ''} (${esc(l.reason)})</li>` : '';
    }).join('');
    return `<div class="cl-panel"><div class="cl-head"><strong>Équipe de combat</strong><span>${roster.loadout.length} / ${MAX_USABLE_CLASSES}</span></div>
        <div class="cl-grid">${rows}</div>
        <details class="cl-limits"><summary>Biomes qui brident des compagnons</summary><ul>${limits}</ul>
        <p>Il reste toujours un membre utilisable : mêlez les compagnons pour tirer parti de chaque région. Ils partagent le qì de Hou Yi, mais chacun a sa barre de vie : à 0 PV, un compagnon est hors de combat jusqu'à la fin.</p></details></div>`;
}

/**
 * Balisage complet de l'onglet. hero : { name, level, hp, maxHp, skills } ; gear : objets portés qui enseignent (arme, stuff) ;
 * selectedId : compétence affichée dans la fiche ; canToggle : faux en combat.
 */
export function skillsTabHtml(hero, gear, selectedId, canToggle = true) {
    normalizeSkills(hero);
    const used = usedMagikoliths(hero), cap = magikolithCapacity(hero);
    const taught = taughtMap(gear, hero);
    const order = { active: 0, learned: 1, training: 2, locked: 3 };
    markSeen(hero, [...taught.keys()]);   // ce que l'équipement porté enseigne devient visible (et le reste du catalogue reste caché)
    const list = [...visibleSkills(hero, [...taught.keys()])].sort((a, b) => order[skillState(hero, a, taught)] - order[skillState(hero, b, taught)]);
    const selected = getSkill(selectedId) || list[0];
    const learnedCount = hero.skills.learned.length;
    const ownedClasses = normalizeRoster(hero).owned;
    const transe = Object.entries(TRANSE_EFFECTS).filter(([cls]) => ownedClasses.includes(cls)).map(([cls, e]) => `<li><strong>${esc(e.name)}</strong> (${esc(CLASS_SHORT[cls])}) : ${esc(e.text)}</li>`).join('');
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
        <p class="ab-legend"><span class="lg lg-active">${GEM}</span> activée <span class="lg lg-learned">${GEM}</span> apprise <span class="lg lg-training">${GEM}</span> en apprentissage <span class="lg lg-locked">${GEM}</span> à débloquer · ${learnedCount} apprise${learnedCount > 1 ? 's' : ''}</p>
        <details class="ab-xiu"><summary>Xiūxiān</summary>
            <p>Chaque classe a sa jauge, qui se remplit quand vous subissez des dégâts avec cette classe et se conserve d'un combat à l'autre. Pleine, touchez-la pour déclencher la Xiūxiān de cette classe (${TRANSE_TURNS} tours) : son effet s'applique, même si vous changez de classe ensuite.</p>
            <ul>${transe}</ul>${ownedClasses.includes('sorcerer') ? '<p>L\'ultime ne se lance que pendant la Xiūxiān du Mage, avec le Mage choisi pour le tour.</p>' : ''}</details>
    </div>`;
}

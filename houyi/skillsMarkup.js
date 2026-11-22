// Onglet « Compétences » : balisage (module pur, sans DOM ni accès au jeu : testable et prévisualisable hors du jeu).
// Présentation inspirée des menus de capacités des jeux de rôle japonais : en-tête du héros avec son compteur de Fulu, grille à deux colonnes
// (gemme pleine = activée, gemme creuse = apprise mais éteinte, gemme grise = pas encore apprise), coût en Fulu à droite, fiche d'information.
import { visibleSkills, markSeen, getSkill, isSupport, skillsTaughtBy, normalizeSkills, isLearned, progressOf, magikolithCapacity, usedMagikoliths, isBaseSkill, victoriesLeft } from './skills.js';
import { TRANSE_TURNS, TRANSE_EFFECTS } from './transe.js';
import { CLASS_IDS, CLASS_SHORT, MAX_USABLE_CLASSES, START_CLASS, BIOME_CLASS_LIMITS, normalizeRoster } from './classRoster.js';
import { ALLIES, memberName, allyMaxHp } from './allies.js';
import { weaponsFor, allyEquippedWeapon } from './allyWeapons.js';
import { charTabsHtml, getCharTab, charTabIds } from './charTabs.js';
import { allyWeaponBonus } from './weapons.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GEM = '<svg class="gem-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 L14 5 L14 11 L8 15 L2 11 L2 5Z"/><path class="gem-facet" d="M2 5 L8 8 L14 5 M8 8 L8 15"/></svg>';

/** État d'une compétence : active | learned | training (enseignée par l'équipement porté) | locked. */
export function skillState(hero, skill, taughtNow) {
    const state = normalizeSkills(hero);
    if (isLearned(hero, skill.id)) return isSupport(skill) ? (state.active.includes(skill.id) ? 'active' : 'learned') : 'learned';
    return taughtNow.has(skill.id) ? 'training' : 'locked';
}

const STATE_LABEL = { active: 'Allumée', learned: 'Apprise (éteinte)', training: 'En apprentissage', locked: 'À débloquer' };

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
    const cost = isSupport(skill) ? skill.cost : '';
    return `<button type="button" class="ab-row ab-${st}${skill.id === selectedId ? ' selected' : ''}" data-skill="${skill.id}" aria-pressed="${skill.id === selectedId}">
        <span class="ab-gem">${GEM}</span>
        <span class="ab-name">${esc(skill.name)}${skill.classId ? ` <small class="ab-class">${esc(memberName(skill.classId))}</small>` : ''}</span>
        <span class="ab-cost" title="Coût en Fulu">${cost}</span>
    </button>`;
}

function infoPanel(hero, skill, taught, canToggle) {
    if (!skill) return '<div class="ab-info"><p class="ab-hint">Touchez une compétence pour voir sa fiche.</p></div>';
    const st = skillState(hero, skill, taught);
    const have = progressOf(hero, skill.id);
    const pct = st === 'active' || st === 'learned' ? 100 : Math.round(have / skill.ap * 100);
    const who = taught.get(skill.id);
    const support = isSupport(skill);
    const cls = skill.classId ? memberName(skill.classId) : null;
    const left = magikolithCapacity(hero) - usedMagikoliths(hero);
    // D'où vient-elle ? / Où en est-on ? : la réponse change selon l'état.
    let origin;
    if (isBaseSkill(skill.id)) origin = `Compétence de base de ${esc(cls)} : apprise dès le départ.`;
    else if (st === 'active' || st === 'learned') origin = `Apprise pour toujours${who ? ` (enseignée aussi par ${esc(who.join(', '))})` : ''}.`;
    else if (st === 'training') origin = `En cours d'apprentissage grâce à ${esc(who.join(', '))} : <b>${Math.min(have, skill.ap)} / ${skill.ap} PA</b>, encore environ ${victoriesLeft(hero, skill.id)} victoire${victoriesLeft(hero, skill.id) > 1 ? 's' : ''}${cls ? ` (${esc(cls)} doit jouer pendant le combat)` : ''}.`;
    else origin = `Pas apprise. Portez une arme ou une pièce de stuff qui l'enseigne, puis gagnez des combats : chaque victoire donne des PA (${have} / ${skill.ap}).`;
    // Comment l'utiliser ?
    let usage;
    if (!support) usage = st === 'learned' ? `Pas d'activation : elle apparaît dans la liste de sorts${cls ? ` de ${esc(cls)}` : ''} en combat.` : `Une fois apprise, elle apparaît comme un sort en combat${cls ? ` (avec ${esc(cls)})` : ''}.`;
    else if (st === 'active') usage = `Allumée : son effet agit${cls ? ` quand ${esc(cls)} joue` : ''}. Éteignez-la pour récupérer ${skill.cost} Fulu.`;
    else if (st === 'learned') usage = skill.cost > left ? `Il manque ${skill.cost - left} Fulu pour l'allumer (il en reste ${left}) : éteignez une autre compétence.` : `Touchez « Allumer » : elle coûte ${skill.cost} Fulu (il en reste ${left}).`;
    else usage = `Une fois apprise, vous pourrez l'allumer (${skill.cost} Fulu), à tout moment.`;
    const action = support && (st === 'active' || st === 'learned')
        ? `<button type="button" class="ab-toggle" data-toggle-skill="${skill.id}"${canToggle ? '' : ' disabled'}>${st === 'active' ? 'Éteindre' : 'Allumer'}</button>` : '';
    return `<div class="ab-info">
        <div class="ab-info-head"><strong>${esc(skill.name)}</strong><span class="ab-state ab-state-${st}">${STATE_LABEL[st]}</span></div>
        <p class="ab-desc">${esc(skill.description)}</p>
        <div class="ab-line"><span>Type</span><span>${support ? `Soutien · ${skill.cost} Fulu` : 'Action · commande de combat'}${cls ? ` · ${esc(cls)}` : ''}</span></div>
        <div class="ab-line ab-origin"><span>Origine</span><span>${origin}</span></div>
        ${st === 'training' || st === 'locked' ? `<div class="ab-bar"><div class="ab-bar-fill" style="width:${pct}%"></div></div>` : ''}
        <div class="ab-line ab-usage"><span>Utiliser</span><span>${usage}</span></div>
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
            const opts = [...choices.map(w => `<option value="${esc(w.id)}"${eq?.id === w.id ? ' selected' : ''}>${esc(w.name)} (+${allyWeaponBonus(w)})</option>`)].join('');
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
    // Un onglet par personnage : les compétences de sa classe (celles sans classe, ou d'une classe sans onglet, appartiennent à Hou Yi)
    const charId = getCharTab('skills', hero);
    const tabIds = charTabIds(hero);
    const owner = s => (tabIds.includes(s.classId) ? s.classId : START_CLASS);   // une compétence d'une classe sans onglet reste sous Hou Yi
    const list = [...visibleSkills(hero, [...taught.keys()])].filter(s => owner(s) === charId)
        .sort((a, b) => order[skillState(hero, a, taught)] - order[skillState(hero, b, taught)]);
    const selected = list.find(s => s.id === selectedId) || list[0];
    const learnedCount = hero.skills.learned.length;
    const ownedClasses = normalizeRoster(hero).owned;
    const transe = Object.entries(TRANSE_EFFECTS).filter(([cls]) => ownedClasses.includes(cls)).map(([cls, e]) => `<li><strong>${esc(e.name)}</strong> (${esc(memberName(cls))}) : ${esc(e.text)}</li>`).join('');
    return `<div class="ab-screen">
        <div class="ab-header">
            <div class="ab-hero"><strong>${esc(hero.name || 'Hou Yi')}</strong> <span class="ab-lv">Niv. ${hero.level || 1}</span>
                <div class="ab-hp">PV ${hero.hp ?? hero.maxHp ?? 0} / ${hero.maxHp ?? 0}</div></div>
            <div class="ab-fulu" role="status" aria-label="Fulu utilisés"><span class="ab-fulu-ic">${GEM}</span><span class="ab-fulu-num"><b>${used}</b> / ${cap}</span><span class="ab-fulu-label">Fulu</span></div>
        </div>
        <div class="fulu-meter" aria-hidden="true">${gems(used, cap)}</div>
        ${classesHtml(hero, canToggle)}
        ${charTabsHtml('skills', hero, 'Compétences par personnage')}
        <div class="ab-body">
            <div class="ab-groups">${[['Soutien', list.filter(isSupport)], ['Actions', list.filter(s => !isSupport(s))]].filter(([, items]) => items.length).map(([title, items]) => `<h3 class="ab-group">${title}</h3><div class="ab-grid" role="list">${items.map(s => row(hero, s, taught, selected.id)).join('')}</div>`).join('')}</div>
            ${infoPanel(hero, selected, taught, true)}
        </div>
        <p class="ab-legend"><span class="lg lg-active">${GEM}</span> allumée (bonus actif) <span class="lg lg-learned">${GEM}</span> apprise, éteinte <span class="lg lg-training">${GEM}</span> en apprentissage <span class="lg lg-locked">${GEM}</span> à débloquer · ${learnedCount} apprise${learnedCount > 1 ? 's' : ''}</p>
        <details class="ab-xiu"><summary>Xiūxiān</summary>
            <p>Chaque classe a sa jauge, qui se remplit quand vous subissez des dégâts avec cette classe et se conserve d'un combat à l'autre. Pleine, touchez-la pour déclencher la Xiūxiān de cette classe (${TRANSE_TURNS} tours) : son effet s'applique, même si vous changez de classe ensuite.</p>
            <ul>${transe}</ul>${ownedClasses.includes('sorcerer') ? '<p>L\'ultime ne se lance que pendant la Xiūxiān de Longwang, avec Longwang choisi pour le tour.</p>' : ''}</details>
    </div>`;
}

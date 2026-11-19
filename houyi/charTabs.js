// Onglets « un par personnage » des menus : Hou Yi puis chaque compagnon recruté. Module sans DOM (balisage et état seulement) ;
// l'écoute des clics est posée par bindCharTabs. Utilisé par les menus Sorts, Armes, Compétences et Stats.
import { START_CLASS } from './classRoster.js';
import { recruitedAllies, memberName } from './allies.js';

const chosen = {};   // menu → personnage choisi (gardé tant que la page reste ouverte)

/** Personnages de l'équipe, Hou Yi en premier. */
export const charTabIds = hero => [START_CLASS, ...recruitedAllies(hero)];

/** Personnage choisi dans un menu ; Hou Yi si le choix n'est plus recruté. */
export function getCharTab(menu, hero) {
    return charTabIds(hero).includes(chosen[menu]) ? chosen[menu] : START_CLASS;
}
export function setCharTab(menu, id) { chosen[menu] = id; }

/** Balisage de la bande d'onglets ; vide quand Hou Yi est seul (aucun compagnon à montrer). */
export function charTabsHtml(menu, hero, label = 'Personnage') {
    const ids = charTabIds(hero);
    if (ids.length < 2) return '';
    const current = getCharTab(menu, hero);
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    return `<div class="char-tabs" role="tablist" aria-label="${esc(label)}">`
        + ids.map(id => `<button type="button" class="char-tab${id === current ? ' on' : ''}" role="tab" aria-selected="${id === current}" data-char-tab="${id}" data-menu="${menu}">${esc(memberName(id))}</button>`).join('')
        + '</div>';
}

/** Écoute (une fois) les clics sur les onglets d'un menu, dans `root` ; `onChange(id)` redessine le menu. */
export function bindCharTabs(root, menu, onChange) {
    if (!root || root.dataset[`charTabs_${menu}`]) return;
    root.dataset[`charTabs_${menu}`] = '1';
    root.addEventListener('click', ev => {
        const btn = ev.target.closest?.(`.char-tab[data-menu="${menu}"]`);
        if (!btn || !root.contains(btn)) return;
        const id = btn.dataset.charTab;
        if (id === chosen[menu]) return;
        setCharTab(menu, id);
        onChange(id);
    });
}

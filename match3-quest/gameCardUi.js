// Aides communes aux cartes des onglets Sorts / Armes / Équipement / Inventaire (échappement HTML, pied de carte, tri mémorisé).
// Extrait de game.js.
import { icon } from './icons.js';

export const escapeHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const cardActionsHtml = (compare, actions) => `<div class="card-actions">${compare}<span class="card-actions-main">${actions}</span></div>`;
export const emptySlotHtml = (label, text) => `<div class="weapon-item gear-card slot-empty"><div class="weapon-details"><span class="weapon-name">${label}</span><span class="weapon-description">${text}</span></div></div>`;

// ── Tri des listes d'armes et d'objets (menus déroulants des onglets Armes et Objets) ──
const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
const byText = (a, b) => String(a).localeCompare(String(b), 'fr');
export const WEAPON_SORTS = {
    name: (a, b) => byText(a.name, b.name),
    damage: (a, b) => (b.damage || 0) - (a.damage || 0) || byText(a.name, b.name),
    ap: (a, b) => (a.actionPoints || 0) - (b.actionPoints || 0) || byText(a.name, b.name),
    level: (a, b) => (a.minLevel || 1) - (b.minLevel || 1) || byText(a.name, b.name)
};
const ITEM_SORTS = {
    name: (a, b) => byText(a.it.name, b.it.name),
    rarity: (a, b) => (RARITY_RANK[b.it.rarity] ?? 0) - (RARITY_RANK[a.it.rarity] ?? 0) || byText(a.it.name, b.it.name),
    level: (a, b) => (a.it.minLevel || 1) - (b.it.minLevel || 1) || byText(a.it.name, b.it.name),
    type: (a, b) => byText(a.it.type, b.it.type) || byText(a.it.name, b.it.name)
};
export const sortChoice = id => { try { return localStorage.getItem('sort:' + id) || 'default'; } catch { return 'default'; } };
export function bindSortSelect(id, rerender){
    const sel = document.getElementById(id);
    if(!sel || sel.dataset.bound) return;
    sel.value = sortChoice(id);
    sel.dataset.bound = '1';
    sel.addEventListener('change', () => { try { localStorage.setItem('sort:' + id, sel.value); } catch {} rerender(); });
}
export const sortedEntries = (entries, sortId) => {
    const fn = ITEM_SORTS[sortChoice(sortId)];
    return fn ? [...entries].sort(fn) : entries;
};

// ── Cartes compactes (onglets Armes, Objets, Stuff, Spéciaux) ──
// Une carte tient sur une à deux lignes : nom (jamais coupé en plusieurs lignes, la quantité est une pastille à part),
// puis les ÉCARTS avec ce qui est porté (ce qui compte pour choisir), sinon les chiffres clés. Un seul bouton principal et un
// menu « ⋯ » pour le reste (Comparer, À vendre, Jeter…). La description n'apparaît qu'à l'appui long (infobulle, voir bindCardTips).
const openCards = new Set();   // cartes dont le menu « ⋯ » est ouvert (survit au redessin des listes)

export const moreButtonHtml = open => `<button type="button" class="rc-btn rc-ic" data-rc-more aria-expanded="${!!open}" aria-label="Plus d'actions" title="Plus d'actions">${icon('more')}</button>`;

// key : identifiant stable de la carte ; border : couleur de rareté ; badges : pastilles à côté du nom ; sub : écarts et chiffres clés ;
// primary : bouton principal ; more : boutons du menu « ⋯ » ; tip : contenu de l'infobulle (appui long / survol).
export function rowCardHtml({ key, cls = '', border = '', name, badges = '', sub = '', primary = '', more = '', tip = '' }) {
    const open = !!more && openCards.has(key);
    return `<div class="rc${cls ? ' ' + cls : ''}${open ? ' open' : ''}" data-rc="${escapeHtml(key)}" tabindex="0"${border ? ` style="border-left-color:${escapeHtml(border)}"` : ''}>`
        + `<div class="rc-main"><div class="rc-title"><span class="rc-name">${name}</span>${badges}</div>${sub ? `<div class="rc-sub">${sub}</div>` : ''}</div>`
        + `<div class="rc-actions">${primary}${more ? moreButtonHtml(open) : ''}</div>`
        + (more ? `<div class="rc-more">${more}</div>` : '')
        + (tip ? `<div class="rc-tip visually-hidden">${tip}</div>` : '')
        + `</div>`;
}

// Emplacement vide : une seule ligne discrète.
export const emptyRowHtml = (label, text) => `<div class="rc rc-empty"><span class="rc-name">${label}</span><span class="rc-sub">${text}</span></div>`;

export const badgeHtml = (text, cls = '') => `<em class="rc-badge${cls ? ' ' + cls : ''}">${text}</em>`;

// Contenu d'infobulle : titre, lignes de détail, description.
export const cardTipHtml = (title, lines = [], desc = '') =>
    `<div class="spell-tooltip-title">${title}</div>${lines.filter(Boolean).map(l => `<div class="spell-tooltip-line">${l}</div>`).join('')}${desc ? `<div class="spell-tooltip-line"><em>${desc}</em></div>` : ''}`;

// Première proposition d'une description (avant la parenthèse ou la virgule) : une ligne de repère, le reste est dans l'infobulle.
export const shortText = (text, max = 48) => {
    const first = String(text ?? '').split(/ \(|[,;]/)[0].trim();
    return first.length > max ? first.slice(0, max - 1).trimEnd() + '…' : first;
};

if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
        const btn = e.target.closest?.('[data-rc-more]');
        if (!btn) return;
        const card = btn.closest('.rc');
        if (!card) return;
        const key = card.dataset.rc;
        const wasOpen = openCards.delete(key);
        if (!wasOpen) openCards.add(key);
        card.classList.toggle('open', !wasOpen);
        btn.setAttribute('aria-expanded', String(!wasOpen));
    });
}

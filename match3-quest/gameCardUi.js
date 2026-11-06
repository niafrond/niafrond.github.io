// Aides communes aux cartes des onglets Sorts / Armes / Équipement / Inventaire (échappement HTML, pied de carte, tri mémorisé).
// Extrait de game.js.


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

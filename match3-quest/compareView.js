// Comparaison de deux sorts, armes ou stuffs : bouton « Comparer » sur chaque ligne (1er clic = référence, 2e clic = tableau comparatif).
// Module d'affichage pur : les objets sont retrouvés par les résolveurs passés à initCompare (aucune dépendance à game.js).

const RARITY_LABEL = { common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', legendary: 'Ultra rare' };
const KIND_LABEL = { spell: 'sort', weapon: 'arme', stuff: 'stuff' };
const SLOT_LABEL = { head: 'Casque', neck: 'Collier', wrist: 'Bracelet', ring: 'Bague' };

const costTotal = sp => typeof sp.cost === 'number' ? sp.cost : Object.values(sp.cost || {}).reduce((a, b) => a + b, 0);
const costText = sp => typeof sp.cost === 'number' ? `${sp.cost} ${sp.color || ''}`.trim() : Object.entries(sp.cost || {}).map(([c, n]) => `${n} ${c}`).join(' + ');

// Lignes comparées : { label, num (valeur numérique ou null), text, better: 'high' | 'low' | null }.
export function compareRows(kind, o) {
    if (!o) return [];
    const n = (label, v, better = 'high') => ({ label, num: v || 0, text: String(v || 0), better });
    const t = (label, text) => ({ label, num: null, text: text || '—', better: null });
    if (kind === 'spell') return [
        { label: 'Coût (total)', num: costTotal(o), text: costText(o) || '0', better: 'low' },
        n('Dégâts', o.dmg), n('Soin', o.heal), n('Niveau requis', o.minLevel || 1, 'low'),
        t('Effet', o.description)
    ];
    if (kind === 'weapon') return [
        n('Dégâts', o.damage), n('Points d\'action', o.actionPoints, 'low'), n('Niveau requis', o.minLevel || 1, 'low'),
        n('Attaque', o.atkBonus), n('Défense', o.defBonus), t('Biome', o.biome), t('Mains', o.twoHanded ? 'Deux mains' : 'Une main')
    ];
    if (kind === 'stuff') return [
        t('Emplacement', SLOT_LABEL[o.slot]), t('Rareté', RARITY_LABEL[o.rarity]),
        n('Attaque', o.atkBonus), n('Défense', o.defBonus), n('PV max', o.maxHp), n('Résistance poison (%)', o.poisonResist),
        n('Niveau requis', o.minLevel || 1, 'low'), t('Protège', o.biomeProtect)
    ];
    return [];
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function buildCompareHtml(kind, a, b) {
    const ra = compareRows(kind, a), rb = compareRows(kind, b);
    const body = ra.map((row, i) => {
        const other = rb[i];
        let ca = '', cb = '';
        if (row.better && row.num !== other.num) {
            const aWins = row.better === 'high' ? row.num > other.num : row.num < other.num;
            ca = aWins ? ' class="cmp-better"' : ''; cb = aWins ? '' : ' class="cmp-better"';
        }
        return `<tr><th scope="row">${esc(row.label)}</th><td${ca}>${esc(row.text)}</td><td${cb}>${esc(other.text)}</td></tr>`;
    }).join('');
    return `<table class="compare-table"><thead><tr><th></th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>${body}</tbody></table>`;
}

let selection = null;   // { kind, id } : premier élément choisi
let resolvers = {};

function refreshButtons() {
    document.querySelectorAll('.compare-btn').forEach(btn => {
        const on = !!selection && btn.dataset.compareKind === selection.kind && btn.dataset.compareId === selection.id;
        btn.classList.toggle('compare-selected', on);
        btn.setAttribute('aria-pressed', String(on));
    });
}

function closeOverlay() { document.getElementById('compare-overlay')?.remove(); }

function showOverlay(kind, a, b) {
    closeOverlay();
    const el = document.createElement('div');
    el.id = 'compare-overlay';
    el.className = 'modal active compare-overlay';
    el.innerHTML = `<div class="modal-content"><h2>Comparer des ${esc(KIND_LABEL[kind])}s</h2>${buildCompareHtml(kind, a, b)}<div class="modal-actions"><button class="primary" type="button">Fermer</button></div></div>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.modal-actions button')) closeOverlay(); });
    document.body.appendChild(el);
}

export function onCompareClick(kind, id) {
    if (!selection || selection.kind !== kind) { selection = { kind, id }; refreshButtons(); return 'selected'; }
    if (selection.id === id) { selection = null; refreshButtons(); return 'cleared'; }
    const a = resolvers[kind]?.(selection.id), b = resolvers[kind]?.(id);
    selection = null;
    refreshButtons();
    if (!a || !b) return 'missing';
    showOverlay(kind, a, b);
    return 'shown';
}

// Bouton « Comparer » à ajouter dans une ligne.
export const compareButtonHtml = (kind, id) =>
    `<button type="button" class="compare-btn" data-compare-kind="${esc(kind)}" data-compare-id="${esc(id)}" aria-pressed="false" title="Comparer avec un autre ${esc(KIND_LABEL[kind])} (cliquez sur « Comparer » d'un second)">Comparer</button>`;

export function initCompare(r) {
    resolvers = r;
    document.addEventListener('click', e => {
        const btn = e.target.closest?.('.compare-btn');
        if (!btn) return;
        e.stopPropagation();
        onCompareClick(btn.dataset.compareKind, btn.dataset.compareId);
    });
    // Les listes sont reconstruites à chaque mise à jour : on remet en évidence la référence choisie.
    new MutationObserver(refreshButtons).observe(document.body, { childList: true, subtree: true });
}

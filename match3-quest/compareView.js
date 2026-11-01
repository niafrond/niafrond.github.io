// Comparaison de deux sorts, armes ou stuffs : bouton « Comparer » sur chaque ligne (1er clic = référence, 2e clic = tableau comparatif).
// Module d'affichage pur : les objets sont retrouvés par les résolveurs passés à initCompare (aucune dépendance à game.js).

import { MANA_HEX } from './icons.js';

const RARITY_LABEL = { common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', legendary: 'Ultra rare' };
const KIND_LABEL = { spell: 'sort', weapon: 'arme', stuff: 'stuff', item: 'objet' };
const ANOTHER = { spell: 'un autre sort', weapon: 'une autre arme', stuff: 'un autre stuff', item: 'un autre objet' };
const ITEM_TYPE_LABEL = { shield: 'Bouclier', reusable: 'Objet rechargeable', artifact: 'Relique', consumable: 'Consommable' };
const WARD_LABEL = { red: 'Feu', blue: 'Eau', green: 'Terre', yellow: 'Air', purple: 'Arcane' };
const SLOT_LABEL = { head: 'Casque', neck: 'Collier', wrist: 'Bracelet', ring: 'Bague' };

const costTotal = sp => typeof sp.cost === 'number' ? sp.cost : Object.values(sp.cost || {}).reduce((a, b) => a + b, 0);
const costText = sp => typeof sp.cost === 'number' ? `${sp.cost} ${sp.color || ''}`.trim() : Object.entries(sp.cost || {}).map(([c, n]) => `${n} ${c}`).join(' + ');

// Coût en gomettes : un disque de la couleur du qì avec la quantité écrite dedans (ex. gomette rouge « 5 »).
const costBadges = sp => {
    const entries = typeof sp.cost === 'number' ? [[sp.color, sp.cost]] : Object.entries(sp.cost || {});
    return entries.map(([color, n]) => `<span class="cost-badge${color === 'yellow' ? ' cost-badge-light' : ''}" style="background:${MANA_HEX[color] || '#888'}" title="${esc(color)}">${esc(n)}</span>`).join('');
};

// Lignes comparées : { label, num (valeur numérique ou null), text, better: 'high' | 'low' | null }.
export function compareRows(kind, o) {
    if (!o) return [];
    const n = (label, v, better = 'high') => ({ label, num: v || 0, text: String(v || 0), better });
    const t = (label, text) => ({ label, num: null, text: text || '—', better: null });
    if (kind === 'spell') return [
        { label: 'Coût (total)', num: costTotal(o), text: costText(o) || '0', html: costBadges(o) || '0', better: 'low' },
        n('Dégâts', o.dmg), n('Soin', o.heal), n('Niveau requis', o.minLevel || 1, 'low'),
        t('Effet', o.description)
    ];
    if (kind === 'weapon') return [
        n('Dégâts', o.damage), n('Points d\'action', o.actionPoints, 'low'), n('Niveau requis', o.minLevel || 1, 'low'),
        n('Attaque', o.atkBonus), n('Défense', o.defBonus), t('Biome', o.biome), t('Mains', o.twoHanded ? 'Deux mains' : 'Une main')
    ];
    if (kind === 'stuff') return [
        t('Emplacement', SLOT_LABEL[o.slot]), t('Rareté', RARITY_LABEL[o.rarity]),
        n('Attaque', o.atkBonus), n('Défense', o.defBonus), n('PV max', o.maxHp), n('Résistance poison (%)', o.poisonResist), t('Protection élémentaire', Object.entries(o.ward || {}).filter(([, v]) => v > 0).map(([k, v]) => `${WARD_LABEL[k] || k} −${v} %`).join(', ')), 
        n('Niveau requis', o.minLevel || 1, 'low'), t('Protège', o.biomeProtect)
    ];
    if (kind === 'item') return [
        t('Type', ITEM_TYPE_LABEL[o.type] || o.type), t('Rareté', RARITY_LABEL[o.rarity]),
        n('Défense', o.defense), n('Attaque', o.atkBonus), n('Absorbe', o.absorbDamage),
        n('Charges', o.chargesPerCycle), n('Recharge (tours)', o.rechargeTurns, 'low'),
        n('Niveau requis', o.minLevel || 1, 'low'), t('Effet', o.description)
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
        return `<tr><th scope="row">${esc(row.label)}</th><td${ca}>${row.html ?? esc(row.text)}</td><td${cb}>${other.html ?? esc(other.text)}</td></tr>`;
    }).join('');
    return `<table class="compare-table"><thead><tr><th></th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>${body}</tbody></table>`;
}

// Écarts d'un objet avec celui déjà porté, en pastilles (« +12 Dégâts » en vert, « −2 Déf » en rouge).
// fields : [clé, libellé, 'high' | 'low'] ('low' = plus petit est meilleur, ex. points d'action).
export function deltaBadgesHtml(candidate, current, fields) {
    if (!candidate || !current || candidate.id === current.id) return '';
    return fields.map(([key, label, better = 'high']) => {
        const d = (candidate[key] || 0) - (current[key] || 0);
        if (!d) return '';
        const good = better === 'high' ? d > 0 : d < 0;
        return `<span class="delta ${good ? 'delta-up' : 'delta-down'}">${d > 0 ? '+' : '−'}${Math.abs(d)} ${esc(label)}</span>`;
    }).join('');
}

let selection = null;   // { kind, id } : premier élément choisi
let resolvers = {};
let equipActions = {};   // kind -> id => équipe l'objet (ou ouvre le choix du remplacement)
let equipState = {};     // kind -> id => { label, disabled }

function refreshButtons() {
    document.querySelectorAll('.compare-btn').forEach(btn => {
        const on = !!selection && btn.dataset.compareKind === selection.kind && btn.dataset.compareId === selection.id;
        const label = on ? 'Choisi' : 'Comparer';
        btn.classList.toggle('compare-selected', on);
        if (btn.getAttribute('aria-pressed') !== String(on)) btn.setAttribute('aria-pressed', String(on));
        if (btn.textContent !== label) btn.textContent = label;   // garde : l'observateur de mutations rappelle cette fonction
    });
}

// Bandeau en bas d'écran tant qu'une référence est choisie : rappelle quoi faire et permet d'annuler.
function refreshHint() {
    let bar = document.getElementById('compare-hint');
    const ref = selection && resolvers[selection.kind]?.(selection.id);
    if (!ref) { bar?.remove(); return; }
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'compare-hint';
        bar.setAttribute('role', 'status');
        bar.addEventListener('click', e => { if (e.target.closest('[data-compare-cancel]')) setSelection(null); });
        document.body.appendChild(bar);
    }
    bar.innerHTML = `<span>Comparer <strong>${esc(ref.name)}</strong> avec : touchez « Comparer » sur ${ANOTHER[selection.kind]}.</span><button type="button" data-compare-cancel>Annuler</button>`;
}

function setSelection(sel) {
    selection = sel;
    refreshButtons();
    refreshHint();
}

function closeOverlay() { document.getElementById('compare-overlay')?.remove(); }

function showOverlay(kind, a, b) {
    closeOverlay();
    const el = document.createElement('div');
    el.id = 'compare-overlay';
    el.className = 'modal active compare-overlay';
    // Ligne d'actions : un bouton « Équiper » (ou « Remplacer » quand il n'y a plus de place) par colonne.
    const equipCell = o => {
        const st = equipState[kind]?.(o.id) || { label: 'Équiper', disabled: false };
        return `<td><button type="button" class="weapon-action cmp-equip" data-cmp-equip="${esc(o.id)}"${st.disabled ? ' disabled' : ''}>${esc(st.label)}</button></td>`;
    };
    const table = buildCompareHtml(kind, a, b).replace('</tbody>', `<tr class="cmp-actions"><th scope="row"></th>${equipCell(a)}${equipCell(b)}</tr></tbody>`);
    el.innerHTML = `<div class="modal-content"><h2>Comparer des ${esc(KIND_LABEL[kind])}s</h2>${table}<div class="modal-actions"><button class="primary" type="button">Fermer</button></div></div>`;
    el.addEventListener('click', e => {
        const eq = e.target.closest('[data-cmp-equip]');
        if (eq && !eq.disabled) { closeOverlay(); equipActions[kind]?.(eq.dataset.cmpEquip); return; }
        if (e.target === el || e.target.closest('.modal-actions button')) closeOverlay();
    });
    document.body.appendChild(el);
}

export function onCompareClick(kind, id) {
    if (!selection || selection.kind !== kind) { setSelection({ kind, id }); return 'selected'; }
    if (selection.id === id) { setSelection(null); return 'cleared'; }
    const a = resolvers[kind]?.(selection.id), b = resolvers[kind]?.(id);
    setSelection(null);
    if (!a || !b) return 'missing';
    showOverlay(kind, a, b);
    return 'shown';
}

// Bouton « Comparer » à ajouter dans une ligne.
export const compareButtonHtml = (kind, id) =>
    `<button type="button" class="compare-btn" data-compare-kind="${esc(kind)}" data-compare-id="${esc(id)}" aria-pressed="false" title="Comparer avec ${ANOTHER[kind]} (cliquez sur « Comparer » d'un second)">Comparer</button>`;

export function initCompare(r, equip = {}) {
    resolvers = r;
    equipActions = equip.actions || {};
    equipState = equip.state || {};
    document.addEventListener('click', e => {
        const btn = e.target.closest?.('.compare-btn');
        if (!btn) return;
        e.stopPropagation();
        onCompareClick(btn.dataset.compareKind, btn.dataset.compareId);
    });
    // Les listes sont reconstruites à chaque mise à jour : on remet en évidence la référence choisie.
    new MutationObserver(refreshButtons).observe(document.body, { childList: true, subtree: true });
}

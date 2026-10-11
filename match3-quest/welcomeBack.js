// « Ça fait longtemps » : rappel succinct (armes, sorts, potions, quêtes actives) quand le joueur revient après une longue absence.
const LAST_PLAYED_KEY = 'match3LastPlayed';
export const ABSENCE_MS = 2 * 24 * 60 * 60 * 1000;   // 2 jours

const storage = () => { try { return globalThis.localStorage || null; } catch(_) { return null; } };

export function readLastPlayed(){
    const raw = Number(storage()?.getItem(LAST_PLAYED_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function touchLastPlayed(now = Date.now()){
    try { storage()?.setItem(LAST_PLAYED_KEY, String(now)); } catch(_) { /* stockage indisponible */ }
}

export function isLongAbsence(lastPlayed, now = Date.now()){
    return Number.isFinite(lastPlayed) && lastPlayed > 0 && now - lastPlayed >= ABSENCE_MS;
}

const isPotion = item => item && (item.type === 'consumable' || item.type === 'reusable');

// Données du rappel : listes de { name, text }.
export function buildRecap(player, quests = []){
    const weapons = (player?.weapons || []).map(w => ({ name: w.name, text: w.description || '', equipped: player.equippedWeapon?.id === w.id }));
    const spells = (player?.activeSpells || []).map(s => ({ name: s.name, text: s.description || '' }));
    const potions = (player?.inventory || []).filter(isPotion).map(i => ({ name: i.name, text: i.description || '' }));
    return { weapons, spells, potions, quests: quests.map(q => ({ name: q.title, text: q.objective || '', ready: !!q.ready })) };
}

export function absenceDays(lastPlayed, now = Date.now()){
    return Math.floor((now - lastPlayed) / (24 * 60 * 60 * 1000));
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function section(title, rows, empty){
    const body = rows.length
        ? rows.map(r => `<li><strong>${esc(r.name)}</strong>${r.equipped ? ' (équipée)' : ''}${r.ready ? ' (à rendre)' : ''}${r.text ? ` — ${esc(r.text)}` : ''}</li>`).join('')
        : `<li><em>${esc(empty)}</em></li>`;
    return `<h3>${title}</h3><ul style="text-align:left;margin:.2em 0 .8em;padding-left:1.2em">${body}</ul>`;
}

export function showWelcomeBack(recap, days){
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'welcome-back-modal';
    modal.innerHTML = `<div class="modal-content" style="max-height:85vh;overflow:auto">
        <h2>Ça fait longtemps !</h2>
        <p>Vous n'avez pas joué depuis ${days} jours. Voici un petit rappel.</p>
        ${section('Armes', recap.weapons, 'Aucune arme')}
        ${section('Sorts activés', recap.spells, 'Aucun sort activé')}
        ${section('Potions', recap.potions, 'Aucune potion')}
        ${section('Quêtes en cours', recap.quests, 'Aucune quête en cours')}
        <div class="modal-actions"><button class="primary" id="welcome-back-close">C'est reparti !</button></div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#welcome-back-close').addEventListener('click', () => modal.remove());
}

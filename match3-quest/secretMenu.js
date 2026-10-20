// Menu secret : 6 clics sur « Particules de mana » (Options) l'ouvrent pour toute la session (jamais sauvegardé).
// Permet de s'attribuer tous les stuffs, tous les sorts, toutes les armes et n'importe quel niveau.
import { player, saveUpdate, log, updateStats, updateAvailableSpells, updateAvailableWeapons, createSpellButtons, createWeaponButton, updatePlayerStatsTab, grantStuffPiece, setCheatAllSpells, setCheatOneShot, isCheatOneShot, setCheatFreeSpells, isCheatFreeSpells, setCheatMaxRage, isCheatMaxRage } from "./game.js";
import { allStuff } from "./stuff.js";
import { allWeapons } from "./weapons.js";
import { MAX_LEVEL } from "./experience.js";
import { createClickCounter, setHeroLevel } from "./secretLogic.js";

export function giveAllStuff(hero = player) {
    let added = 0;
    allStuff.forEach(s => { if(grantStuffPiece(s.id, 'Menu secret')) added++; });
    return added;
}

export function giveAllWeapons(hero = player) {
    if(!Array.isArray(hero.weapons)) hero.weapons = [];
    let added = 0;
    allWeapons.forEach(w => { if(!hero.weapons.some(o => o.id === w.id)) { hero.weapons.push(w); added++; } });
    return added;
}

function refreshAll() {
    updateAvailableSpells();
    updateAvailableWeapons();
    // updateAvailableSpells charge classes.js en asynchrone : on rafraîchit les boutons juste après.
    setTimeout(() => { createSpellButtons(); updatePlayerStatsTab(); }, 100);
    createWeaponButton();
    updateStats();
    saveUpdate();
    document.dispatchEvent(new Event('stuff-changed'));
}

let modal = null;
function buildModal() {
    const el = document.createElement('div');
    el.className = 'modal secret-modal';
    el.innerHTML = `<div class="modal-content options-content">
        <h2>Menu secret</h2>
        <p>Valable pour cette session uniquement.</p>
        <div class="options-row"><span>Niveau (1–${MAX_LEVEL})</span><span><input type="number" id="secret-level" min="1" max="${MAX_LEVEL}" style="width:4.5em"> <button id="secret-level-btn">Appliquer</button></span></div>
        <div class="options-row"><span>Tous les stuffs</span><button id="secret-stuff-btn">Obtenir</button></div>
        <div class="options-row"><span>Toutes les armes</span><button id="secret-weapons-btn">Obtenir</button></div>
        <div class="options-row"><span>Tous les sorts</span><button id="secret-spells-btn">Débloquer</button></div>
        <div class="options-row"><span>One shot les ennemis</span><button id="secret-oneshot-btn" aria-pressed="false">Non</button></div>
        <div class="options-row"><span>Sorts gratuits (sans mana)</span><button id="secret-free-btn" aria-pressed="false">Non</button></div>
        <div class="options-row"><span>Rage toujours au max</span><button id="secret-rage-btn" aria-pressed="false">Non</button></div>
        <div class="modal-actions"><button class="primary" id="secret-close-btn">Fermer</button></div>
    </div>`;
    document.body.appendChild(el);
    const $ = id => el.querySelector('#' + id);
    const close = () => el.classList.remove('active');
    el.addEventListener('click', e => { if(e.target === el) close(); });
    $('secret-close-btn').addEventListener('click', close);
    $('secret-level-btn').addEventListener('click', () => {
        const lvl = setHeroLevel(player, $('secret-level').value);
        log(`Menu secret : niveau ${lvl}.`);
        refreshAll();
    });
    $('secret-stuff-btn').addEventListener('click', () => {
        const n = giveAllStuff();
        log(`Menu secret : ${n} stuff(s) ajouté(s).`);
        refreshAll();
    });
    $('secret-weapons-btn').addEventListener('click', () => {
        const n = giveAllWeapons();
        log(`Menu secret : ${n} arme(s) ajoutée(s).`);
        refreshAll();
    });
    $('secret-spells-btn').addEventListener('click', () => {
        setCheatAllSpells(true);
        log('Menu secret : tous les sorts débloqués.');
        refreshAll();
    });
    $('secret-oneshot-btn').addEventListener('click', () => {
        setCheatOneShot(!isCheatOneShot());
        syncOneShot(el);
        log(`Menu secret : one shot ${isCheatOneShot() ? 'activé' : 'désactivé'}.`);
    });
    $('secret-free-btn').addEventListener('click', () => {
        setCheatFreeSpells(!isCheatFreeSpells());
        syncOneShot(el);
        createSpellButtons();
        log(`Menu secret : sorts gratuits ${isCheatFreeSpells() ? 'activés' : 'désactivés'}.`);
    });
    $('secret-rage-btn').addEventListener('click', () => {
        setCheatMaxRage(!isCheatMaxRage());
        syncOneShot(el);
        updateStats();
        log(`Menu secret : rage au max ${isCheatMaxRage() ? 'activée' : 'désactivée'}.`);
    });
    return el;
}

function syncOneShot(el) {
    const rage = el.querySelector('#secret-rage-btn');
    rage.textContent = isCheatMaxRage() ? 'Oui' : 'Non';
    rage.setAttribute('aria-pressed', String(isCheatMaxRage()));
    const free = el.querySelector('#secret-free-btn');
    free.textContent = isCheatFreeSpells() ? 'Oui' : 'Non';
    free.setAttribute('aria-pressed', String(isCheatFreeSpells()));
    const btn = el.querySelector('#secret-oneshot-btn');
    btn.textContent = isCheatOneShot() ? 'Oui' : 'Non';
    btn.setAttribute('aria-pressed', String(isCheatOneShot()));
}

export function openSecretMenu() {
    if(!modal) modal = buildModal();
    modal.querySelector('#secret-level').value = player.level || 1;
    syncOneShot(modal);
    modal.classList.add('active');
}

// Branche le déclencheur : 6 clics sur le bouton « Particules de mana ».
export function bindSecretTrigger(button) {
    if(!button) return;
    const hit = createClickCounter();
    button.addEventListener('click', () => { if(hit()) openSecretMenu(); });
}

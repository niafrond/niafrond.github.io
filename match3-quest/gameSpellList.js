// Sorts disponibles selon le niveau (plafond, liste débloquée), boutons de sorts, déblocage par le menu secret.
// Extrait de game.js.
import { MAX_ACTIVE_SPELLS } from './constants.js';
import { preloadUltimateCinematic } from './ultimateCinematics.js';
import { getEquippedUltimate } from './ultimates.js';
import { spellCooldownLeft } from './spellCooldown.js';
import { isMuted } from './alterations.js';
import { icon as svgIcon } from './icons.js';
import { bindTooltip, showSpellTooltip, hideSpellTooltip } from './gameTooltips.js';
import { updateSpellsTab } from './gameSpellsTab.js';
import { allSpells as spellsCatalog, getSpellsByLevel } from './spells.js';
import { canEntityCastSpell, castSpell, markMultiManaSpell, player, spellColorsOf, spellCostHtml, spellEffectIcon } from './game.js';

// sorts
const HIGH_SPELL_FROM_LEVEL = 15;

function getUnlockedSpellCap(level) {
    const safeLevel = Math.max(1, Math.floor(level || 1));
    return Math.max(0, safeLevel - 1);
}

function buildUnlockedSpellsList(spells, level) {
    const unlockCap = getUnlockedSpellCap(level);

    const uniqueById = [];
    const seenIds = new Set();
    for(const spell of spells || []) {
        if(!spell || !spell.id || seenIds.has(spell.id)) continue;
        seenIds.add(spell.id);
        uniqueById.push(spell);
    }

    // Sort offensif de départ : dès le niveau 1, le joueur a au moins un sort de dégâts (le moins coûteux), toujours en tête de liste.
    const isOffensive = s => s.type === 'damage' && s.dmg > 0 && !s.effect && (s.minLevel || 1) <= Math.max(1, Math.floor(level || 1));
    const starter = uniqueById.filter(isOffensive).sort((a, b) => (a.cost || 0) - (b.cost || 0) || String(a.id).localeCompare(String(b.id)))[0];

    uniqueById.sort((a, b) => {
        if(starter && (a === starter) !== (b === starter)) return a === starter ? -1 : 1;
        const levelA = Math.max(1, Math.floor(a?.minLevel || 1));
        const levelB = Math.max(1, Math.floor(b?.minLevel || 1));
        if(levelA !== levelB) return levelA - levelB;
        return String(a.id).localeCompare(String(b.id));
    });

    // Les sorts de haut niveau (multimana, niveau > 15) et les sorts avancés (3 à 5 couleurs, dès le niveau 8) sont débloqués dès leur
    // niveau, hors plafond du nombre de sorts : sinon, triés après les sorts de niveau inférieur, ils restaient hors de portée jusqu'au niveau 38+.
    const isFreeUnlock = s => s.type === 'advanced' || s.type === 'board' || (s.minLevel || 1) > HIGH_SPELL_FROM_LEVEL;
    const early = uniqueById.filter(s => !isFreeUnlock(s)).slice(0, Math.max(unlockCap, starter ? 1 : 0));
    const free = uniqueById.filter(isFreeUnlock);
    return [...early, ...free].sort((a, b) => Math.max(1, Math.floor(a?.minLevel || 1)) - Math.max(1, Math.floor(b?.minLevel || 1)) || String(a.id).localeCompare(String(b.id)));
}

// Menu secret (secretMenu.js) : le temps de la session, tous les sorts (toutes classes) sont débloqués.
let cheatAllSpells = false;
export function setCheatAllSpells(on){
    cheatAllSpells = !!on;
    // Indicateur non énumérable (jamais sauvegardé) lu par ultimates.js : tous les ultimes, toutes classes.
    Object.defineProperty(player, 'cheatAllUltimates', { value: !!on, enumerable: false, writable: true, configurable: true });
}

export function updateAvailableSpells(){
    if(cheatAllSpells) {
        import('./classes.js').then(module => {
            const everySpell = [...spellsCatalog, ...module.allClassSpells];
            const seen = new Set();
            player.availableSpells = everySpell.filter(sp => sp?.id && !seen.has(sp.id) && seen.add(sp.id));
            updateActiveSpells();
        });
        return;
    }
    // Si le joueur a une classe, inclure les sorts de classe
    let allAvailableSpells = [...getSpellsByLevel(player.level)];
    
    if(player.class) {
        import('./classes.js').then(module => {
            const classSpells = module.getClassSpells(player.class, player.level);
            allAvailableSpells = [...allAvailableSpells, ...classSpells];
            player.availableSpells = buildUnlockedSpellsList(allAvailableSpells, player.level);
            updateActiveSpells();
        });
    } else {
        player.availableSpells = buildUnlockedSpellsList(allAvailableSpells, player.level);
        updateActiveSpells();
    }
}

function updateActiveSpells() {
    // garder seulement les sorts actifs valides
    player.activeSpells = player.activeSpells.filter(sp => 
        player.availableSpells.some(avail => avail.id === sp.id)
    );
    // si moins de 4 sorts actifs, en ajouter automatiquement
    if(player.activeSpells.length < MAX_ACTIVE_SPELLS){
        for(const sp of player.availableSpells){
            if(!player.activeSpells.some(active => active.id === sp.id)){
                player.activeSpells.push(sp);
                if(player.activeSpells.length >= MAX_ACTIVE_SPELLS) break;
            }
        }
    }
    // maintenir la compatibilité avec l'ancien code
    player.spells = player.activeSpells;
}

export function createSpellButtons(){
    const container=document.getElementById('spell-buttons');
    if(!container) return;
    hideSpellTooltip();
    container.innerHTML="";
    player.activeSpells.forEach(sp=>{
        const btn=document.createElement('div');
        btn.className = 'enemy-spell-item';
        btn.dataset.spellId = sp.id;
        btn.tabIndex = 0;
        const damageText = sp.dmg ? ` - ${sp.dmg} dmg` : '';
        const healText = sp.heal ? ` - ${sp.heal} HP` : '';
        
        // Gérer l'affichage du coût (simple ou multiple)
        const costHTML = spellCostHtml(sp, player);
        const hasEnoughMana = canEntityCastSpell(player, sp);
        markMultiManaSpell(btn, sp);
        
        const muted = isMuted(player);   // Muet : cadenas, sort inutilisable
        btn.innerHTML = `
            <div class="spell-name">${sp.name} ${muted ? svgIcon('lock') : spellEffectIcon(sp)}</div>
            <div class="spell-cost">${costHTML}${damageText}${healText}</div>
        `;
        const coolLeft = spellCooldownLeft(sp.id);
        if(coolLeft > 0) btn.querySelector('.spell-cost').insertAdjacentHTML('beforeend', ` <span class="spell-cooldown">Recharge : ${coolLeft} tour${coolLeft > 1 ? 's' : ''}</span>`);
        if(player.level<sp.minLevel || !hasEnoughMana || coolLeft > 0 || muted) {
            btn.classList.add('disabled');
            // Sort multi-qì : la tuile reste grisée tant qu'il manque du qì, mais la pastille d'une couleur déjà atteinte garde sa couleur.
            if(player.level >= sp.minLevel && btn.querySelector('.cost-part.met') && btn.querySelector('.cost-part.unmet')) btn.classList.add('spell-partial');
            btn.tabIndex = -1;
        } else {
            btn.onclick=()=>castSpell(sp.id);
            btn.onkeydown=(event)=>{
                if(event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    castSpell(sp.id);
                }
            };
        }

        const showDetails = () => showSpellTooltip(btn, sp, costHTML);
        const hideDetails = () => hideSpellTooltip();
        bindTooltip(btn, showDetails, hideDetails);

        container.appendChild(btn);
    });
    // Planches de cinématique de l'ultime choisi gardées en mémoire : son lancement n'attend aucun téléchargement.
    const ultimate = getEquippedUltimate(player);
    if(ultimate) preloadUltimateCinematic([ultimate]);
    updateSpellsTab();
}

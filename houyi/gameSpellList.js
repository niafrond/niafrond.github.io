// Sorts disponibles selon le niveau (plafond, liste débloquée), boutons de sorts, déblocage par le menu secret.
// Extrait de game.js.
import { MAX_ACTIVE_SPELLS } from './constants.js';
import { actionGuard } from './actionGuard.js';
import { preloadUltimateCinematic } from './ultimateCinematics.js';
import { getEquippedUltimate } from './ultimates.js';
import { spellCooldownLeft } from './spellCooldown.js';
import { isMuted } from './alterations.js';
import { icon as svgIcon } from './icons.js';
import { bindTooltip, showSpellTooltip, hideSpellTooltip } from './gameTooltips.js';
import { updateSpellsTab } from './gameSpellsTab.js';
import { allSpells as spellsCatalog, getSpellsByLevel } from './spells.js';
import { getClassSpells, playerClasses } from './classes.js';
import { usableClasses, restrictedClasses, normalizeRoster, CLASS_SHORT } from './classRoster.js';
import { actionSpells } from './skills.js';
import { classProgress, classRemainingMs, classChargeInfo, isClassReady, chargeTick, spendClass, spendEnemy, isEnemyReady, chargeRunning, enqueueAction, takeDueAction, hasQueuedAction, upcomingBeads } from './classCharge.js';
import { renderPotionButtons } from './potionsView.js';
import { isInTranse, describeTranse, transeEffectFor, TRANSE_TURNS } from './transe.js';
import { canEntityCastSpell, castSpell, enemy, gameState, currentTurn, markMultiManaSpell, player, setTurnClass, spellColorsOf, spellCostHtml, spellEffectIcon, log, updateStats } from './game.js';

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

// ── Classe du tour ─────────────────────────────────────────────────────────
// En combat, le joueur choisit une classe par tour : ses sorts de classe sont proposés, la Xiūxiān prend son effet et seul le sorcier peut lancer l'ultime.
const combatBiome = () => (gameState.combatState === 'active' ? enemy?.biome || null : null);
/** Classe du tour : celle choisie si elle est utilisable (classe de combat, biome non bridé, entraînement), sinon la classe du héros, sinon la première utilisable. */
export function getTurnClass(){
    const usable = usableNow();
    if(gameState.turnClass && usable.includes(gameState.turnClass)) return gameState.turnClass;
    if(usable.includes(player.class)) return player.class;
    return usable[0] || player.class || null;
}

/** Classes de combat utilisables maintenant (biome, entraînement). */
export const usableNow = () => usableClasses(player, combatBiome(), gameState.forcedClass);

// ── Temps de chargement des actions ─────────────────────────────────────────
// Le plateau reste au tour par tour ; arme, sorts, compétences de classe, objets et potions exigent que la classe du tour soit chargée (classCharge.js).
const TUTORIAL_CHARGE_FACTOR = 0.2;   // tutoriel : chargement 5 fois plus court (la notion est montrée sans bloquer le déroulé)
export const chargeFactor = () => (enemy?.isTutorialEnemy ? TUTORIAL_CHARGE_FACTOR : 1);
export const chargeEnabled = () => gameState.combatState === 'active';

/**
 * Une action est choisie (sort, compétence, objet, arme) : si la classe du tour est prête et qu'aucune action n'attend, elle part tout de suite
 * (renvoie false) ; sinon elle entre dans la file d'attente (renvoie true) et `retry` la rejouera au début d'un tour du joueur, dès que sa classe est
 * chargée. Le joueur n'en voit pas l'ordre. Le duel-tutoriel part toujours tout de suite (déroulé scripté).
 */
export function deferAction(retry){
    if(!chargeEnabled() || gameState.bypassCharge || enemy?.isTutorialEnemy) return false;
    const id = getTurnClass();
    if(!id || (isClassReady(gameState.charge, id) && !hasQueuedAction(gameState.actionQueue, 'player'))) return false;
    enqueueAction(gameState.actionQueue, { owner: 'player', classId: id, retry });
    renderActionBeads();
    updateStats();
    return true;
}
/** Début d'un tour du joueur : si une action en file a sa classe chargée, elle part maintenant (elle prend le tour). */
export function runQueuedPlayerAction(){
    if(!chargeEnabled()) return false;
    const item = takeDueAction(gameState.actionQueue, 'player', it => isClassReady(gameState.charge, it.classId));
    if(!item) return false;
    gameState.turnClass = item.classId;
    gameState.bypassCharge = true;
    try { item.retry(); } finally { gameState.bypassCharge = false; }
    return true;
}
/** Une action vient d'être faite avec la classe du tour : elle se recharge. */
export function spendActionCharge(){
    if(!chargeEnabled()) return;
    const id = getTurnClass();
    if(id) spendClass(gameState.charge, player, id, chargeFactor());
    createSpellButtons();
}
/** L'ennemi est-il chargé ? (toujours oui dans le tutoriel, dont les coups sont imposés) */
export const enemyActionReady = () => !chargeEnabled() || enemy?.isTutorialEnemy || isEnemyReady(gameState.charge);
export function spendEnemyAction(){
    if(chargeEnabled() && !enemy?.isTutorialEnemy) spendEnemy(gameState.charge, enemy, 1);
}

/** Ligne de perles en haut du combat : une perle verte par action du joueur à venir, une rouge par action ennemie, dans l'ordre de départ. */
export function renderActionBeads(){
    const box = typeof document !== 'undefined' ? document.getElementById('action-beads') : null;
    if(!box) return;
    const on = chargeEnabled() && !enemy?.isTutorialEnemy;
    box.hidden = !on;
    if(!on){ box.innerHTML = ''; _beadKey = ''; return; }
    const beads = upcomingBeads(gameState.charge, gameState.actionQueue, gameState.enemyPending).slice(0, 12);
    const key = beads.join('');
    if(key === _beadKey) return;   // rien n'a changé : pas de redessin
    _beadKey = key;
    box.innerHTML = beads.map(side => `<i class="bead bead-${side}"></i>`).join('');
    box.setAttribute('aria-label', beads.length ? `${beads.length} action${beads.length > 1 ? 's' : ''} à venir` : 'Aucune action à venir');
}
let _beadKey = '';

// Le temps de combat avance en temps réel, fenêtre visible ; quand une classe (ou l'ennemi) devient prête, boutons et barres se rafraîchissent.
let _chargeLast = 0, _chargeKey = '';
function chargeTicker(){
    renderActionBeads();
    const now = Date.now();
    const dt = _chargeLast ? Math.min(1000, now - _chargeLast) : 0;
    _chargeLast = now;
    if(!chargeEnabled()){ if(typeof document !== 'undefined') document.body?.classList.remove('charge-paused'); return; }
    if(typeof document !== 'undefined' && document.hidden) return;
    // Tempo : plateau inactif depuis 5 s = chargements en pause (barres figées) ; ils reprennent au prochain combo du plateau.
    const running = chargeRunning(now, actionGuard.lastComboAt());
    if(typeof document !== 'undefined') document.body?.classList.toggle('charge-paused', !running);
    if(!running) return;
    chargeTick(gameState.charge, dt);
    const key = usableNow().map(id => isClassReady(gameState.charge, id) ? 1 : 0).join('') + (isEnemyReady(gameState.charge) ? 'e' : '');
    if(key !== _chargeKey){
        _chargeKey = key;
        createSpellButtons();
    }
}
if(typeof setInterval === 'function' && typeof document !== 'undefined') setInterval(chargeTicker, 250);

/** Sorts proposés ce tour : sorts génériques équipés + sorts de la classe du tour (complétés jusqu'à MAX_ACTIVE_SPELLS) + commandes des compétences apprises. */
export function combatSpellList(){
    const cls = getTurnClass();
    const list = (player.activeSpells || []).filter(sp => !sp.class || sp.class === cls);
    if(cls){
        for(const sp of getClassSpells(cls, player.level)){
            if(list.length >= MAX_ACTIVE_SPELLS) break;
            if(!list.some(s => s.id === sp.id) && !(player.archivedSpells || []).includes(sp.id)) list.push(sp);
        }
    }
    return [...list, ...actionSpells(player).filter(sp => !sp.class || sp.class === cls)];   // les commandes de classe n'existent que pour la classe du tour
}


/** Bandeau de la Xiūxiān en cours : nom, effet exact et tours restants (au-dessus de la ligne de classes). */
function renderXiuBanner(zone){
    let banner = document.getElementById('xiu-banner');
    if(!banner){
        banner = document.createElement('div');
        banner.id = 'xiu-banner';
        banner.className = 'xiu-banner';
        banner.setAttribute('role', 'status');
        zone.parentElement.insertBefore(banner, zone);
    }
    const on = gameState.combatState === 'active' && isInTranse(player) && !!player.transeClass;
    banner.hidden = !on;
    if(!on){ banner.innerHTML = ''; return; }
    const cls = player.transeClass, effect = transeEffectFor(cls);
    const left = player.cheatMaxRage === true ? null : Math.max(1, Math.min(TRANSE_TURNS, Math.floor(player.transe || 0)));
    banner.innerHTML = `<strong>Xiūxiān · ${CLASS_SHORT[cls] || cls}${effect.name ? ` : ${effect.name}` : ''}</strong>`
        + `<span>${effect.text ? `Effet : ${effect.text}.` : ''}${left ? ` ${left} tour${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}.` : ''}</span>`;
}

function renderClassPicker(container){
    let picker = document.getElementById('class-picker');
    if(!picker){
        picker = document.createElement('div');
        picker.id = 'class-picker';
        picker.className = 'class-picker';
        // Hors de la zone de choix d'action : juste au-dessus de #spells-container.
        const zone = document.getElementById('spells-container') || container.parentElement;
        zone.parentElement.insertBefore(picker, zone);
    }
    renderXiuBanner(picker);
    const active = gameState.combatState === 'active';
    const mine = active && currentTurn === 'player';
    const current = getTurnClass();
    const loadout = normalizeRoster(player).loadout;
    picker.hidden = !active;   // toujours là en combat, même avec une seule classe : elle porte la barre de chargement
    picker.title = isInTranse(player) ? describeTranse(current) : 'Une classe par tour : ses sorts, son effet de Xiūxiān';
    const restricted = restrictedClasses(player, combatBiome());
    const forced = gameState.forcedClass;
    picker.innerHTML = loadout.map(id => {
        const reason = forced && id !== forced ? 'Entraînement : classe imposée' : (restricted[id] ? `Bridée ici : ${restricted[id]}` : playerClasses[id]?.name || id);
        // Barre de chargement : se remplit en temps réel jusqu'à ce que la classe soit prête (animation CSS pour le temps restant).
        const prog = Math.round(classProgress(gameState.charge, player, id, chargeFactor()) * 100);
        const remaining = classRemainingMs(gameState.charge, id);
        const animStyle = remaining > 0 ? `--from:${prog}%;--to:100%;--dur:${remaining}ms;` : '';
        const info = classChargeInfo(player, id);
        const chargeText = prog >= 100 ? `Prête (chargement ${info.time})` : `Se recharge : ${Math.ceil(remaining / 1000)} s (temps ${info.time} : Agilité/Moral -${Math.round(info.pct.agility)} %, attribut -${Math.round(info.pct.attribute)} %, qì -${Math.round(info.pct.qi)} %, compétences -${info.pct.skills} %)`;
        const off = !mine || (forced && id !== forced) || restricted[id];   // choisir une classe reste libre : seules ses ACTIONS attendent son chargement
        return `<button type="button" class="class-pick${id === current ? ' on' : ''}${restricted[id] ? ' limited' : ''}${prog >= 100 ? ' ready-pulse' : ' charging'}${animStyle ? ' charging-anim' : ''}" data-class="${id}" aria-pressed="${id === current}"${off ? ' disabled' : ''} style="--charge:${prog}%;${animStyle}" title="${reason} · ${chargeText}"><span>${CLASS_SHORT[id] || id}</span></button>`;
    }).join('');
    picker.querySelectorAll('.class-pick').forEach(btn => { btn.onclick = () => { if(setTurnClass(btn.dataset.class)) createSpellButtons(); }; });
}

export function createSpellButtons(){
    const container=document.getElementById('spell-buttons');
    if(!container) return;
    hideSpellTooltip();
    container.innerHTML="";
    renderClassPicker(container);
    combatSpellList().forEach(sp=>{
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
    renderPotionButtons();   // potions de soin (potions.js)
    // Planches de cinématique de l'ultime choisi gardées en mémoire : son lancement n'attend aucun téléchargement.
    const ultimate = getEquippedUltimate(player);
    if(ultimate) preloadUltimateCinematic([ultimate]);
    updateSpellsTab();
}

// Sorts disponibles selon le niveau (plafond, liste débloquée), boutons de sorts, déblocage par le menu secret.
// Extrait de game.js.
import { MAX_ACTIVE_SPELLS } from './constants.js';
import { actionGuard } from './actionGuard.js';
import { isAllyKnockedOut, isMemberKO, ALLIES, memberName } from './allies.js';
import { isBoardResolving } from './board.js';
import { preloadUltimateCinematic } from './ultimateCinematics.js';
import { getEquippedUltimate } from './ultimates.js';
import { spellCooldownLeft } from './spellCooldown.js';
import { isMuted } from './alterations.js';
import { icon as svgIcon } from './icons.js';
import { bindTooltip, showSpellTooltip, showMemberTooltip, hideSpellTooltip } from './gameTooltips.js';
import { updateSpellsTab } from './gameSpellsTab.js';
import { allSpells as spellsCatalog, getSpellsByLevel } from './spells.js';
import { getClassSpells, playerClasses } from './classes.js';
import { usableClasses, restrictedClasses, normalizeRoster, CLASS_SHORT, START_CLASS } from './classRoster.js';
import { RAGE_MAX } from './ultimates.js';
import { ULTIMATE_CLASS, getSelectableUltimates } from './ultimates.js';
import { statusBadgesHtml } from './statusBadges.js';
import { actionSpells } from './skills.js';
import { classProgress, classRemainingMs, classChargeInfo, isClassReady, chargeTick, spendClass, spendEnemy, isEnemyReady, chargeRunning, chargeSpeed, enqueueAction, takeNextDue, upcomingBeads } from './classCharge.js';
import { renderPotionButtons } from './potionsView.js';
import { isInTranse, describeTranse, transeEffectFor, TRANSE_TURNS } from './transe.js';
import { escapeHtml } from './escapeHtml.js';
import { xiuMembers, canEntityCastSpell, castSpell, enemy, gameState, currentTurn, markMultiManaSpell, player, setTurnClass, spellColorsOf, spellCostHtml, spellEffectIcon, log, updateStats } from './game.js';

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
export const usableNow = () => usableClasses(player, combatBiome(), gameState.forcedClass).filter(id => !isMemberKO(gameState.allies, gameState.heroKo, id));   // un membre hors de combat (Hou Yi compris) ne joue plus

// ── Temps de chargement des actions ─────────────────────────────────────────
// Les actions (sort, compétence de classe, objet, arme) sont INDÉPENDANTES du plateau : elles ne prennent pas le tour, partent dès que leur classe
// est chargée (file commune joueur / ennemi, ordre jamais détaillé), même en plein tour de plateau adverse ; seule la pause d'inactivité du plateau
// (5 s sans combo) les retient. Exceptions liées au plateau : les sorts qui modifient la grille et les ultimes attendent leur tour de plateau.
const TUTORIAL_CHARGE_FACTOR = 0.2;   // tutoriel : chargement 5 fois plus court (la notion est montrée sans bloquer le déroulé)
const ACTION_GAP_MS = 900;            // durée pendant laquelle une action « est en cours » : la suivante de la file attend la fin de l'animation
export const chargeFactor = () => (enemy?.isTutorialEnemy ? TUTORIAL_CHARGE_FACTOR : 1);
export const chargeEnabled = () => gameState.combatState === 'active';
/** Actions indépendantes du plateau ? Tout combat, sauf le duel-tutoriel (déroulé scripté) et les duels (tours imposés). */
export const decoupled = () => chargeEnabled() && !enemy?.isTutorialEnemy && !enemy?.duel;

const actionBusy = () => Date.now() < (gameState.actionBusyUntil || 0) || (typeof document !== 'undefined' && !!document.querySelector('.attack-overlay'));
const markActionBusy = () => { gameState.actionBusyUntil = Date.now() + ACTION_GAP_MS; };
// Une action choisie est déjà payée et sa classe déjà consommée : elle ne dépend plus que du passage dans la file (une à la fois) et de la pause d'inactivité.
// Les sorts qui modifient la grille et les ultimes (`turnBound`) attendent la fin du tour de plateau en cours, plateau au repos, juste avant le suivant.
const canRunNow = it => !it.turnBound;   // les sorts qui modifient la grille ne partent pas ici : ils attendent la fin du tour de plateau (runBoundaryAction)
const readyAhead = () => gameState.actionQueue.some(canRunNow);

/** La classe du tour est-elle chargée (barre pleine) ? Condition pour CHOISIR une action ; toujours vrai hors combat indépendant du plateau. */
export function classCanAct(){
    if(!decoupled()) return true;
    const id = getTurnClass();
    return !id || isClassReady(gameState.charge, id);
}

/**
 * Appelée par chaque action du joueur (arme, sort, compétence, objet, potion) une fois qu'elle est validée ET payée : la classe est consommée tout de suite
 * (sa barre repart de zéro), puis `effect` part immédiatement si aucune action ne passe devant ou n'est en cours, sinon il entre dans la file commune
 * (plusieurs actions de la même classe peuvent y attendre). Renvoie true si l'action est prise en charge ici, false si l'appelant doit la jouer lui-même
 * (tutoriel, duel : déroulé d'avant). `turnBound` : action qui modifie le plateau (attend le tour de plateau du joueur).
 */
export function chooseAction(effect, opts = {}){
    if(!decoupled()){ spendActionCharge(); return false; }
    const id = getTurnClass();
    if(id) spendClass(gameState.charge, player, id, chargeFactor());
    createSpellButtons();
    dispatchAction('player', effect, !!opts.turnBound);
    return true;
}
/** L'ennemi a choisi, payé et consommé sa barre : son effet part ou entre dans la même file. */
export function chooseEnemyAction(effect, turnBound = false){
    if(!decoupled()) return false;
    spendEnemy(gameState.charge, enemy, 1);
    dispatchAction('enemy', effect, turnBound);
    return true;
}
function dispatchAction(owner, effect, turnBound){
    const item = { owner, run: effect, turnBound, dueAt: gameState.charge.now };
    if(!turnBound && !actionBusy() && !readyAhead()){ markActionBusy(); effect(); return; }
    enqueueAction(gameState.actionQueue, item);
    renderActionBeads();
}

/**
 * Fin d'un tour de plateau, plateau au repos, juste avant le suivant : si un sort qui modifie la grille (ou un ultime) attend, il part maintenant, du camp qui
 * l'a choisi ; son propre déroulé (résolution des combos) rappellera la fin de tour. Renvoie true si une action est partie (l'appelant s'arrête là).
 * `resume` relance la fin de tour si l'action ne modifie finalement rien (garde-fou de 4 s).
 */
export function runBoundaryAction(resume){
    gameState.boundaryResume = null;
    if(!decoupled()) return false;
    const item = takeNextDue(gameState.actionQueue, it => it.turnBound);
    if(!item) return false;
    markActionBusy();
    gameState.boundaryResume = resume;
    const token = (gameState.boundaryToken = (gameState.boundaryToken || 0) + 1);
    renderActionBeads();
    item.run();
    setTimeout(() => {   // l'action n'a rien relancé (aucun changement) : on poursuit la fin de tour
        if(gameState.boundaryToken === token && gameState.boundaryResume && gameState.combatState === 'active' && !isBoardResolving()) resumeAfterBoundary();
    }, 4000);
    return true;
}
/** Une action de plateau ne relance pas la fin de tour d'elle-même (échec, aucun changement) : on la poursuit. */
export function resumeAfterBoundary(){
    const resume = gameState.boundaryResume;
    gameState.boundaryResume = null;
    if(resume) resume();
}
/** Fait partir la prochaine action de la file, si l'une peut partir (appelé en continu par le ticker de chargement). */
export function pumpActions(){
    if(!decoupled() || actionBusy()) return;
    const item = takeNextDue(gameState.actionQueue, canRunNow);
    if(!item) return;
    markActionBusy();
    item.run();
    renderActionBeads();
}
/** Remplit tout de suite la barre d'action du lanceur (effet des sorts qui donnaient un tour bonus) : classe du sort (ou du tour) pour le héros, barre de l'ennemi pour lui. */
export function refillActionBar(caster, classId = null){
    if(!chargeEnabled()) return false;
    if(caster === enemy) gameState.charge.enemyReady = gameState.charge.now;
    else { const id = classId || getTurnClass(); if(!id) return false; gameState.charge.ready[id] = gameState.charge.now; }
    if(typeof document !== 'undefined'){ createSpellButtons(); refreshClassPicker(); }
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
    const beads = upcomingBeads(gameState.charge, gameState.actionQueue, !!gameState.enemyPending).slice(0, 12);
    const key = beads.join('');
    if(key === _beadKey) return;   // rien n'a changé : pas de redessin
    _beadKey = key;
    box.innerHTML = beads.map(side => `<i class="bead bead-${side}"></i>`).join('');
    box.setAttribute('aria-label', beads.length ? `${beads.length} action${beads.length > 1 ? 's' : ''} à venir` : 'Aucune action à venir');
}
let _beadKey = '';

// Le temps de combat avance en temps réel, fenêtre visible ; quand une classe (ou l'ennemi) devient prête, boutons et barres se rafraîchissent.
/** Vitesse de chargement de chaque membre de l'équipe selon ses altérations (Hou Yi : celles du héros ; un compagnon : les siennes). */
const memberSpeeds = () => Object.fromEntries(usableNow().map(id => [id, chargeSpeed(id === 'assassin' ? player : gameState.allies?.[id])]));

let _chargeLast = 0, _chargeKey = '';
let _aiModule = null;
const aiModule = () => (_aiModule ||= import('./gameTurnFlow.js').catch(() => null));   // import différé : gameTurnFlow.js dépend de ce module
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
    const heroSpeed = memberSpeeds(), foeSpeed = chargeSpeed(enemy);
    chargeTick(gameState.charge, dt, heroSpeed, foeSpeed);
    pumpActions();   // les actions en file partent dès que possible, sans lien avec le plateau
    aiModule().then(m => m && m.enemyProactiveAction());
    import('./foeTurns.js').then(m => m.tickFoeCharges(dt)).catch(() => {});   // chaque autre ennemi du groupe a sa barre de chargement (foeTurns.js)   // l'ennemi choisit lui aussi ses actions dès qu'il est chargé
    const key = usableNow().map(id => isClassReady(gameState.charge, id) ? 1 : 0).join('') + (isEnemyReady(gameState.charge) ? 'e' : '') + `|${Object.values(heroSpeed).join(',')}`;   // la vitesse (altérations) redessine les barres
    if(key !== _chargeKey){
        _chargeKey = key;
        createSpellButtons();
        document.dispatchEvent(new Event('potions-changed'));   // « Objet » se réactive
        document.dispatchEvent(new Event('charge-changed'));    // armes et objets : voir gameInventoryTabs.js
    }
}
if(typeof setInterval === 'function' && typeof document !== 'undefined') setInterval(chargeTicker, 250);

/** Sorts proposés ce tour : sorts génériques équipés + sorts de la classe du tour (complétés jusqu'à MAX_ACTIVE_SPELLS) + commandes des compétences apprises. */
export const INVOCATION_COOLDOWN = 3;   // tours de recharge d'une invocation
export function combatSpellList(){
    const cls = getTurnClass();
    // Un personnage = ses propres boutons : les sorts équipés sans classe sont ceux de Hou Yi ; un compagnon n'a que les sorts de sa classe.
    const list = (player.activeSpells || []).filter(sp => sp.class ? sp.class === cls : cls === START_CLASS);
    if(cls){
        for(const sp of getClassSpells(cls, player.level)){
            if(list.length >= MAX_ACTIVE_SPELLS) break;
            if(!list.some(s => s.id === sp.id) && !(player.archivedSpells || []).includes(sp.id)) list.push(sp);
        }
    }
    // Invocations (anciens ultimes) : sorts comme les autres, réservés au Mage invocateur (classe du tour = ULTIMATE_CLASS) ; coût normal en qì,
    // petit temps de recharge, aucune jauge de Xiūxiān requise.
    const invocations = cls === ULTIMATE_CLASS ? getSelectableUltimates(player).map(sp => ({ ...sp, invocation: true, cooldown: sp.cooldown ?? INVOCATION_COOLDOWN })) : [];
    return [...list, ...invocations, ...actionSpells(player).filter(sp => !sp.class || sp.class === cls)];   // les commandes de classe n'existent que pour la classe du tour
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
    const members = gameState.combatState === 'active' ? xiuMembers() : [];
    banner.hidden = !members.length;
    if(!members.length){ banner.innerHTML = ''; return; }
    banner.innerHTML = members.map(({ entity, classId: cls }) => {   // une Xiūxiān par membre : nom du porteur, effet, tours restants
        const effect = transeEffectFor(cls);
        const left = Math.max(1, Math.min(TRANSE_TURNS, Math.floor(entity.transe || 0)));
        return `<div><strong>Xiūxiān · ${escapeHtml(entity === player ? 'Hou Yi' : entity.name)}${effect.name ? ` : ${escapeHtml(effect.name)}` : ''}</strong>`
            + `<span>${effect.text ? ` Effet : ${escapeHtml(effect.text)}.` : ''} ${left} tour${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}.</span></div>`;
    }).join('');
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
    const mine = active && (currentTurn === 'player' || decoupled());   // choisir un membre à tout moment : seules ses actions attendent son chargement
    const current = getTurnClass();
    const loadout = normalizeRoster(player).loadout;
    picker.hidden = !active;   // toujours là en combat, même avec une seule classe : elle porte la barre de chargement
    picker.title = isInTranse(player) ? describeTranse(current) : 'Une classe par tour : ses sorts, son effet de Xiūxiān';
    const restricted = restrictedClasses(player, combatBiome());
    const forced = gameState.forcedClass;
    const html = loadout.map(id => {
        const reason = isMemberKO(gameState.allies, gameState.heroKo, id) ? 'Hors de combat' : forced && id !== forced ? 'Entraînement : classe imposée' : (restricted[id] ? `Bridée ici : ${restricted[id]}` : `${ALLIES[id] ? ALLIES[id].name + ' · ' : ''}${playerClasses[id]?.name || id}`);
        // Barre de chargement : se remplit en temps réel jusqu'à ce que la classe soit prête (animation CSS pour le temps restant).
        const prog = Math.round(classProgress(gameState.charge, player, id, chargeFactor()) * 100);
        const remaining = classRemainingMs(gameState.charge, id);
        const speed = memberSpeeds()[id] ?? 1;   // altérations (propres à chaque membre) : le chargement ralentit, s'accélère ou s'arrête
        const animStyle = remaining > 0 ? `--from:${prog}%;--to:100%;--dur:${Math.round(remaining / Math.max(0.05, speed))}ms;${speed <= 0 ? '--play:paused;' : ''}` : '';
        const info = classChargeInfo(player, id);
        const chargeText = prog >= 100 ? `Prête (chargement ${info.time})` : `Se recharge : ${Math.ceil(remaining / 1000)} s (temps ${info.time} : Agilité/Moral -${Math.round(info.pct.agility)} %, attribut -${Math.round(info.pct.attribute)} %, qì -${Math.round(info.pct.qi)} %, compétences -${info.pct.skills} %)`;
        const ko = isMemberKO(gameState.allies, gameState.heroKo, id);   // membre hors de combat : il ne joue plus
        const off = !mine || (forced && id !== forced) || restricted[id] || ko;   // choisir un compagnon reste libre : seules ses ACTIONS attendent son chargement
        return `<button type="button" class="class-pick${id === current ? ' on' : ''}${restricted[id] ? ' limited' : ''}${ko ? ' ko' : ''}${prog >= 100 && !ko ? ' ready-pulse' : ' charging'}${animStyle ? ' charging-anim' : ''}" data-class="${id}" aria-pressed="${id === current}"${off ? ' disabled' : ''} style="--charge:${prog}%;${animStyle}" title="${reason} · ${chargeText}"><span class="cp-name">${memberName(id)}</span>${memberBarsHtml(id)}</button>`;
    }).join('');
    const key = html + `|${current}|${off}`;
    if(picker._key === key) return;   // rien n'a changé : on ne redessine pas (l'animation de chargement ne repart pas de zéro)
    picker._key = key;
    picker.innerHTML = html;
    picker.querySelectorAll('.class-pick').forEach(btn => bindTooltip(btn, () => showMemberTooltip(btn, btn.dataset.class), hideSpellTooltip));   // appui long / survol : équipement, altérations, Xiūxiān en cours
    picker.querySelectorAll('.class-pick').forEach(btn => { btn.onclick = () => { if(setTurnClass(btn.dataset.class)){ createSpellButtons(); updateStats(); document.dispatchEvent(new Event('charge-changed')); } }; });
}

/** Données d'un membre de l'équipe pour sa barre d'action : PV, jauge de Xiūxiān (ou tours restants), état. Hou Yi : le héros ; sinon le compagnon. */
export function memberGauge(id){
    const hero = id === START_CLASS;
    const m = hero ? player : gameState.allies?.[id];
    if(!m) return null;
    const inXiu = Math.floor(m.transe || 0) > 0;
    const rage = Math.floor(m.rage || 0);
    return {
        id, entity: m, hero, inXiu, rage,
        hp: Math.max(0, Math.floor(m.hp || 0)), maxHp: Math.max(1, Math.floor(m.maxHp || 1)),
        gauge: inXiu ? Math.floor(m.transe) / TRANSE_TURNS * 100 : Math.min(100, rage / RAGE_MAX * 100),
        full: hero ? (m.cheatMaxRage === true || rage >= RAGE_MAX) : rage >= RAGE_MAX,
        ko: hero ? !!gameState.heroKo : !!m.ko
    };
}
// Barres fines au pied du bouton d'un personnage : PV puis Xiūxiān. Les données du personnage ne sont plus dupliquées ailleurs (plus de barre des compagnons en haut).
function memberBarsHtml(id){
    const g = memberGauge(id);
    if(!g) return '';
    const pct = Math.round(g.hp / g.maxHp * 100);
    // Altérations propres à CE personnage (bonus et malus), en pastilles dans son bouton ; rien dans la zone de qì commune.
    const badges = statusBadgesHtml(g.entity).replace(/ tabindex="0"/g, '').replace(/^<div class="status-badges">/, '<span class="status-badges cp-status">').replace(/<\/div>$/, '</span>');
    return `${badges}<span class="cp-bars" aria-hidden="true"><i class="cp-hp" title="${g.hp} / ${g.maxHp} PV"><b style="width:${pct}%"></b><em>${g.hp}/${g.maxHp}</em></i><i class="cp-xiu${g.full && !g.inXiu ? ' full' : ''}${g.inXiu ? ' on' : ''}"><b style="width:${Math.round(g.gauge)}%"></b></i></span>`;
}
/** Redessine seulement la ligne des personnages (PV, Xiūxiān, chargement) sans toucher aux boutons d'action. */
export function refreshClassPicker(){
    const container = typeof document !== 'undefined' ? document.getElementById('spell-buttons') : null;
    if(container && gameState.combatState === 'active') renderClassPicker(container);
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
            <div class="spell-cost">${sp.invocation ? '<span class="spell-tag">Invocation</span> ' : ''}${costHTML}${damageText}${healText}</div>
        `;
        const coolLeft = spellCooldownLeft(sp.id);
        if(coolLeft > 0) btn.querySelector('.spell-cost').insertAdjacentHTML('beforeend', ` <span class="spell-cooldown">Recharge : ${coolLeft} tour${coolLeft > 1 ? 's' : ''}</span>`);
        if(player.level<sp.minLevel || !hasEnoughMana || coolLeft > 0 || muted || !classCanAct()) {   // classe du tour en chargement : on ne peut pas choisir l'action
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

/** Joue `fn` (éventuellement asynchrone) en tant que lanceur `who` ('player' | 'enemy'), quel que soit le camp du tour de plateau en cours. */
export async function withCaster(who, fn){
    gameState.casterOverride = who;
    try { return await fn(); } finally { gameState.casterOverride = null; }
}

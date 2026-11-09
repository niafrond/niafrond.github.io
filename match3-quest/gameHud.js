// Interface du combat : animation des barres de PV et des compteurs, portraits, mise à jour des stats et sorts ennemis, journal, sauvegarde.
// Extrait de game.js.
import { escapeHtml } from "./escapeHtml.js";
import { enemyNameLabel } from './bestiaryNames.js';
import { heroSprite, enemySprite, spriteUri, gbaSprite, gbaAttackFrames } from './sprites/index.js';
import { hpBarTiming, hpShieldSegment } from './combatFlow.js';
import { setAIDifficulty, getAIDifficulty } from './enemyAI.js';
import { icon as svgIcon } from './icons.js';
import { RAGE_MAX, getEquippedUltimate, isRageFull, canCastUltimateMana } from './ultimates.js';
import { statusBadgesHtml } from './statusBadges.js';
import { animationFactor } from './gameOptions.js';
import { announce, notify } from './a11y.js';
import { bindStatusBadges, bindTooltip, ensureSpellTooltip, placeTooltip, showSpellTooltip, showPlayerGearTooltip, showPlayerGearTooltipBriefly, showItemTooltip, hideSpellTooltip, bindEnemyStuffLongPress } from './gameTooltips.js';
import { createWeaponButton, statValueHtml } from './gameInventoryTabs.js';
import { updatePlayerStatsTab } from './gameStatsTab.js';
import { updateLevelHud } from './gameLevelUp.js';
import { createSpellButtons } from './gameSpellList.js';
import { bonusTurnBadge, canEntityCastSpell, castUltimate, clampManaToCaps, classIcon, currentTurn, enemy, gameState, getUltimateTooltipHtml, getWeaponIcon, markMultiManaSpell, player, spellCostHtml, spellEffectIcon, syncPlayerControlsLock, ultimateManaBarHtml } from './game.js';

// Nom de l'ennemi dans la barre de stats : caractères chinois simplifiés par défaut (bestiaryNames.js), pinyin après un clic sur l'ennemi (et inversement).
// Le choix est gardé pour toute la session de jeu ; sans entrée pour le gabarit, le nom du gabarit reste affiché.
let enemyNameAsHanzi = true;
// Le nom affiché est-il en caractères chinois ? (agrandi par .name-hanzi : les hanzi sont illisibles à la taille du texte latin)
const enemyNameIsHanzi = (e, asHanzi) => /[\u3400-\u9fff]/.test(enemyNameLabel(e, asHanzi));

// --- Animation compteur (tick 1 par 1) ---
export const _activeCounters = {};
/**
 * Anime simultanément un compteur texte (id) et sa progress bar associée,
 * en incrémentant/décrémentant de 1 à chaque tick jusqu'à la valeur cible.
 * @param {string} id      - id du span texte
 * @param {number} from    - valeur de départ
 * @param {number} to      - valeur cible
 * @param {HTMLElement|null} progressEl - élément <progress> à synchroniser (optionnel)
 */
export function _animateHpBar(id, from, to, progressEl = null) {
    if (_activeCounters[id]) {
        clearInterval(_activeCounters[id]);
        delete _activeCounters[id];
    }
    if (isNaN(from) || from === to) return;
    let current = from;
    const delta = Math.abs(to - from);
    // Toute animation de PV (affichage initial, dégâts, soins) dure moins de 4 s : au-delà, le compteur avance par paliers.
    const { intervalMs, unit } = hpBarTiming(delta);
    const step = (to > from ? 1 : -1) * unit;

    function applyValue(val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
        if (progressEl) { progressEl.value = val; syncHpShield(progressEl); }
    }

    applyValue(current);
    _activeCounters[id] = setInterval(() => {
        current = step > 0 ? Math.min(to, current + step) : Math.max(to, current + step);
        applyValue(current);
        if (current === to) {
            clearInterval(_activeCounters[id]);
            delete _activeCounters[id];
        }
    }, intervalMs);
}

// Part de PV encaissable par le bouclier équipé : segment de couleur différente à la suite des PV (30 PV + 10 encaissables = barre de 40).
function playerHpShieldHtml(hp) {
    const absorb = Math.max(0, Math.floor(player.shieldAbsorbLeft || 0));
    const seg = hpShieldSegment(hp, absorb, player.maxHp);
    const title = `Bouclier : encaisse encore ${absorb} dégâts`;
    return { max: seg.max, bar: absorb > 0 ? `<span class="hp-shield" data-absorb="${absorb}" title="${title}"></span>` : '', text: absorb > 0 ? ` <span class="hp-shield-text" title="${title}">+${absorb}</span>` : '' };
}
// Positionne le segment du bouclier d'après la valeur affichée (animée) de la barre.
function syncHpShield(progressEl) {
    const segEl = progressEl?.parentElement?.querySelector('.hp-shield');
    if (!segEl) return;
    const seg = hpShieldSegment(Number(progressEl.value), Number(segEl.dataset.absorb), Number(progressEl.max));
    segEl.style.left = `${seg.left}%`;
    segEl.style.width = `${seg.width}%`;
}

function _animateCounter(id, from, to) {
    _animateHpBar(id, from, to, null);
}

// Dessins des combattants (héros à gauche tourné vers la droite, ennemi à droite tourné vers la gauche) : posés en variable CSS
// `--portrait` des panneaux de stats (pseudo-élément ::after), donc sans clignotement quand le panneau est reconstruit.
// Animation d'attaque jouée sur le portrait : les images défilent puis le portrait de face revient.
const attackPlaying = new Set();
export const ATTACK_FRAME_MS = 90;
// Flèche qui vole du portrait de Hou Yi à celui de l'ennemi (élément posé sur la page, retiré à l'arrivée).
function shootArrow(fromEl, toEl){
    if(!fromEl || !toEl) return;
    const center = el => { const r = el.getBoundingClientRect(); const w = r.width ? Math.min(64, r.width) : 64; return { x: r.right - 4 - w / 2, y: r.top + 2 + w * 0.5 }; };
    const a = center(fromEl), b = center(toEl);
    const arrow = document.createElement('div');
    arrow.className = 'hero-arrow';
    arrow.style.left = `${a.x}px`;
    arrow.style.top = `${a.y}px`;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    arrow.style.setProperty('--angle', `${angle}rad`);
    document.body.appendChild(arrow);
    const dx = b.x - a.x, dy = b.y - a.y, dur = 360 * animationFactor();
    const anim = arrow.animate ? arrow.animate([
        { transform: `translate(0px, 0px) rotate(${angle}rad)`, opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${angle}rad)`, opacity: 1 }
    ], { duration: dur, easing: 'ease-in', fill: 'forwards' }) : null;
    setTimeout(() => arrow.remove(), dur + 60);
    if(anim) anim.onfinish = () => arrow.remove();
}

export function playFighterAttack(isPlayer){
    if(document.body.classList.contains('fx-low')) return;
    const id = isPlayer ? 'player-stats' : 'enemy-stats';
    const el = document.getElementById(id);
    const fighter = isPlayer ? player : enemy;
    const frames = isPlayer ? gbaAttackFrames(player.class) : (gbaAttackFrames(fighter.spriteKey || fighter.id).length ? gbaAttackFrames(fighter.spriteKey || fighter.id) : gbaAttackFrames(fighter.templateId));
    if(!el || !frames.length || attackPlaying.has(id)) return;
    attackPlaying.add(id);
    const ms = (isPlayer ? 130 : ATTACK_FRAME_MS) * animationFactor();
    frames.forEach((uri, i) => setTimeout(() => el.style.setProperty('--portrait', `url("${uri}")`), i * ms));
    if(isPlayer) setTimeout(() => shootArrow(el, document.getElementById('enemy-stats')), (frames.length - 1) * ms);   // la flèche part quand la corde est lâchée
    setTimeout(() => { attackPlaying.delete(id); updateFighterPortraits(); }, frames.length * ms);
}

function updateFighterPortraits(){
    // Hou Yi est tourné vers la droite (vers l'ennemi) ; l'ennemi est tourné vers la gauche : la vue de profil dérivée des sprites
    // vectoriels écrasait les personnages en largeur, mais les sprites GBA ont de vraies vues de profil.
    const set = (id, svg) => {
        const el = document.getElementById(id);
        if(!el || attackPlaying.has(id)) return;
        const view = svg || null;
        if(view) el.style.setProperty('--portrait', `url("${spriteUri(view)}")`);
        else el.style.removeProperty('--portrait');
    };
    set('player-stats', gbaSprite(player.class, 'right') || heroSprite(player.class) || heroSprite('assassin'));
    const eKey = enemy.spriteKey || enemy.id;
    const terrainSprite = gbaSprite(eKey, 'left') || gbaSprite(enemy.templateId, 'left');   // l'ennemi regarde vers Hou Yi (à gauche)
    set('enemy-stats', terrainSprite || enemySprite(eKey, enemy.templateId, enemy.biome));
}

export function updateStats(){
    syncPlayerControlsLock();
    updateLevelHud();
    updateFighterPortraits();
    // truncate log to only the latest message
    const logDiv=document.getElementById('log');
    if(logDiv){
        const lines = logDiv.innerHTML.split('<br>').filter(l=>l.trim()!=='');
        logDiv.innerHTML = lines.slice(-1).join('<br>');
    }

    // Snapshot des valeurs affichées AVANT le rebuild du DOM
    const snapPlayerHp = parseInt(document.getElementById('player-hp-current')?.textContent, 10);
    const snapEnemyHp  = parseInt(document.getElementById('enemy-hp-current')?.textContent,  10);
    const snapPlayerMana = {};
    const snapEnemyMana  = {};
    for (const c of ['red','blue','green','yellow','purple']) {
        snapPlayerMana[c] = parseInt(document.getElementById(`player-mana-${c}`)?.textContent, 10);
        snapEnemyMana[c]  = parseInt(document.getElementById(`enemy-mana-${c}`)?.textContent,  10);
    }

    // Cibles (valeurs actuelles des entités)
    const targetPlayerHp = Math.floor(player.hp);
    const playerShield = playerHpShieldHtml(targetPlayerHp);
    const targetEnemyHp  = Math.floor(enemy.hp);
    // Valeurs initiales pour les progress bars (snap si disponible, sinon target)
    const initPlayerHp = isNaN(snapPlayerHp) ? targetPlayerHp : snapPlayerHp;
    const initEnemyHp  = isNaN(snapEnemyHp)  ? targetEnemyHp  : snapEnemyHp;
    const targetPlayerMana = { red: player.mana.red, blue: player.mana.blue, green: player.mana.green, yellow: player.mana.yellow, purple: player.mana.purple };
    const targetEnemyMana  = { red: enemy.mana.red,  blue: enemy.mana.blue,  green: enemy.mana.green,  yellow: enemy.mana.yellow,  purple: enemy.mana.purple  };

    const playerDiv=document.getElementById('player-stats');
    if(playerDiv && !playerDiv.dataset.gearTipBound){
        playerDiv.dataset.gearTipBound = '1';
        bindTooltip(playerDiv, () => showPlayerGearTooltip(playerDiv), hideSpellTooltip);
        // Un clic / toucher sur le joueur affiche aussi son équipement et ses bonus/malus, quelques secondes.
        playerDiv.addEventListener('click', () => {
            showPlayerGearTooltipBriefly(playerDiv);
        });
    }
    // Pas de jauge de rage sans ultime débloqué (classe sans ultime ou niveau minimum non atteint).
    // Jauge pleine : le texte devient « ULTIME » et la barre se lance l'ultime choisi (compte comme un tour).
    const equippedUltimate = getEquippedUltimate(player);
    const ultimateReady = !!equippedUltimate && isRageFull(player) && gameState.combatState === 'active';
    const ultimateManaReached = !!equippedUltimate && (player.cheatFreeSpells === true || canCastUltimateMana(player, equippedUltimate));   // clignote seulement si le qì collecté suffit aussi
    // Héros avec jauge de rage : sa fiche est déjà bien remplie, la fiche ennemie reçoit plus de largeur (style.css `.has-rage`).
    document.querySelector('.stats-container')?.classList.toggle('has-rage', !!equippedUltimate);
    // Affichage de la classe si définie
    Promise.resolve(classIcon(player.class)).then(emoji => {
        playerDiv.innerHTML = `
            <div class="stat row-name"><span class="enemy-combat-name" title="${escapeHtml(player.name || 'Hou Yi')}">${emoji} ${escapeHtml((player.name || 'Hou Yi').split(' ')[0])}</span>${bonusTurnBadge(player)}</div>
            ${statusBadgesHtml(player)}
            <div class="stat row-hp">
                <div class="hp-bar-container">
                    <progress value="${initPlayerHp}" max="${playerShield.max}"></progress>${playerShield.bar}
                    <span class="hp-text"><span id="player-hp-current">${targetPlayerHp}</span>/${player.maxHp}${playerShield.text}</span>
                </div>
            </div>
            ${equippedUltimate ? `
            <div class="stat rage-stat row-rage">
                <div class="rage-bar-container${isRageFull(player) ? ' full' : ''}${ultimateReady ? ' ultimate-ready' : ''}${ultimateReady && ultimateManaReached ? ' mana-reached' : ''}"${ultimateReady ? ' role="button" tabindex="0"' : ''}>
                    <div class="rage-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${RAGE_MAX}" aria-valuenow="${Math.floor(player.rage || 0)}"><div class="rage-fill" style="height:${Math.min(100, Math.max(0, (player.rage || 0) / RAGE_MAX * 100))}%"></div></div>
                    <span class="rage-text" title="${ultimateReady ? 'ULTIME' : `RAGE ${Math.floor(player.rage || 0)}`}">${ultimateReady ? '★' : Math.floor(player.rage || 0)}</span>
                </div>
                ${ultimateManaBarHtml(player, equippedUltimate)}
            </div>
            ` : ''}
            <div class="stat stat-row row-stats"><span class="level-pill" title="Niveau ${player.level}">${player.level}</span><span class="stat-chip" title="Attaque"><strong>Att.</strong> ${statValueHtml(player, 'attack')}</span><span class="stat-chip" title="Défense"><strong>Déf.</strong> ${statValueHtml(player, 'defense')}</span></div>
            <div class="stat row-pills">
                <div class="mana-dots">
                    <span id="player-mana-red" class="cost-badge mana-red" title="red">${targetPlayerMana.red}</span>
                    <span id="player-mana-blue" class="cost-badge mana-blue" title="blue">${targetPlayerMana.blue}</span>
                    <span id="player-mana-green" class="cost-badge mana-green" title="green">${targetPlayerMana.green}</span>
                    <span id="player-mana-yellow" class="cost-badge mana-yellow cost-badge-light" title="yellow">${targetPlayerMana.yellow}</span>
                    <span id="player-mana-purple" class="cost-badge mana-purple" title="purple">${targetPlayerMana.purple}</span>
                    <span class="stat-chip pa-stat" title="Points d'action"><img class="pa-ic" src="sprites/tiles/tile-combat.svg" alt=""> ${player.combatPoints}</span>
                </div>
            </div>`;
        
        if(equippedUltimate){
            const rageBar = playerDiv.querySelector('.rage-bar-container');
            if(ultimateReady){
                rageBar.onclick = () => castUltimate(equippedUltimate.id);
                rageBar.onkeydown = (event) => {
                    if(event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        castUltimate(equippedUltimate.id);
                    }
                };
            }
            // Fiche (nom, qì requis, effet) : survol, ou appui long au doigt (qui ne lance pas l'ultime).
            bindTooltip(rageBar, () => { const t = ensureSpellTooltip(); t.innerHTML = getUltimateTooltipHtml(player, equippedUltimate); t.classList.add('visible'); placeTooltip(t, rageBar, 260); }, () => hideSpellTooltip());
        }

        // Animer les compteurs si les valeurs ont changé
        const playerProgressEl = playerDiv.querySelector('.hp-bar-container progress');
        syncHpShield(playerProgressEl);
        _animateHpBar('player-hp-current', initPlayerHp, targetPlayerHp, playerProgressEl);
        for (const c of ['red','blue','green','yellow','purple']) {
            _animateCounter(`player-mana-${c}`, snapPlayerMana[c], targetPlayerMana[c]);
        }

        // Ajouter/retirer classe pour liseré selon le tour actuel
        playerDiv.classList.toggle('active-turn', currentTurn === 'player');
        playerDiv.classList.toggle('ultimate-ready', ultimateReady);   // ultime disponible : toute la fiche clignote (style.css)
        bindStatusBadges(playerDiv, player);
    });
    
    const enemyDiv=document.getElementById('enemy-stats');
    enemyDiv.classList.toggle('active-turn', currentTurn === 'enemy');
    
    // Icône de la classe de l'ennemi
    const enemyClassEmoji = classIcon(enemy.playerClass);
    
    // Afficher un indicateur visuel si l'ennemi est plus fort
    const levelIndicator = enemy.level > player.level ? 
        `<span class="level-pill level-pill-danger" title="Niveau ${enemy.level} : plus fort que vous">${enemy.level}</span>` : 
        `<span class="level-pill" title="Niveau ${enemy.level}">${enemy.level}</span>`;
    
    enemyDiv.innerHTML = `
        <div class="stat row-name"><span class="enemy-combat-name${enemyNameIsHanzi(enemy, enemyNameAsHanzi) ? ' name-hanzi' : ''}" data-full-name="${enemy.name}" aria-label="Nom complet: ${enemy.name}">${enemyClassEmoji} ${escapeHtml(enemyNameLabel(enemy, enemyNameAsHanzi))}</span>${bonusTurnBadge(enemy)}</div>
        ${statusBadgesHtml(enemy)}
        <div class="stat row-hp">
            <div class="hp-bar-container">
                <progress class="enemy-bar" value="${initEnemyHp}" max="${enemy.maxHp}"></progress>
                <span class="hp-text"><span id="enemy-hp-current">${targetEnemyHp}</span>/${enemy.maxHp}</span>
            </div>
        </div>
        <div class="stat stat-row row-stats">${levelIndicator}<span class="stat-chip" title="Attaque"><strong>Att.</strong> ${statValueHtml(enemy, 'attack')}</span><span class="stat-chip" title="Défense"><strong>Déf.</strong> ${statValueHtml(enemy, 'defense')}</span></div>
        <div class="stat row-pills">
            <div class="mana-dots">
                <span id="enemy-mana-red" class="cost-badge mana-red" title="red">${targetEnemyMana.red}</span>
                <span id="enemy-mana-blue" class="cost-badge mana-blue" title="blue">${targetEnemyMana.blue}</span>
                <span id="enemy-mana-green" class="cost-badge mana-green" title="green">${targetEnemyMana.green}</span>
                <span id="enemy-mana-yellow" class="cost-badge mana-yellow cost-badge-light" title="yellow">${targetEnemyMana.yellow}</span>
                <span id="enemy-mana-purple" class="cost-badge mana-purple" title="purple">${targetEnemyMana.purple}</span>
                <span class="stat-chip pa-stat" title="Points d'action"><img class="pa-ic" src="sprites/tiles/tile-combat.svg" alt=""> ${enemy.combatPoints}</span>
            </div>
        </div>`;
    bindStatusBadges(enemyDiv, enemy);
    // Animer les compteurs ennemi
    const enemyProgressEl = enemyDiv.querySelector('.hp-bar-container progress');
    _animateHpBar('enemy-hp-current', initEnemyHp, targetEnemyHp, enemyProgressEl);
    for (const c of ['red','blue','green','yellow','purple']) {
        _animateCounter(`enemy-mana-${c}`, snapEnemyMana[c], targetEnemyMana[c]);
    }

    const enemyNameEl = enemyDiv.querySelector('.enemy-combat-name');
    if(enemyNameEl) {
        const fullName = enemyNameEl.dataset.fullName || enemy.name;
        // Ni survol ni appui bref : le clic simple ne fait que changer le nom ; seul l'appui long montre force, faiblesse et stuff.
        bindEnemyStuffLongPress(enemyNameEl, fullName, enemy);
    }
    if(!enemyDiv.dataset.nameToggleBound) {
        enemyDiv.dataset.nameToggleBound = '1';
        enemyDiv.addEventListener('click', () => {
            enemyNameAsHanzi = !enemyNameAsHanzi;
            const el = enemyDiv.querySelector('.enemy-combat-name');
            if(el){
                el.innerHTML = `${classIcon(enemy.playerClass)} ${escapeHtml(enemyNameLabel(enemy, enemyNameAsHanzi))}`;
                el.classList.toggle('name-hanzi', enemyNameIsHanzi(enemy, enemyNameAsHanzi));
            }
        });
    }
    
    updateEnemySpells();
}

export function updateEnemySpells(){
    // Afficher l'arme ennemie (au-dessus des sorts, comme le joueur)
    const weaponContainer = document.getElementById('enemy-weapon-button');
    if (weaponContainer) {
        let weaponHtml = '';
        if (enemy.weapon) {
            const icon = getWeaponIcon(enemy.weapon.type);
            weaponHtml += `
                <div class="enemy-spell-item disabled">
                    <div class="spell-name">${icon} ${enemy.weapon.name}</div>
                    <div class="spell-cost">${enemy.weapon.actionPoints} ${svgIcon('arrow')} - ${enemy.weapon.damage} ${svgIcon('skull')}</div>
                </div>
            `;
        }
        if (enemy.inventoryItem) {
            weaponHtml += `
                <div class="enemy-spell-item disabled enemy-item-card" tabindex="0">
                    <div class="spell-name">${svgIcon('bag')} ${enemy.inventoryItem.name}</div>
                    <div class="spell-cost">Objet ennemi</div>
                </div>
            `;
        }
        weaponContainer.innerHTML = weaponHtml;

        const enemyItemCard = weaponContainer.querySelector('.enemy-item-card');
        if(enemyItemCard && enemy.inventoryItem) {
            const showDetails = () => showItemTooltip(enemyItemCard, enemy.inventoryItem, { isEnemyItem: true });
            const hideDetails = () => hideSpellTooltip();
            bindTooltip(enemyItemCard, showDetails, hideDetails);
        }
    }

    const container = document.getElementById('enemy-spell-list');
    if(!container) return;
    container.innerHTML = '';
    
    // Aucun sort : pas de tuile du tout (plutôt qu'une tuile « Aucun sort »).
    if(!enemy.spells || enemy.spells.length === 0) return;
    
    enemy.spells.forEach(sp => {
        const div = document.createElement('div');
        div.className = 'enemy-spell-item';
        const hasEnoughMana = canEntityCastSpell(enemy, sp);
        if(!hasEnoughMana) {
            div.classList.add('disabled');
        }
        
        // Sort de classe : icône de la classe
        const spellClassIndicator = sp.class ? classIcon(sp.class) : '';
        
        // Gestion des coûts multiples pour les sorts de classe
        const costDisplay = spellCostHtml(sp);
        
        const damageText = sp.dmg ? ` • ${sp.dmg} dmg` : '';
        const healText = sp.heal ? ` • ${sp.heal} HP` : '';
        const effectText = sp.description || (sp.effect ? 'Effet special' : (sp.dmg ? `Inflige ${sp.dmg} degats` : (sp.heal ? `Soigne ${sp.heal} HP` : 'Aucun effet')));
        div.innerHTML = `
            <div class="spell-name">${spellClassIndicator} ${sp.name} ${spellEffectIcon(sp)}</div>
            <div class="spell-cost">${costDisplay}${damageText}${healText}</div>
        `;
        div.title = effectText;
        markMultiManaSpell(div, sp);

        const showDetails = () => showSpellTooltip(div, sp);
        const hideDetails = () => hideSpellTooltip();
        bindTooltip(div, showDetails, hideDetails);

        container.appendChild(div);
    });
}

export function log(text){
    announce(text);   // lecteurs d'écran : le message ne dépend ni d'une animation ni d'un son (a11y.js)
    const logDiv=document.getElementById('log');
    if(logDiv){
        logDiv.innerHTML = text + "<br>";
        logDiv.scrollTop = logDiv.scrollHeight;
    }
}

export function logActiveAction(actionText){
    const actor = currentTurn === 'player'
        ? `joueur (${player.name || 'Hou Yi'})`
        : `ennemi (${enemy.name || 'Ennemi'})`;
    console.log(`Action active - ${actor}: ${actionText}`);
}

// ========================================
// GESTION DE LA DIFFICULTÉ DE L'IA
// ========================================

export function changeAIDifficulty(difficultyLevel) {
    setAIDifficulty(difficultyLevel);
    log(`Difficulté de l'IA changée: ${difficultyLevel}`);
}

export function getCurrentAIDifficulty() {
    const difficulty = getAIDifficulty();
    return difficulty.name;
}

// ========================================

let lastSaveErrorNotice = 0;
export function saveUpdate(){
    clampManaToCaps(player);
    try {
        localStorage.setItem('player', JSON.stringify(player));
        console.log('Données du joueur sauvegardées');
        if (player.class) {
            console.log(`Classe sauvegardée: ${player.class}`);
        }
    } catch (e) {
        console.error('Erreur lors de la sauvegarde:', e);
        // Sans message, le joueur croirait sa partie enregistrée : on le dit calmement, une fois par minute au plus.
        if (Date.now() - lastSaveErrorNotice > 60000) {
            lastSaveErrorNotice = Date.now();
            notify("La sauvegarde automatique n'a pas fonctionné (stockage du navigateur plein ou bloqué). Votre partie reste en cours : pensez à l'exporter depuis Options / Pause.", 9000);
        }
    }
    updateStats();
    createSpellButtons();
    createWeaponButton();
    updatePlayerStatsTab();
}

// Fonction pour effacer la sauvegarde
export function clearSaveData() {
    if (confirm('Réinitialiser le jeu ? Toute votre progression (personnage, quêtes, objets) sera définitivement effacée.')) {
        localStorage.removeItem('player');
        console.log('Sauvegarde effacée');
        location.reload();
    }
}

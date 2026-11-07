// Onglet Stats détaillées du joueur et animations d'annonce (sorts, attaques) du combat.
// Extrait de game.js.
import { escapeHtml } from "./escapeHtml.js";
import { spriteUri } from './sprites/index.js';
import { spellFxHtml, spellFxDurationMs, preloadSpellFx } from './spellFx.js';
import { icon as svgIcon, manaIcon } from './icons.js';
import { npcSprite } from './sprites/index.js';
import { COMPANION_POWERS } from './companionPowers.js';
import { PLAY_STYLES, PLAY_STYLE_ORDER, getPlayStyle, setPlayStyle } from './playStyles.js';
import { COMPANIONS } from './companions.js';
import { summarizeColorBonuses, totalAttributePoints, agilityScore } from './attributes.js';
import { getXPProgress, getXPToNextLevel } from './experience.js';
import { animationFactor } from './gameOptions.js';
import { statValueHtml } from './gameInventoryTabs.js';
import { playFighterAttack, log, saveUpdate } from './gameHud.js';
import { resetAttributePoints, showAttributeMenu } from './gameLevelUp.js';
import { COMPANION_NAMES, classIcon, companionMenuHooks, enemy, gameState, getPrimaryAttributeEffect, player } from './game.js';

// mise à jour de l'onglet stats détaillées
// Section « Compagnon » de l'onglet Stats : un seul compagnon actif à la fois, choisi parmi les recrutés (hors combat).
function companionSectionHtml(){
    const choices = companionMenuHooks.getChoices?.();
    if(!choices || !choices.companions.length) return '';
    const locked = gameState.combatState === 'active' ? ' disabled' : '';
    const buttons = [...choices.companions.map(c => ({ id: c.id, name: c.name, title: c.title })), { id: 'none', name: 'Aucun', title: 'Combattre seul' }].map(c => {
        const power = COMPANION_POWERS[c.id];
        const on = choices.activeId === c.id;
        return `<div class="stat-line"><button type="button" data-companion="${c.id}" class="${on ? 'active' : 'secondary'}" aria-pressed="${on}"${locked}>${c.name}${on ? ' (actif)' : ''}</button><span class="stat-effect">${c.title}${power ? ` · ${power.name} : ${power.text}` : ''}</span></div>`;
    }).join('');
    return `<div class="stats-section"><h3>Compagnon actif</h3>${buttons}<div class="stat-line"><span class="stat-effect">Un seul compagnon à la fois ; le changer se fait hors combat.</span></div></div>`;
}

// Section « Style de Hou Yi » de l'onglet Stats : cartes au style du jeu (comme le choix de classe), modifiables hors combat.
function playStyleSectionHtml(){
    const current = getPlayStyle(player)?.id || '';
    const locked = gameState.combatState === 'active' ? ' disabled' : '';
    const cards = [{ id: '', name: 'Style libre', summary: 'Aucun modificateur : le jeu de base.', effects: [] }, ...PLAY_STYLE_ORDER.map(id => PLAY_STYLES[id])].map(st => {
        const on = current === st.id;
        return `<button type="button" class="class-card playstyle-card${on ? ' selected' : ''}" data-playstyle="${st.id}" aria-pressed="${on}"${locked}>
            <div class="class-name">${st.name}</div>
            <div class="class-description">${st.summary}</div>
            ${st.effects.length ? `<ul class="playstyle-effects">${st.effects.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
        </button>`;
    }).join('');
    return `<div class="stats-section"><h3>Style de Hou Yi</h3><div class="class-grid playstyle-grid">${cards}</div><div class="stat-line"><span class="stat-effect">Se change librement hors combat, sans perdre de progression.</span></div></div>`;
}

export function updatePlayerStatsTab(){
    const statsContent = document.getElementById('stats-content');
    if(!statsContent) return;
    
    // Import de la classe pour afficher le nom
    import('./classes.js').then(module => {
        const classData = player.class ? module.playerClasses[player.class] : null;
        const className = classData ? `${classIcon(player.class)} ${classData.name}` : 'Aucun';
        
        // Calculer la progression XP
        const xpProgress = getXPProgress(player);
        const xpRemaining = getXPToNextLevel(player);
        
        statsContent.innerHTML = `
            <div class="stats-section">
                <h3>Informations</h3>
                <div class="stat-line">
                    <span class="stat-label">${svgIcon('idCard')} Nom:</span>
                    <span class="stat-value">${escapeHtml(player.name || 'Hou Yi')}</span>
                </div>
                <div class="stat-line">
                    <span class="stat-label">${svgIcon('mask')} Style:</span>
                    <span class="stat-value">${className}</span>
                </div>
                <div class="stat-line">
                    <span class="stat-label">${svgIcon('star')} Niveau:</span>
                    <span class="stat-value">${player.level}</span>
                </div>
                <div class="stat-line">
                    <span class="stat-label">${svgIcon('chart')} Expérience:</span>
                    <span class="stat-value">${player.xp} / ${player.xpToNextLevel} XP</span>
                </div>
                <div class="stat-line">
                    <div style="width: 100%; margin-top: 5px;">
                        <div class="xp-bar-container">
                            <progress class="xp-bar" value="${xpProgress}" max="100" style="width: 100%;"></progress>
                            <span class="xp-text">${xpProgress}% (${xpRemaining} XP restants)</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="stats-section attribute-points-section">
                <h3>Points d'attribut</h3>
                <div class="stat-line">
                    <span class="stat-label">${svgIcon('star')} À répartir :</span>
                    <span class="stat-value">${player.unspentLevelPoints || 0}</span>
                    <span class="stat-effect">${totalAttributePoints(player)} point(s) dépensé(s)</span>
                </div>
                <div class="attribute-points-actions">
                    <button type="button" id="spend-points-btn" ${(player.unspentLevelPoints || 0) > 0 && gameState.combatState !== 'active' ? '' : 'disabled'}>Répartir les points</button>
                    <button type="button" id="reset-points-btn" ${totalAttributePoints(player) > 0 && gameState.combatState !== 'active' ? '' : 'disabled'} title="Rend tous les points dépensés pour les répartir autrement (hors combat)">Réinitialiser les points</button>
                </div>
            </div>
            <div class="stats-section">
                <h3>Caractéristiques</h3>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('muscle')} Force (Strength):</span>
                <span class="stat-value">${player.attributes.strength}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'strength')} Attaque</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('runner')} Agilité (Agility):</span>
                <span class="stat-value">${player.attributes.agility}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'agility')} Défense</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('brain')} Intelligence:</span>
                <span class="stat-value">${player.attributes.intelligence}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'intelligence')} Puissance magique</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('heart')} Endurance (Stamina):</span>
                <span class="stat-value">${player.attributes.stamina}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'stamina')} HP max</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('target')} Moral (Morale):</span>
                <span class="stat-value">${player.attributes.morale}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'morale')} Défense et agilité</span>
            </div>
        </div>
        
        <div class="stats-section">
            <h3>Statistiques de combat</h3>
            <div class="stat-line">
                <span class="stat-label" title="Chance de coup critique (arme, crânes) — plafonnée à 98 %">${svgIcon('sword')} Attaque (critique):</span>
                <span class="stat-value">${statValueHtml(player, 'attack')}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label" title="Chance de bloquer en tout ou partie une attaque armée ou de crânes — plafonnée à 98 %">${svgIcon('shield')} Défense (blocage):</span>
                <span class="stat-value">${statValueHtml(player, 'defense')}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label" title="Agilité (points d'Agilité et de Moral) : joue en premier quand elle dépasse celle de l'ennemi (initiative) ; chaque point ajoute aussi 1 de défense">${svgIcon('runner')} Agilité (initiative):</span>
                <span class="stat-value">${agilityScore(player)}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('heart')} HP Maximum:</span>
                <span class="stat-value">${player.maxHp}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('spark')} Qì Maximum:</span>
                <span class="stat-value">${player.maxMana}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${['red', 'yellow', 'green', 'blue', 'purple'].map(manaIcon).join('')} Caps qì :</span>
                <span class="stat-value">${player.manaCaps?.red ?? player.maxMana}/${player.manaCaps?.yellow ?? player.maxMana}/${player.manaCaps?.green ?? player.maxMana}/${player.manaCaps?.blue ?? player.maxMana}/${player.manaCaps?.purple ?? player.maxMana}</span>
            </div>
        </div>
        
        <div class="stats-section">
            <h3>Bonus de couleur (niveaux)</h3>
            ${summarizeColorBonuses(player).map(c => `<div class="stat-line">
                <span class="stat-label">${manaIcon(c.color)} ${c.colorLabel[0].toUpperCase() + c.colorLabel.slice(1)} (${c.points} pt) :</span>
                <span class="stat-effect">match de 3 = ${c.perMatch3} qì · +${c.initial} au départ · réserve ${c.cap}</span>
            </div>`).join('')}
        </div>

        ${playStyleSectionHtml()}
        ${companionSectionHtml()}
        <div class="stats-section">
            <button onclick="window.clearPlayerSave()" class="secondary">Effacer la sauvegarde</button>
        </div>
    `;
        statsContent.querySelectorAll('[data-companion]').forEach(btn => btn.addEventListener('click', () => {
            if(gameState.combatState === 'active') return;
            if(companionMenuHooks.setActive?.(btn.dataset.companion)) updatePlayerStatsTab();
        }));
        statsContent.querySelectorAll('[data-playstyle]').forEach(btn => btn.addEventListener('click', () => {
            if(gameState.combatState === 'active' || !setPlayStyle(player, btn.dataset.playstyle || null)) return;
            saveUpdate();
            log(PLAY_STYLES[player.playStyle] ? `Style : ${PLAY_STYLES[player.playStyle].name}.` : 'Style libre.');
            updatePlayerStatsTab();
        }));
        statsContent.querySelector('#spend-points-btn')?.addEventListener('click', () => showAttributeMenu());
        statsContent.querySelector('#reset-points-btn')?.addEventListener('click', () => {
            if(gameState.combatState === 'active') return;
            if(confirm(`Réinitialiser les ${totalAttributePoints(player)} point(s) d'attribut dépensés ? Ils vous seront rendus pour être répartis autrement.`)) {
                resetAttributePoints();
            }
        });
    });
}

// Construit et affiche une animation d'attaque ou de sort à partir de paramètres structurés.
// Paramètres : { icon, title, damage?, heal?, source?, target? }
preloadSpellFx();

// Portrait pixel art de Xiao Gui (le renard compagnon) pour l'annonce de son coup.
export function companionIconHtml(id){
    const npc = COMPANIONS.find(c => c.id === id)?.npc;
    const uri = npc ? spriteUri(npcSprite(npc)) : null;
    return uri ? `<img class="fox-portrait" src="${uri}" alt="${COMPANION_NAMES[id] || id}" style="width:96px;height:96px;max-width:40vw;max-height:40vw;object-fit:contain;image-rendering:pixelated">` : svgIcon('star');
}
export function foxIconHtml(){
    const uri = spriteUri(npcSprite('xiao_gui'));
    return uri ? `<img class="fox-portrait" src="${uri}" alt="Xiao Gui" style="width:96px;height:96px;max-width:40vw;max-height:40vw;object-fit:contain;image-rendering:pixelated">` : svgIcon('star');
}

export function showCombatAnimation({ icon, title, damage = null, heal = null, source = null, target = null }, isPlayerAttack = true, options = {}) {
    // Les annonces de critique / blocage / parade restent affichées jusqu'au clic du joueur.
    if(options.requireClick === undefined && options.autoHideMs === undefined && /CRITIQUE|BLOQUÉ|paré/.test(String(damage ?? ''))) options = { ...options, requireClick: true };
    // Coup d'arme ou sort offensif : le combattant joue aussi son animation d'attaque (tir à l'arc, coup d'arme…)
    if(!options.blocked && damage !== null && (isPlayerAttack ? typeof target === 'string' && target.includes(enemy.name) : /dégâts/.test(String(damage)))) playFighterAttack(isPlayerAttack);
    const boardEl = document.getElementById('board');   // zone intérieure (l'overlay est dans le padding du plateau)
    const boardPx = boardEl ? Math.min(boardEl.clientWidth, boardEl.clientHeight) || Infinity : Infinity;
    const fx = spellFxHtml(title, Number.isFinite(boardPx) ? boardPx : 0);   // les sorts très chers s'étalent sur le plateau ; mini-animation pixel art du sort (plus riche pour les sorts chers), sinon l'icône
    if(fx && options.requireClick === undefined && options.autoHideMs === undefined) options = { ...options, autoHideMs: Math.max(1000 * animationFactor(), spellFxDurationMs(title) * 2 + 500) };   // l'animation tourne en boucle : au moins deux passages
    const bigFx = Boolean(fx && fx.includes('spellfx-big'));
    let html = `<div class="attack-icon${fx ? ' has-spellfx' : ''}${bigFx ? ' has-spellfx-big' : ''}">${fx || svgIcon(icon) || icon}</div>`;
    // 2e temps d'un blocage / d'une parade : gros bouclier (plein = bloqué, fendu = paré) et texte qui vibre.
    if(options.blocked) html = `<div class="block-shield block-${options.blocked}">${svgIcon('wickershield')}</div>` + html;
    let caption = `<div class="attack-title">${String(title).toUpperCase()}</div>`;
    if (damage !== null) caption += `<div class="attack-damage">${damage}</div>`;
    if (heal   !== null) caption += `<div class="attack-heal">${heal}</div>`;
    if (source !== null) caption += `<div class="attack-source">${escapeHtml(source)}</div>`;
    if (target !== null) caption += `<div class="attack-target">${escapeHtml(target)}</div>`;
    // Sort très cher : l'animation garde tout le plateau, titre et dégâts recouvrent les boutons de sorts.
    html += bigFx ? `<div class="attack-caption">${caption}</div>` : caption;
    showAttackAnimation(html, isPlayerAttack, options);
}

// Attaque en deux temps quand la cible bloque ou pare : 1) dégâts annoncés, 2) dégâts réellement subis avec bouclier et vibration.
// `strike` vient de resolveStrike ({ damage, crit, block, intended }) ; `params` = paramètres de showCombatAnimation sans `damage`.
export function showStrikeAnimation(params, strike, isPlayerAttack = true, finalDamage = strike.damage, options = {}) {
    const crit = strike.crit ? ' CRITIQUE !' : '';
    const real = Math.floor(finalDamage);
    if(!strike.block || strike.block === 'none') {
        showCombatAnimation({ ...params, damage: `-${real} dégâts${crit}` }, isPlayerAttack, options);
        return;
    }
    const intended = Math.max(Math.floor(strike.intended ?? real), real);
    showCombatAnimation({ ...params, damage: `-${intended} dégâts${crit}` }, isPlayerAttack, {
        ...options, requireClick: false, autoHideMs: 900 * animationFactor(),
        onContinue: () => showCombatAnimation(
            { ...params, damage: `${strike.block === 'total' ? 'BLOQUÉ !' : 'PARÉ !'} -${real} dégâts`, title: params.title },
            isPlayerAttack, { ...options, blocked: strike.block, requireClick: true, onContinue: options.onContinue })
    });
}

// Mécanisme DOM bas niveau pour afficher un overlay d'animation sur la grille
export function showAttackAnimation(text, isPlayerAttack = true, options = {}) {
    const {
        requireClick = false,
        continueText = 'Cliquez pour continuer',
        onContinue = null,
        autoHideMs = 1000 * animationFactor()
    } = options;

    const boardDiv = document.getElementById('board');
    if(!boardDiv) {
        if(typeof onContinue === 'function') {
            onContinue();
        }
        return;
    }
    
    // Créer l'overlay qui cache la grille
    const overlay = document.createElement('div');
    overlay.className = 'attack-overlay';
    
    // Créer le contenu de l'animation
    const attackDiv = document.createElement('div');
    attackDiv.className = 'attack-animation';
    attackDiv.innerHTML = text;
    
    // Couleur selon qui attaque
    if(isPlayerAttack) {
        overlay.classList.add('player-attack');
    } else {
        overlay.classList.add('enemy-attack');
    }

    // Légende d'un sort très cher : sortie de l'overlay pour se poser sur les boutons de sorts.
    const caption = attackDiv.querySelector('.attack-caption');
    const spellsBox = document.getElementById('spells-container');
    if(caption && spellsBox) {
        const r = spellsBox.getBoundingClientRect();
        Object.assign(caption.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
        document.body.appendChild(caption);
        // Fermeture forcée : petite flèche vers le bas en bas de la légende (elle seule capte les clics).
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'attack-caption-close';
        closeBtn.setAttribute('aria-label', "Fermer l'annonce");
        closeBtn.textContent = '▼';
        closeBtn.addEventListener('click', (event) => { event.stopPropagation(); finishOverlay(); });
        caption.appendChild(closeBtn);
    }

    const finishOverlay = () => {
        if(!overlay.parentNode) return;
        caption?.remove();   // la légende part en même temps que le clic « pour continuer » (ou la fin du délai)
        overlay.classList.add('fade-out');
        setTimeout(() => {
            if(overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            if(typeof onContinue === 'function') {
                onContinue();
            }
        }, 500);
    };

    if(requireClick) {
        overlay.classList.add('requires-click');
        const continueHint = document.createElement('div');
        continueHint.className = 'attack-continue';
        continueHint.textContent = continueText;
        attackDiv.appendChild(continueHint);

        overlay.setAttribute('role', 'button');
        overlay.setAttribute('aria-label', continueText);
        overlay.tabIndex = 0;
        overlay.addEventListener('click', finishOverlay);
        overlay.addEventListener('keydown', (event) => {
            if(event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                finishOverlay();
            }
        });
    }
    
    overlay.appendChild(attackDiv);
    boardDiv.appendChild(overlay);

    if(!requireClick) {
        // Supprimer automatiquement après un court délai.
        setTimeout(() => {
            finishOverlay();
        }, autoHideMs);
    }
}

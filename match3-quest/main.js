import { generateBoard, renderBoard } from "./board.js";
import { updateStats, createSpellButtons, newEnemy, restartCombat, updateAvailableSpells, updatePlayerStatsTab, createWeaponButton, updateAvailableWeapons, player, saveUpdate, log, clearSaveData, startNewCombat, updateInventoryTab, grantStartingWeapon, combatHooks } from "./game.js";
import { getAllClasses, playerClasses, DEFAULT_STARTING_WEAPON_ID } from "./classes.js";
import { createMapEnemy } from "./enemies.js";
import { playTitleScreen } from "./cinematics.js";
import { initializeAudioUI, playSfx, primeAudioFromGesture } from "./sound.js";
import { proposeTutorial, initTutorialUI, startTutorial, hasTutorialBeenCompleted } from "./tutorial.js";
import { getMatch3BuildDate } from "./version.js";
import { worldZones } from "./worldMap.js";
import { mountWorldMap } from "./worldMapView.js";
import { createExplorationView } from "./explorationView.js";
import { REGION_ENTRY_SCREEN } from "./story.js";
import { heroSprite, spriteUri } from "./sprites/index.js";

// initialisation de la partie
console.log('Main.js loaded');

const THEME_STORAGE_KEY = 'match3Theme';

function setThemeMode(isDarkMode, toggleButton){
    document.body.classList.toggle('dark-mode', isDarkMode);
    if(toggleButton){
        toggleButton.textContent = isDarkMode ? '☀️' : '🌙';
        toggleButton.setAttribute('aria-pressed', isDarkMode ? 'true' : 'false');
        toggleButton.title = isDarkMode ? 'Désactiver le mode sombre' : 'Activer le mode sombre';
    }

    try {
        localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
    } catch(_) {
        // localStorage can be unavailable in some contexts
    }

    window.dispatchEvent(new Event('resize'));
}

function initializeThemeUI(toggleButton){
    if(!toggleButton) return;

    let isDarkMode = false;
    try {
        isDarkMode = localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch(_) {
        isDarkMode = false;
    }

    setThemeMode(isDarkMode, toggleButton);
    toggleButton.addEventListener('click', () => {
        setThemeMode(!document.body.classList.contains('dark-mode'), toggleButton);
    });
}

// Afficher le modal de sélection de classe au démarrage si pas de classe
function showClassSelection() {
    if(player.class) return; // Déjà une classe sélectionnée
    
    const modal = document.getElementById('class-modal');
    const container = document.getElementById('class-selection');
    const classes = getAllClasses();
    
    let selectedClass = null;
    
    const classGrid = document.createElement('div');
    classGrid.className = 'class-grid';
    
    classes.forEach(cls => {
        const card = document.createElement('div');
        card.className = 'class-card';
        card.dataset.classId = cls.id;
        card.innerHTML = `
            <div class="class-emoji">${cls.emoji}</div>
            <div class="class-name">${cls.name}</div>
            <div class="class-description">${cls.description}</div>
        `;
        card.onclick = () => {
            document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedClass = cls.id;
        };
        classGrid.appendChild(card);
    });
    
    container.innerHTML = '';
    container.appendChild(classGrid);
    
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.innerHTML = `
        <button class="primary" id="confirm-class">Confirmer</button>
        <button class="secondary" id="skip-class">Sans classe</button>
    `;
    container.appendChild(actions);
    
    document.getElementById('confirm-class').onclick = () => {
        if(!selectedClass) {
            log('⚠️ Veuillez sélectionner une classe');
            return;
        }
        player.class = selectedClass;
        // Le joueur est toujours Hou Yi, l'archer divin ; la classe choisie est sa manière de combattre.
        player.name = 'Hou Yi';
        const classData = playerClasses[selectedClass];
        // Appliquer les stats de départ de la classe
        Object.keys(classData.startingStats).forEach(attr => {
            player.attributes[attr] += classData.startingStats[attr];
        });
        log(`✨ ${player.name}, vous êtes maintenant ${classData.emoji} ${classData.name} !`);
        // Le joueur ne doit jamais commencer un combat sans arme équipée
        grantStartingWeapon(classData.startingWeaponId || DEFAULT_STARTING_WEAPON_ID);
        updateAvailableSpells();
        saveUpdate();

        if(!hasTutorialBeenCompleted()) {
            // Proposer le tutoriel en ligne dans la même modal
            container.innerHTML = `
                <div style="text-align:center; padding: 16px 0 8px;">
                    <div style="font-size:3rem; margin-bottom:10px;">📚</div>
                    <h3 style="margin:0 0 8px;">Voulez-vous lancer le tutoriel ?</h3>
                    <p style="color:#666; font-size:0.88rem; margin:0 0 20px;">
                        Il vous guidera pas à pas : déplacer des tuiles, faire des matchs de soleils,<br>générer du mana et lancer un sort.
                    </p>
                    <div class="modal-actions">
                        <button class="primary" id="tutorial-inline-yes">✅ Oui, lancer le tutoriel</button>
                        <button class="secondary" id="tutorial-inline-no">❌ Non merci</button>
                    </div>
                </div>
            `;
            document.getElementById('tutorial-inline-yes').onclick = () => {
                modal.classList.remove('active');
                startTutorial();
            };
            document.getElementById('tutorial-inline-no').onclick = () => {
                modal.classList.remove('active');
                window.dispatchEvent(new Event('match3:enter-exploration'));
            };
        } else {
            modal.classList.remove('active');
            window.dispatchEvent(new Event('match3:enter-exploration'));
        }
    };
    
    document.getElementById('skip-class').onclick = () => {
        // Même sans classe, le joueur doit disposer d'une arme pour se défendre
        grantStartingWeapon(DEFAULT_STARTING_WEAPON_ID);
        saveUpdate();
        modal.classList.remove('active');
        window.dispatchEvent(new Event('match3:enter-exploration'));
    };
    
    modal.classList.add('active');
}

// Attendre que le DOM soit prêt
function init() {
    console.log('Initializing game...');
    const boardElement = document.getElementById('board');
    console.log('Board element:', boardElement);
    
    // ── Phases du jeu : exploration (carte isométrique) ⇄ combat (puzzle) ──────────
    const exploreRoot = document.getElementById('explore-container');
    const exploration = createExplorationView({
        root: exploreRoot,
        canvas: document.getElementById('explore-canvas'),
        getSaved: () => player.exploration,
        setSaved: data => { player.exploration = data; },
        getHero: () => ({ classId: player.class, emoji: playerClasses[player.class]?.emoji || '🧙', name: player.name }),
        getPlayerLevel: () => player.level,
        onEncounter: encounter => startEncounterCombat(encounter),
        onGold: amount => { player.gold = (player.gold || 0) + amount; },
        onSave: () => saveUpdate(),
        onRegionVisited: regionId => {
            if(!player.worldMap) player.worldMap = { currentZoneId: null, visitedZoneIds: [] };
            player.worldMap.currentZoneId = regionId;
            if(!player.worldMap.visitedZoneIds.includes(regionId)) {
                player.worldMap.visitedZoneIds.push(regionId);
            }
        },
        onOpenMap: () => showWorldMap(),
        onOpenMenu: () => window.switchTab('weapons')
    });
    exploration.init();

    const setCombatUiVisible = visible => {
        document.querySelector('.stats-container').style.display = visible ? 'flex' : 'none';
        document.getElementById('board').style.display = visible ? 'grid' : 'none';
        document.getElementById('spells-container').style.display = visible ? 'flex' : 'none';
    };

    const activateCombatTab = () => {
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('tab-combat').classList.add('active');
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
    };

    // Phase exploration : on affiche la carte, plus de plateau ni de bouton de combat.
    const enterExploration = () => {
        document.getElementById('worldmap-modal')?.classList.remove('active');
        document.getElementById('battle-result-screen')?.classList.remove('active');
        setCombatUiVisible(false);
        const newCombatBtn = document.getElementById('new-combat-btn');
        if(newCombatBtn) newCombatBtn.style.display = 'none';
        const abandonBtn = document.getElementById('abandon-combat-btn');
        if(abandonBtn) abandonBtn.style.display = 'none';
        const tabs = document.querySelector('.tabs');
        if(tabs) tabs.style.display = 'flex';
        activateCombatTab();
        exploration.show();
    };

    // Phase combat : lancée par une rencontre sur la carte (l'ennemi vient du décor de la zone).
    const startEncounterCombat = encounter => {
        playSfx('uiClick');
        exploration.hide();
        activateCombatTab();
        setCombatUiVisible(true);
        startNewCombat(createMapEnemy(encounter));
        generateBoard();
        renderBoard();
        updateStats();
    };

    combatHooks.onVictory = () => exploration.onCombatVictory();
    combatHooks.onEnd = isVictory => exploration.onCombatEnd(isVictory);
    window.addEventListener('match3:enter-exploration', enterExploration);
    // Tout combat (y compris le tutoriel) masque la carte.
    window.addEventListener('match3:combat-start', () => exploration.hide());

    // Carte du monde : vue d'ensemble des régions, téléportation vers celles déjà découvertes.
    const showWorldMap = () => {
        playSfx('uiClick');
        const modal = document.getElementById('worldmap-modal');
        const container = document.getElementById('worldmap-selection');
        if(!modal || !container) return;
        mountWorldMap(container, worldZones, {
            level: player.level,
            visitedIds: player.worldMap?.visitedZoneIds || [],
            currentId: exploration.getCurrentRegion(),
            heroUri: spriteUri(heroSprite(player.class)),
            requireVisit: true
        }, zone => {
            modal.classList.remove('active');
            const screenId = REGION_ENTRY_SCREEN[zone.id];
            if(screenId) exploration.teleportToScreen(screenId);
        });
        modal.classList.add('active');
    };
    document.getElementById('worldmap-close-btn')?.addEventListener('click', () => {
        document.getElementById('worldmap-modal')?.classList.remove('active');
    });

    // Après un combat : le bouton ramène sur la carte d'exploration.
    document.getElementById('new-combat-btn').addEventListener('click',()=>{
        primeAudioFromGesture();
        enterExploration();
    });

    // Menu Options / Pause (son, volume, mode nuit)
    const optionsModal = document.getElementById('options-modal');
    document.getElementById('options-btn')?.addEventListener('click', () => {
        primeAudioFromGesture();
        playSfx('uiClick');
        optionsModal?.classList.add('active');
    });
    document.getElementById('options-close-btn')?.addEventListener('click', () => optionsModal?.classList.remove('active'));
    optionsModal?.addEventListener('click', e => { if(e.target === optionsModal) optionsModal.classList.remove('active'); });

    const soundToggleButton = document.getElementById('sound-toggle-btn');
    initializeAudioUI(soundToggleButton);

    const darkModeToggleButton = document.getElementById('dark-mode-toggle-btn');
    initializeThemeUI(darkModeToggleButton);

    // Initialiser l'UI du tutoriel
    initTutorialUI();

    // Rendre startTutorial accessible globalement (pour bouton HTML inline)
    window.startTutorial = startTutorial;

    // Garde-fou : une sauvegarde existante (créée avant cette règle) peut avoir
    // une classe déjà choisie mais aucune arme équipée. On corrige silencieusement.
    if(player.class) {
        grantStartingWeapon(playerClasses[player.class]?.startingWeaponId || DEFAULT_STARTING_WEAPON_ID);
    }

    // Ne pas créer d'ennemi ni de board au démarrage
    // Juste initialiser les sorts et armes disponibles
    updateAvailableSpells();
    updateAvailableWeapons();
    createSpellButtons();
    createWeaponButton();
    updatePlayerStatsTab();
    updateInventoryTab();
    
    // Au démarrage : plus de plateau, pas de bouton « Retour à l'exploration » ni « Abandonner »
    // (la phase d'exploration est l'état par défaut du jeu).
    setCombatUiVisible(false);
    // Afficher la sélection de classe si nécessaire ; sinon on reprend l'exploration là où on l'avait laissée.
    // Écran de démarrage (portrait animé) avant la sélection de classe / la reprise ; ignoré par les navigateurs
    // pilotés par des tests automatisés (sauf ?title=1).
    const skipTitle = navigator.webdriver && !/[?&]title=1/.test(location.search);
    (skipTitle ? Promise.resolve() : playTitleScreen()).then(() => {
        showClassSelection();
        if(player.class) {
            enterExploration();
        }
    });
    
    // Rendre la fonction clearSaveData accessible globalement pour le bouton
    window.clearPlayerSave = clearSaveData;
}

// Les modules script sont automatiquement en defer, donc le DOM est déjà chargé
// Mais on vérifie quand même
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

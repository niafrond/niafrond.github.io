import { icon } from "./icons.js";
import { generateBoard, renderBoard } from "./board.js";
import { updateStats, createSpellButtons, newEnemy, restartCombat, updateAvailableSpells, updatePlayerStatsTab, createWeaponButton, updateAvailableWeapons, player, saveUpdate, log, clearSaveData, startNewCombat, updateInventoryTab, grantStartingWeapon, grantChestLoot, combatHooks, getCombatMusicScene, getCombatMusicOptions, grantExplorationXP, showAttributeMenu } from "./game.js";
import { rollChestLoot } from "./chestLoot.js";
import { getAllClasses, playerClasses, DEFAULT_STARTING_WEAPON_ID } from "./classes.js";
import { createMapEnemy } from "./enemies.js";
import { playTitleScreen, playPrologueAnimation } from "./cinematics.js";
import { COMBAT_INTRO_MS, initializeAudioUI, playSfx, primeAudioFromGesture, getSharedAudioContext, getMusicVolume, isMusicMuted } from "./sound.js";
import { setMusicEnvironment, setMusicScene, stopMusic } from "./music.js";
import { proposeTutorial, initTutorialUI, startTutorial, hasTutorialBeenCompleted } from "./tutorial.js";
import { getMatch3BuildDate, getMatch3Version } from "./version.js";
import { rechargeReusableItems } from "./items.js";
import { renderMerchant } from "./shop.js";
import { exportSaveToFile, importSaveFromFile, downloadSaveFile } from "./saveManager.js";
import { worldZones } from "./worldMap.js";
import { mountWorldMap } from "./worldMapView.js";
import { createExplorationView } from "./explorationView.js";
import { REGION_ENTRY_SCREEN } from "./story.js";
import { ARENA_MIN_LEVEL, ARENA_NAME, ARENA_REGION, isArenaUnlocked } from "./arena.js";
import { heroSprite, spriteUri, loadSpritePack, CORE_PACK } from "./sprites/index.js";
import { hideLoadingScreen } from "./loader.js";

// initialisation de la partie
console.log('Main.js loaded');

const THEME_STORAGE_KEY = 'match3Theme';

function setThemeMode(isDarkMode, toggleButton){
    document.body.classList.toggle('dark-mode', isDarkMode);
    if(toggleButton){
        toggleButton.innerHTML = icon(isDarkMode ? 'sun' : 'moon');
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
            <div class="class-emoji">${heroSprite(cls.id) ? `<img alt="" src="${spriteUri(heroSprite(cls.id))}">` : icon(cls.icon)}</div>
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
            log('Veuillez sélectionner une classe');
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
        log(`${player.name}, vous êtes maintenant ${classData.name} !`);
        // Le joueur ne doit jamais commencer un combat sans arme équipée
        grantStartingWeapon(classData.startingWeaponId || DEFAULT_STARTING_WEAPON_ID);
        updateAvailableSpells();
        saveUpdate();

        // Nouvelle partie : pas de question, le tutoriel est le duel contre Fengmeng.
        modal.classList.remove('active');
        window.dispatchEvent(new Event('match3:start-tutorial-duel'));
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
        getHero: () => ({ classId: player.class, name: player.name }),
        getPlayerLevel: () => player.level,
        onEncounter: encounter => startEncounterCombat(encounter),
        onGold: amount => { player.gold = (player.gold || 0) + amount; },
        onChestLoot: ev => grantChestLoot(rollChestLoot(ev.chest, ev.screen, player)),
        onXp: amount => {
            const res = grantExplorationXP(amount);
            if(res.leveledUp) {
                exploration.toast(`Niveau ${res.newLevel} !`, 4000);
                showAttributeMenu();   // écran de choix de l'attribut à améliorer, comme après un combat
            }
        },
        onSave: () => saveUpdate(),
        onRegionVisited: regionId => {
            if(regionId === ARENA_REGION) return;   // l'arène n'est pas une région de la carte du monde
            if(!player.worldMap) player.worldMap = { currentZoneId: null, visitedZoneIds: [] };
            player.worldMap.currentZoneId = regionId;
            if(!player.worldMap.visitedZoneIds.includes(regionId)) {
                player.worldMap.visitedZoneIds.push(regionId);
            }
        },
        onOpenMap: () => showWorldMap(),
        onOpenArena: () => openArena(),
        onOpenMenu: () => window.switchTab('weapons'),
        renderMerchant
    });
    exploration.init();

    // Musique d'ambiance (pentatonique chinoise, music.js) : la scène voulue se déduit de l'état de l'interface.
    setMusicEnvironment({ getContext: getSharedAudioContext, getVolume: getMusicVolume, isMuted: isMusicMuted });
    let combatIntroUntil = 0;
    window.addEventListener('match3:combat-start', () => { combatIntroUntil = Date.now() + COMBAT_INTRO_MS; });
    const desiredMusic = () => {
        if(document.querySelector('.cine-ending')) return ['ending'];
        if(document.querySelector('.title-screen, .cine-overlay')) return ['title'];
        if(document.querySelector('.battle-transition')) return null;
        // Combat : musique générée « combat » / « boss » ; l'écran de résultat repasse sur la musique de menu.
        const fight = getCombatMusicScene();
        if(fight) return Date.now() < combatIntroUntil ? null : [fight, getCombatMusicOptions()];   // jingle d'entrée d'abord, puis la musique
        if(document.getElementById('battle-result-screen')?.classList.contains('active')) return ['menu'];
        if(document.getElementById('class-modal')?.classList.contains('active')) return ['title'];
        const tab = document.querySelector('.tab-panel.active')?.id;
        if(tab && tab !== 'tab-combat') return ['menu'];
        if(document.getElementById('worldmap-modal')?.classList.contains('active') || document.querySelector('.explore-journal')) return ['menu'];
        const info = exploration.getSceneInfo();
        if(!info) return null;
        if(info.kind === 'house') return ['house'];
        if(info.kind === 'village' || info.kind === 'wild') return [info.kind, { biome: info.biome }];
        return [info.region === 'lune' ? 'moon' : 'sanctuary'];
    };
    let musicStopped = true;
    const syncMusic = () => {
        const want = desiredMusic();
        if(!want) { if(!musicStopped) { stopMusic({ fadeMs: 700 }); musicStopped = true; } return; }
        musicStopped = false;
        setMusicScene(want[0], want[1]);
    };
    setInterval(syncMusic, 400);
    // Les navigateurs interdisent tout son avant un geste de l'utilisateur : le premier appui (en pratique « Toucher
    // pour commencer » de l'écran-titre) débloque le contexte audio, et la musique démarre aussitôt. On garde
    // l'écoute (capture) pour reprendre un contexte suspendu plus tard (retour d'onglet, iOS).
    const unlockAudio = () => { primeAudioFromGesture(); syncMusic(); };
    ['pointerdown', 'touchstart', 'keydown'].forEach(type => document.addEventListener(type, unlockAudio, { capture: true, passive: true }));

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
        const recharged = rechargeReusableItems(player);
        if(recharged.length) { log(`Rechargé : ${recharged.map(i => i.name).join(', ')}.`); saveUpdate(); }
        exploration.show();
    };

    // Phase combat : lancée par une rencontre sur la carte (l'ennemi vient du décor de la zone).
    const startEncounterCombat = encounter => {
        playSfx('uiClick');
        exploration.hide();
        activateCombatTab();
        setCombatUiVisible(true);
        if(encounter.tutorial) {
            // Duel d'entraînement contre Fengmeng : combat guidé pas à pas (voir tutorial.js)
            startTutorial({ enemy: createMapEnemy(encounter) });
            return;
        }
        startNewCombat(createMapEnemy(encounter));
        generateBoard();
        renderBoard();
        updateStats();
    };

    // ── Arène des Mille Flèches (arena.js) : un lieu à explorer (parvis, salles, maîtres d'arène) ──────────
    // Le bouton « Arène » du HUD y entre (dès le niveau 15) ; dans l'arène, il devient « Sortir » et en fait sortir à tout moment.
    const openArena = () => {
        if(exploration.inArena()) { playSfx('uiClick'); exploration.leaveArena(); return; }
        if(!isArenaUnlocked(player.level)) {
            exploration.toast(`L'${ARENA_NAME} ouvre ses portes au niveau ${ARENA_MIN_LEVEL} (vous êtes niveau ${player.level}).`, 4500);
            return;
        }
        playSfx('uiClick');
        exploration.enterArena();
    };

    combatHooks.onVictory = () => exploration.onCombatVictory();
    combatHooks.onEnd = isVictory => exploration.onCombatEnd(isVictory);
    window.addEventListener('match3:enter-exploration', enterExploration);
    // Nouvelle partie, classe choisie : on enchaîne directement sur le duel-tutoriel contre Fengmeng.
    window.addEventListener('match3:start-tutorial-duel', () => {
        enterExploration();
        exploration.startTutorialDuel('fengmeng_1');
    });
    // Tout combat (y compris le tutoriel) masque la carte.
    window.addEventListener('match3:combat-start', () => {
        exploration.hide();
    });

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
        // Voyage rapide : pierres de voyage activées, groupées par région.
        const stones = exploration.getTravelList();
        if(stones.length) {
            const panel = document.createElement('div');
            panel.className = 'worldmap-travel';
            panel.innerHTML = `<h4>${icon('stone')} Voyage rapide</h4>`;
            const zoneName = Object.fromEntries(worldZones.map(z => [z.id, z.shortName]));
            stones.forEach(w => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'worldmap-travel-btn';
                btn.textContent = `${zoneName[w.region] || w.region} · ${w.screenName}`;
                btn.disabled = w.current;
                btn.addEventListener('click', () => {
                    modal.classList.remove('active');
                    exploration.travelTo(w.screenId);
                });
                panel.appendChild(btn);
            });
            container.appendChild(panel);
        }
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

    // Sauvegarde dans un fichier : permet de reprendre la partie sur un autre appareil.
    document.getElementById('save-export-btn')?.addEventListener('click', () => {
        const res = exportSaveToFile(player, getMatch3Version());
        if(res.success) { downloadSaveFile(res.blob, res.filename); log(res.message); }
        else alert(res.message);
    });
    const saveImportInput = document.getElementById('save-import-input');
    document.getElementById('save-import-btn')?.addEventListener('click', () => saveImportInput?.click());
    saveImportInput?.addEventListener('change', async () => {
        const file = saveImportInput.files[0];
        saveImportInput.value = '';
        if(!file) return;
        const res = await importSaveFromFile(file);
        if(!res.success) { alert(res.message); return; }
        if(!confirm(`${res.message}\nCette sauvegarde remplacera la partie en cours. Continuer ?`)) return;
        localStorage.setItem('player', JSON.stringify(res.player));
        location.reload();
    });

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
    // Écran de chargement initial (index.html) : on ne charge que les dessins communs (héros, coffres) et ceux de la
    // région où reprend la partie ; les autres régions sont chargées en y entrant.
    const bootReady = Promise.all([loadSpritePack(CORE_PACK), exploration.ready()])
        .catch(err => console.warn('[boot] chargement initial incomplet', err))
        .then(() => hideLoadingScreen());
    // Nouvelle partie (aucune classe choisie) : prologue animé, puis choix de la classe et tutoriel.
    bootReady.then(() => (skipTitle ? undefined : playTitleScreen()))
        .then(() => (!skipTitle && !player.class ? playPrologueAnimation() : undefined))
        .then(() => {
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

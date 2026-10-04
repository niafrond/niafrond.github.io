import { generateBoard, renderBoard } from "./board.js";
import { updateStats, createSpellButtons, newEnemy, restartCombat, updateAvailableSpells, updatePlayerStatsTab, createWeaponButton, updateAvailableWeapons, player, saveUpdate, log, clearSaveData, startNewCombat, updateInventoryTab, grantStartingWeapon, combatHooks, getCombatMusicScene } from "./game.js";
import { getAllClasses, playerClasses, DEFAULT_STARTING_WEAPON_ID } from "./classes.js";
import { createMapEnemy } from "./enemies.js";
import { addXP } from "./experience.js";
import { playTitleScreen, playPrologueAnimation } from "./cinematics.js";
import { COMBAT_INTRO_MS, initializeAudioUI, playSfx, primeAudioFromGesture, getSharedAudioContext, getMusicVolume, isMusicMuted } from "./sound.js";
import { setMusicEnvironment, setMusicScene, stopMusic } from "./music.js";
import { proposeTutorial, initTutorialUI, startTutorial, hasTutorialBeenCompleted } from "./tutorial.js";
import { getMatch3BuildDate } from "./version.js";
import { worldZones } from "./worldMap.js";
import { mountWorldMap } from "./worldMapView.js";
import { createExplorationView } from "./explorationView.js";
import { REGION_ENTRY_SCREEN } from "./story.js";
import { ARENA_MIN_LEVEL, ARENA_NAME, ARENA_TIERS, arenaTier, isArenaUnlocked, isTierUnlocked, normalizeArenaStats, arenaEncounter, arenaWaveLevel, isChampionWave, recordArenaWave } from "./arena.js";
import { heroSprite, spriteUri, loadSpritePack, CORE_PACK } from "./sprites/index.js";
import { hideLoadingScreen } from "./loader.js";

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
        getHero: () => ({ classId: player.class, emoji: playerClasses[player.class]?.emoji || '🧙', name: player.name }),
        getPlayerLevel: () => player.level,
        onEncounter: encounter => startEncounterCombat(encounter),
        onGold: amount => { player.gold = (player.gold || 0) + amount; },
        onXp: amount => {
            const res = addXP(player, amount);
            if(res.leveledUp) exploration.toast(`⭐ Niveau ${res.newLevel} !`, 4000);
        },
        onSave: () => saveUpdate(),
        onRegionVisited: regionId => {
            if(!player.worldMap) player.worldMap = { currentZoneId: null, visitedZoneIds: [] };
            player.worldMap.currentZoneId = regionId;
            if(!player.worldMap.visitedZoneIds.includes(regionId)) {
                player.worldMap.visitedZoneIds.push(regionId);
            }
        },
        onOpenMap: () => showWorldMap(),
        onOpenArena: () => openArena(),
        onOpenMenu: () => window.switchTab('weapons')
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
        if(fight) return Date.now() < combatIntroUntil ? null : [fight];   // jingle d'entrée d'abord, puis la musique
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

    // ── Arène des Mille Flèches (arena.js) : huit cercles, vagues enchaînées depuis l'écran de résultat ─────
    let arenaRun = null;   // { tier, wave } pendant une série de vagues
    const arenaStats = () => normalizeArenaStats(player.arena);
    const startArenaWave = (tierId, wave) => {
        arenaRun = { tier: tierId, wave };
        startEncounterCombat(arenaEncounter(tierId, wave, player.level));
    };
    const arenaTierCard = (tier, stats) => {
        const unlocked = isTierUnlocked(stats, tier.id);
        const cleared = stats.cleared.includes(tier.id);
        const best = stats.best[tier.id] || 0;
        const prev = arenaTier(tier.id - 1);
        const status = cleared ? '✅ Terminé' : unlocked ? (best ? `Record : vague ${best}/${tier.waves}` : 'Ouvert') : `🔒 Terminez le ${prev.name}`;
        return `<div class="arena-tier${unlocked ? '' : ' locked'}${cleared ? ' cleared' : ''}">
            <div class="arena-tier-head"><strong>${tier.emoji} ${tier.id}. ${tier.name}</strong><span>${status}</span></div>
            <p>${tier.desc}</p>
            <p class="arena-tier-meta">${tier.waves} vagues · adversaires niv. ${arenaWaveLevel(tier.id, 1, player.level)} → ${arenaWaveLevel(tier.id, tier.waves, player.level)}${tier.statMult > 1 ? ` · renfort ×${tier.statMult}` : ''}${cleared ? '' : ` · 1er passage : +${tier.clearGold} or, +${tier.clearXp} XP`}</p>
            ${unlocked ? `<button type="button" class="primary arena-enter-btn" data-tier="${tier.id}">⚔️ Entrer</button>` : ''}
        </div>`;
    };
    const openArena = () => {
        if(!isArenaUnlocked(player.level)) {
            exploration.toast(`🔒 L'${ARENA_NAME} ouvre ses portes au niveau ${ARENA_MIN_LEVEL} (vous êtes niveau ${player.level}).`, 4500);
            return;
        }
        playSfx('uiClick');
        const stats = arenaStats();
        let modal = document.getElementById('arena-modal');
        if(!modal) {
            modal = document.createElement('div');
            modal.id = 'arena-modal';
            modal.className = 'modal';
            modal.addEventListener('click', e => { if(e.target === modal) modal.classList.remove('active'); });
            document.body.appendChild(modal);
        }
        modal.innerHTML = `<div class="modal-content arena-modal">
            <h2>🏟️ ${ARENA_NAME}</h2>
            <p>Huit cercles de plus en plus durs : chacun s'ouvre quand le précédent a été terminé au moins une fois. Un cercle est une série de vagues dont la dernière est son champion. Chaque victoire rapporte XP, or et butin, plus une prime d'arène ; vos PV sont restaurés entre deux vagues. Une défaite clôt la série, sans autre pénalité.</p>
            <p class="arena-record">🏆 ${stats.cleared.length}/${ARENA_TIERS.length} cercles terminés · ⚔️ ${stats.wins} victoire${stats.wins > 1 ? 's' : ''} · ${stats.runs} série${stats.runs > 1 ? 's' : ''}</p>
            <div class="arena-tiers">${ARENA_TIERS.map(t => arenaTierCard(t, stats)).join('')}</div>
            <div class="modal-actions"><button class="secondary" id="arena-close-btn">Fermer</button></div>
        </div>`;
        modal.querySelectorAll('.arena-enter-btn').forEach(btn => {
            btn.onclick = () => {
                const tierId = Number(btn.dataset.tier);
                if(!isTierUnlocked(arenaStats(), tierId)) return;
                primeAudioFromGesture();
                modal.classList.remove('active');
                player.arena = { ...arenaStats(), runs: arenaStats().runs + 1 };
                startArenaWave(tierId, 1);
            };
        });
        modal.querySelector('#arena-close-btn').onclick = () => modal.classList.remove('active');
        modal.classList.add('active');
    };
    // Fin d'une vague : record, puis vague suivante, cercle terminé (et suivant débloqué) ou fin de la série.
    const onArenaCombatEnd = isVictory => {
        if(!arenaRun) return;
        const { tier: tierId, wave } = arenaRun;
        const tier = arenaTier(tierId);
        const { stats, firstClear } = recordArenaWave(player.arena, tierId, wave, isVictory);
        player.arena = stats;
        const box = document.createElement('div');
        box.className = 'arena-result';
        if(isVictory && wave < tier.waves) {
            const next = wave + 1;
            box.innerHTML = `<p>${tier.emoji} ${tier.name} : vague ${wave}/${tier.waves} remportée !</p>
                <p>Ensuite : ${isChampionWave(tierId, next) ? '🏆 le champion du cercle' : `vague ${next}/${tier.waves}`}, niveau ${arenaWaveLevel(tierId, next, player.level)}.</p>
                <button type="button" class="primary arena-next-btn">⚔️ ${isChampionWave(tierId, next) ? 'Affronter le champion' : `Vague ${next}`}</button>`;
            box.querySelector('.arena-next-btn').onclick = () => {
                primeAudioFromGesture();
                startArenaWave(tierId, next);
            };
        } else if(isVictory) {
            arenaRun = null;
            const nextTier = arenaTier(tierId + 1);
            box.innerHTML = `<p>🏆 ${tier.name} terminé${firstClear ? ' pour la première fois' : ''} !</p>
                <p>${nextTier ? (firstClear ? `🔓 Nouveau cercle débloqué : ${nextTier.emoji} ${nextTier.name}.` : `Le ${nextTier.name} vous attend.`) : "Vous avez vaincu le dernier cercle : l'arène s'incline devant vous."}</p>`;
        } else {
            arenaRun = null;
            box.innerHTML = `<p>${tier.emoji} Vous tombez à la vague ${wave}/${tier.waves} du ${tier.name}. Renforcez-vous (boutique, sorts, armes) et revenez quand vous voulez.</p>`;
        }
        document.getElementById('battle-result-summary')?.appendChild(box);
        saveUpdate();
    };

    combatHooks.onVictory = () => exploration.onCombatVictory();
    combatHooks.onEnd = isVictory => {
        exploration.onCombatEnd(isVictory);
        onArenaCombatEnd(isVictory);
    };
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
            panel.innerHTML = '<h4>🌀 Voyage rapide</h4>';
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
        arenaRun = null;   // quitter l'arène
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

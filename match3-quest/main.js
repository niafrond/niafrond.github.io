import { generateBoard, renderBoard } from "./board.js";
import { updateStats, createSpellButtons, newEnemy, restartCombat, updateAvailableSpells, updatePlayerStatsTab, createWeaponButton, updateAvailableWeapons, player, saveUpdate, log, clearSaveData, startNewCombat, updateInventoryTab } from "./game.js";
import { getAllClasses, playerClasses } from "./classes.js";
import { getRandomPlayerName } from "./playerNames.js";
import { createBossEnemyForTier, generateEnemyChoices } from "./enemies.js";
import { calculateXPGain } from "./experience.js";
import { initializeAudioUI, playSfx, primeAudioFromGesture } from "./sound.js";
import { proposeTutorial, initTutorialUI, startTutorial, hasTutorialBeenCompleted } from "./tutorial.js";
import { getMatch3BuildDate } from "./version.js";

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

function getBossTierForLevel(level) {
    const safeLevel = Math.max(1, Math.floor(level || 1));
    if(safeLevel < 5 || safeLevel % 5 !== 0) return null;
    return safeLevel;
}

function ensurePendingBossForSelection() {
    if(player.pendingBoss?.enemy) {
        return player.pendingBoss.enemy;
    }

    const tier = getBossTierForLevel(player.level);
    if(!tier) return null;

    const defeatedTiers = Array.isArray(player.defeatedBossTiers) ? player.defeatedBossTiers : [];
    if(defeatedTiers.includes(tier)) return null;

    const bossEnemy = createBossEnemyForTier(tier);
    player.pendingBoss = {
        tier,
        enemy: bossEnemy
    };
    saveUpdate();
    log(`👑 Un boss vous attend au palier ${tier} ! Il restera proposé jusqu'à sa défaite.`);
    return bossEnemy;
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
        player.name = getRandomPlayerName(selectedClass);
        const classData = playerClasses[selectedClass];
        // Appliquer les stats de départ de la classe
        Object.keys(classData.startingStats).forEach(attr => {
            player.attributes[attr] += classData.startingStats[attr];
        });
        log(`✨ ${player.name}, vous êtes maintenant ${classData.emoji} ${classData.name} !`);
        updateAvailableSpells();
        saveUpdate();

        if(!hasTutorialBeenCompleted()) {
            // Proposer le tutoriel en ligne dans la même modal
            container.innerHTML = `
                <div style="text-align:center; padding: 16px 0 8px;">
                    <div style="font-size:3rem; margin-bottom:10px;">📚</div>
                    <h3 style="margin:0 0 8px;">Voulez-vous lancer le tutoriel ?</h3>
                    <p style="color:#666; font-size:0.88rem; margin:0 0 20px;">
                        Il vous guidera pas à pas : déplacer des tuiles, faire des matchs de crânes,<br>générer du mana et lancer un sort.
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
            };
        } else {
            modal.classList.remove('active');
        }
    };
    
    document.getElementById('skip-class').onclick = () => {
        modal.classList.remove('active');
    };
    
    modal.classList.add('active');
}

// Attendre que le DOM soit prêt
function init() {
    console.log('Initializing game...');
    const boardElement = document.getElementById('board');
    console.log('Board element:', boardElement);
    
    const showEnemySelection = () => {
        playSfx('uiClick');
        const modal = document.getElementById('enemy-modal');
        const container = document.getElementById('enemy-selection');
        const rerollBtn = document.getElementById('reroll-enemies-btn');
        if(!modal || !container || !rerollBtn) {
            // fallback sans modal
            startNewCombat();
            generateBoard();
            renderBoard();
            updateStats();
            return;
        }

        const renderChoices = () => {
            const enemies = generateEnemyChoices(player.level, 4, undefined, player.maxHp);
            const pendingBoss = ensurePendingBossForSelection();
            if(pendingBoss) {
                enemies.unshift({ ...pendingBoss });
            }
            const grid = document.createElement('div');
            grid.className = 'enemy-grid';

            enemies.forEach(enemyChoice => {
                const card = document.createElement('div');
                card.className = `enemy-card${enemyChoice.isOverleveledChoice ? ' danger' : ''}${enemyChoice.isEasyChoice ? ' easy' : ''}${enemyChoice.isBoss ? ' boss' : ''}`;
                const xpGain = calculateXPGain(enemyChoice, player.level);

                card.innerHTML = `
                    <div class="enemy-name">${enemyChoice.raceEmoji} ${enemyChoice.name}</div>
                    <div class="enemy-meta">Niveau ${enemyChoice.level} • HP ${enemyChoice.maxHp} • Atk ${enemyChoice.attack} • Def ${enemyChoice.defense || 0}</div>
                    <div class="enemy-xp">XP estimée: ${xpGain}</div>
                    ${enemyChoice.isBoss ? `<div class="enemy-warning">👑 Boss de palier ${enemyChoice.bossTier}</div>` : ''}
                    ${enemyChoice.isOverleveledChoice ? '<div class="enemy-warning">⚠️ Ennemi trop fort (+6 niveaux)</div>' : ''}
                    ${enemyChoice.isEasyChoice ? '<div class="enemy-easy">⬇️ Ennemi affaibli (facile)</div>' : ''}
                `;

                card.onclick = () => {
                    modal.classList.remove('active');

                    // Basculer vers l'onglet combat
                    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
                    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                    document.getElementById('tab-combat').classList.add('active');
                    document.querySelectorAll('.tab-btn')[0].classList.add('active');

                    // Afficher les éléments de combat
                    document.querySelector('.stats-container').style.display = 'flex';
                    document.getElementById('board').style.display = 'grid';
                    document.getElementById('spells-container').style.display = 'flex';

                    startNewCombat(enemyChoice);
                    generateBoard();
                    renderBoard();
                    updateStats();
                };

                grid.appendChild(card);
            });

            container.innerHTML = '';
            container.appendChild(grid);
        };

        rerollBtn.onclick = () => renderChoices();
        renderChoices();
        modal.classList.add('active');
    };

    // Gestionnaire du bouton "Nouveau Combat"
    document.getElementById('new-combat-btn').addEventListener('click',()=>{
        primeAudioFromGesture();
        showEnemySelection();
    });

    const soundToggleButton = document.getElementById('sound-toggle-btn');
    initializeAudioUI(soundToggleButton);

    const darkModeToggleButton = document.getElementById('dark-mode-toggle-btn');
    initializeThemeUI(darkModeToggleButton);

    // Initialiser l'UI du tutoriel
    initTutorialUI();

    // Rendre startTutorial accessible globalement (pour bouton HTML inline)
    window.startTutorial = startTutorial;

    // Ne pas créer d'ennemi ni de board au démarrage
    // Juste initialiser les sorts et armes disponibles
    updateAvailableSpells();
    updateAvailableWeapons();
    createSpellButtons();
    createWeaponButton();
    updatePlayerStatsTab();
    updateInventoryTab();
    
    // Cacher les éléments de combat au démarrage
    document.querySelector('.stats-container').style.display = 'none';
    document.getElementById('board').style.display = 'none';
    document.getElementById('spells-container').style.display = 'none';
    
    // Au démarrage, afficher le bouton "Nouveau Combat" et cacher le bouton "Abandonner"
    const newCombatBtn = document.getElementById('new-combat-btn');
    if(newCombatBtn) {
        newCombatBtn.style.display = 'block';
    }
    
    const abandonBtn = document.getElementById('abandon-combat-btn');
    if(abandonBtn) {
        abandonBtn.style.display = 'none';
    }
    
    // Afficher les onglets au démarrage
    const tabs = document.querySelector('.tabs');
    if(tabs) {
        tabs.style.display = 'flex';
    }
    
    // Afficher la sélection de classe si nécessaire
    showClassSelection();
    
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

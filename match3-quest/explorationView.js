// Phase d'exploration : carte plein écran en vue du dessus (canvas), saisie clavier / pavé
// tactile, dialogues de PNJ, journal de quêtes. La logique est dans exploration.js, les données
// (cartes, histoire) dans story.js.
//
// Déplacement : un clic / toucher sur la carte envoie le héros à l'endroit visé par le plus court
// chemin (recalculé à chaque pas, sans chercher à éviter les ennemis). Cliquer sur un PNJ, un
// coffre ou un ennemi y mène et déclenche l'interaction. Le clavier (↑ ↓ ← → / ZQSD) reste disponible.
// Repère : x vers la droite, y vers le bas.
// L'écran de carte est affiché en entier (taille de tuile adaptée) ; si la fenêtre est trop
// petite pour garder des tuiles lisibles, la caméra suit le héros.
// Mémoire : seuls les dessins de la région courante sont chargés et décodés (prepareRegion). En changeant de
// région, la carte se fige (saisies bloquées) le temps de charger les nouveaux paquets de sprites, derrière un
// écran de chargement si cela dure ; les images de l'ancienne région sont libérées.

import { STORY_TITLE, REGION_UNLOCK_LEVEL } from './story.js';
import * as X from './exploration.js';
import { worldZones } from './worldMap.js';
import { playSfx } from './sound.js';
import { playEndingAnimation, playSunFallAnimation, playRegionDiscovery, playBossDialogue, prologueAnimationPlayed } from './cinematics.js';
import { spriteImage, spriteUri, heroSprite, npcSprite, chestSprite, enemySprite, loadSpritePack, packsForKeys, decodeSprites, retainSprites } from './sprites/index.js';
import { viewSprite, viewDir, HERO_VIEW_OPTS } from './sprites/side.js';
import { withLoadingScreen, trackProgress } from './loader.js';
import { ARENA_BIOMES, ARENA_REGION, ARENA_NAME, arenaTier, isArenaUnlocked } from './arena.js';
import { decorSprite, DECOR_NAMES } from './sprites/decor.js';
import { icon } from './icons.js';

const MIN_TILE = 44;    // en dessous, la carte défile avec le héros au lieu de rétrécir
const MAX_TILE = 96;
const HUD_TOP = 64;     // bandeau du haut (titre, objectif, boutons)
const HUD_BOTTOM = 8;
const MOVE_DELAY_MS = 150;
const MOUNTED_MOVE_DELAY_MS = 75;   // à cheval : deux fois plus vite
const BATTLE_TRANSITION_MS = 1700;   // durée de l'animation d'entrée en combat
const BATTLE_STRIPS = 10;

const DIRECTIONS = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
};

const KEY_TO_DIR = {
    ArrowUp: 'up', w: 'up', z: 'up', W: 'up', Z: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', q: 'left', A: 'left', Q: 'left',
    ArrowRight: 'right', d: 'right', D: 'right'
};

// Palette de chaque biome : sol (damier), chemin, falaise, liquide, ciel, décors des obstacles.
// Les 10 biomes de la légende de Hou Yi (voir UNIVERS.md §6).
const BIOMES = {
    paddy: { a: '#a8d672', b: '#9ecb68', path: '#e6d29a', cliff: '#8a6a3a', liquid: '#6ab7c9', sky: ['#bfe3f5', '#f4f9e8'], decor: ['rice', 'lantern', 'hut'] },
    riverbed: { a: '#c9a46b', b: '#c09b62', path: '#d9bd8a', cliff: '#7a5a35', liquid: '#7d6b4a', sky: ['#e3b878', '#f7e6c6'], decor: ['rock', 'rice', 'rock'] },
    bamboo: { a: '#8a9684', b: '#808c7a', path: '#b8b09a', cliff: '#4a4f46', liquid: '#4f5f5a', sky: ['#9aa59a', '#d8dbd0'], decor: ['bamboo', 'campfire', 'bamboo'] },
    gobi: { a: '#efdfb2', b: '#e8d6a4', path: '#f7ecc8', cliff: '#bf9c58', liquid: '#78c0c8', sky: ['#f8d98a', '#fff6dc'], decor: ['cactus', 'rock', 'cactus'] },
    storm: { a: '#7d7690', b: '#746d88', path: '#a39cb8', cliff: '#3f3a54', liquid: '#4a5fa8', sky: ['#3b3558', '#7a73a0'], decor: ['mountain', 'storm', 'mountain'] },
    volcano: { a: '#3b3438', b: '#352e32', path: '#5a4a48', cliff: '#1d1719', liquid: '#ff5a1f', sky: ['#2a1010', '#7a2a14'], decor: ['volcano', 'rock', 'volcano'] },
    savanna: { a: '#d8c06a', b: '#cfb75f', path: '#ead89a', cliff: '#8a6c2e', liquid: '#4a8fb8', sky: ['#f4c26a', '#fde9bd'], decor: ['rice', 'rock', 'rice'] },
    coast: { a: '#e6d7b0', b: '#dccda6', path: '#f0e4c4', cliff: '#8a7650', liquid: '#1d5fa8', sky: ['#7ec4ec', '#e6f5fb'], decor: ['wave', 'rock', 'wave'] },
    fusang: { a: '#f0dc8c', b: '#e8d27e', path: '#fff0b0', cliff: '#b88a2a', liquid: '#e8b830', sky: ['#fde6a6', '#fffbea'], decor: ['tree', 'lantern', 'tree'] },
    house: { a: '#c9a06a', b: '#bd9560', path: '#a8483a', cliff: '#5a3a24', liquid: '#6ab7c9', sky: ['#3a2a20', '#5a4130'], decor: ['chair', 'jar', 'bed', 'books', 'lantern', 'teapot'] },
    moon: { a: '#c9cde8', b: '#bec3e0', path: '#e4e6f4', cliff: '#3a3f78', liquid: '#6f86d8', sky: ['#171a4a', '#3b3f86'], decor: ['moon', 'lantern', 'moon'] },
    ...ARENA_BIOMES   // parvis et salles de l'Arène des Mille Flèches (arena.js)
};

const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.max(0, Math.min(255, v + amt));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};
const hash = (x, y) => Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;

/**
 * @param {object} cfg
 *  root, canvas               éléments du DOM
 *  getSaved()/setSaved(data)  lecture / écriture de player.exploration
 *  getHero()                  { classId, name, mount? } du personnage (mount : 'horse' = déplacements deux fois plus rapides)
 *  getPlayerLevel()           niveau courant
 *  onEncounter(encounter)     lance le combat (encounter.prep : préparation du terrain, voir terrain.js)
 *  getWeakness(templateId)    nom de la faiblesse d'un ennemi (observation), facultatif
 *  onGold(amount)             crédite de l'or
 *  onXp(amount)               crédite de l'expérience (récompenses de quêtes)
 *  onSave()                   sauvegarde la partie (aussi après une Nouvelle Partie +)
 *  onRegionVisited(regionId)  région découverte
 *  onOpenMap()                ouvre la carte du monde
 *  onOpenArena()              ouvre l'Arène des Mille Flèches (arena.js)
 *  onOpenMenu()               ouvre le menu (inventaire, sorts, stats)
 *  renderMerchant(npc, card, { close, ngPlus })  remplit la fenêtre de boutique d'un PNJ marchand (shop.js)
 */
export function createExplorationView(cfg) {
    const { root, canvas } = cfg;
    const ctx = canvas.getContext('2d');
    const els = {
        title: root.querySelector('.explore-title'),
        objective: root.querySelector('.explore-objective'),
        dialog: root.querySelector('.explore-dialog'),
        toast: root.querySelector('.explore-toast'),
        journalBtn: root.querySelector('[data-explore="journal"]'),
        mountBtn: root.querySelector('[data-explore="mount"]'),
        mapBtn: root.querySelector('[data-explore="map"]'),
        arenaBtn: root.querySelector('[data-explore="arena"]'),
        menuBtn: root.querySelector('[data-explore="menu"]')
    };

    let session = null;
    let active = false;
    let rafId = null;
    let lastFrame = 0;
    let held = null;
    let walk = null;          // déplacement au clic en cours : { tx, ty, path }
    let cam = { ox: 0, oy: 0, tile: 1, vw: 0 };
    let lastMoveAt = 0;
    let dialogQueue = [];
    let dialogIndex = 0;
    let toastTimer = null;
    let journalEl = null;
    let merchantEl = null;
    let inCombat = false;
    let battleTransitionEl = null;
    let battleTransitionTimer = null;
    const vis = { px: 0, py: 0, enemies: {}, bob: 0 };
    let preparedRegion = null;   // région dont les dessins sont chargés et décodés
    let preparing = null;        // { region, promise } : chargement en cours

    // ── Session ────────────────────────────────────────────────────────────
    function ensureSession() {
        if (session) return session;
        session = X.createSession(cfg.getSaved());
        cfg.setSaved(session.data);
        session.rt.queuedEvents = [];
        session.rt.pendingEnemyId = null;
        syncVisual(true);
        return session;
    }

    function syncVisual(snap) {
        const st = session.data;
        if (snap) { vis.px = st.x; vis.py = st.y; }
        X.aliveEnemies(session).forEach(e => {
            if (snap || !vis.enemies[e.def.id]) vis.enemies[e.def.id] = { x: e.x, y: e.y };
        });
    }

    // ── Interface ──────────────────────────────────────────────────────────
    function refreshHud() {
        const screen = X.currentScreen(session);
        const plus = session.data.ngPlus > 0 ? ` · NG+${session.data.ngPlus}` : '';
        if (els.title) els.title.textContent = `${screen.name}${plus}`;
        if (els.objective) {
            const tq = X.trackedQuest(session);
            els.objective.textContent = `${tq ? (tq.side ? '[Annexe] ' : '[Principale] ') : ''}${X.currentObjectiveText(session)}`;
        }
        // Dans l'arène, le bouton « Arène » (trophée) devient « Sortir » (porte) : on peut en sortir à tout moment.
        if (els.arenaBtn) {
            const inside = X.inArena(session);
            els.arenaBtn.innerHTML = inside ? `${icon('door')}<span> Sortir</span>` : `${icon('trophy')}<span> Arène</span>`;
            els.arenaBtn.title = inside ? "Quitter l'arène" : 'Arène des Mille Flèches (dès le niveau 15)';
            els.arenaBtn.classList.toggle('arena-exit', inside);
        }
    }

    function toast(message, ms = 3200) {
        if (!els.toast) return;
        els.toast.textContent = message;
        els.toast.classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => els.toast.classList.remove('visible'), ms);
    }

    const isDialogOpen = () => dialogQueue.length > 0;
    // La carte n'est « jouable » que si elle est réellement affichée (onglet Combat actif) et sans modal par-dessus.
    const isOnScreen = () => root.getClientRects().length > 0;
    const isModalOpen = () => Boolean(document.querySelector('.modal.active'))
        || document.getElementById('levelup-modal')?.style.display === 'flex';
    const isRegionReady = () => Boolean(session) && preparedRegion === X.currentScreen(session).region;
    const isBlocked = () => isDialogOpen() || inCombat || Boolean(journalEl) || Boolean(merchantEl) || !isOnScreen() || isModalOpen() || !isRegionReady();

    // ── Ressources de la région ────────────────────────────────────────────
    // PNJ et ennemis d'une région (tous ses écrans), y compris les locuteurs des scènes de victoire.
    function regionEntities(region) {
        const screens = Object.values(session.screens).filter(sc => sc.region === region);
        const npcs = screens.flatMap(sc => sc.npcs).map(n => n.id);
        const enemies = screens.flatMap(sc => sc.enemies).map(e => [e.spriteKey || e.id, e.templateId]);
        screens.flatMap(sc => sc.enemies).forEach(e => {
            [e.defeatScene, ...(e.afterScenes || [])].forEach(scene => {
                const sp = scene?.speaker;
                if (sp?.npc) npcs.push(sp.npc);
                if (sp?.enemy) {
                    const def = session.rt.enemyIndex[sp.enemy]?.def;
                    enemies.push([def?.spriteKey || sp.enemy, def?.templateId]);
                }
            });
        });
        return { npcs, enemies };
    }

    // Dessins d'une région (à appeler une fois ses paquets chargés) : héros, coffres, PNJ, ennemis.
    function regionSprites(region) {
        const { npcs, enemies } = regionEntities(region);
        return [...new Set([
            heroSprite(cfg.getHero().classId), chestSprite(false), chestSprite(true),
            ...DECOR_NAMES.map(decorSprite),
            ...npcs.map(id => npcSprite(id)),
            ...enemies.map(([key, templateId]) => enemySprite(key, templateId))
        ].filter(Boolean))];
    }

    // Charge les paquets de sprites de la région, libère les images des autres régions et décode les nouvelles.
    function prepareRegion(region) {
        if (preparedRegion === region) return Promise.resolve();
        if (preparing?.region === region) return preparing.promise;
        const { npcs, enemies } = regionEntities(region);
        const packs = packsForKeys({ npcs, enemies });
        const zone = worldZones.find(z => z.id === region);
        const label = zone ? zone.name : region === ARENA_REGION ? ARENA_NAME : 'Chargement…';
        const promise = withLoadingScreen(label, async progress => {
            await trackProgress(packs.map(loadSpritePack), r => progress(r * 0.5));
            const svgs = regionSprites(region);
            retainSprites(svgs);
            await trackProgress(svgs.map(svg => decodeSprites([svg])), r => progress(0.5 + r * 0.5));
        }).catch(err => {
            console.warn('[exploration] chargement des dessins de la région incomplet', err);
        }).then(() => {
            if (preparing?.promise !== promise) return;
            preparing = null;
            preparedRegion = region;
        });
        preparing = { region, promise };
        return promise;
    }

    function renderDialog() {
        const box = els.dialog;
        if (!box) return;
        if (!isDialogOpen()) {
            box.classList.remove('visible');
            box.innerHTML = '';
            return;
        }
        const entry = dialogQueue[0];
        const text = entry.lines[dialogIndex];
        const last = dialogIndex >= entry.lines.length - 1 && dialogQueue.length === 1;
        const speaker = entry.speaker || {};
        box.innerHTML = `
            <div class="explore-dialog-portrait">${speaker.sprite
                ? `<img alt="" src="${spriteUri(speaker.sprite)}">`
                : icon(speaker.icon || 'scroll')}</div>
            <div class="explore-dialog-body">
                <div class="explore-dialog-name">${escapeHtml(speaker.name || '')}${speaker.title ? ` <span>— ${escapeHtml(speaker.title)}</span>` : ''}</div>
                <div class="explore-dialog-text">${escapeHtml(text)}</div>
                ${entry.choices && last
                    ? `<div class="explore-dialog-choices">${entry.choices.map((c, i) => `<button type="button" class="explore-choice" data-choice="${i}">${escapeHtml(c.label)}</button>`).join('')}</div>`
                    : `<div class="explore-dialog-next">${last ? 'Fermer' : 'Suivant ►'} <small>(Entrée / clic)</small></div>`}
            </div>`;
        box.classList.add('visible');
    }

    function openDialog(speaker, lines, after, choices) {
        if (!lines || lines.length === 0) { after?.(); return; }
        dialogQueue.push({ speaker, lines: [...lines], after, choices });
        if (dialogQueue.length === 1) { dialogIndex = 0; }
        renderDialog();
    }

    function advanceDialog() {
        if (!isDialogOpen()) return;
        const entry = dialogQueue[0];
        if (dialogIndex < entry.lines.length - 1) {
            dialogIndex++;
        } else if (entry.choices) {
            return; // un choix est obligatoire : on répond avec les boutons
        } else {
            dialogQueue.shift();
            dialogIndex = 0;
            entry.after?.();
        }
        renderDialog();
    }

    const NARRATOR = { icon: 'scroll', name: 'Narrateur' };

    // Locuteur d'une scène (`defeatScene.speaker`) : sprite de PNJ, d'ennemi ou du héros (`hero: true`), parchemin du narrateur sinon.
    function sceneSpeaker(sp = {}) {
        if (sp.hero) {
            const hero = cfg.getHero();
            return { name: sp.name || hero.name, title: sp.title, sprite: heroSprite(hero.classId), icon: NARRATOR.icon };
        }
        const npcDef = sp.npc
            ? Object.values(session.screens).flatMap(sc => sc.npcs).find(n => n.id === sp.npc)
            : null;
        const enemyDef = sp.enemy ? session.rt.enemyIndex[sp.enemy]?.def : null;
        const sprite = sp.npc ? npcSprite(sp.npc) : sp.enemy ? enemySprite(enemyDef?.spriteKey || sp.enemy, enemyDef?.templateId) : null;
        return {
            name: sp.name || NARRATOR.name,
            title: sp.title,
            sprite,
            icon: NARRATOR.icon
        };
    }

    // Traite les événements d'histoire. `spoken` : quêtes dont le texte vient d'être dit par un PNJ.
    function processEvents(events, spoken = new Set()) {
        const fall = events.find(e => e.type === 'sunFall');
        if (fall) {
            // Chute d'un soleil : cinématique d'abord, puis le reste des événements (butin, quêtes, interludes)
            const rest = events.filter(e => e !== fall);
            playSunFallAnimation(fall).then(() => processEvents(rest, spoken));
            return;
        }
        let gold = 0;
        let xp = 0;
        events.forEach(ev => {
            if (ev.type === 'objective') {
                toast(`${ev.quest.title} : objectif accompli`);
            } else if (ev.type === 'scene') {
                openDialog(sceneSpeaker(ev.speaker), ev.lines);
            } else if (ev.type === 'arenaCleared') {
                const tier = arenaTier(ev.tier);
                toast(ev.firstClear
                    ? `${tier.name} terminé !${ev.next ? ` La porte du ${ev.next.name} s'ouvre au parvis.` : " L'arène s'incline devant vous."}`
                    : `${tier.name} terminé une fois de plus !`, 6000);
            } else if (ev.type === 'questStarted') {
                if (!spoken.has(ev.quest.id)) openDialog({ ...NARRATOR, title: `Nouvelle quête : ${ev.quest.title}` }, ev.lines);
                toast(`Nouvelle quête${ev.quest.side ? ' annexe' : ' principale'} : ${ev.quest.title}`);
                proposeTracking(ev.quest);
            } else if (ev.type === 'questCompleted') {
                if (ev.ended) {
                    // Fin de la légende : dialogue final puis animation de fin
                    if (spoken.has(ev.quest.id)) playEndingAnimation(); else openDialog({ ...NARRATOR, title: ev.quest.chapter }, ev.lines, () => { playEndingAnimation(); });
                } else if (!spoken.has(ev.quest.id)) openDialog({ ...NARRATOR, title: ev.quest.chapter }, ev.lines);
                if (!ev.paid) { gold += ev.gold || 0; xp += ev.xp || 0; }
                const frag = ev.reward?.fragment ? ` · ${ev.reward.fragment}` : '';
                const plus = ev.ended ? ' · Nouvelle Partie + débloquée (journal)' : '';
                toast(`Quête terminée : ${ev.quest.title} — +${ev.gold || 0} or${ev.xp ? ` · +${ev.xp} XP` : ''}${frag}${plus}`, ev.ended ? 8000 : 5000);
            } else if (ev.type === 'chestOpened') {
                if (!ev.paid) gold += ev.gold || 0;
                // Butin (potions, reliques, armes) : tiré et rangé dans le sac par le jeu (chestLoot.js).
                const loot = ev.paid ? [] : (cfg.onChestLoot?.(ev) || []);
                const lootText = loot.length ? ` · ${loot.join(' · ')}` : '';
                toast(`${ev.chest.openText || `${ev.chest.label || 'Coffre'} ouvert !`}${ev.gold ? ` +${ev.gold} or` : ''}${lootText}`, loot.length ? 5500 : 3200);
            }
        });
        if (gold > 0) cfg.onGold(gold);
        if (xp > 0) cfg.onXp?.(xp);
        cfg.onSave();
        refreshHud();
    }

    const kindBadge = quest => quest.side
        ? `<span class="quest-badge side" title="Quête annexe">${icon('scroll')} Annexe</span>`
        : `<span class="quest-badge main" title="Quête principale">${icon('star')} Principale</span>`;

    // Après l'activation d'une quête : si une autre quête est déjà suivie, le joueur choisit laquelle suivre.
    function proposeTracking(quest) {
        const p = X.trackProposal(session, quest);
        if (!p || p.mode !== 'ask') return;
        openDialog({ ...NARRATOR, title: 'Suivre cette quête ?' }, [
            `« ${p.quest.title} » vient d'être activée. Vous suivez actuellement « ${p.current.title} ».`
        ], null, [
            { label: 'Suivre cette quête', run: () => { X.setTrackedQuest(session, p.quest.id); toast(`Quête suivie : ${p.quest.title}`); cfg.onSave(); refreshHud(); } },
            { label: 'Rester sur la quête actuelle', run: () => { toast(`Quête suivie : ${p.current.title}`); } }
        ]);
    }

    function eventsSpoken(events) {
        return new Set(events.filter(e => e.quest).map(e => e.quest.id));
    }

    // ── Carnet de voyage : quêtes (suivi), voyage rapide, progression ──────
    const REGION_LABEL = Object.fromEntries(worldZones.map(z => [z.id, z.shortName]));
    const carnet = { tab: 'quests', filter: 'all', region: 'all' };
    const STATUS_LABEL = { available: `${icon('talk')} À démarrer`, active: `${icon('target')} En cours`, ready: `${icon('check')} À rendre`, done: `${icon('flag')} Terminée` };
    const STATUS_ORDER = { ready: 0, active: 1, available: 2, done: 3 };

    function questsPanel() {
        const all = X.journalEntries(session);
        const regions = [...new Set(all.map(e => e.region).filter(Boolean))];
        if (carnet.region !== 'all' && !regions.includes(carnet.region)) carnet.region = 'all';
        const counts = {
            main: all.filter(e => !e.quest.side && e.status !== 'done').length,
            side: all.filter(e => e.quest.side && e.status !== 'done').length,
            done: all.filter(e => e.status === 'done').length
        };
        const entries = all
            .filter(e => carnet.filter === 'all' ? e.status !== 'done'
                : carnet.filter === 'main' ? !e.quest.side && e.status !== 'done'
                    : carnet.filter === 'side' ? e.quest.side && e.status !== 'done' : e.status === 'done')
            .filter(e => carnet.region === 'all' || e.region === carnet.region)
            .sort((a, b) => Number(b.tracked) - Number(a.tracked) || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
        const chip = (key, label) => `<button type="button" class="carnet-chip${carnet.filter === key ? ' on' : ''}" data-filter="${key}">${label}</button>`;
        const reward = r => [r.gold ? `${icon('coin')} ${r.gold}` : '', r.xp ? `${icon('star')} ${r.xp} XP` : '', r.fragment ? `${icon('puzzle')} ${escapeHtml(r.fragment)}` : ''].filter(Boolean).join(' · ');
        return `
            <div class="carnet-filters">
                ${chip('all', 'En cours')}${chip('main', `Principale (${counts.main})`)}${chip('side', `Annexes (${counts.side})`)}${chip('done', `Terminées (${counts.done})`)}
            </div>
            <select class="carnet-region" aria-label="Région">
                <option value="all">Toutes les régions</option>
                ${regions.map(r => `<option value="${r}"${carnet.region === r ? ' selected' : ''}>${escapeHtml(REGION_LABEL[r] || r)}</option>`).join('')}
            </select>
            <div class="explore-journal-list">
            ${entries.length === 0 ? '<p>Aucune quête dans cette liste. Parlez aux villageois, entrez dans les maisons.</p>' : entries.map(e => `
                <div class="explore-quest ${e.status}${e.tracked ? ' tracked' : ''}">
                    <div class="explore-quest-head"><b>${e.tracked ? `${icon('check')} ` : ''}${escapeHtml(e.quest.title)}</b> ${kindBadge(e.quest)} <span>${STATUS_LABEL[e.status] || ''}</span></div>
                    <div class="explore-quest-chapter">${escapeHtml(e.quest.chapter)}${e.region && REGION_LABEL[e.region] ? ` · ${escapeHtml(REGION_LABEL[e.region])}` : ''}</div>
                    ${e.status === 'available'
                        ? `<div class="explore-quest-where">${icon('talk')} Parlez à ${escapeHtml(e.giverName || 'un PNJ')}${e.giverPlace ? ` (${escapeHtml(e.giverPlace)})` : ''}</div>`
                        : `<ul>${e.objectives.map(o => `<li class="${o.done ? 'done' : ''}">${o.done ? icon('check') : '○'} ${escapeHtml(o.text)}</li>`).join('')}</ul>`}
                    ${e.where && e.status !== 'done' && e.status !== 'available' ? `<div class="explore-quest-where">${icon('pin')} ${escapeHtml(e.where)}</div>` : ''}
                    ${e.quest.reward ? `<div class="explore-quest-reward">${reward(e.quest.reward)}</div>` : ''}
                    ${e.status === 'done' ? '' : `<button type="button" class="carnet-track" data-track="${e.tracked ? '' : e.quest.id}">${e.tracked ? 'Ne plus suivre' : `${icon('star')} Suivre`}</button>`}
                </div>`).join('')}
            </div>`;
    }

    function travelPanel() {
        const stones = X.waypointList(session);
        const byRegion = new Map();
        stones.forEach(w => { if (!byRegion.has(w.region)) byRegion.set(w.region, []); byRegion.get(w.region).push(w); });
        if (stones.length === 0) return '<p>Aucune pierre de voyage activée. Touchez une pierre de voyage dans un village ou en chemin.</p>';
        const kindIcon = { village: icon('village'), wild: icon('leafWild'), sanctuary: icon('sun') };
        return `<p class="carnet-hint">Les pierres de voyage ${icon('stone')} se trouvent dans chaque village, au milieu des terres sauvages et à l'entrée des sanctuaires. Touchez-les pour les activer.</p>
            <div class="carnet-travel">${[...byRegion.entries()].map(([region, list]) => `
                <div class="carnet-travel-region"><h4>${escapeHtml(REGION_LABEL[region] || region)}</h4>
                ${list.map(w => `<button type="button" class="carnet-travel-btn" data-travel="${w.screenId}"${w.current ? ' disabled' : ''}>
                    ${kindIcon[w.kind] || icon('stone')} ${escapeHtml(w.screenName)}${w.current ? ' <small>(vous êtes ici)</small>' : ''}</button>`).join('')}
                </div>`).join('')}</div>`;
    }

    function progressPanel() {
        const rows = X.regionProgress(session).filter(r => r.visited);
        const bar = (n, total) => `<span class="carnet-bar"><i style="width:${total ? Math.round(100 * n / total) : 0}%"></i></span> ${n}/${total}`;
        return `<div class="carnet-progress">${rows.map(r => `
            <div class="carnet-progress-row"><b>${escapeHtml(REGION_LABEL[r.region] || r.region)}</b>
                <div>${icon('chest')} Coffres ${bar(r.chestsOpened, r.chestsTotal)}</div>
                <div>${icon('scroll')} Annexes ${bar(r.sideDone, r.sideTotal)}</div>
                <div>${icon('stone')} Pierres ${bar(r.stonesFound, r.stonesTotal)}</div>
            </div>`).join('')}</div>`;
    }

    function renderCarnet() {
        if (!journalEl) return;
        const body = carnet.tab === 'travel' ? travelPanel() : carnet.tab === 'progress' ? progressPanel() : questsPanel();
        const tab = (key, label) => `<button type="button" class="carnet-tab${carnet.tab === key ? ' on' : ''}" data-tab="${key}">${label}</button>`;
        journalEl.innerHTML = `
            <div class="explore-journal-card">
                <h3>${icon('scroll')} ${escapeHtml(STORY_TITLE)}</h3>
                ${session.data.ended ? `<p class="explore-journal-end">${icon('moon')} La légende est achevée !</p>` : ''}
                <div class="carnet-tabs">${tab('quests', `${icon('scroll')} Quêtes`)}${tab('travel', `${icon('stone')} Voyage`)}${tab('progress', `${icon('chart')} Progression`)}</div>
                ${body}
                ${session.data.ended ? `<button type="button" class="primary explore-journal-ngplus">${icon('moon')} Nouvelle Partie +</button>` : ''}
                <button type="button" class="primary explore-journal-close">Fermer</button>
            </div>`;
    }

    function showJournal(tab) {
        if (journalEl) return closeJournal();
        if (typeof tab === 'string') carnet.tab = tab;
        journalEl = document.createElement('div');
        journalEl.className = 'explore-journal';
        journalEl.addEventListener('click', ev => {
            if (ev.target.closest('.explore-journal-ngplus')) { confirmNewGamePlus(); return; }
            if (ev.target === journalEl || ev.target.closest('.explore-journal-close')) { closeJournal(); return; }
            const tabBtn = ev.target.closest('[data-tab]');
            if (tabBtn) { carnet.tab = tabBtn.dataset.tab; renderCarnet(); return; }
            const filterBtn = ev.target.closest('[data-filter]');
            if (filterBtn) { carnet.filter = filterBtn.dataset.filter; renderCarnet(); return; }
            const trackBtn = ev.target.closest('[data-track]');
            if (trackBtn) {
                X.setTrackedQuest(session, trackBtn.dataset.track || null);
                cfg.onSave();
                refreshHud();
                renderCarnet();
                return;
            }
            const travelBtn = ev.target.closest('[data-travel]');
            if (travelBtn) { closeJournal(); travelTo(travelBtn.dataset.travel); }
        });
        journalEl.addEventListener('change', ev => {
            if (ev.target.classList.contains('carnet-region')) { carnet.region = ev.target.value; renderCarnet(); }
        });
        root.appendChild(journalEl);
        renderCarnet();
    }

    // Voyage rapide vers une pierre activée (hors combat).
    function travelTo(screenId) {
        ensureSession();
        if (inCombat || !X.fastTravel(session, screenId)) return false;
        held = null;
        walk = null;
        vis.enemies = {};
        syncVisual(true);
        const screen = X.currentScreen(session);
        cfg.onRegionVisited?.(screen.region);
        refreshHud();
        toast(`Voyage rapide : ${screen.name}`, 2600);
        cfg.onSave();
        return true;
    }

    function changeArena(enter) {
        ensureSession();
        if (inCombat || isDialogOpen()) return false;
        if (!(enter ? X.enterArena(session) : X.leaveArena(session))) return false;
        held = null;
        walk = null;
        vis.enemies = {};
        syncVisual(true);
        refreshHud();
        const screen = X.currentScreen(session);
        if (!enter) cfg.onRegionVisited?.(screen.region);
        toast(enter ? screen.name : `Vous quittez l'arène : ${screen.name}`, 2600);
        if (enter && !session.data.arenaIntroSeen) {
            session.data.arenaIntroSeen = true;
            if (screen.arrival?.length) openDialog({ ...NARRATOR, title: screen.name }, screen.arrival);
        }
        cfg.onSave();
        return true;
    }

    function closeJournal() {
        journalEl?.remove();
        journalEl = null;
    }

    // Boutique d'un PNJ marchand (contenu et achats : shop.js via cfg.renderMerchant).
    function openMerchant(npc) {
        if (merchantEl || !cfg.renderMerchant) return;
        held = null;
        walk = null;
        merchantEl = document.createElement('div');
        merchantEl.className = 'explore-journal merchant-overlay';
        const card = document.createElement('div');
        card.className = 'explore-journal-card merchant-card';
        merchantEl.appendChild(card);
        merchantEl.addEventListener('click', ev => { if (ev.target === merchantEl) closeMerchant(); });
        root.appendChild(merchantEl);
        cfg.renderMerchant(npc, card, { close: closeMerchant, ngPlus: session.data.ngPlus || 0 });
    }

    function closeMerchant() {
        merchantEl?.remove();
        merchantEl = null;
        cfg.onSave?.();
    }

    // Nouvelle Partie + : l'histoire repart de zéro (le niveau et l'équipement du joueur sont conservés),
    // les adversaires sont plus coriaces. Confirmation demandée, puis sauvegarde.
    function confirmNewGamePlus() {
        const ok = window.confirm('Commencer une Nouvelle Partie + ?\n\nL\'histoire repart des Rizières Desséchées : quêtes, soleils et coffres sont remis à zéro, '
            + 'mais votre niveau et votre équipement sont conservés. Les ennemis seront plus puissants.');
        if (!ok) return;
        if (!X.startNewGamePlus(session)) return;
        closeJournal();
        session.rt.queuedEvents = [];
        session.rt.pendingEnemyId = null;
        held = null;
        walk = null;
        vis.enemies = {};
        syncVisual(true);
        refreshHud();
        cfg.onRegionVisited?.(X.currentScreen(session).region);
        cfg.onSave();
        toast(`Nouvelle Partie + ${session.data.ngPlus} : les soleils se lèvent de nouveau…`, 5000);
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    // ── Actions ────────────────────────────────────────────────────────────
    // Animation « à la Pokémon » : éclairs blancs, volets noirs qui se referment en alternance,
    // puis le nom de l'adversaire. Le combat démarre à la fin (les saisies sont bloquées entre-temps).
    function playBattleTransition(enc, done) {
        removeBattleTransition();
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const overlay = document.createElement('div');
        overlay.className = `battle-transition${reduced ? ' reduced' : ''}`;
        overlay.innerHTML = `
            <div class="bt-strips">${Array.from({ length: BATTLE_STRIPS }, (_, i) =>
                `<div class="bt-strip ${i % 2 ? 'from-right' : 'from-left'}" style="--i:${i}"></div>`).join('')}</div>
            <div class="bt-flash"></div>
            <div class="bt-title">
                <div class="bt-emoji">${enemySprite(enc.spriteKey || enc.enemyId, enc.templateId)
                    ? `<img class="bt-sprite" alt="" src="${spriteUri(enemySprite(enc.spriteKey || enc.enemyId, enc.templateId))}">`
                    : icon('sword')}</div>
                <div class="bt-name">${escapeHtml(enc.boss?.name || enc.name)}</div>
                <div class="bt-level">${enc.boss ? `${icon('crown')} Boss · ` : ''}Niveau ${enc.level}</div>
            </div>`;
        root.appendChild(overlay);
        battleTransitionEl = overlay;
        playSfx(enc.boss ? 'bossStart' : 'battleStart');
        battleTransitionTimer = setTimeout(() => {
            battleTransitionTimer = null;
            if (!enc.boss) { done(); return; }
            // Boss : échange de répliques avant le combat
            const spriteHtml = overlay.querySelector('.bt-emoji')?.innerHTML || icon('crown');
            overlay.classList.add('with-dialog');
            playBossDialogue(overlay, enc, spriteHtml).then(() => { if (battleTransitionEl === overlay) done(); });
        }, reduced ? 500 : BATTLE_TRANSITION_MS);
    }

    function removeBattleTransition() {
        clearTimeout(battleTransitionTimer);
        battleTransitionTimer = null;
        battleTransitionEl?.remove();
        battleTransitionEl = null;
    }

    function startEncounter(enemyId, opts = {}) {
        if (inCombat) return;
        const enc = X.encounterFor(session, enemyId, cfg.getPlayerLevel());
        if (!enc) return;
        if (opts.tutorial) enc.tutorial = true;
        session.rt.pendingEnemyId = enemyId;
        if (enc.prep?.lines?.length) toast(enc.prep.lines.join(' '), 4500);
        held = null;
        walk = null;
        inCombat = true;
        cfg.onSave();
        playBattleTransition(enc, () => cfg.onEncounter(enc));
    }

    function handleResult(res) {
        if (!res) return;
        switch (res.type) {
            case 'combat':
                startEncounter(res.enemyId);
                break;
            case 'talk': {
                const talk = X.talkToNpc(session, res.npcId);
                if (!talk) break;
                const spoken = eventsSpoken(talk.events);
                openDialog({ sprite: npcSprite(talk.npc.id), name: talk.npc.name, title: talk.npc.title }, talk.lines,
                    () => { processEvents(talk.events, spoken); if (talk.npc.merchant) openMerchant(talk.npc); });
                break;
            }
            case 'chest': {
                const chest = X.openChest(session, res.chestId);
                if (chest) processEvents(chest.events);
                break;
            }
            case 'observed': {
                const weak = cfg.getWeakness?.(res.templateId);
                toast(weak ? `Vous observez ${res.name} : faiblesse = ${weak}.` : `Vous observez ${res.name} : une faille dans sa garde.`, 4500);
                cfg.onSave();
                break;
            }
            case 'illusion':
                // Mirage : aucun combat, il se dissipe ; l'état a changé, on sauvegarde.
                held = null;
                walk = null;
                openDialog({ ...NARRATOR, icon: 'spark', title: 'Mirage' }, res.lines);
                cfg.onSave();
                break;
            case 'shielded':
                held = null;
                walk = null;
                openDialog({ ...NARRATOR, icon: 'shield', title: 'Un bouclier de flammes' }, res.lines);
                break;
            case 'exitBlocked':
                if (res.reason === 'quest') toast(`${res.message}`, 4500);
                else toast(`Une brume magique bloque la route vers ${res.regionName} — niveau ${res.minLevel} requis.`, 4200);
                break;
            case 'waypoint':
                walk = null;
                playSfx('uiClick');
                toast(res.isNew ? `${res.name} activée : voyage rapide possible depuis la carte` : `${res.name}`, res.isNew ? 4200 : 2200);
                cfg.onSave();
                refreshHud();
                break;
            case 'transition': {
                const screen = X.currentScreen(session);
                cfg.onRegionVisited?.(screen.region);
                vis.enemies = {};
                syncVisual(true);
                refreshHud();
                toast(screen.name, 2200);
                // Première visite : petit texte d'ambiance du Narrateur.
                // Jamais de texte du Narrateur en entrant dans une maison.
                // Première entrée dans une région : cinématique, puis le texte d'ambiance.
                const zone = res.firstVisit && !screen.interior && screen.region !== ARENA_REGION
                    && X.regionVisitCount(session, screen.region) === 1
                    ? worldZones.find(z => z.id === screen.region) : null;
                const showArrival = () => { if (res.firstVisit && res.arrival?.length && !screen.interior) openDialog({ ...NARRATOR, title: screen.name }, res.arrival); };
                if (zone) playRegionDiscovery(zone).then(showArrival); else showArrival();
                if (res.warning) toast(`${res.warning.regionName} : niveau ${res.warning.minLevel} recommandé — les ennemis y sont redoutables.`, 5000);
                // Dans une maison, les quêtes déclenchées à l'entrée n'ouvrent pas de dialogue du Narrateur (toasts seulement).
                if (res.events?.length) processEvents(res.events, screen.interior ? eventsSpoken(res.events) : undefined);
                cfg.onSave();
                break;
            }
            default:
                break;
        }
    }

    function doMove(dirName) {
        if (isBlocked()) return;
        const d = DIRECTIONS[dirName];
        if (!d) return;
        handleResult(X.tryMove(session, d.dx, d.dy, { playerLevel: cfg.getPlayerLevel() }));
        lastMoveAt = performance.now();
    }

    // ── Déplacement au clic ────────────────────────────────────────────────
    function tileFromEvent(ev) {
        const rect = canvas.getBoundingClientRect();
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        return { x: Math.floor((px - cam.ox) / cam.tile), y: Math.floor((py - cam.oy) / cam.tile) };
    }

    function onCanvasPointerDown(ev) {
        if (!active || isBlocked()) return;
        ev.preventDefault();
        const { x, y } = tileFromEvent(ev);
        const path = X.findPath(session, x, y);
        if (path === null) {
            walk = null;
            toast('Impossible d\'aller là.', 1600);
            return;
        }
        if (path.length === 0) return;
        held = null;
        walk = { tx: x, ty: y, path };
    }

    // Délai entre deux pas : le cheval double la vitesse (la caméra suit plus vite aussi).
    const hasMount = () => Boolean(cfg.getHero().mount);
    const riding = () => X.isRiding(session, hasMount());
    const moveDelay = () => (riding() ? MOUNTED_MOVE_DELAY_MS : MOVE_DELAY_MS);

    // Touche C / bouton : monter ou descendre de cheval.
    function toggleMount() {
        const res = X.toggleMount(session, hasMount());
        if (res.type === 'none') return;
        toast(res.message, 2200);
        cfg.onSave();
        refreshMountButton();
    }
    function refreshMountButton() {
        const btn = els.mountBtn;
        if (!btn) return;
        const state = `${hasMount()}|${riding()}`;
        if (btn.dataset.state === state) return;   // évite de toucher au DOM à chaque image
        btn.dataset.state = state;
        btn.hidden = !hasMount();
        btn.classList.toggle('on', riding());
        btn.title = riding() ? 'Descendre de cheval (C)' : 'Monter à cheval (C)';
    }

    // Un pas vers la destination ; le chemin est recalculé à chaque pas (patrouilles, ennemis vaincus…).
    function walkStep() {
        const path = X.findPath(session, walk.tx, walk.ty);
        if (!path || path.length === 0) { walk = null; return; }
        walk.path = path;
        const next = path[0];
        const dx = next.x - session.data.x;
        const dy = next.y - session.data.y;
        const res = X.tryMove(session, dx, dy, { playerLevel: cfg.getPlayerLevel() });
        lastMoveAt = performance.now();
        if (res.type !== 'moved') {
            walk = null;            // interaction, combat, changement d'écran, obstacle ou brume
            handleResult(res);
        } else if (session.data.x === walk.tx && session.data.y === walk.ty) {
            walk = null;
        }
    }

    // ── Saisie ─────────────────────────────────────────────────────────────
    function onKeyDown(ev) {
        if (!active || !isOnScreen() || isModalOpen()) return;
        if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
        if (ev.key === 'Enter' || ev.key === ' ') {
            if (isDialogOpen()) { ev.preventDefault(); advanceDialog(); }
            return;
        }
        if (ev.key === 'Escape' && merchantEl) { closeMerchant(); return; }
        if (ev.key === 'Escape' && journalEl) { closeJournal(); return; }
        if (ev.key === 'j' || ev.key === 'J') { showJournal(); return; }
        if (ev.key === 'c' || ev.key === 'C') { toggleMount(); return; }
        if (ev.key === 'v' || ev.key === 'V') { showJournal('travel'); return; }
        const dir = KEY_TO_DIR[ev.key];
        if (!dir) return;
        ev.preventDefault();
        if (ev.repeat) return;
        walk = null;
        held = dir;
        if (performance.now() - lastMoveAt >= moveDelay()) doMove(dir);
    }

    function onKeyUp(ev) {
        const dir = KEY_TO_DIR[ev.key];
        if (dir && held === dir) held = null;
    }

    function bindControls() {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        canvas.addEventListener('pointerdown', onCanvasPointerDown);
        canvas.addEventListener('contextmenu', ev => ev.preventDefault());
        els.dialog?.addEventListener('click', ev => {
            const btn = ev.target.closest?.('[data-choice]');
            const entry = dialogQueue[0];
            if (btn && entry?.choices) {
                const choice = entry.choices[Number(btn.dataset.choice)];
                dialogQueue.shift();
                dialogIndex = 0;
                choice?.run?.();
                renderDialog();
                return;
            }
            advanceDialog();
        });
        els.journalBtn?.addEventListener('click', showJournal);
        els.mountBtn?.addEventListener('click', () => { if (!isBlocked()) toggleMount(); });
        els.mapBtn?.addEventListener('click', () => { if (!isBlocked()) cfg.onOpenMap?.(); });
        els.arenaBtn?.addEventListener('click', () => { if (!isBlocked()) cfg.onOpenArena?.(); });
        els.menuBtn?.addEventListener('click', () => { if (!isBlocked()) cfg.onOpenMenu?.(); });
    }

    // ── Boucle de rendu ────────────────────────────────────────────────────
    function frame(now) {
        if (!active) return;
        const dt = Math.min(100, now - (lastFrame || now));
        lastFrame = now;

        // Nouvelle région (transition, voyage, téléportation, NG+…) : on attend ses dessins, la carte reste figée.
        if (!isRegionReady()) {
            prepareRegion(X.currentScreen(session).region);
            rafId = requestAnimationFrame(frame);
            return;
        }

        if (held && !isBlocked() && now - lastMoveAt >= moveDelay()) doMove(held);
        else if (walk && !isBlocked() && now - lastMoveAt >= moveDelay()) walkStep();
        if (walk && isBlocked()) walk = null;
        if (!isBlocked()) {
            const events = X.tick(session, dt);
            const hit = events.find(e => e.type === 'combat');
            if (hit) startEncounter(hit.enemyId);
            else events.forEach(ev => handleResult(ev));
        }

        // Sur l'eau, le cheval ne suit pas : on met pied à terre tout seul.
        if (X.autoDismount(session, hasMount())) { toast('Le cheval ne suit pas sur l\'eau : vous mettez pied à terre.', 3000); cfg.onSave(); }
        refreshMountButton();
        const k = Math.min(1, dt / (riding() ? 55 : 95));
        vis.px += (session.data.x - vis.px) * k;
        vis.py += (session.data.y - vis.py) * k;
        X.aliveEnemies(session).forEach(e => {
            const v = vis.enemies[e.def.id] || (vis.enemies[e.def.id] = { x: e.x, y: e.y });
            v.x += (e.x - v.x) * k;
            v.y += (e.y - v.y) * k;
        });
        vis.bob = now;

        draw(now);
        rafId = requestAnimationFrame(frame);
    }

    // ── Calque de sol mis en cache ─────────────────────────────────────────
    const GROUND_MARGIN = 32;                 // marge (px CSS) du calque de sol autour de la carte (plus de falaise : simple tampon)
    const GROUND_MAX_PIXELS = 16e6;           // au-delà, on retombe sur le dessin direct (mémoire)
    let groundCache = null;

    function paintGroundCells(g, screen, biome, tile, ox, oy, inRects) {
        for (let y = 0; y < screen.h; y++) {
            for (let x = 0; x < screen.w; x++) {
                // carte de mer : les récifs (obstacles) reposent sur l'eau, pas sur une case de sable
                g.fillStyle = (inRects(screen.liquids, x, y) || (screen.aquatic && inRects(screen.obstacles, x, y))) ? biome.liquid
                    : inRects(screen.paths, x, y) ? biome.path
                    : ((x + y) % 2 ? biome.a : biome.b);
                g.fillRect(ox + x * tile, oy + y * tile, tile, tile);
            }
        }
    }

    let liquidCache = { screen: null, cells: [] };
    function getLiquidCells(screen, inRects) {
        if (liquidCache.screen === screen) return liquidCache.cells;
        const cells = [];
        for (let y = 0; y < screen.h; y++) for (let x = 0; x < screen.w; x++) if (inRects(screen.liquids, x, y)) cells.push([x, y]);
        liquidCache = { screen, cells };
        return cells;
    }

    function getGroundLayer(screen, biome, tile, dpr, inRects) {
        const c = groundCache;
        if (c && c.screen === screen && c.biome === biome && c.tile === tile && c.dpr === dpr) return c;
        const M = GROUND_MARGIN;
        const w = Math.ceil((tile * screen.w + 2 * M) * dpr);
        const h = Math.ceil((tile * screen.h + 2 * M) * dpr);
        if (w * h > GROUND_MAX_PIXELS || typeof document === 'undefined') return null;
        const canvas = c?.canvas || document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext('2d');
        if (!g) return null;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Aucune bordure : ni falaise ni ombre autour de la carte (le décor se prolonge jusqu'au bord de l'écran).
        paintGroundCells(g, screen, biome, tile, M, M, inRects);
        groundCache = { screen, biome, tile, dpr, canvas };
        return groundCache;
    }

    function draw(now) {
        const screen = X.currentScreen(session);
        const biome = BIOMES[screen.biome] || BIOMES.paddy;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const vw = Math.max(1, canvas.clientWidth);
        const vh = Math.max(1, canvas.clientHeight);
        if (canvas.width !== Math.round(vw * dpr) || canvas.height !== Math.round(vh * dpr)) {
            canvas.width = Math.round(vw * dpr);
            canvas.height = Math.round(vh * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // fond sans cadre : de l'eau (carte de mer) ou la couleur du sol du biome jusqu'au bord de l'écran
        ctx.fillStyle = screen.aquatic ? biome.liquid : biome.a;
        ctx.fillRect(0, 0, vw, vh);

        // taille de tuile et caméra
        const availH = Math.max(1, vh - HUD_TOP - HUD_BOTTOM);
        const tile = Math.max(MIN_TILE, Math.min(MAX_TILE, Math.floor(Math.min(vw / screen.w, availH / screen.h))));
        const mapW = tile * screen.w;
        const mapH = tile * screen.h;
        const follow = (size, avail, offset, pos) =>
            size <= avail ? offset + (avail - size) / 2
                : offset + Math.min(0, Math.max(avail - size, avail / 2 - (pos + 0.5) * tile));
        const ox = follow(mapW, vw, 0, vis.px);
        const oy = follow(mapH, availH, HUD_TOP, vis.py);
        cam = { ox, oy, tile, vw };
        const P = (x, y) => ({ x: ox + x * tile, y: oy + y * tile });

        const level = cfg.getPlayerLevel();
        const aura = X.getAuraTiles(session);
        const pulse = 0.5 + 0.5 * Math.sin(now / 320);
        const inRects = (rects, x, y) => rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
        const cell = (x, y, fill, inset = 0) => {
            const p = P(x, y);
            ctx.fillStyle = fill;
            ctx.fillRect(p.x + inset, p.y + inset, tile - inset * 2, tile - inset * 2);
        };

        // 1. Sol, chemins, liquides, zones de vigilance
        // Le fond statique (sol, chemins, base des liquides) est dessiné une seule fois dans un calque hors écran puis
        // simplement recopié à chaque image : des centaines de fillRect par image étaient le principal coût de rendu
        // sur les vieux appareils. Rendu identique.
        const ground = getGroundLayer(screen, biome, tile, dpr, inRects);
        if (ground) {
            ctx.drawImage(ground.canvas, ox - GROUND_MARGIN, oy - GROUND_MARGIN,
                ground.canvas.width / dpr, ground.canvas.height / dpr);
        } else {
            paintGroundCells(ctx, screen, biome, tile, ox, oy, inRects);
        }
        // Parties animées : reflets des liquides et zones de vigilance qui pulsent
        const liquidCells = getLiquidCells(screen, inRects);
        liquidCells.forEach(([x, y]) => {
            const shimmer = 0.10 + 0.10 * Math.sin(now / 500 + x * 1.7 + y * 1.1);
            cell(x, y, `rgba(255,255,255,${shimmer.toFixed(3)})`, tile * 0.08);
        });
        if (aura.size) {
            const auraFill = `rgba(220,38,38,${(0.16 + 0.12 * pulse).toFixed(3)})`;
            aura.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                if (!inRects(screen.liquids, x, y)) cell(x, y, auraFill);
            });
        }
        // contour des zones de vigilance (lecture claire de « où ne pas passer »)
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(220,38,38,${(0.35 + 0.25 * pulse).toFixed(3)})`;
        aura.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            if (inRects(screen.liquids, x, y)) return;
            const p = P(x, y);
            ctx.strokeRect(p.x + 0.75, p.y + 0.75, tile - 1.5, tile - 1.5);
        });

        // sens du regard : un chevron par case de la zone, pointant vers l'avant de l'ennemi
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(255,255,255,${(0.35 + 0.25 * pulse).toFixed(3)})`;
        X.aliveEnemies(session).filter(e => !X.isShielded(session, e.def) && X.aggroOf(e.def) > 0).forEach(e => {
            const f = e.face || { dx: 0, dy: 1 };
            const fx = Math.abs(f.dx) >= Math.abs(f.dy) ? Math.sign(f.dx) : 0;
            const fy = fx ? 0 : (Math.sign(f.dy) || 1);
            X.auraCellsOf(session, e).forEach(({ x, y }) => {
                if ((x === e.x && y === e.y) || inRects(screen.liquids, x, y)) return;
                const c = P(x + 0.5, y + 0.5), a = tile * 0.14;
                ctx.beginPath();
                ctx.moveTo(c.x - fy * a - fx * a, c.y - fx * a - fy * a);
                ctx.lineTo(c.x + fx * a, c.y + fy * a);
                ctx.lineTo(c.x + fy * a - fx * a, c.y + fx * a - fy * a);
                ctx.stroke();
            });
        });

        // trajet du déplacement au clic : points le long du chemin et cercle sur la destination
        if (walk && walk.path?.length) {
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            walk.path.slice(0, -1).forEach(step => {
                const c = P(step.x + 0.5, step.y + 0.5);
                ctx.beginPath();
                ctx.arc(c.x, c.y, Math.max(3, tile * 0.07), 0, Math.PI * 2);
                ctx.fill();
            });
            const t = P(walk.tx + 0.5, walk.ty + 0.5);
            ctx.lineWidth = 3;
            ctx.strokeStyle = `rgba(255,255,255,${(0.6 + 0.4 * pulse).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, tile * (0.28 + 0.06 * pulse), 0, Math.PI * 2);
            ctx.stroke();
        }

        // sorties : case lumineuse, flèche vers le bord de la carte, nom de la destination
        screen.exits.forEach(ex => {
            if (ex.door) {
                // porte de maison : tapis lumineux devant la porte du bâtiment (dessinée avec lui)
                cell(ex.x, ex.y, `rgba(255,236,150,${(0.28 + 0.2 * pulse).toFixed(3)})`, tile * 0.1);
                return;
            }
            if (screen.interior) {
                // sortie d'une maison : porte de bois dans le mur du bas
                const p = P(ex.x, ex.y);
                ctx.fillStyle = '#7a4a26';
                ctx.fillRect(p.x + tile * 0.12, p.y + tile * 0.05, tile * 0.76, tile * 0.95);
                ctx.fillStyle = `rgba(255,236,150,${(0.25 + 0.2 * pulse).toFixed(3)})`;
                ctx.fillRect(p.x + tile * 0.2, p.y + tile * 0.15, tile * 0.6, tile * 0.85);
                drawLabel(p.x + tile / 2, p.y - tile * 0.35, 'Sortie', '#fff8e1', '#5a3e1b', Math.max(11, Math.round(tile * 0.2)));
                return;
            }
            const minLevel = REGION_UNLOCK_LEVEL[session.screens[ex.to].region] || 1;
            const locked = X.isExitLocked(session, ex);
            const gated = locked || (level < minLevel && session.screens[ex.to].region !== screen.region);
            cell(ex.x, ex.y, locked ? `rgba(200,200,210,${(0.5 + 0.2 * pulse).toFixed(3)})` : `rgba(255,236,150,${(0.6 + 0.3 * pulse).toFixed(3)})`);
            cell(ex.x, ex.y, 'rgba(255,255,255,0.45)', tile * 0.16);
            // passage de bord de 3 cases : seule la case centrale porte la flèche et le nom (world/expand.js)
            if (ex.span) return;
            const c = P(ex.x + 0.5, ex.y + 0.5);
            const arrow = locked ? '×' : ex.x === 0 ? '◄' : ex.x === screen.w - 1 ? '►' : ex.y === 0 ? '▲' : '▼';
            ctx.fillStyle = '#5a3e1b';
            ctx.font = `${Math.round(tile * 0.42)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(arrow, c.x, c.y);
            const labelY = ex.y === 0 ? c.y + tile * 0.75 : c.y - tile * 0.75;
            const labelText = locked ? `${ex.label} (fermé)` : gated ? `${ex.label} (niv. ${minLevel})` : ex.label;
            drawLabel(c.x, labelY, labelText,
                gated ? '#e5e7eb' : '#fff8e1', '#5a3e1b', Math.max(11, Math.round(tile * 0.2)));
        });

        // 2. Décors, PNJ, coffres, ennemis, héros (du haut vers le bas de l'écran)
        const items = [];
        const inBuilding = (x, y) => (screen.buildings || []).some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
        for (let x = 0; x < screen.w; x++) {
            for (let y = 0; y < screen.h; y++) {
                if (inRects(screen.obstacles, x, y) && !inBuilding(x, y)) items.push({ depth: y, kind: 'block', x, y });
            }
        }
        (screen.buildings || []).forEach(b => items.push({ depth: b.y + b.h - 0.5, kind: 'building', b, x: b.x, y: b.y }));
        if (screen.waypoint) items.push({ depth: screen.waypoint.y + 0.1, kind: 'waypoint', x: screen.waypoint.x, y: screen.waypoint.y });
        (screen.spots || []).forEach(sp => items.push({ depth: sp.y + 0.05, kind: 'spot', sp, x: sp.x, y: sp.y }));
        X.visibleNpcs(session).forEach(n => items.push({ depth: n.y + 0.1, kind: 'npc', n, x: n.x, y: n.y }));
        X.visibleChests(session).forEach(c => items.push({ depth: c.y + 0.1, kind: 'chest', c, x: c.x, y: c.y }));
        X.aliveEnemies(session).forEach(e => {
            const v = vis.enemies[e.def.id] || e;
            items.push({ depth: v.y + 0.2, kind: 'enemy', e, x: v.x, y: v.y });
        });
        items.push({ depth: vis.py + 0.3, kind: 'player', x: vis.px, y: vis.py });
        items.sort((a, b) => a.depth - b.depth);

        const labelSize = Math.max(11, Math.round(tile * 0.2));
        const houseMk = X.houseMarkers(session);
        // anneaux dorés sur les cibles de la quête suivie
        X.trackedMarkers(session).forEach(t => {
            let pos = null;
            if (t.kind === 'npc') pos = screen.npcs.find(n => n.id === t.id);
            else if (t.kind === 'chest') pos = screen.chests.find(ch => ch.id === t.id);
            else if (t.kind === 'enemy') pos = X.aliveEnemies(session).find(e => e.def.id === t.id);
            if (!pos) return;
            const c = P(pos.x + 0.5, pos.y + 0.5);
            ctx.lineWidth = 3;
            ctx.strokeStyle = `rgba(250,204,21,${(0.55 + 0.4 * pulse).toFixed(3)})`;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y + tile * 0.3, tile * (0.42 + 0.05 * pulse), tile * 0.17, 0, 0, Math.PI * 2);
            ctx.stroke();
        });
        items.forEach(it => {
            const c = P(it.x + 0.5, it.y + 0.5);
            switch (it.kind) {
                case 'building': {
                    drawBuilding(it.b, P(it.b.x, it.b.y), tile, labelSize);
                    // indicateur de quête : « ! » (quête à prendre) ou « ? » (à rendre / cible de la quête suivie) dans la maison
                    const hm = houseMk.find(h => h.exit.x === it.b.door.x && h.exit.y === it.b.door.y);
                    if (hm) {
                        const top = P(it.b.x + it.b.w / 2, it.b.y);
                        drawMarker(top.x, top.y - tile * 0.28 - 4 * Math.abs(Math.sin(now / 300)), hm.marker, tile, 1.35);
                    }
                    break;
                }
                case 'spot': {
                    // préparation du terrain (terrain.js) : hautes herbes, piège, belvédère
                    const feet = c.y + tile * 0.3;
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#2b1b17';
                    if (it.sp.kind === 'tallGrass') {
                        ctx.strokeStyle = '#2f7a2f';
                        for (let k = -2; k <= 2; k++) {
                            ctx.beginPath();
                            ctx.moveTo(c.x + k * tile * 0.13, feet);
                            ctx.lineTo(c.x + k * tile * 0.13 + (k % 2 ? 3 : -3), feet - tile * (0.38 + 0.05 * (k % 2)));
                            ctx.stroke();
                        }
                    } else if (it.sp.kind === 'trap') {
                        ctx.strokeStyle = '#6b4a2b';
                        ctx.beginPath();
                        ctx.ellipse(c.x, feet - tile * 0.1, tile * 0.28, tile * 0.1, 0, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.beginPath();
                        for (let k = -2; k <= 2; k++) { ctx.moveTo(c.x + k * tile * 0.1, feet - tile * 0.1); ctx.lineTo(c.x + k * tile * 0.1, feet - tile * 0.26); }
                        ctx.stroke();
                    } else {
                        ctx.strokeStyle = `rgba(255,255,255,${(0.5 + 0.3 * Math.sin(now / 400)).toFixed(3)})`;
                        ctx.beginPath();
                        ctx.ellipse(c.x, feet - tile * 0.05, tile * 0.3, tile * 0.11, 0, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(c.x, feet - tile * 0.05);
                        ctx.lineTo(c.x, feet - tile * 0.5);
                        ctx.lineTo(c.x + tile * 0.18, feet - tile * 0.42);
                        ctx.lineTo(c.x, feet - tile * 0.34);
                        ctx.stroke();
                    }
                    break;
                }
                case 'waypoint': {
                    const active = session.data.waypoints.includes(session.data.screenId);
                    const feet = c.y + tile * 0.38;
                    drawShadow(c.x, feet, tile * 0.3, tile * 0.1);
                    ctx.fillStyle = active ? '#8fa6b8' : '#7b7b86';
                    ctx.strokeStyle = '#2b1b17';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(c.x - tile * 0.26, feet);
                    ctx.lineTo(c.x - tile * 0.18, c.y - tile * 0.28);
                    ctx.lineTo(c.x + tile * 0.18, c.y - tile * 0.28);
                    ctx.lineTo(c.x + tile * 0.26, feet);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    const glow = active ? 0.55 + 0.35 * Math.sin(now / 350) : 0.15;
                    ctx.beginPath();
                    ctx.arc(c.x, c.y - tile * 0.5, tile * (active ? 0.2 : 0.14), 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(120,220,255,${glow.toFixed(3)})`;
                    ctx.fill();
                    ctx.stroke();
                    drawDecor('swirl', c.x, c.y - tile * 0.05 + tile * 0.17, tile * 0.34);
                    break;
                }
                case 'block': {
                    if (screen.interior && (it.x === 0 || it.y === 0 || it.x === screen.w - 1 || it.y === screen.h - 1)) {
                        cell(it.x, it.y, shade(biome.cliff, it.y === 0 ? -6 : 8));
                        cell(it.x, it.y, 'rgba(0,0,0,0.18)', tile * 0.46);
                        break;
                    }
                    cell(it.x, it.y, shade(biome.cliff, 10));
                    const decor = biome.decor[Math.floor(hash(it.x, it.y) * biome.decor.length)];
                    drawShadow(c.x, c.y + tile * 0.3, tile * 0.32, tile * 0.11);
                    drawDecor(decor, c.x, c.y + tile * 0.36, tile * 0.85);
                    break;
                }
                case 'npc': {
                    const feet = c.y + tile * 0.4;
                    drawShadow(c.x, feet, tile * 0.28, tile * 0.1);
                    const bob = Math.sin(now / 520 + it.x * 1.3) * tile * 0.012;
                    drawSprite(npcSprite(it.n.id), c.x, feet + bob, tile * 1.02);
                    const marker = X.npcMarker(session, it.n.id);
                    if (it.n.merchant) drawMerchantBadge(c.x, c.y - tile * 0.74 - 3 * Math.abs(Math.sin(now / 340)), tile);
                    else if (marker) drawMarker(c.x, c.y - tile * 0.72 - 4 * Math.abs(Math.sin(now / 300)), marker, tile);
                    drawLabel(c.x, c.y + tile * 0.55, it.n.name, '#fff8e1', '#5a3e1b', labelSize);
                    break;
                }
                case 'chest': {
                    const opened = session.data.openedChests.includes(it.c.id);
                    const feet = c.y + tile * 0.36;
                    drawShadow(c.x, feet, tile * 0.28, tile * 0.1);
                    if (it.c.altar) {
                        // autel : décor dessiné (pas de sprite de coffre), orné une fois l'offrande déposée
                        const glow = opened ? 0.25 : 0.55 + 0.25 * Math.sin(now / 400);
                        ctx.beginPath();
                        ctx.ellipse(c.x, feet - tile * 0.04, tile * 0.42, tile * 0.15, 0, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(255,248,200,${glow.toFixed(3)})`;
                        ctx.fill();
                        drawDecor(opened ? 'altarLit' : 'altar', c.x, feet, tile * 0.9);
                    } else {
                        drawSprite(chestSprite(opened), c.x, feet, tile * 0.85);
                    }
                    break;
                }
                case 'enemy': {
                    const def = it.e.def;
                    const illusion = Boolean(def.illusion);
                    const boss = Boolean(def.boss);
                    const big = boss || illusion;       // un mirage copie la silhouette du vrai soleil
                    const shielded = X.isShielded(session, def);
                    const lvl = X.enemyLevel(def, X.enemyRegionLevel(session, def.id), session.data.ngPlus);
                    const size = tile * (big ? 1.55 : 1.08);
                    const feet = c.y + tile * 0.4;
                    // Indice des mirages : ils scintillent, n'ont ni ombre au sol ni étiquette de niveau.
                    if (!illusion) drawShadow(c.x, feet, tile * (boss ? 0.46 : 0.3), tile * 0.1);
                    const bob = Math.sin(now / 430 + it.x * 2.1 + it.y) * tile * 0.015;
                    ctx.save();
                    if (illusion) ctx.globalAlpha = 0.4 + 0.45 * (0.5 + 0.5 * Math.sin(now / 170 + it.x * 3.1 + it.y * 1.7));
                    const baseSprite = enemySprite(def.spriteKey || def.id, def.templateId);
                    drawSprite(viewSprite(baseSprite, viewDir(it.e.face)), c.x, feet + bob, size, baseSprite);
                    ctx.restore();
                    if (shielded) {
                        // bouclier de flammes tant que la meute n'est pas abattue
                        ctx.beginPath();
                        ctx.arc(c.x, feet - size * 0.42, size * 0.56, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(255,150,60,${(0.12 + 0.08 * pulse).toFixed(3)})`;
                        ctx.fill();
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = `rgba(255,200,90,${(0.55 + 0.3 * pulse).toFixed(3)})`;
                        ctx.stroke();
                    }
                    if (big) {
                        ctx.save();
                        if (illusion) ctx.globalAlpha = 0.5;
                        drawCrown(c.x, feet - size * 0.98 - 3 * Math.abs(Math.sin(now / 350)), tile * 0.42);
                        ctx.restore();
                    }
                    if (!illusion) {
                        const color = lvl > level ? '#dc2626' : lvl < level ? '#16a34a' : '#ca8a04';
                        drawLabel(c.x, c.y + tile * (boss ? 0.68 : 0.58), `${shielded ? 'Bouclier · ' : boss ? 'Boss · ' : ''}Nv ${lvl}`, '#ffffff', color, labelSize);
                    }
                    break;
                }
                case 'player': {
                    const moving = Math.hypot(session.data.x - vis.px, session.data.y - vis.py) > 0.05;
                    const hop = moving ? -tile * 0.08 * Math.abs(Math.sin(now / 70)) : Math.sin(now / 500) * tile * 0.01;
                    const feet = c.y + tile * 0.4;
                    drawShadow(c.x, feet, tile * 0.28, tile * 0.1);
                    ctx.beginPath();
                    ctx.ellipse(c.x, feet - tile * 0.02, tile * 0.36, tile * 0.13, 0, 0, Math.PI * 2);
                    ctx.strokeStyle = '#facc15';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    // Pas de Yu : sur l'eau, le héros glisse à la surface et des rides s'étendent sous ses pieds
                    if (inRects(screen.liquids || [], Math.round(vis.px), Math.round(vis.py))) {
                        for (let r = 0; r < 2; r++) {
                            const phase = ((now / 900) + r * 0.5) % 1;
                            ctx.beginPath();
                            ctx.ellipse(c.x, feet - tile * 0.02, tile * (0.3 + 0.35 * phase), tile * (0.1 + 0.12 * phase), 0, 0, Math.PI * 2);
                            ctx.strokeStyle = `rgba(255,255,255,${(0.7 * (1 - phase)).toFixed(3)})`;
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }
                    }
                    const hero = cfg.getHero();
                    const heroBase = heroSprite(hero.classId);
                    const heroView = viewSprite(heroBase, viewDir(session.rt.facing), HERO_VIEW_OPTS);
                    if (riding()) {
                        // à cheval : la monture au sol, le héros en selle
                        drawSprite(npcSprite('horse_mount'), c.x, feet + hop * 0.5, tile * 1.2);
                        drawSprite(heroView, c.x, feet + hop - tile * 0.34, tile * 0.86, heroBase);
                    } else {
                        drawSprite(heroView, c.x, feet + hop, tile * 1.06, heroBase);
                    }
                    break;
                }
                default:
                    break;
            }
        });
        drawQuestCompass(P, vis, tile, pulse, now, labelSize);
    }

    // Indicateur de direction de la quête suivie : flèche dorée autour du héros, trait pointillé vers la cible
    // (ou vers la sortie / la porte à prendre quand la cible est dans un autre écran), nom de la destination.
    function drawQuestCompass(P, vis, tile, pulse, now, labelSize) {
        const dir = X.questDirection(session);
        if (!dir) return;
        const hero = P(vis.px + 0.5, vis.py + 0.5);
        const dest = P(dir.x + 0.5, dir.y + 0.5);
        const dx = dest.x - hero.x;
        const dy = dest.y - hero.y;
        const dist = Math.hypot(dx, dy);
        if (dist < tile * 1.3) return; // déjà tout près : l'anneau de la cible suffit
        const ang = Math.atan2(dy, dx);
        ctx.save();
        ctx.setLineDash([tile * 0.12, tile * 0.18]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(250,204,21,${(0.28 + 0.12 * pulse).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(hero.x + Math.cos(ang) * tile * 1.1, hero.y + Math.sin(ang) * tile * 1.1);
        ctx.lineTo(dest.x - Math.cos(ang) * tile * 0.4, dest.y - Math.sin(ang) * tile * 0.4);
        ctx.stroke();
        ctx.setLineDash([]);
        // flèche autour du héros
        const r = tile * (0.95 + 0.08 * pulse);
        ctx.translate(hero.x + Math.cos(ang) * r, hero.y + Math.sin(ang) * r - tile * 0.1);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(tile * 0.26, 0);
        ctx.lineTo(-tile * 0.12, -tile * 0.2);
        ctx.lineTo(-tile * 0.04, 0);
        ctx.lineTo(-tile * 0.12, tile * 0.2);
        ctx.closePath();
        ctx.fillStyle = '#facc15';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2b1b17';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
        // sortie / porte à prendre : halo + nom de la destination
        if (dir.kind === 'exit') {
            ctx.lineWidth = 3;
            ctx.strokeStyle = `rgba(250,204,21,${(0.55 + 0.4 * pulse).toFixed(3)})`;
            ctx.strokeRect(dest.x - tile * 0.45, dest.y - tile * 0.45, tile * 0.9, tile * 0.9);
            drawLabel(dest.x, dest.y - tile * 0.75, `➜ ${dir.label}`, '#fef08a', '#5a3e1b', labelSize);
        }
    }

    const ROOFS = ['#b23a30', '#2f6f73', '#8a5a2b', '#6b4a8a', '#c98a2b', '#3f7d4e', '#a8483a', '#4a6fa5'];

    // Maison de village : toit à pignon, murs crème, porte (tuile de la porte), fenêtres, nom du bâtiment.
    function drawBuilding(b, p, tile, labelSize) {
        const w = b.w * tile;
        const h = b.h * tile;
        const roof = ROOFS[(b.id.charCodeAt(0) + (b.x * 7 + b.y * 3)) % ROOFS.length];
        const roofH = Math.max(tile * 0.9, h * 0.5);
        const wallY = p.y + roofH * 0.8;
        ctx.save();
        // murs
        ctx.fillStyle = '#f0e0b8';
        ctx.fillRect(p.x + 3, wallY, w - 6, h - roofH * 0.8);
        ctx.fillStyle = 'rgba(120,80,40,0.18)';
        ctx.fillRect(p.x + w * 0.62, wallY, w * 0.38 - 3, h - roofH * 0.8);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2b1b17';
        ctx.strokeRect(p.x + 3, wallY, w - 6, h - roofH * 0.8);
        // fenêtres
        const winY = wallY + (h - roofH * 0.8) * 0.28;
        ctx.fillStyle = '#7ab8d8';
        [0.18, 0.68].forEach(fx => {
            if (Math.abs(p.x + w * fx + tile * 0.2 - (p.x + (b.door.x - b.x + 0.5) * tile)) < tile * 0.5) return;
            ctx.fillRect(p.x + w * fx, winY, tile * 0.4, tile * 0.34);
            ctx.strokeRect(p.x + w * fx, winY, tile * 0.4, tile * 0.34);
        });
        // porte
        const dx = p.x + (b.door.x - b.x) * tile;
        const dy = p.y + (b.door.y - b.y) * tile;
        ctx.fillStyle = '#6b3d22';
        ctx.fillRect(dx + tile * 0.2, dy + tile * 0.12, tile * 0.6, tile * 0.88);
        ctx.strokeRect(dx + tile * 0.2, dy + tile * 0.12, tile * 0.6, tile * 0.88);
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath();
        ctx.arc(dx + tile * 0.68, dy + tile * 0.58, tile * 0.04, 0, Math.PI * 2);
        ctx.fill();
        // toit
        ctx.fillStyle = roof;
        ctx.beginPath();
        ctx.moveTo(p.x - tile * 0.12, wallY + 4);
        ctx.lineTo(p.x + w * 0.5, p.y);
        ctx.lineTo(p.x + w + tile * 0.12, wallY + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(p.x + w * 0.5, p.y);
        ctx.lineTo(p.x + w + tile * 0.12, wallY + 4);
        ctx.lineTo(p.x + w * 0.5, wallY + 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        if (b.name && tile >= 40) drawLabel(p.x + w / 2, p.y + roofH * 0.62, b.name, 'rgba(255,248,225,0.92)', '#5a3e1b', Math.max(10, labelSize - 1), w / 2);
    }

    // Dessine un sprite SVG (pieds vers le bas du cadre) centré sur cx, dont les pieds sont posés en feetY.
    // Retourne false tant que l'image n'est pas chargée (ou s'il n'y a pas de sprite).
    // `fallback` : dessin de face montré le temps que la vue de côté / de dos (dérivée) se décode.
    function drawSprite(svg, cx, feetY, size, fallback = null) {
        if (!svg) return false;
        let img = spriteImage(svg);
        if (!img.complete || !img.naturalWidth) {
            if (!fallback || fallback === svg) return true; // en cours de chargement : rien à dessiner
            img = spriteImage(fallback);
            if (!img.complete || !img.naturalWidth) return true;
        }
        ctx.drawImage(img, cx - size / 2, feetY - size * 0.92, size, size);
        return true;
    }

    // Pastille de quête au-dessus d'un PNJ : « ! » (quête à prendre) ou « ? » (à rendre).
    function drawMarker(x, y, char, tile, scale = 1) {
        const r = tile * 0.17 * scale;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = char === '?' ? '#38bdf8' : '#facc15';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2b1b17';
        ctx.stroke();
        ctx.fillStyle = '#2b1b17';
        ctx.font = `700 ${Math.round(r * 1.6)}px 'Rt Digits', 'Pixelify Sans', ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char, x, y + r * 0.08);
    }

    // Pièce chinoise dorée (trou carré) au-dessus d'un PNJ marchand : repérable de loin.
    function drawMerchantBadge(x, y, tile) {
        const r = tile * 0.21;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#f2c14e';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2b1b17';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#b8862a';
        ctx.stroke();
        const h = r * 0.5;
        ctx.fillStyle = '#2b1b17';
        ctx.fillRect(x - h / 2, y - h / 2, h, h);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(x - r * 0.4, y - r * 0.45, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
    }

    // Petite couronne dorée au-dessus des boss.
    function drawCrown(x, y, w) {
        const h = w * 0.7;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y + h / 2);
        ctx.lineTo(x - w / 2, y - h / 4);
        ctx.lineTo(x - w / 4, y + h / 12);
        ctx.lineTo(x, y - h / 2);
        ctx.lineTo(x + w / 4, y + h / 12);
        ctx.lineTo(x + w / 2, y - h / 4);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.closePath();
        ctx.fillStyle = '#facc15';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2b1b17';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    function drawShadow(x, y, rx, ry) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fill();
    }

    // Élément de décor dessiné (sprites/decor.js), base posée en baseY.
    function drawDecor(name, x, baseY, size) {
        const svg = decorSprite(name);
        if (!svg) return;
        const img = spriteImage(svg);
        if (img.complete && img.naturalWidth) ctx.drawImage(img, x - size / 2, baseY - size * 0.92, size, size);
    }

    function drawLabel(x, y, text, bg, fg, size = 12, reach = cam.tile * 0.5) {
        ctx.font = `700 ${size}px 'Rt Digits', 'Pixelify Sans', ui-monospace, monospace`;
        const w = ctx.measureText(text).width + 14;
        const h = size + 8;
        // carte plus large que l'écran (caméra qui suit le héros) : l'étiquette d'une entité hors cadre n'est pas dessinée
        // (sinon elle s'empilerait contre le bord de l'écran)
        if (x < -reach || x > cam.vw + reach) return;
        // reste dans le cadre : une étiquette près du bord (sortie) ne doit pas être coupée
        if (cam.vw > w) x = Math.min(Math.max(x, w / 2 + 4), cam.vw - w / 2 - 4);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 6);
        else ctx.rect(x - w / 2, y - h / 2, w, h);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.stroke();
        ctx.fillStyle = fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y + 0.5);
    }

    // ── API publique ───────────────────────────────────────────────────────
    function applyQueuedEvents() {
        const queued = session.rt.queuedEvents;
        if (!queued || queued.length === 0) return;
        session.rt.queuedEvents = [];
        processEvents(queued);
    }

    return {
        init() {
            // police pixel des étiquettes dessinées sur le canvas (chargée à la demande par le navigateur)
            document.fonts?.load("700 14px 'Pixelify Sans'");
            document.fonts?.load("700 14px 'Rt Digits'", '0123456789');
            ensureSession();
            bindControls();
            cfg.onRegionVisited?.(X.currentScreen(session).region);
        },

        // Charge les dessins de la région courante (au démarrage, derrière l'écran de chargement initial).
        ready() {
            ensureSession();
            return prepareRegion(X.currentScreen(session).region);
        },

        show() {
            ensureSession();
            removeBattleTransition();
            root.style.display = 'block';
            inCombat = false;
            active = true;
            lastFrame = 0;
            syncVisual(true);
            refreshHud();
            if (!rafId) rafId = requestAnimationFrame(frame);
            if (X.needsIntro(session)) {
                const lines = X.markIntroSeen(session);
                // Le prologue a déjà été raconté par l'animation de nouvelle partie : pas de texte à dérouler en plus.
                if (!prologueAnimationPlayed()) openDialog({ icon: 'scroll', name: STORY_TITLE, title: 'Prologue' }, lines, () => { cfg.onSave(); });
                cfg.onSave();
            }
            applyQueuedEvents();
        },

        hide() {
            active = false;
            held = null;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = null;
            root.style.display = 'none';
            removeBattleTransition();
            closeJournal();
        },

        // Victoire : l'ennemi de la carte disparaît (avant la sauvegarde de fin de combat).
        // L'or des quêtes est crédité tout de suite (donc sauvegardé) ; les textes d'histoire
        // et les annonces s'affichent au retour sur la carte.
        onCombatVictory() {
            ensureSession();
            const id = session.rt.pendingEnemyId;
            if (!id) return;
            const firstKill = !session.data.defeated.includes(id);
            const events = X.markEnemyDefeated(session, id);
            if (firstKill && /^sun_[1-9]$/.test(id)) {
                const def = session.rt.enemyIndex[id]?.def;
                events.unshift({ type: 'sunFall', paid: true, count: session.data.defeated.filter(d => /^sun_[1-9]$/.test(d)).length, name: def?.boss?.name || def?.name || 'Soleil' });
            }
            const gold = events.reduce((sum, e) => sum + (e.gold || 0), 0);
            if (gold > 0) cfg.onGold(gold);
            const xpGain = events.reduce((sum, e) => sum + (e.xp || 0), 0);
            if (xpGain > 0) cfg.onXp?.(xpGain);
            events.forEach(e => { e.paid = true; });
            session.rt.queuedEvents.push(...events);
            session.rt.pendingEnemyId = null;
        },

        onCombatEnd(isVictory) {
            ensureSession();
            if (!isVictory && session.rt.pendingEnemyId) X.resetAfterDefeat(session);   // dans l'arène : expulsion
            session.rt.pendingEnemyId = null;
            vis.enemies = {};
            syncVisual(true);
            refreshHud();
            cfg.onSave();
        },

        // Nouvelle partie : le duel d'entraînement contre Fengmeng sert de tutoriel guidé.
        startTutorialDuel(enemyId = 'fengmeng_1') {
            ensureSession();
            prepareRegion(X.currentScreen(session).region).then(() => startEncounter(enemyId, { tutorial: true }));
        },

        travelTo,
        openCarnet: tab => { if (!isBlocked()) showJournal(tab); },
        getTravelList() { ensureSession(); return X.waypointList(session); },

        // Arène des Mille Flèches : entrée (point de retour mémorisé) et sortie à tout moment.
        inArena() { ensureSession(); return X.inArena(session); },
        // L'arène s'ouvre dès le 3e terrain (Bambous) : arena.js `isArenaUnlocked`
        isArenaUnlocked() { ensureSession(); return isArenaUnlocked(session.data.visitedScreens); },
        enterArena() { return changeArena(true); },
        leaveArena() { return changeArena(false); },

        teleportToScreen(screenId) {
            ensureSession();
            if (!X.teleportToScreen(session, screenId)) return false;
            vis.enemies = {};
            syncVisual(true);
            refreshHud();
            cfg.onSave();
            return true;
        },

        getCurrentRegion() {
            ensureSession();
            return X.currentScreen(session).region;
        },

        // Scène musicale de l'écran courant (null hors exploration, p. ex. en combat).
        getSceneInfo() {
            if (!session || !active || root.style.display === 'none' || inCombat) return null;
            const screen = X.currentScreen(session);
            return { kind: screen.interior ? 'house' : screen.kind || 'sanctuary', biome: screen.biome, region: screen.region };
        },

        isBusy: () => isBlocked(),
        toast
    };
}

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

import { escapeHtml } from "./escapeHtml.js";
import { getStuffById } from './stuff.js';
import { STORY_TITLE } from './story.js';
import * as X from './exploration.js';
import { vibrate, armVibration } from './gameOptions.js';
import { worldZones } from './worldMap.js';
import { playSfx } from './sound.js';
import { openPuzzle } from './puzzle/view.js';
import { openBook } from './change/view.js';
import { dialogFlags } from './dialogState.js';
import { playSunFallAnimation, playRegionDiscovery, playPortalTransition, playBossDialogue, prologueAnimationPlayed, playPrologueAnimation, playFengmengDuelCinematic } from './cinematics.js';
import { spriteUri, heroSprite, npcSprite, chestSprite, enemySprite, loadSpritePack, packsForKeys, decodeSprites, retainSprites, PX_GRID_BIG, gbaSprite, loadGbaSprites } from './sprites/index.js';
import { viewDir } from './sprites/side.js';
import { createTrail, recordHero, stepCompanion } from './companionTrail.js';
import { withLoadingScreen, trackProgress, isLoadingScreenSuppressed } from './loader.js';
import { loadSequence } from './ultimateCinematics.js';
import { ARENA_REGION, ARENA_NAME, arenaTier, isArenaUnlocked } from './arena.js';
import { decorSprite, DECOR_NAMES } from './sprites/decor.js';
import { DEAD_TREES } from './sprites/deadtrees.js';
import { icon } from './icons.js';
import { enemyCatalogList } from './enemies.js';
import { bestiaryEntries } from './bestiary.js';
import { createChangeFlow } from './explorationViewChange.js';
import { createCarnet } from './explorationViewCarnet.js';
import { createMapOverlay } from './explorationViewMap.js';
import { createGroundLayer } from './explorationViewGround.js';
import { createDraw } from './explorationViewDraw.js';
import { createOverlays } from './explorationViewOverlays.js';
import { createPainters } from './explorationViewPainters.js';
import { COVERED_DRAW_MS, IDLE_DRAW_MS, IDLE_DRAW_LOW_MS, MOVE_DELAY_MS, MOUNTED_MOVE_DELAY_MS, BATTLE_TRANSITION_MS, BATTLE_STRIPS, DIRECTIONS, KEY_TO_DIR } from './explorationViewConsts.js';


/**
 * @param {object} cfg
 *  root, canvas               éléments du DOM
 *  getSaved()/setSaved(data)  lecture / écriture de player.exploration
 *  getHero()                  { classId, name, mount? } du personnage (mount : 'horse' = déplacements deux fois plus rapides)
 *  getPlayerLevel()           niveau courant
 *  hasStealth()               vrai si le héros porte le collier d'ombre (indétectable par les ennemis, hors boss)
 *  onEncounter(encounter)     lance le combat (encounter.prep : préparation du terrain, voir terrain.js)
 *  getWeakness(templateId)    nom de la faiblesse d'un ennemi (observation), facultatif
 *  onUltimateLearned(id)      un ultime de légende vient d'être gagné (cinématique de révélation, jouée après les dialogues)
 *  onGold(amount)             crédite de l'or
 *  onXp(amount)               crédite de l'expérience (récompenses de quêtes)
 *  onSave()                   sauvegarde la partie (aussi après une Nouvelle Partie +)
 *  onRegionVisited(regionId)  région découverte
 *  onNewGamePlus()            Nouvelle Partie + lancée (remise à zéro de la carte du monde côté joueur)
 *  onOpenMap()                ouvre la carte du monde
 *  onOpenArena()              ouvre l'Arène des Mille Flèches (arena.js)
 *  onOpenMenu()               ouvre le menu (inventaire, sorts, stats)
 *  onExportSave()             exporte la sauvegarde dans un fichier (avant la Nouvelle Partie +) ; retourne true si l'export a réussi
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
        mirrorBtn: root.querySelector('[data-explore="mirror"]'),
        menuBtn: root.querySelector('[data-explore="menu"]')
    };

    let session = null;
    let active = false;
    let rafId = null;
    let lastDrawAt = 0;   // dernier dessin réel (la carte est redessinée au ralenti sous un modal)
    let lastFrame = 0;
    let held = null;
    let walk = null;          // déplacement au clic en cours : { tx, ty, path }
    let cam = { ox: 0, oy: 0, tile: 1, vw: 0 };
    let lastMoveAt = 0;
    let dialogQueue = [];
    let dialogIndex = 0;
    let toastTimer = null;
    let journalEl = null;
    let mapEl = null;   // carte plein écran (clic sur la minimap) : pose d'un repère
    let merchantEl = null;
    let inCombat = false;
    let battleTransitionEl = null;
    let battleTransitionTimer = null;
    const vis = { px: 0, py: 0, enemies: {}, bob: 0 };
    // Défilement d'une carte à l'autre (connexion de bordure) : l'image de la carte quittée glisse hors du cadre pendant que
    // la nouvelle entre, dans le sens de la marche. { dir, snap, t0 (null = au prochain dessin) }
    const SLIDE_MS = 260;
    let slide = null;
    const slideProgress = now => {
        if (!slide) return 1;
        if (slide.t0 === null) slide.t0 = now;
        const p = Math.min(1, (now - slide.t0) / SLIDE_MS);
        if (p >= 1) slide = null;
        return p;
    };
    let preparedRegion = null;   // région dont les dessins sont chargés et décodés
    let preparing = null;        // { region, promise } : chargement en cours

    let changeEnd = null;       // résout startChangeEpisode quand le mode se termine
    let healView = null;        // puzzle de soin ouvert (change/view.js)
    let changeFarewell = false; // épisode 3 : musique de l'adieu pendant la dernière conversation
    let stayAt = 0;
    let groundCache = null;
    let liquidCache = { screen: null, cells: [] };
    let groundJob = null;     // { screen, biome, tile, dpr, canvas, paintRows, y, done }
    let spareCanvas = null;   // canvas de sol recyclé (évite de réallouer ~30 Mo à chaque carte)
    let fogHeroCell = '';
    let lastBuzz = 0, auraAnnounced = false;
    const env = {
        cfg,
        get GATE_SCALE() { return GATE_SCALE; },
        get GROUND_MARGIN() { return GROUND_MARGIN; },
        get MARKER_COLOR() { return MARKER_COLOR; },
        get NARRATOR() { return NARRATOR; },
        get NO_MINIMAP() { return NO_MINIMAP; },
        get active() { return active; }, set active(v) { active = v; },
        get auraAnnounced() { return auraAnnounced; }, set auraAnnounced(v) { auraAnnounced = v; },
        get cam() { return cam; }, set cam(v) { cam = v; },
        canvas,
        get changeEnd() { return changeEnd; }, set changeEnd(v) { changeEnd = v; },
        get changeFarewell() { return changeFarewell; }, set changeFarewell(v) { changeFarewell = v; },
        get closeJournal() { return closeJournal; },
        get confirmNewGamePlus() { return confirmNewGamePlus; },
        ctx,
        get dialogQueue() { return dialogQueue; },
        get drawAura() { return drawAura; },
        get drawBuilding() { return drawBuilding; },
        get drawCachedObject() { return drawCachedObject; },
        get drawCrown() { return drawCrown; },
        get drawDarkness() { return drawDarkness; },
        get drawDecor() { return drawDecor; },
        get drawDpr() { return drawDpr; }, set drawDpr(v) { drawDpr = v; },
        get drawFogOfWar() { return drawFogOfWar; },
        get drawGateAura() { return drawGateAura; },
        get drawLabel() { return drawLabel; },
        get drawMarker() { return drawMarker; },
        get drawMarkerCompass() { return drawMarkerCompass; },
        get drawMerchantBadge() { return drawMerchantBadge; },
        get drawMinimap() { return drawMinimap; },
        get drawQuestCompass() { return drawQuestCompass; },
        get drawShadow() { return drawShadow; },
        get drawSprite() { return drawSprite; },
        get ensureSession() { return ensureSession; },
        get escapeHtml() { return escapeHtml; },
        get fogHeroCell() { return fogHeroCell; }, set fogHeroCell(v) { fogHeroCell = v; },
        get getGroundLayer() { return getGroundLayer; },
        get getLiquidCells() { return getLiquidCells; },
        get groundCache() { return groundCache; }, set groundCache(v) { groundCache = v; },
        get groundJob() { return groundJob; }, set groundJob(v) { groundJob = v; },
        get handleResult() { return handleResult; },
        get healView() { return healView; }, set healView(v) { healView = v; },
        get held() { return held; }, set held(v) { held = v; },
        get inCombat() { return inCombat; },
        get isDialogOpen() { return isDialogOpen; },
        get isOnScreen() { return isOnScreen; },
        get isRimTree() { return isRimTree; },
        get journalEl() { return journalEl; }, set journalEl(v) { journalEl = v; },
        get kindBadge() { return kindBadge; },
        get lastBuzz() { return lastBuzz; }, set lastBuzz(v) { lastBuzz = v; },
        get launchNewGamePlus() { return launchNewGamePlus; },
        get liquidCache() { return liquidCache; }, set liquidCache(v) { liquidCache = v; },
        get mapEl() { return mapEl; }, set mapEl(v) { mapEl = v; },
        get miniBase() { return miniBase; },
        get miniFog() { return miniFog; },
        get miniRect() { return miniRect; }, set miniRect(v) { miniRect = v; },
        get miniShift() { return miniShift; }, set miniShift(v) { miniShift = v; },
        get npcMarkerCached() { return npcMarkerCached; },
        get openDialog() { return openDialog; },
        get paintGroundCells() { return paintGroundCells; },
        get prepareRegion() { return prepareRegion; },
        get refreshHud() { return refreshHud; },
        get riding() { return riding; },
        root,
        get sceneSpeaker() { return sceneSpeaker; },
        get session() { return session; },
        get slide() { return slide; },
        slideProgress,
        get spareCanvas() { return spareCanvas; }, set spareCanvas(v) { spareCanvas = v; },
        get stayAt() { return stayAt; }, set stayAt(v) { stayAt = v; },
        get stopHoldRepeat() { return stopHoldRepeat; },
        get syncVisual() { return syncVisual; },
        get tileFor() { return tileFor; },
        get toast() { return toast; },
        get travelTo() { return travelTo; },
        vis,
        get walk() { return walk; }, set walk(v) { walk = v; },
    };
    const { NPC_HOP_SPEED, afterDialogs, askMirror, changeStay, eventsSpoken, kindBadge, openHealFor, openHouseMirror, playLegendEnd, playNpcArrival, proposeTracking, startChangeEpisode } = createChangeFlow(env);
    const { bestiaryPanel, showJournal } = createCarnet(env);
    const { MARKER_COLOR, changeArena, closeJournal, closeMapOverlay, drawMarkerCompass, openMapOverlay, travelTo } = createMapOverlay(env);
    const { GROUND_MARGIN, getGroundLayer, getLiquidCells, npcMarkerCached, paintGroundCells, prebuildNeighborGround, tileFor } = createGroundLayer(env);
    const { draw } = createDraw(env);
    const { NO_MINIMAP, drawAura, drawDarkness, drawFogOfWar, drawMinimap, drawQuestCompass, miniBase, miniFog, overMinimap } = createOverlays(env);
    const { GATE_SCALE, drawBuilding, drawCachedObject, drawCrown, drawDecor, drawGateAura, drawLabel, drawMarker, drawMerchantBadge, drawShadow, drawSprite, isRimTree } = createPainters(env);

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
        if (snap) { vis.px = st.x; vis.py = st.y; vis.cx = st.x; vis.cy = st.y; vis.trail = null; }
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
            const prog = X.changeProgress(session);
            els.objective.textContent = prog.length
                ? `Chang'e : soigner les habitants (${prog.filter(p => p.healed).length} / ${prog.length})`
                : `${tq ? (tq.side ? '[Annexe] ' : '[Principale] ') : ''}${X.currentObjectiveText(session)}`;
        }
        // Mode Chang'e : les icônes habituelles (journal, carte, arène, sac, monture) n'ont plus lieu d'être, seule l'icône miroir reste (style.css `.change-mode`).
        root.classList.toggle('change-mode', X.inChangeMode(session));
        // Bouton miroir : visible tant qu'un épisode de Chang'e est commencé et inachevé (il le rouvre, après confirmation).
        if (els.mirrorBtn) {
            if (!els.mirrorBtn.innerHTML) els.mirrorBtn.innerHTML = icon('mirror');
            els.mirrorBtn.hidden = !(X.inChangeMode(session) || X.pendingChangeEpisode(session));
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

    let puzzleView = null;   // énigme à plateau ouverte (puzzle/view.js), au-dessus de la carte
    const isDialogOpen = () => dialogQueue.length > 0;
    // La carte n'est « jouable » que si elle est réellement affichée (onglet Combat actif) et sans modal par-dessus.
    // Lecture de layout (getClientRects) appelée plusieurs fois par image : mémorisée 100 ms.
    let onScreenStamp = -Infinity, onScreenValue = false;
    const isOnScreen = () => {
        const t = performance.now();
        if (t - onScreenStamp > 100) { onScreenValue = root.getClientRects().length > 0; onScreenStamp = t; }
        return onScreenValue;
    };
    const isModalOpen = () => Boolean(document.querySelector('.modal.active'))
        || document.getElementById('levelup-modal')?.style.display === 'flex';
    const isRegionReady = () => Boolean(session) && preparedRegion === X.currentScreen(session).region;
    const isBlocked = () => Boolean(vis.npcAnim?.blocking) || isDialogOpen() || Boolean(puzzleView) || Boolean(healView) || inCombat || Boolean(journalEl) || Boolean(mapEl) || Boolean(merchantEl) || !isOnScreen() || isModalOpen() || !isRegionReady();

    // ── Ressources de la région ────────────────────────────────────────────
    // Biome de l'écran où se tient un ennemi (teinte de son dessin).
    const enemyBiome = enemyId => {
        const entry = session?.rt.enemyIndex[enemyId];
        return (entry && session.screens[entry.screenId]?.biome) || undefined;
    };

    // PNJ et ennemis d'une région (tous ses écrans), y compris les locuteurs des scènes de victoire.
    function regionEntities(region) {
        const screens = Object.values(session.screens).filter(sc => sc.region === region);
        const npcs = screens.flatMap(sc => sc.npcs).map(n => n.id);
        const enemies = screens.flatMap(sc => sc.enemies.map(e => [e.spriteKey || e.id, e.templateId, sc.biome]));
        // créatures des hautes herbes : dessin du gabarit (spriteKey = templateId), à charger avec la région
        screens.forEach(sc => (X.grassOf(sc)?.table || []).forEach(t => enemies.push([t.templateId, t.templateId, sc.biome])));
        screens.flatMap(sc => sc.enemies).forEach(e => {
            [e.defeatScene, ...(e.afterScenes || [])].forEach(scene => {
                const sp = scene?.speaker;
                if (sp?.npc) npcs.push(sp.npc);
                if (sp?.enemy) {
                    const def = session.rt.enemyIndex[sp.enemy]?.def;
                    enemies.push([def?.spriteKey || sp.enemy, def?.templateId, enemyBiome(sp.enemy)]);
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
            ...DEAD_TREES,
            ...npcs.map(id => npcSprite(id)),
            ...enemies.map(([key, templateId, biome]) => enemySprite(key, templateId, biome))
        ].filter(Boolean))];
    }

    // Charge les paquets de sprites de la région, libère les images des autres régions et décode les nouvelles.
    function prepareRegion(region) {
        // région prête : seul le héros peut manquer (classe choisie après le chargement initial)
        if (preparedRegion === region) return loadGbaSprites([cfg.getHero().classId, `${cfg.getHero().classId}_horse`]).catch(() => {});
        if (preparing?.region === region) return preparing.promise;
        const { npcs, enemies } = regionEntities(region);
        const packs = packsForKeys({ npcs, enemies });
        const zone = worldZones.find(z => z.id === region);
        const label = zone ? zone.name : region === ARENA_REGION ? ARENA_NAME : 'Chargement…';
        const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
        const clip = portrait && zone && !isLoadingScreenSuppressed() ? loadSequence(`biome_${region}`) : null;   // boucle d'arrivée du biome en fond de l'écran de chargement
        // sprites GBA de la région : héros, PNJ, ennemis et leurs gabarits (le reste se charge à la première apparition)
        const gba = loadGbaSprites([cfg.getHero().classId, `${cfg.getHero().classId}_horse`, X.MIMIC_SPRITE, ...npcs, ...enemies.flatMap(([key, templateId]) => [key, templateId])]);
        const promise = withLoadingScreen(label, async progress => {
            await trackProgress([...packs.map(loadSpritePack), gba], r => progress(r * 0.5));
            const svgs = regionSprites(region);
            retainSprites(svgs);
            await trackProgress(svgs.map(svg => decodeSprites([svg])), r => progress(0.5 + r * 0.5));
        }, clip).catch(err => {
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
        const { showChoices, closing } = dialogFlags(entry, dialogIndex, dialogQueue.length);
        const speaker = entry.speaker || {};
        box.innerHTML = `
            <div class="explore-dialog-portrait">${speaker.gba
                ? `<img class="pixel-art" alt="" src="${speaker.gba}">`
                : speaker.sprite
                ? `<img alt="" src="${spriteUri(speaker.sprite)}">`
                : icon(speaker.icon || 'scroll')}</div>
            <div class="explore-dialog-body">
                <div class="explore-dialog-name">${escapeHtml(speaker.name || '')}${speaker.title ? ` <span>— ${escapeHtml(speaker.title)}</span>` : ''}</div>
                <div class="explore-dialog-text">${escapeHtml(text)}</div>
                ${showChoices
                    ? `<div class="explore-dialog-choices">${entry.choices.map((c, i) => `<button type="button" class="explore-choice" data-choice="${i}">${escapeHtml(c.label)}</button>`).join('')}</div>`
                    : `<div class="explore-dialog-next">${closing ? 'Fermer' : 'Suivant ►'} <small>(Entrée / clic)</small></div>`}
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
            // Même si `after` échoue, la boîte est redessinée d'après la file (sinon elle resterait affichée, file vide, sans pouvoir se fermer).
            try { entry.after?.(); } finally { renderDialog(); }
            return;
        }
        renderDialog();
    }

    const NARRATOR = { icon: 'scroll', name: 'Narrateur' };

    // Locuteur d'une scène (`defeatScene.speaker`) : sprite de PNJ, d'ennemi ou du héros (`hero: true`), parchemin du narrateur sinon.
    function sceneSpeaker(sp = {}) {
        if (sp.hero) {
            const hero = cfg.getHero();
            return { name: sp.name || hero.name, title: sp.title, sprite: heroSprite(hero.classId), gba: gbaSprite(hero.classId), icon: NARRATOR.icon };
        }
        const npcDef = sp.npc
            ? Object.values(session.screens).flatMap(sc => sc.npcs).find(n => n.id === sp.npc)
            : null;
        const enemyDef = sp.enemy ? session.rt.enemyIndex[sp.enemy]?.def : null;
        // Xiao Gui (compagnon) parle sous sa forme de renard, pas sous celle de la renarde Xia dont il emprunte l'identifiant.
        const spriteNpc = sp.npc === 'huli_xia' && sp.name === 'Xiao Gui' ? 'xiao_gui' : sp.npc;
        const sprite = spriteNpc ? npcSprite(spriteNpc) : sp.enemy ? enemySprite(enemyDef?.spriteKey || sp.enemy, enemyDef?.templateId, enemyBiome(sp.enemy)) : null;
        // Même dessin que sur la carte : le sprite GBA du PNJ / de l'ennemi, sinon le sprite vectoriel de repli.
        const gba = spriteNpc ? gbaSprite(spriteNpc)
            : sp.enemy ? (gbaSprite(enemyDef?.spriteKey || sp.enemy) || gbaSprite(enemyDef?.templateId))
            : null;
        return {
            name: sp.name || NARRATOR.name,
            title: sp.title,
            sprite,
            gba,
            icon: NARRATOR.icon
        };
    }

    // Dialogues de compagnons (companions.js) : répliques de groupe contextuelles, jouées une fois chacune.
    function playBanter() {
        X.collectBanter(session).forEach(ev => openDialog(sceneSpeaker(ev.speaker), ev.lines));
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
            } else if (ev.type === 'parley') {
                toast(`Pourparlers avec ${ev.npc.name} : le passage s'ouvre sans combat.`, 4500);
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
                    if (spoken.has(ev.quest.id)) playLegendEnd(); else openDialog({ ...NARRATOR, title: ev.quest.chapter }, ev.lines, () => { playLegendEnd(); });
                } else if (!spoken.has(ev.quest.id)) openDialog({ ...NARRATOR, title: ev.quest.chapter }, ev.lines);
                if (!ev.paid) { gold += ev.gold || 0; xp += ev.xp || 0; cfg.onQuestReward?.(ev); }
                if (!ev.paid && ev.reward?.ultimate) afterDialogs(() => cfg.onUltimateLearned?.(ev.reward.ultimate));   // révélation de l'ultime après les dialogues
                const frag = ev.reward?.fragment ? ` · ${ev.reward.fragment}` : '';
                const stuffText = ev.reward?.stuff ? ` · ${getStuffById(ev.reward.stuff)?.name || 'Stuff'}` : '';
                const plus = ev.ended ? ' · Nouvelle Partie + débloquée (journal)' : '';
                toast(`Quête terminée : ${ev.quest.title} — +${ev.gold || 0} or${ev.xp ? ` · +${ev.xp} XP` : ''}${frag}${stuffText}${plus}`, ev.ended ? 8000 : 5000);
            } else if (ev.type === 'chestSealed') {
                toast(`${ev.chest.label || 'Coffre'} : vous n'avez aucune raison de fouiller ici pour l'instant.`, 3500);
            } else if (ev.type === 'chestOpened') {
                if (!ev.paid) gold += ev.gold || 0;
                // Butin (potions, reliques, armes) : tiré et rangé dans le sac par le jeu (chestLoot.js).
                const loot = ev.paid ? [] : (cfg.onChestLoot?.(ev) || []);
                const lootText = loot.length ? ` · ${loot.join(' · ')}` : '';
                const specialText = ev.questItem ? ` · Objet spécial : ${ev.questItem.name}` : '';
                // Popup qui reste jusqu'au clic : le joueur a le temps de lire la description et le butin.
                openDialog({ ...NARRATOR, icon: 'chest', title: ev.chest.label || 'Coffre' },
                    [`${(ev.early && ev.chest.earlyText) || ev.chest.openText || `${ev.chest.label || 'Coffre'} ouvert !`}${ev.gold ? ` +${ev.gold} or` : ''}${lootText}${specialText}`]);
            }
        });
        if (gold > 0) cfg.onGold(gold);
        if (xp > 0) cfg.onXp?.(xp);
        // Duel en plusieurs phases : la suivante démarre dès que les scènes sont dites, sans retour libre sur la carte.
        const chain = events.find(e => e.type === 'chain');
        if (chain) afterDialogs(() => startEncounter(chain.enemyId)); else playBanter();
        // Mode Chang'e : après la mort du soleil des régions 3, 6 et 9 et les dialogues, Hou Yi parle à Chang'e par le miroir, puis la transition se lance.
        const changeEv = events.find(e => e.type === 'changeEpisode');
        const episodeDone = changeEv ? new Promise(resolve => afterDialogs(() => startChangeEpisode(changeEv.episode).then(resolve))) : null;
        // PNJ qui accourt vers le héros en sautillant : une fois tous les dialogues dits (et l'épisode de Chang'e terminé), juste avant sa propre conversation.
        events.filter(e => e.type === 'npcArrival').forEach(e => {
            if (episodeDone) episodeDone.then(() => afterDialogs(() => playNpcArrival(e.npcId)));
            else afterDialogs(() => playNpcArrival(e.npcId));
        });
        cfg.onSave();
        refreshHud();
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

    // Nouvelle Partie + : l'histoire repart de zéro (niveau, équipement et arène sont conservés ; l'arène est ouverte dès le début),
    // les adversaires sont plus coriaces. Confirmation demandée, puis export de la sauvegarde, puis départ.
    function confirmNewGamePlus() {
        const ok = window.confirm('Commencer une Nouvelle Partie + ?\n\nVotre sauvegarde sera d\'abord exportée dans un fichier. L\'histoire repart du prologue, aux Rizières Desséchées : '
            + 'quêtes, soleils, coffres, pierres de voyage et compagnons sont remis à zéro, mais votre niveau et votre équipement sont conservés, et l\'arène est ouverte dès le début. Les ennemis seront plus puissants.');
        if (ok) launchNewGamePlus();
    }

    // Exporte la sauvegarde (la partie terminée sert de copie de secours), puis relance l'histoire en Nouvelle Partie +.
    function launchNewGamePlus() {
        if (!session.data.ended) return;
        if (cfg.onExportSave && !cfg.onExportSave()) { toast("L'export de la sauvegarde a échoué : la Nouvelle Partie + n'a pas été lancée.", 6000); return; }
        if (!X.startNewGamePlus(session)) return;
        closeJournal();
        session.rt.queuedEvents = [];
        session.rt.pendingEnemyId = null;
        held = null;
        walk = null;
        vis.enemies = {};
        syncVisual(true);
        refreshHud();
        cfg.onNewGamePlus?.();
        cfg.onRegionVisited?.(X.currentScreen(session).region);
        cfg.onSave();
        // L'histoire repart comme une nouvelle partie : prologue animé, puis duel d'ouverture contre Fengmeng.
        playPrologueAnimation().then(() => {
            X.markIntroSeen(session);
            cfg.onSave();
            toast(`Nouvelle Partie + ${session.data.ngPlus} : les soleils se lèvent de nouveau…`, 5000);
            return prepareRegion(X.currentScreen(session).region);
        }).then(() => startEncounter('fengmeng_1'));
    }

    // ── Actions ────────────────────────────────────────────────────────────
    // Animation « à la Pokémon » : éclairs blancs, volets noirs qui se referment en alternance,
    // puis le nom de l'adversaire. Le combat démarre à la fin (les saisies sont bloquées entre-temps).
    function playBattleTransition(enc, done) {
        playSfx(enc.boss ? 'bossStart' : 'battleStart');   // avant tout le reste : le jingle part avant l'animation, pas après
        removeBattleTransition();
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const overlay = document.createElement('div');
        const eKey = enc.spriteKey || enc.enemyId;
        const encGbaSprite = gbaSprite(eKey, 'front') || gbaSprite(enc.templateId, 'front');
        const encSvgSprite = encGbaSprite ? null : enemySprite(eKey, enc.templateId, enc.biome || enemyBiome(enc.enemyId));
        overlay.className = `battle-transition${reduced ? ' reduced' : ''}`;
        overlay.innerHTML = `
            <div class="bt-strips">${Array.from({ length: BATTLE_STRIPS }, (_, i) =>
                `<div class="bt-strip ${i % 2 ? 'from-right' : 'from-left'}" style="--i:${i}"></div>`).join('')}</div>
            <div class="bt-flash"></div>
            <div class="bt-title">
                <div class="bt-emoji">${encGbaSprite
                    ? `<img class="bt-sprite pixel-art" alt="" src="${encGbaSprite}">`
                    : encSvgSprite
                        ? `<img class="bt-sprite" alt="" src="${spriteUri(encSvgSprite, PX_GRID_BIG)}" data-small="${spriteUri(encSvgSprite)}">`
                        : icon('sword')}</div>
                <div class="bt-name">${escapeHtml(enc.boss?.name || enc.name)}</div>
                <div class="bt-level">${enc.boss ? `${icon('crown')} Boss · ` : ''}Niveau ${enc.level}</div>
            </div>`;
        root.appendChild(overlay);
        battleTransitionEl = overlay;
        battleTransitionTimer = setTimeout(() => {
            battleTransitionTimer = null;
            if (!enc.boss) { done(); return; }
            // Boss : échange de répliques avant le combat
            const big = overlay.querySelector('.bt-sprite');   // portrait de 52 px : la définition 32, pas le grand plan (64) réduit
            const spriteHtml = big ? `<img class="bt-sprite" alt="" src="${big.dataset.small || big.getAttribute('src')}">` : icon('crown');
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
        X.recordBestiary(session, enc.templateId);   // la créature entre au bestiaire du carnet
        session.rt.pendingEnemyId = enemyId;
        if (enc.prep?.lines?.length) toast(enc.prep.lines.join(' '), 4500);
        held = null;
        walk = null;
        inCombat = true;
        // Duel de mi-parcours contre Fengmeng : cinématique illustrée, une seule fois par partie, avant l'écran de combat
        const startBattle = () => playBattleTransition(enc, () => cfg.onEncounter(enc));
        const seen = (session.data.seenCinematics ||= {});
        if (enemyId === 'fengmeng_2' && !seen.fengmeng_2) {
            seen.fengmeng_2 = true;
            cfg.onSave();
            playFengmengDuelCinematic().then(startBattle);
        } else {
            cfg.onSave();
            startBattle();
        }
    }

    function handleResult(res) {
        if (res?.markerReached) toast('Repère atteint.', 1800);
        if (!res) return;
        switch (res.type) {
            case 'combat':
                startEncounter(res.enemyId);
                break;
            case 'changeStay':
                changeStay();
                break;
            case 'talk': {
                if (X.inChangeMode(session)) { openHealFor(res.npcId); break; }   // mode Chang'e : un habitant à soigner
                if (res.npcId === 'houyi_mirror') { openHouseMirror(); break; }   // miroir de la maison : rejeu d'un épisode
                const talk = X.talkToNpc(session, res.npcId);
                if (!talk) break;
                const spoken = eventsSpoken(talk.events);
                openDialog({ sprite: npcSprite(talk.npc.id), gba: gbaSprite(talk.npc.id), name: talk.npc.name, title: talk.npc.title }, talk.lines,
                    () => {
                        processEvents(talk.events, spoken);
                        if (talk.npc.merchant) openMerchant(talk.npc);
                        if (talk.combat) startEncounter(talk.combat);   // appât : l'ennemi surgit à la fin de la conversation
                    }, talk.warp ? [
                        { label: talk.warp.label || 'Partir', run: () => { const r = X.warpNpc(session, talk.npc.id); if (r) { held = null; walk = null; handleResult(r); } } },
                        { label: talk.warp.stay || 'Rester ici', run: () => {} }
                    ] : undefined);
                break;
            }
            case 'chest': {
                const chest = X.openChest(session, res.chestId);
                if (chest?.type === 'puzzle') {
                    // Coffre verrouillé par une énigme : la victoire l'ouvre aussitôt ; quitter la laisse intacte.
                    puzzleView = openPuzzle(root, chest.puzzleId, {
                        sfx: n => playSfx(n),
                        hero: gbaSprite(cfg.getHero().classId, 'front') || undefined,
                        onClose: () => { puzzleView = null; },
                        onSolved: () => {
                            const reward = X.solvePuzzle(session, chest.puzzleId);
                            const { done, total } = X.puzzleSetProgress(session, chest.puzzleId);
                            const opened = X.openChest(session, res.chestId);
                            if (opened) processEvents(opened.events);
                            if (reward?.stuff.length) {
                                const names = reward.stuff.map(id => cfg.onAncientArmor?.(id)).filter(Boolean);
                                openDialog({ ...NARRATOR, icon: 'shield', title: 'Armure antique' }, [`${names.join(' et ')} : une pièce d'armure antique se révèle !${reward.complete ? ` Les ${total} énigmes de la famille « ${reward.label} » sont résolues : l'armure est au complet, portez ses quatre pièces ensemble pour éveiller son pouvoir.` : ` Énigmes de la famille « ${reward.label} » : ${done}/${total}.`}`]);
                            }
                            cfg.onSave();
                        }
                    });
                    if (!puzzleView) toast('Le coffre ne bouge pas.', 3000);
                } else if (chest?.type === 'mimic') {
                    toast('Le coffre s\'ouvre sur une gueule pleine de dents : une mimique !', 3200);
                    startEncounter(chest.enemyId);
                } else if (chest) processEvents(chest.events);
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
                toast(res.isNew ? `${res.name} activée` : `${res.name}`, res.isNew ? 4200 : 2200);
                cfg.onSave();
                refreshHud();
                if (!journalEl) showJournal('travel');   // la borne ouvre le voyage rapide
                break;
            case 'transition': {
                const screen = X.currentScreen(session);
                startSlide(res);
                cfg.onRegionVisited?.(screen.region);
                vis.enemies = {};
                syncVisual(true);
                refreshHud();
                if (!res.border || screen.dark) toast(screen.dark && !cfg.getHero().torch ? `${screen.name} : il fait noir, une torche (en vente chez les marchands) aiderait.` : screen.name, screen.dark ? 4200 : 2200);
                // Première visite : petit texte d'ambiance du Narrateur.
                // Jamais de texte du Narrateur en entrant dans une maison.
                // Première entrée dans une région : cinématique, puis le texte d'ambiance.
                const zone = res.firstVisit && !screen.interior && screen.region !== ARENA_REGION
                    && X.regionVisitCount(session, screen.region) === 1
                    ? worldZones.find(z => z.id === screen.region)
                    // Écran d'événement (royaume des âmes errantes) : même animation de découverte, à sa première visite (`screen.biomeIntro`).
                    : (res.firstVisit && screen.biomeIntro ? screen.biomeIntro : null);
                // Tout ce qui s'affiche après l'arrivée (annonce, texte d'ambiance, alertes, quêtes) ; pour une porte d'événement, après l'animation de passage.
                const arrivalStory = () => {
                    // Annonce d'événement (une seule fois par partie) : s'affiche avant le texte d'ambiance de l'écran.
                    if (res.notice) openDialog({ ...NARRATOR, title: res.notice.title }, res.notice.lines);
                    const showArrival = () => { if (res.firstVisit && res.arrival?.length && !screen.interior) openDialog({ ...NARRATOR, title: screen.name }, res.arrival); };
                    if (zone) playRegionDiscovery(zone).then(showArrival); else showArrival();
                    if (res.warning) toast(`${res.warning.regionName} : niveau ${res.warning.minLevel} recommandé — les ennemis y sont redoutables.`, 5000);
                    // Dans une maison, les quêtes déclenchées à l'entrée n'ouvrent pas de dialogue du Narrateur (toasts seulement).
                    if (res.events?.length) processEvents(res.events, screen.interior ? eventsSpoken(res.events) : undefined);
                    else playBanter();
                };
                // Porte d'événement (res.portal 'in' / 'out') : animation pixel art de changement de biome, puis la suite.
                // À la première entrée, l'animation de découverte du biome (clip généré) remplace ce passage.
                if (res.portal && !(zone && screen.biomeIntro === zone)) playPortalTransition(res.portal).then(arrivalStory, arrivalStory); else arrivalStory();
                cfg.onSave();
                break;
            }
            default:
                break;
        }
    }

    // Copie de la dernière image affichée (carte quittée) pour le défilement ; aucun défilement pour une porte ou avec « mouvement réduit ».
    function startSlide(res) {
        slide = null;
        if (!res.border || !canvas.width || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const snap = document.createElement('canvas');
        snap.width = canvas.width;
        snap.height = canvas.height;
        snap.getContext('2d').drawImage(canvas, 0, 0);
        slide = { dir: res.dir, snap, t0: null };
    }

    const syncStealth = () => X.setStealth(session, cfg.hasStealth?.());

    function doMove(dirName) {
        if (isBlocked()) return;
        syncStealth();
        const d = DIRECTIONS[dirName];
        if (!d) return;
        handleResult(X.tryMove(session, d.dx, d.dy, { playerLevel: cfg.getPlayerLevel(), riding: riding() }));
        lastMoveAt = performance.now();
    }

    // ── Déplacement au clic ────────────────────────────────────────────────
    function tileFromEvent(ev) {
        const rect = canvas.getBoundingClientRect();
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        return { x: Math.floor((px - cam.ox) / cam.tile), y: Math.floor((py - cam.oy) / cam.tile) };
    }

    // Maintien du doigt : un « clic » est rejoué toutes les HOLD_REPEAT_MS à la dernière position connue.
    const HOLD_REPEAT_MS = 500;
    let holdTimer = null;
    let holdPointer = null;
    function stopHoldRepeat() {
        if (holdTimer !== null) clearInterval(holdTimer);
        holdTimer = null;
        holdPointer = null;
    }
    function onCanvasPointerMove(ev) {
        if (holdPointer && ev.pointerId === holdPointer.id) {
            holdPointer.clientX = ev.clientX;
            holdPointer.clientY = ev.clientY;
        }
    }
    function onCanvasPointerDown(ev) {
        if (!active || isBlocked()) return;
        ev.preventDefault();
        if (overMinimap(ev)) { openMapOverlay(); return; }   // un clic sur la minimap l'ouvre en plein écran (pose d'un repère)
        // Toucher le héros lance la perception du qì (talent, 5 s) : le geste sert aussi à réarmer les vibrations.
        const tile = tileFromEvent(ev);
        if (tile.x === session.data.x && tile.y === session.data.y && X.hasAura(cfg.getPlayerLevel())) {
            stopHoldRepeat();
            armVibration();
            const res = X.startPerception(session, cfg.getPlayerLevel());
            toast(res.found ? 'Perception du qì : une flèche rouge indique le trésor caché le plus proche.' : 'Perception du qì : aucun trésor caché ici.', 2600);
            vibrate(30);
            return;
        }
        stopHoldRepeat();
        holdPointer = { id: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY };
        holdTimer = setInterval(() => {
            if (!holdPointer || !active) { stopHoldRepeat(); return; }
            if (isBlocked()) return;
            walkTo(holdPointer);
        }, HOLD_REPEAT_MS);
        walkTo(ev);
    }

    function walkTo(ev) {
        const { x, y } = tileFromEvent(ev);
        syncStealth();
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
        syncStealth();
        const path = X.findPath(session, walk.tx, walk.ty);
        if (!path || path.length === 0) { walk = null; return; }
        walk.path = path;
        const next = path[0];
        const dx = next.x - session.data.x;
        const dy = next.y - session.data.y;
        syncStealth();
        const res = X.tryMove(session, dx, dy, { playerLevel: cfg.getPlayerLevel(), riding: riding() });
        lastMoveAt = performance.now();
        if (res.markerReached) toast('Repère atteint.', 1800);
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
        if (ev.key === 'Escape' && mapEl) { closeMapOverlay(); return; }
        if (ev.key === 'Escape' && journalEl) { closeJournal(); return; }
        if (ev.key === 'j' || ev.key === 'J') { showJournal(); return; }
        if (ev.key === 'c' || ev.key === 'C') { toggleMount(); return; }
        if (ev.key === 'v' || ev.key === 'V') { showJournal('travel'); return; }   // sans borne à portée : simple rappel de la règle
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
        canvas.addEventListener('pointermove', onCanvasPointerMove);
        for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, stopHoldRepeat);
        canvas.addEventListener('contextmenu', ev => ev.preventDefault());
        els.dialog?.addEventListener('click', ev => {
            const btn = ev.target.closest?.('[data-choice]');
            const entry = dialogQueue[0];
            if (btn && entry?.choices) {
                const choice = entry.choices[Number(btn.dataset.choice)];
                dialogQueue.shift();
                dialogIndex = 0;
                try { choice?.run?.(); } finally { renderDialog(); }
                return;
            }
            advanceDialog();
        });
        els.journalBtn?.addEventListener('click', showJournal);
        els.mountBtn?.addEventListener('click', () => { if (!isBlocked() && !X.inChangeMode(session)) toggleMount(); });
        els.mapBtn?.addEventListener('click', () => { if (!isBlocked() && !X.inChangeMode(session)) cfg.onOpenMap?.(); });   // Chang'e reste au village
        els.arenaBtn?.addEventListener('click', () => { if (!isBlocked() && !X.inChangeMode(session)) cfg.onOpenArena?.(); });
        els.mirrorBtn?.addEventListener('click', () => { if (!isBlocked()) askMirror(); });
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

        const sliding = Boolean(slide);
        if (held && !sliding && !isBlocked() && now - lastMoveAt >= moveDelay()) doMove(held);
        else if (walk && !sliding && !isBlocked() && now - lastMoveAt >= moveDelay()) walkStep();
        if (walk && isBlocked()) walk = null;
        if (!isBlocked()) {
            syncStealth();
            const events = X.tick(session, dt);
            const hit = events.find(e => e.type === 'combat');
            if (hit) startEncounter(hit.enemyId);
            else events.forEach(ev => handleResult(ev));
        }

        // Sur l'eau, le cheval ne suit pas : on met pied à terre tout seul.
        if (X.autoDismount(session, hasMount())) { toast('Le cheval ne suit pas sur l\'eau : vous mettez pied à terre.', 3000); cfg.onSave(); }
        refreshMountButton();
        const k = Math.min(1, dt / (riding() ? 55 : 95));
        // Héros : vitesse constante vers la case cible (une case par délai de pas), sans décélération entre deux pas :
        // en marche continue le mouvement est fluide au lieu de repartir de zéro à chaque case.
        const stepLen = dt / moveDelay() * 1.2;
        const dx = session.data.x - vis.px, dy = session.data.y - vis.py;
        const dist = Math.hypot(dx, dy);
        if (dist > 3) { vis.px = session.data.x; vis.py = session.data.y; }
        else if (dist <= stepLen) { vis.px = session.data.x; vis.py = session.data.y; }
        else { vis.px += dx / dist * stepLen; vis.py += dy / dist * stepLen; }
        // Mode Chang'e : les habitants de passage se baladent (en pause pendant un dialogue ou un puzzle)
        if (X.inChangeMode(session) && !isDialogOpen() && !healView) X.stepChangeAmbient(session, dt);
        // Compagnon actif : il suit la piste du héros, toujours derrière lui (companionTrail.js)
        if (X.activeCompanionOf(session)) {
            const heroDir = viewDir(session.rt.facing);
            if (!vis.trail) vis.trail = createTrail();
            recordHero(vis.trail, vis.px, vis.py, heroDir);
            stepCompanion(vis.trail, { x: vis.px, y: vis.py }, dt, heroDir);
        } else vis.trail = null;
        // Caméra : suit le héros avec un léger amorti (indépendant du pas), pour absorber les à-coups du défilement.
        if (vis.cx === undefined || Math.hypot(vis.px - vis.cx, vis.py - vis.cy) > 6) { vis.cx = vis.px; vis.cy = vis.py; }
        const kc = 1 - Math.exp(-dt / 90);
        vis.cx += (vis.px - vis.cx) * kc;
        vis.cy += (vis.py - vis.cy) * kc;
        X.aliveEnemies(session).forEach(e => {
            const v = vis.enemies[e.def.id] || (vis.enemies[e.def.id] = { x: e.x, y: e.y });
            v.x += (e.x - v.x) * k;
            v.y += (e.y - v.y) * k;
        });
        vis.bob = now;
        // PNJ qui accourt en sautillant (arrival) : avance vers sa cible et rebondit ; le saut s'arrête à l'arrivée.
        const na = vis.npcAnim;
        if (na && !na.idle) {
            const ndx = na.tx - na.x, ndy = na.ty - na.y, nd = Math.hypot(ndx, ndy), step = dt / 1000 * NPC_HOP_SPEED;
            if (nd <= step) { na.x = na.tx; na.y = na.ty; na.phase = 0; na.idle = true; const r = na.resolve; na.resolve = null; r?.(); }
            else { na.x += ndx / nd * step; na.y += ndy / nd * step; na.phase += dt / 1000 * NPC_HOP_SPEED * Math.PI * 1.1; }
        }

        // Dessin inutile (onglet caché, carte hors écran, cinématique opaque par-dessus) : on le saute. Sous un modal (voile à 70 %), la carte
        // ne bouge plus (la logique est bloquée) : 4 images/s suffisent. La logique ci-dessus reste exécutée à chaque image.
        const covered = document.hidden || !isOnScreen() || Boolean(document.querySelector('.cine-overlay'));
        const moving = sliding || Boolean(held) || Boolean(walk);
        const minGap = isModalOpen() ? COVERED_DRAW_MS : moving ? 0 : (document.body.classList.contains('fx-low') ? IDLE_DRAW_LOW_MS : IDLE_DRAW_MS);
        if (!covered && now - lastDrawAt >= minGap - 2) {
            lastDrawAt = now;
            draw(now);
            if (!slide) prebuildNeighborGround();
        }
        rafId = requestAnimationFrame(frame);
    }

    let drawDpr = 1;   // densité de pixels de l'image en cours (ombres pré-rendues)

    let miniShift = 0;   // 0 = à droite, 1 = à gauche (animé)
    let miniRect = null; // zone occupée à l'écran (px CSS du canvas) lors du dernier dessin
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
            // Annonce d'un événement activé : une seule fois par partie, au premier chargement du jeu (après le prologue éventuel).
            const launch = X.takeLaunchNotices(session);
            if (launch.length) {
                launch.forEach(n => openDialog({ ...NARRATOR, title: n.title }, n.lines, () => cfg.onSave()));
                cfg.onSave();
            }
            applyQueuedEvents();
            // Première créature d'herbe de la partie : une seule explication, au retour sur la carte.
            const wildIntro = X.takeWildIntro(session);
            if (wildIntro) toast(wildIntro, 4500);
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
                events.unshift({ type: 'sunFall', paid: true, id, count: session.data.defeated.filter(d => /^sun_[1-9]$/.test(d)).length, name: def?.boss?.name || def?.name || 'Soleil' });
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
            X.resetGrassSteps(session);   // après un combat (créature d'herbe comprise), 3 pas d'herbe sans rencontre
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
        // Contenu de l'onglet Bestiaire : les dessins des créatures connues (de toutes les régions) sont chargés avant d'afficher.
        async bestiaryHtml() {
            ensureSession();
            const { entries } = bestiaryEntries(enemyCatalogList(), session.data.bestiary);
            await loadGbaSprites(entries.map(e => e.id)).catch(() => {});
            return bestiaryPanel();
        },
        getTravelList() { ensureSession(); return X.waypointList(session); },
        canFastTravel() { ensureSession(); return X.nearWaypoint(session); },

        // Arène des Mille Flèches : entrée (point de retour mémorisé) et sortie à tout moment.
        inArena() { ensureSession(); return X.inArena(session); },
        // L'arène s'ouvre dès le 3e terrain (Bambous), ou dès le début en Nouvelle Partie + : arena.js `isArenaUnlocked`
        isArenaUnlocked() { ensureSession(); return isArenaUnlocked(session.data.visitedScreens, session.data.ngPlus); },
        enterArena() { return changeArena(true); },
        leaveArena() { return changeArena(false); },

        teleportToScreen(screenId) {
            ensureSession();
            if (!X.nearWaypoint(session) || !X.teleportToScreen(session, screenId)) return false;
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

        // Vrai quand le joueur explore librement : ni combat, ni dialogue, ni marchand, ni fenêtre ouverte.
        isIdle() { return Boolean(session && active && root.style.display !== 'none' && !isBlocked()); },

        // Vrai quand le joueur n'est ni en combat, ni en dialogue, ni chez un marchand, même si la carte n'est pas affichée
        // (autre onglet : Armes, Objets, Sorts…) : sert au rappel de pause, qui ne doit pas attendre le retour sur la carte.
        isFree() { return Boolean(session && !isDialogOpen() && !puzzleView && !inCombat && !journalEl && !merchantEl && isRegionReady()); },

        // Scène musicale de l'écran courant (null hors exploration, p. ex. en combat).
        getSceneInfo() {
            if (!session || !active || root.style.display === 'none' || inCombat) return null;
            const screen = X.currentScreen(session);
            // Souterrains (biome « cave ») : musique du biome de leur région (celui de sa zone sauvage).
            const biome = screen.underground && !screen.event ? (session.screens[`${screen.region}_wild`]?.biome || screen.biome) : screen.biome;   // écran d'événement : son propre biome (musique propre)
            return { kind: screen.interior ? 'house' : screen.kind || 'sanctuary', biome, region: screen.region };
        },

        getActiveQuestSummaries() {
            ensureSession();
            return X.activeQuestSummaries(session);
        },

        getActiveCompanionIds() {
            ensureSession();
            const active = X.activeCompanionOf(session);
            return active ? [active.id] : [];
        },

        // Menu des compagnons : recrutés, actif, et choix de l'actif (un seul à la fois).
        getCompanionChoices() {
            ensureSession();
            const active = X.activeCompanionOf(session);
            return { companions: X.companionsOf(session), activeId: active ? active.id : 'none' };
        },

        setActiveCompanion(id) {
            ensureSession();
            const ok = X.setActiveCompanion(session, id);
            if (ok) cfg.onSave?.();
            return ok;
        },

        isBusy: () => isBlocked(),
        // Mode Chang'e : musique du village ou de l'adieu (main.js), et le jeu sait qu'on joue Chang'e
        inChangeMode: () => Boolean(session && X.inChangeMode(session)),
        getChangeScene: () => (session && X.inChangeMode(session) ? (changeFarewell ? 'change-farewell' : 'change-village') : null),
        openChangeBook: () => openBook(root, session.data.change),
        startChangeEpisode: (n, opts) => startChangeEpisode(n, opts),   // ouvre un épisode de Chang'e (la mort des soleils 3, 6, 9 l'appelle ; aussi pour les essais)
        toast
    };
}

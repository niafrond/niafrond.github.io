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

import { STORY_TITLE, REGION_UNLOCK_LEVEL } from './story.js';
import * as X from './exploration.js';
import { spriteImage, spriteUri, heroSprite, npcSprite, chestSprite, enemySprite, preloadSprites } from './sprites/index.js';

const MIN_TILE = 44;    // en dessous, la carte défile avec le héros au lieu de rétrécir
const MAX_TILE = 96;
const HUD_TOP = 64;     // bandeau du haut (titre, objectif, boutons)
const HUD_BOTTOM = 8;
const MOVE_DELAY_MS = 150;
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
    paddy: { a: '#a8d672', b: '#9ecb68', path: '#e6d29a', cliff: '#8a6a3a', liquid: '#6ab7c9', sky: ['#bfe3f5', '#f4f9e8'], decor: ['🌾', '🏮', '🛖'] },
    riverbed: { a: '#c9a46b', b: '#c09b62', path: '#d9bd8a', cliff: '#7a5a35', liquid: '#7d6b4a', sky: ['#e3b878', '#f7e6c6'], decor: ['🪨', '🌾', '🪨'] },
    bamboo: { a: '#8a9684', b: '#808c7a', path: '#b8b09a', cliff: '#4a4f46', liquid: '#4f5f5a', sky: ['#9aa59a', '#d8dbd0'], decor: ['🎋', '🔥', '🎋'] },
    gobi: { a: '#efdfb2', b: '#e8d6a4', path: '#f7ecc8', cliff: '#bf9c58', liquid: '#78c0c8', sky: ['#f8d98a', '#fff6dc'], decor: ['🌵', '🪨', '🌵'] },
    storm: { a: '#7d7690', b: '#746d88', path: '#a39cb8', cliff: '#3f3a54', liquid: '#4a5fa8', sky: ['#3b3558', '#7a73a0'], decor: ['⛰️', '🌩️', '⛰️'] },
    volcano: { a: '#3b3438', b: '#352e32', path: '#5a4a48', cliff: '#1d1719', liquid: '#ff5a1f', sky: ['#2a1010', '#7a2a14'], decor: ['🌋', '🪨', '🌋'] },
    savanna: { a: '#d8c06a', b: '#cfb75f', path: '#ead89a', cliff: '#8a6c2e', liquid: '#4a8fb8', sky: ['#f4c26a', '#fde9bd'], decor: ['🌾', '🪨', '🌾'] },
    coast: { a: '#e6d7b0', b: '#dccda6', path: '#f0e4c4', cliff: '#8a7650', liquid: '#1d5fa8', sky: ['#7ec4ec', '#e6f5fb'], decor: ['🌊', '🪨', '🌊'] },
    fusang: { a: '#f0dc8c', b: '#e8d27e', path: '#fff0b0', cliff: '#b88a2a', liquid: '#e8b830', sky: ['#fde6a6', '#fffbea'], decor: ['🌳', '🏮', '🌳'] },
    moon: { a: '#c9cde8', b: '#bec3e0', path: '#e4e6f4', cliff: '#3a3f78', liquid: '#6f86d8', sky: ['#171a4a', '#3b3f86'], decor: ['🌕', '🏮', '🌕'] }
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
 *  getHero()                  { classId, emoji, name } du personnage
 *  getPlayerLevel()           niveau courant
 *  onEncounter(encounter)     lance le combat
 *  onGold(amount)             crédite de l'or
 *  onSave()                   sauvegarde la partie (aussi après une Nouvelle Partie +)
 *  onRegionVisited(regionId)  région découverte
 *  onOpenMap()                ouvre la carte du monde
 *  onOpenMenu()               ouvre le menu (inventaire, sorts, boutique, stats)
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
        mapBtn: root.querySelector('[data-explore="map"]'),
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
    let inCombat = false;
    let battleTransitionEl = null;
    let battleTransitionTimer = null;
    const vis = { px: 0, py: 0, enemies: {}, bob: 0 };

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
        const plus = session.data.ngPlus > 0 ? ` · 🌕 NG+${session.data.ngPlus}` : '';
        if (els.title) els.title.textContent = `📍 ${screen.name}${plus}`;
        if (els.objective) els.objective.textContent = X.currentObjectiveText(session);
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
    const isBlocked = () => isDialogOpen() || inCombat || Boolean(journalEl) || !isOnScreen() || isModalOpen();

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
                : (speaker.emoji || '📜')}</div>
            <div class="explore-dialog-body">
                <div class="explore-dialog-name">${escapeHtml(speaker.name || '')}${speaker.title ? ` <span>— ${escapeHtml(speaker.title)}</span>` : ''}</div>
                <div class="explore-dialog-text">${escapeHtml(text)}</div>
                <div class="explore-dialog-next">${last ? '✔ Fermer' : '▶ Suivant'} <small>(Entrée / clic)</small></div>
            </div>`;
        box.classList.add('visible');
    }

    function openDialog(speaker, lines, after) {
        if (!lines || lines.length === 0) { after?.(); return; }
        dialogQueue.push({ speaker, lines: [...lines], after });
        if (dialogQueue.length === 1) { dialogIndex = 0; }
        renderDialog();
    }

    function advanceDialog() {
        if (!isDialogOpen()) return;
        const entry = dialogQueue[0];
        if (dialogIndex < entry.lines.length - 1) {
            dialogIndex++;
        } else {
            dialogQueue.shift();
            dialogIndex = 0;
            entry.after?.();
        }
        renderDialog();
    }

    const NARRATOR = { emoji: '📜', name: 'Narrateur' };

    // Locuteur d'une scène (`defeatScene.speaker`) : sprite de PNJ ou d'ennemi, emoji de repli sinon.
    function sceneSpeaker(sp = {}) {
        const npcDef = sp.npc
            ? Object.values(session.screens).flatMap(sc => sc.npcs).find(n => n.id === sp.npc)
            : null;
        const enemyDef = sp.enemy ? session.rt.enemyIndex[sp.enemy]?.def : null;
        const sprite = sp.npc ? npcSprite(sp.npc) : sp.enemy ? enemySprite(enemyDef?.spriteKey || sp.enemy, enemyDef?.templateId) : null;
        return {
            name: sp.name || NARRATOR.name,
            title: sp.title,
            sprite,
            emoji: sp.emoji || npcDef?.emoji || enemyDef?.emoji || NARRATOR.emoji
        };
    }

    // Traite les événements d'histoire. `spoken` : quêtes dont le texte vient d'être dit par un PNJ.
    function processEvents(events, spoken = new Set()) {
        let gold = 0;
        events.forEach(ev => {
            if (ev.type === 'scene') {
                openDialog(sceneSpeaker(ev.speaker), ev.lines);
            } else if (ev.type === 'questStarted') {
                if (!spoken.has(ev.quest.id)) openDialog({ ...NARRATOR, title: `Nouvelle quête : ${ev.quest.title}` }, ev.lines);
                toast(`📜 Nouvelle quête${ev.quest.side ? ' secondaire' : ''} : ${ev.quest.title}`);
            } else if (ev.type === 'questCompleted') {
                if (!spoken.has(ev.quest.id)) openDialog({ ...NARRATOR, title: ev.quest.chapter }, ev.lines);
                if (!ev.paid) gold += ev.gold || 0;
                const frag = ev.reward?.fragment ? ` · 🧩 ${ev.reward.fragment}` : '';
                const plus = ev.ended ? ' · 🌕 Nouvelle Partie + débloquée (journal)' : '';
                toast(`✅ Quête terminée : ${ev.quest.title} — 💰 +${ev.gold || 0}${frag}${plus}`, ev.ended ? 8000 : 5000);
            } else if (ev.type === 'chestOpened') {
                if (!ev.paid) gold += ev.gold || 0;
                toast(`${ev.chest.openText || `🎁 ${ev.chest.label || 'Coffre'} ouvert !`}${ev.gold ? ` 💰 +${ev.gold}` : ''}`);
            }
        });
        if (gold > 0) cfg.onGold(gold);
        cfg.onSave();
        refreshHud();
    }

    function eventsSpoken(events) {
        return new Set(events.filter(e => e.quest).map(e => e.quest.id));
    }

    function showJournal() {
        if (journalEl) return closeJournal();
        const entries = X.journalEntries(session);
        journalEl = document.createElement('div');
        journalEl.className = 'explore-journal';
        const statusLabel = { available: '💬 À démarrer', active: '🎯 En cours', ready: '✅ À rendre', done: '🏁 Terminée' };
        journalEl.innerHTML = `
            <div class="explore-journal-card">
                <h3>📜 ${escapeHtml(STORY_TITLE)}</h3>
                ${session.data.ended ? '<p class="explore-journal-end">🌕 La légende est achevée !</p>' : ''}
                <div class="explore-journal-list">
                ${entries.length === 0 ? '<p>Aucune quête pour l\'instant. Parlez aux villageois.</p>' : entries.map(e => `
                    <div class="explore-quest ${e.status}">
                        <div class="explore-quest-head"><b>${escapeHtml(e.quest.title)}</b> <span>${statusLabel[e.status] || ''}</span></div>
                        <div class="explore-quest-chapter">${escapeHtml(e.quest.chapter)}</div>
                        ${e.status === 'available' ? '' : `<ul>${e.objectives.map(o => `<li class="${o.done ? 'done' : ''}">${o.done ? '☑' : '☐'} ${escapeHtml(o.text)}</li>`).join('')}</ul>`}
                    </div>`).join('')}
                </div>
                ${session.data.ended ? '<button type="button" class="primary explore-journal-ngplus">🌕 Nouvelle Partie +</button>' : ''}
                <button type="button" class="primary explore-journal-close">Fermer</button>
            </div>`;
        journalEl.addEventListener('click', ev => {
            if (ev.target.closest('.explore-journal-ngplus')) { confirmNewGamePlus(); return; }
            if (ev.target === journalEl || ev.target.closest('.explore-journal-close')) closeJournal();
        });
        root.appendChild(journalEl);
    }

    function closeJournal() {
        journalEl?.remove();
        journalEl = null;
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
        toast(`🌕 Nouvelle Partie + ${session.data.ngPlus} : les soleils se lèvent de nouveau…`, 5000);
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
                    : escapeHtml(enc.emoji || '⚔️')}</div>
                <div class="bt-name">${escapeHtml(enc.boss?.name || enc.name)}</div>
                <div class="bt-level">${enc.boss ? '👑 Boss · ' : ''}Niveau ${enc.level}</div>
            </div>`;
        root.appendChild(overlay);
        battleTransitionEl = overlay;
        battleTransitionTimer = setTimeout(() => {
            battleTransitionTimer = null;
            done();
        }, reduced ? 500 : BATTLE_TRANSITION_MS);
    }

    function removeBattleTransition() {
        clearTimeout(battleTransitionTimer);
        battleTransitionTimer = null;
        battleTransitionEl?.remove();
        battleTransitionEl = null;
    }

    function startEncounter(enemyId) {
        if (inCombat) return;
        const enc = X.encounterFor(session, enemyId, cfg.getPlayerLevel());
        if (!enc) return;
        session.rt.pendingEnemyId = enemyId;
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
                openDialog({ emoji: talk.npc.emoji, sprite: npcSprite(talk.npc.id), name: talk.npc.name, title: talk.npc.title }, talk.lines,
                    () => processEvents(talk.events, spoken));
                break;
            }
            case 'chest': {
                const chest = X.openChest(session, res.chestId);
                if (chest) processEvents(chest.events);
                break;
            }
            case 'illusion':
                // Mirage : aucun combat, il se dissipe ; l'état a changé, on sauvegarde.
                held = null;
                walk = null;
                openDialog({ ...NARRATOR, emoji: '✨', title: 'Mirage' }, res.lines);
                cfg.onSave();
                break;
            case 'shielded':
                held = null;
                walk = null;
                openDialog({ ...NARRATOR, emoji: '🛡️', title: 'Un bouclier de flammes' }, res.lines);
                break;
            case 'exitBlocked':
                if (res.reason === 'quest') toast(`🔒 ${res.message}`, 4500);
                else toast(`🌫️ Une brume magique bloque la route vers ${res.regionName} — niveau ${res.minLevel} requis.`, 4200);
                break;
            case 'transition': {
                const screen = X.currentScreen(session);
                cfg.onRegionVisited?.(screen.region);
                vis.enemies = {};
                syncVisual(true);
                refreshHud();
                toast(`📍 ${screen.name}`, 2200);
                // Première visite : petit texte d'ambiance du Narrateur.
                if (res.firstVisit && res.arrival?.length) openDialog({ ...NARRATOR, title: screen.name }, res.arrival);
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
            toast('🚫 Impossible d\'aller là.', 1600);
            return;
        }
        if (path.length === 0) return;
        held = null;
        walk = { tx: x, ty: y, path };
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
        if (ev.key === 'Escape' && journalEl) { closeJournal(); return; }
        if (ev.key === 'j' || ev.key === 'J') { showJournal(); return; }
        const dir = KEY_TO_DIR[ev.key];
        if (!dir) return;
        ev.preventDefault();
        if (ev.repeat) return;
        walk = null;
        held = dir;
        if (performance.now() - lastMoveAt >= MOVE_DELAY_MS) doMove(dir);
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
        els.dialog?.addEventListener('click', advanceDialog);
        els.journalBtn?.addEventListener('click', showJournal);
        els.mapBtn?.addEventListener('click', () => { if (!isBlocked()) cfg.onOpenMap?.(); });
        els.menuBtn?.addEventListener('click', () => { if (!isBlocked()) cfg.onOpenMenu?.(); });
    }

    // ── Boucle de rendu ────────────────────────────────────────────────────
    function frame(now) {
        if (!active) return;
        const dt = Math.min(100, now - (lastFrame || now));
        lastFrame = now;

        if (held && !isBlocked() && now - lastMoveAt >= MOVE_DELAY_MS) doMove(held);
        else if (walk && !isBlocked() && now - lastMoveAt >= MOVE_DELAY_MS) walkStep();
        if (walk && isBlocked()) walk = null;
        if (!isBlocked()) {
            const events = X.tick(session, dt);
            const hit = events.find(e => e.type === 'combat');
            if (hit) startEncounter(hit.enemyId);
            else events.forEach(ev => handleResult(ev));
        }

        const k = Math.min(1, dt / 95);
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

        // fond
        const sky = ctx.createLinearGradient(0, 0, 0, vh);
        sky.addColorStop(0, biome.sky[0]);
        sky.addColorStop(1, biome.sky[1]);
        ctx.fillStyle = sky;
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
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = biome.cliff;
        ctx.fillRect(ox - 4, oy - 4, mapW + 8, mapH + 8);
        ctx.restore();
        for (let y = 0; y < screen.h; y++) {
            for (let x = 0; x < screen.w; x++) {
                if (inRects(screen.liquids, x, y)) {
                    cell(x, y, biome.liquid);
                    const shimmer = 0.10 + 0.10 * Math.sin(now / 500 + x * 1.7 + y * 1.1);
                    cell(x, y, `rgba(255,255,255,${shimmer.toFixed(3)})`, tile * 0.08);
                } else {
                    const isPath = inRects(screen.paths, x, y);
                    cell(x, y, isPath ? biome.path : ((x + y) % 2 ? biome.a : biome.b));
                }
                if (aura.has(`${x},${y}`) && !inRects(screen.liquids, x, y)) {
                    cell(x, y, `rgba(220,38,38,${(0.16 + 0.12 * pulse).toFixed(3)})`);
                }
            }
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
            const minLevel = REGION_UNLOCK_LEVEL[session.screens[ex.to].region] || 1;
            const locked = X.isExitLocked(session, ex);
            const gated = locked || level < minLevel;
            cell(ex.x, ex.y, locked ? `rgba(200,200,210,${(0.5 + 0.2 * pulse).toFixed(3)})` : `rgba(255,236,150,${(0.6 + 0.3 * pulse).toFixed(3)})`);
            cell(ex.x, ex.y, 'rgba(255,255,255,0.45)', tile * 0.16);
            const c = P(ex.x + 0.5, ex.y + 0.5);
            const arrow = locked ? '🔒' : ex.x === 0 ? '◀' : ex.x === screen.w - 1 ? '▶' : ex.y === 0 ? '▲' : '▼';
            ctx.fillStyle = '#5a3e1b';
            ctx.font = `${Math.round(tile * 0.42)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(arrow, c.x, c.y);
            const labelY = ex.y === 0 ? c.y + tile * 0.75 : c.y - tile * 0.75;
            const labelText = locked ? `🔒 ${ex.label}` : gated ? `🌫️ ${ex.label} (niv. ${minLevel})` : ex.label;
            drawLabel(c.x, labelY, labelText,
                gated ? '#e5e7eb' : '#fff8e1', '#5a3e1b', Math.max(11, Math.round(tile * 0.2)));
        });

        // 2. Décors, PNJ, coffres, ennemis, héros (du haut vers le bas de l'écran)
        const items = [];
        for (let x = 0; x < screen.w; x++) {
            for (let y = 0; y < screen.h; y++) {
                if (inRects(screen.obstacles, x, y)) items.push({ depth: y, kind: 'block', x, y });
            }
        }
        X.visibleNpcs(session).forEach(n => items.push({ depth: n.y + 0.1, kind: 'npc', n, x: n.x, y: n.y }));
        X.visibleChests(session).forEach(c => items.push({ depth: c.y + 0.1, kind: 'chest', c, x: c.x, y: c.y }));
        X.aliveEnemies(session).forEach(e => {
            const v = vis.enemies[e.def.id] || e;
            items.push({ depth: v.y + 0.2, kind: 'enemy', e, x: v.x, y: v.y });
        });
        items.push({ depth: vis.py + 0.3, kind: 'player', x: vis.px, y: vis.py });
        items.sort((a, b) => a.depth - b.depth);

        const labelSize = Math.max(11, Math.round(tile * 0.2));
        items.forEach(it => {
            const c = P(it.x + 0.5, it.y + 0.5);
            switch (it.kind) {
                case 'block': {
                    cell(it.x, it.y, shade(biome.cliff, 10));
                    const emoji = biome.decor[Math.floor(hash(it.x, it.y) * biome.decor.length)];
                    drawShadow(c.x, c.y + tile * 0.3, tile * 0.32, tile * 0.11);
                    drawEmoji(emoji, c.x, c.y, tile * 0.85);
                    break;
                }
                case 'npc': {
                    const feet = c.y + tile * 0.4;
                    drawShadow(c.x, feet, tile * 0.28, tile * 0.1);
                    const bob = Math.sin(now / 520 + it.x * 1.3) * tile * 0.012;
                    if (!drawSprite(npcSprite(it.n.id), c.x, feet + bob, tile * 1.02)) drawEmoji(it.n.emoji, c.x, c.y, tile * 0.75);
                    const marker = X.npcMarker(session, it.n.id);
                    if (marker) drawMarker(c.x, c.y - tile * 0.72 - 4 * Math.abs(Math.sin(now / 300)), marker === '❓' ? '?' : '!', tile);
                    drawLabel(c.x, c.y + tile * 0.55, it.n.name, '#fff8e1', '#5a3e1b', labelSize);
                    break;
                }
                case 'chest': {
                    const opened = session.data.openedChests.includes(it.c.id);
                    const feet = c.y + tile * 0.36;
                    drawShadow(c.x, feet, tile * 0.28, tile * 0.1);
                    if (it.c.emojiOnly) {
                        // autel, etc. : décor en emoji (pas de sprite de coffre)
                        const glow = opened ? 0.25 : 0.55 + 0.25 * Math.sin(now / 400);
                        ctx.beginPath();
                        ctx.ellipse(c.x, feet - tile * 0.04, tile * 0.42, tile * 0.15, 0, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(255,248,200,${glow.toFixed(3)})`;
                        ctx.fill();
                        drawEmoji(opened ? (it.c.emojiOpened || '🏮') : (it.c.emoji || '🌕'), c.x, c.y - tile * 0.05, tile * 0.8);
                    } else if (!drawSprite(chestSprite(opened), c.x, feet, tile * 0.85)) {
                        drawEmoji(opened ? '📭' : (it.c.emoji || '🎁'), c.x, c.y, tile * 0.65);
                    }
                    break;
                }
                case 'enemy': {
                    const def = it.e.def;
                    const illusion = Boolean(def.illusion);
                    const boss = Boolean(def.boss);
                    const big = boss || illusion;       // un mirage copie la silhouette du vrai soleil
                    const shielded = X.isShielded(session, def);
                    const lvl = X.enemyLevel(def, level, session.data.ngPlus);
                    const size = tile * (big ? 1.55 : 1.08);
                    const feet = c.y + tile * 0.4;
                    // Indice des mirages : ils scintillent, n'ont ni ombre au sol ni étiquette de niveau.
                    if (!illusion) drawShadow(c.x, feet, tile * (boss ? 0.46 : 0.3), tile * 0.1);
                    const bob = Math.sin(now / 430 + it.x * 2.1 + it.y) * tile * 0.015;
                    ctx.save();
                    if (illusion) ctx.globalAlpha = 0.4 + 0.45 * (0.5 + 0.5 * Math.sin(now / 170 + it.x * 3.1 + it.y * 1.7));
                    if (!drawSprite(enemySprite(def.spriteKey || def.id, def.templateId), c.x, feet + bob, size)) {
                        drawEmoji(def.emoji, c.x, c.y, tile * (big ? 1.0 : 0.78));
                    }
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
                        drawLabel(c.x, c.y + tile * (boss ? 0.68 : 0.58), `${shielded ? '🛡 ' : boss ? '☠ ' : ''}Nv ${lvl}`, '#ffffff', color, labelSize);
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
                    const hero = cfg.getHero();
                    if (!drawSprite(heroSprite(hero.classId), c.x, feet + hop, tile * 1.06)) drawEmoji(hero.emoji, c.x, c.y + hop, tile * 0.76);
                    break;
                }
                default:
                    break;
            }
        });
    }

    // Dessine un sprite SVG (pieds vers le bas du cadre) centré sur cx, dont les pieds sont posés en feetY.
    // Retourne false tant que l'image n'est pas chargée (ou s'il n'y a pas de sprite).
    function drawSprite(svg, cx, feetY, size) {
        if (!svg) return false;
        const img = spriteImage(svg);
        if (!img.complete || !img.naturalWidth) return true; // en cours de chargement : on n'affiche pas l'emoji
        ctx.drawImage(img, cx - size / 2, feetY - size * 0.92, size, size);
        return true;
    }

    // Pastille de quête au-dessus d'un PNJ : « ! » (quête à prendre) ou « ? » (à rendre).
    function drawMarker(x, y, char, tile) {
        const r = tile * 0.17;
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

    function drawEmoji(emoji, x, y, size) {
        ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText(emoji, x, y);
    }

    function drawLabel(x, y, text, bg, fg, size = 12) {
        ctx.font = `700 ${size}px 'Rt Digits', 'Pixelify Sans', ui-monospace, monospace`;
        const w = ctx.measureText(text).width + 14;
        const h = size + 8;
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
            preloadSprites();
            // police pixel des étiquettes dessinées sur le canvas (chargée à la demande par le navigateur)
            document.fonts?.load("700 14px 'Pixelify Sans'");
            document.fonts?.load("700 14px 'Rt Digits'", '0123456789');
            ensureSession();
            bindControls();
            cfg.onRegionVisited?.(X.currentScreen(session).region);
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
                openDialog({ emoji: '📜', name: STORY_TITLE, title: 'Prologue' }, lines, () => { cfg.onSave(); });
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
            const events = X.markEnemyDefeated(session, id);
            const gold = events.reduce((sum, e) => sum + (e.gold || 0), 0);
            if (gold > 0) cfg.onGold(gold);
            events.forEach(e => { e.paid = true; });
            session.rt.queuedEvents.push(...events);
            session.rt.pendingEnemyId = null;
        },

        onCombatEnd(isVictory) {
            ensureSession();
            if (!isVictory && session.rt.pendingEnemyId) X.resetAfterDefeat(session);
            session.rt.pendingEnemyId = null;
            syncVisual(true);
            cfg.onSave();
        },

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

        isBusy: () => isBlocked(),
        toast
    };
}

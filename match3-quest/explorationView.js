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
const BIOMES = {
    village: { a: '#8fd16a', b: '#84c760', path: '#e8d3a0', cliff: '#a8692f', liquid: '#3b8fdd', sky: ['#9ad7f5', '#e8f7ff'], decor: ['🏠', '🏡', '🌳'] },
    forest: { a: '#4fa85a', b: '#469d51', path: '#b98c5a', cliff: '#6b4a2b', liquid: '#3b8fdd', sky: ['#7fc8a0', '#d9f2dc'], decor: ['🌲', '🌳', '🌲'] },
    den: { a: '#7a6a55', b: '#716150', path: '#5c4d3b', cliff: '#3e3226', liquid: '#3b8fdd', sky: ['#4a3f35', '#8a7a66'], decor: ['🪨', '🍄', '🪨'] },
    ruins: { a: '#a9ad9a', b: '#9fa390', path: '#c9c2a8', cliff: '#6f7364', liquid: '#3b8fdd', sky: ['#b6c4d8', '#eef2f7'], decor: ['🏛️', '🧱', '🪨'] },
    warcamp: { a: '#b08256', b: '#a67a50', path: '#d3a76e', cliff: '#5e4029', liquid: '#3b8fdd', sky: ['#d98b6a', '#f6d7b8'], decor: ['⛺', '🪵', '🪨'] },
    desert: { a: '#ecd394', b: '#e4c988', path: '#f5e3b3', cliff: '#b18a45', liquid: '#3b8fdd', sky: ['#f6c56b', '#fdf0cf'], decor: ['🌵', '🪨', '🌵'] },
    frozen: { a: '#e4f1fa', b: '#d8e9f5', path: '#bcd7ea', cliff: '#8fb4cf', liquid: '#5bb0e0', sky: ['#a9d3ee', '#f2faff'], decor: ['🌲', '🧊', '🌲'] },
    abyss: { a: '#5b4a7c', b: '#54446f', path: '#7b68a0', cliff: '#2e2445', liquid: '#1a1030', sky: ['#1a1030', '#3a2a5c'], decor: ['💎', '🪨', '💎'] }
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
 *  getHero()                  { emoji, name } du personnage
 *  getPlayerLevel()           niveau courant
 *  onEncounter(encounter)     lance le combat
 *  onGold(amount)             crédite de l'or
 *  onSave()                   sauvegarde la partie
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
    let cam = { ox: 0, oy: 0, tile: 1 };
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
        if (els.title) els.title.textContent = `📍 ${screen.name}`;
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
            <div class="explore-dialog-portrait">${speaker.emoji || '📜'}</div>
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

    // Traite les événements d'histoire. `spoken` : quêtes dont le texte vient d'être dit par un PNJ.
    function processEvents(events, spoken = new Set()) {
        let gold = 0;
        events.forEach(ev => {
            if (ev.type === 'questStarted') {
                if (!spoken.has(ev.quest.id)) openDialog({ ...NARRATOR, title: `Nouvelle quête : ${ev.quest.title}` }, ev.lines);
                toast(`📜 Nouvelle quête${ev.quest.side ? ' secondaire' : ''} : ${ev.quest.title}`);
            } else if (ev.type === 'questCompleted') {
                if (!spoken.has(ev.quest.id)) openDialog({ ...NARRATOR, title: ev.quest.chapter }, ev.lines);
                if (!ev.paid) gold += ev.gold || 0;
                const frag = ev.reward?.fragment ? ` · 🧩 ${ev.reward.fragment}` : '';
                toast(`✅ Quête terminée : ${ev.quest.title} — 💰 +${ev.gold || 0}${frag}`, 5000);
            } else if (ev.type === 'chestOpened') {
                if (!ev.paid) gold += ev.gold || 0;
                toast(`🎁 ${ev.chest.label || 'Coffre'} ouvert ! 💰 +${ev.gold}`);
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
                ${session.data.ended ? '<p class="explore-journal-end">🏆 La Couronne est reconstituée !</p>' : ''}
                <div class="explore-journal-list">
                ${entries.length === 0 ? '<p>Aucune quête pour l\'instant. Parlez aux villageois.</p>' : entries.map(e => `
                    <div class="explore-quest ${e.status}">
                        <div class="explore-quest-head"><b>${escapeHtml(e.quest.title)}</b> <span>${statusLabel[e.status] || ''}</span></div>
                        <div class="explore-quest-chapter">${escapeHtml(e.quest.chapter)}</div>
                        ${e.status === 'available' ? '' : `<ul>${e.objectives.map(o => `<li class="${o.done ? 'done' : ''}">${o.done ? '☑' : '☐'} ${escapeHtml(o.text)}</li>`).join('')}</ul>`}
                    </div>`).join('')}
                </div>
                <button type="button" class="primary explore-journal-close">Fermer</button>
            </div>`;
        journalEl.addEventListener('click', ev => {
            if (ev.target === journalEl || ev.target.closest('.explore-journal-close')) closeJournal();
        });
        root.appendChild(journalEl);
    }

    function closeJournal() {
        journalEl?.remove();
        journalEl = null;
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
                <div class="bt-emoji">${escapeHtml(enc.emoji || '⚔️')}</div>
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
                openDialog({ emoji: talk.npc.emoji, name: talk.npc.name, title: talk.npc.title }, talk.lines,
                    () => processEvents(talk.events, spoken));
                break;
            }
            case 'chest': {
                const chest = X.openChest(session, res.chestId);
                if (chest) processEvents(chest.events);
                break;
            }
            case 'exitBlocked':
                toast(`🌫️ Une brume magique bloque la route vers ${res.regionName} — niveau ${res.minLevel} requis.`, 4200);
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
        const biome = BIOMES[screen.biome] || BIOMES.forest;
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
        cam = { ox, oy, tile };
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
            const gated = level < minLevel;
            cell(ex.x, ex.y, `rgba(255,236,150,${(0.6 + 0.3 * pulse).toFixed(3)})`);
            cell(ex.x, ex.y, 'rgba(255,255,255,0.45)', tile * 0.16);
            const c = P(ex.x + 0.5, ex.y + 0.5);
            const arrow = ex.x === 0 ? '◀' : ex.x === screen.w - 1 ? '▶' : ex.y === 0 ? '▲' : '▼';
            ctx.fillStyle = '#5a3e1b';
            ctx.font = `${Math.round(tile * 0.42)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(arrow, c.x, c.y);
            const labelY = ex.y === 0 ? c.y + tile * 0.75 : c.y - tile * 0.75;
            drawLabel(c.x, labelY, gated ? `🌫️ ${ex.label} (niv. ${minLevel})` : ex.label,
                gated ? '#e5e7eb' : '#fff8e1', '#5a3e1b', Math.max(10, Math.round(tile * 0.17)));
        });

        // 2. Décors, PNJ, coffres, ennemis, héros (du haut vers le bas de l'écran)
        const items = [];
        for (let x = 0; x < screen.w; x++) {
            for (let y = 0; y < screen.h; y++) {
                if (inRects(screen.obstacles, x, y)) items.push({ depth: y, kind: 'block', x, y });
            }
        }
        screen.npcs.forEach(n => items.push({ depth: n.y + 0.1, kind: 'npc', n, x: n.x, y: n.y }));
        screen.chests.forEach(c => items.push({ depth: c.y + 0.1, kind: 'chest', c, x: c.x, y: c.y }));
        X.aliveEnemies(session).forEach(e => {
            const v = vis.enemies[e.def.id] || e;
            items.push({ depth: v.y + 0.2, kind: 'enemy', e, x: v.x, y: v.y });
        });
        items.push({ depth: vis.py + 0.3, kind: 'player', x: vis.px, y: vis.py });
        items.sort((a, b) => a.depth - b.depth);

        const labelSize = Math.max(10, Math.round(tile * 0.17));
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
                    drawShadow(c.x, c.y + tile * 0.32, tile * 0.28, tile * 0.1);
                    drawEmoji(it.n.emoji, c.x, c.y, tile * 0.75);
                    const marker = X.npcMarker(session, it.n.id);
                    if (marker) drawEmoji(marker, c.x, c.y - tile * 0.62 - 4 * Math.abs(Math.sin(now / 300)), tile * 0.4);
                    drawLabel(c.x, c.y + tile * 0.55, it.n.name, '#fff8e1', '#5a3e1b', labelSize);
                    break;
                }
                case 'chest': {
                    const opened = session.data.openedChests.includes(it.c.id);
                    drawShadow(c.x, c.y + tile * 0.3, tile * 0.28, tile * 0.1);
                    drawEmoji(opened ? '📭' : '🎁', c.x, c.y, tile * 0.65);
                    break;
                }
                case 'enemy': {
                    const def = it.e.def;
                    const boss = Boolean(def.boss);
                    const lvl = X.enemyLevel(def, level);
                    drawShadow(c.x, c.y + tile * 0.32, tile * (boss ? 0.42 : 0.3), tile * 0.1);
                    drawEmoji(def.emoji, c.x, c.y, tile * (boss ? 1.0 : 0.78));
                    if (boss) drawEmoji('👑', c.x, c.y - tile * 0.72 - 3 * Math.abs(Math.sin(now / 350)), tile * 0.4);
                    const color = lvl > level ? '#dc2626' : lvl < level ? '#16a34a' : '#ca8a04';
                    drawLabel(c.x, c.y + tile * (boss ? 0.68 : 0.56), `${boss ? '☠ ' : ''}Nv ${lvl}`, '#ffffff', color, labelSize);
                    break;
                }
                case 'player': {
                    const moving = Math.hypot(session.data.x - vis.px, session.data.y - vis.py) > 0.05;
                    const hop = moving ? -tile * 0.08 * Math.abs(Math.sin(now / 70)) : 0;
                    drawShadow(c.x, c.y + tile * 0.32, tile * 0.28, tile * 0.1);
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, tile * 0.4, 0, Math.PI * 2);
                    ctx.strokeStyle = '#facc15';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    drawEmoji(cfg.getHero().emoji, c.x, c.y + hop, tile * 0.76);
                    break;
                }
                default:
                    break;
            }
        });
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
        ctx.font = `bold ${size}px system-ui, sans-serif`;
        const w = ctx.measureText(text).width + 12;
        const h = size + 7;
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

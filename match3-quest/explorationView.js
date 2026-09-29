// Phase d'exploration : rendu isométrique (canvas), saisie clavier / pavé tactile,
// dialogues de PNJ, journal de quêtes. La logique est dans exploration.js, les données
// (cartes, histoire) dans story.js.
//
// Repère : x augmente vers le bas-droite de l'écran, y vers le bas-gauche. Les touches sont
// donc : ↑ = haut-droite, → = bas-droite, ↓ = bas-gauche, ← = haut-gauche.

import { STORY_TITLE, REGION_UNLOCK_LEVEL } from './story.js';
import * as X from './exploration.js';

const TW = 64;          // largeur d'une tuile (losange)
const TH = 32;          // hauteur d'une tuile
const DEPTH = 22;       // épaisseur de la falaise sous l'île
const PAD_X = 24;
const PAD_TOP = 78;     // marge haute : sprites et bandeaux dépassent au-dessus de la carte
const MOVE_DELAY_MS = 150;

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
        dpad: root.querySelectorAll('[data-dir]')
    };

    let session = null;
    let active = false;
    let rafId = null;
    let lastFrame = 0;
    let held = null;
    let lastMoveAt = 0;
    let dialogQueue = [];
    let dialogIndex = 0;
    let toastTimer = null;
    let journalEl = null;
    let inCombat = false;
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
    const isOnScreen = () => root.offsetParent !== null;
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
                toast(`📜 Nouvelle quête : ${ev.quest.title}`);
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
    function startEncounter(enemyId) {
        const enc = X.encounterFor(session, enemyId, cfg.getPlayerLevel());
        if (!enc) return;
        session.rt.pendingEnemyId = enemyId;
        held = null;
        inCombat = true;
        cfg.onSave();
        cfg.onEncounter(enc);
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
        els.dpad.forEach(btn => {
            const dir = btn.dataset.dir;
            const start = ev => { ev.preventDefault(); held = dir; doMove(dir); };
            const stop = () => { if (held === dir) held = null; };
            btn.addEventListener('pointerdown', start);
            btn.addEventListener('pointerup', stop);
            btn.addEventListener('pointerleave', stop);
            btn.addEventListener('pointercancel', stop);
            btn.addEventListener('contextmenu', ev => ev.preventDefault());
        });
        els.dialog?.addEventListener('click', advanceDialog);
        els.journalBtn?.addEventListener('click', showJournal);
        els.mapBtn?.addEventListener('click', () => { if (!isBlocked()) cfg.onOpenMap?.(); });
    }

    // ── Boucle de rendu ────────────────────────────────────────────────────
    function frame(now) {
        if (!active) return;
        const dt = Math.min(100, now - (lastFrame || now));
        lastFrame = now;

        if (held && !isBlocked() && now - lastMoveAt >= MOVE_DELAY_MS) doMove(held);
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

    function layout(screen) {
        const width = (screen.w + screen.h) * TW / 2 + PAD_X * 2;
        const height = (screen.w + screen.h) * TH / 2 + DEPTH + PAD_TOP;
        return { width, height, ox: PAD_X + screen.h * TW / 2, oy: PAD_TOP };
    }

    function draw(now) {
        const screen = X.currentScreen(session);
        const biome = BIOMES[screen.biome] || BIOMES.forest;
        const L = layout(screen);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (canvas.width !== Math.round(L.width * dpr) || canvas.height !== Math.round(L.height * dpr)) {
            canvas.width = Math.round(L.width * dpr);
            canvas.height = Math.round(L.height * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const sky = ctx.createLinearGradient(0, 0, 0, L.height);
        sky.addColorStop(0, biome.sky[0]);
        sky.addColorStop(1, biome.sky[1]);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, L.width, L.height);

        const P = (x, y) => ({ x: L.ox + (x - y) * TW / 2, y: L.oy + (x + y) * TH / 2 });
        const level = cfg.getPlayerLevel();
        const aura = X.getAuraTiles(session);
        const pulse = 0.5 + 0.5 * Math.sin(now / 320);

        const diamond = (x, y, fill, inset = 0) => {
            const t = P(x, y), r = P(x + 1, y), b = P(x + 1, y + 1), l = P(x, y + 1);
            ctx.beginPath();
            ctx.moveTo(t.x, t.y + inset);
            ctx.lineTo(r.x - inset * 2, r.y);
            ctx.lineTo(b.x, b.y - inset);
            ctx.lineTo(l.x + inset * 2, l.y);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
        };
        const inRects = (rects, x, y) => rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);

        // 1. Sol, falaises, chemins, liquides, zones de vigilance
        for (let s = 0; s <= screen.w + screen.h - 2; s++) {
            for (let x = 0; x < screen.w; x++) {
                const y = s - x;
                if (y < 0 || y >= screen.h) continue;
                const liquid = inRects(screen.liquids, x, y);
                const isPath = inRects(screen.paths, x, y);
                // faces de falaise sur le bord bas de l'île
                if (x === screen.w - 1) {
                    const r = P(x + 1, y), b = P(x + 1, y + 1);
                    ctx.beginPath();
                    ctx.moveTo(r.x, r.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y + DEPTH); ctx.lineTo(r.x, r.y + DEPTH);
                    ctx.closePath();
                    ctx.fillStyle = shade(biome.cliff, -25);
                    ctx.fill();
                }
                if (y === screen.h - 1) {
                    const b = P(x + 1, y + 1), l = P(x, y + 1);
                    ctx.beginPath();
                    ctx.moveTo(l.x, l.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y + DEPTH); ctx.lineTo(l.x, l.y + DEPTH);
                    ctx.closePath();
                    ctx.fillStyle = biome.cliff;
                    ctx.fill();
                }
                if (liquid) {
                    diamond(x, y, biome.liquid);
                    const shimmer = 0.10 + 0.10 * Math.sin(now / 500 + x * 1.7 + y * 1.1);
                    diamond(x, y, `rgba(255,255,255,${shimmer.toFixed(3)})`, 3);
                } else {
                    diamond(x, y, isPath ? biome.path : ((x + y) % 2 ? biome.a : biome.b));
                }
                if (aura.has(`${x},${y}`) && !liquid) {
                    diamond(x, y, `rgba(220,38,38,${(0.14 + 0.10 * pulse).toFixed(3)})`);
                }
            }
        }

        // contour des zones de vigilance (lecture claire de « où ne pas passer »)
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(220,38,38,${(0.35 + 0.25 * pulse).toFixed(3)})`;
        aura.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            if (inRects(screen.liquids, x, y)) return;
            const t = P(x, y), r = P(x + 1, y), b = P(x + 1, y + 1), l = P(x, y + 1);
            ctx.beginPath();
            ctx.moveTo(t.x, t.y); ctx.lineTo(r.x, r.y); ctx.lineTo(b.x, b.y); ctx.lineTo(l.x, l.y); ctx.closePath();
            ctx.stroke();
        });

        // sorties
        screen.exits.forEach(ex => {
            const minLevel = REGION_UNLOCK_LEVEL[session.screens[ex.to].region] || 1;
            const gated = level < minLevel;
            diamond(ex.x, ex.y, `rgba(255,236,150,${(0.55 + 0.35 * pulse).toFixed(3)})`);
            diamond(ex.x, ex.y, 'rgba(255,255,255,0.45)', 6);
            const c = P(ex.x + 0.5, ex.y + 0.5);
            ctx.fillStyle = '#5a3e1b';
            ctx.font = '18px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('➜', c.x, c.y);
            drawLabel(c.x, c.y - 30 - pulse * 3, gated ? `🌫️ ${ex.label} (niv. ${minLevel})` : ex.label,
                gated ? '#e5e7eb' : '#fff8e1', '#5a3e1b');
        });

        // 2. Objets triés en profondeur
        const items = [];
        for (let x = 0; x < screen.w; x++) {
            for (let y = 0; y < screen.h; y++) {
                if (inRects(screen.obstacles, x, y)) items.push({ depth: x + y + 0.5, kind: 'block', x, y });
            }
        }
        screen.npcs.forEach(n => items.push({ depth: n.x + n.y + 0.5, kind: 'npc', n, x: n.x, y: n.y }));
        screen.chests.forEach(c => items.push({ depth: c.x + c.y + 0.5, kind: 'chest', c, x: c.x, y: c.y }));
        X.aliveEnemies(session).forEach(e => {
            const v = vis.enemies[e.def.id] || e;
            items.push({ depth: v.x + v.y + 0.6, kind: 'enemy', e, x: v.x, y: v.y });
        });
        items.push({ depth: vis.px + vis.py + 0.65, kind: 'player', x: vis.px, y: vis.py });
        items.sort((a, b) => a.depth - b.depth);

        items.forEach(it => {
            const c = P(it.x + 0.5, it.y + 0.5);
            switch (it.kind) {
                case 'block': {
                    diamond(it.x, it.y, shade(biome.cliff, 10));
                    const emoji = biome.decor[Math.floor(hash(it.x, it.y) * biome.decor.length)];
                    drawShadow(c.x, c.y + 4, 15, 6);
                    drawEmoji(emoji, c.x, c.y - 6, 40);
                    break;
                }
                case 'npc': {
                    drawShadow(c.x, c.y + 5, 13, 5);
                    drawEmoji(it.n.emoji, c.x, c.y - 8, 34);
                    const marker = X.npcMarker(session, it.n.id);
                    if (marker) drawEmoji(marker, c.x, c.y - 42 - 4 * Math.abs(Math.sin(now / 300)), 22);
                    drawLabel(c.x, c.y + 20, it.n.name, '#fff8e1', '#5a3e1b', 11);
                    break;
                }
                case 'chest': {
                    const opened = session.data.openedChests.includes(it.c.id);
                    drawShadow(c.x, c.y + 5, 13, 5);
                    drawEmoji(opened ? '📭' : '🎁', c.x, c.y - 6, 30);
                    break;
                }
                case 'enemy': {
                    const def = it.e.def;
                    const boss = Boolean(def.boss);
                    const lvl = X.enemyLevel(def, level);
                    drawShadow(c.x, c.y + 5, boss ? 20 : 14, boss ? 8 : 5);
                    drawEmoji(def.emoji, c.x, c.y - (boss ? 12 : 8), boss ? 50 : 36);
                    if (boss) drawEmoji('👑', c.x, c.y - 52 - 3 * Math.abs(Math.sin(now / 350)), 22);
                    const color = lvl > level ? '#dc2626' : lvl < level ? '#16a34a' : '#ca8a04';
                    drawLabel(c.x, c.y + (boss ? 24 : 20), `${boss ? '☠ ' : ''}Nv ${lvl}`, '#ffffff', color, 11);
                    break;
                }
                case 'player': {
                    const moving = Math.hypot(session.data.x - vis.px, session.data.y - vis.py) > 0.05;
                    const hop = moving ? -5 * Math.abs(Math.sin(now / 70)) : -1.5 * Math.sin(now / 400);
                    drawShadow(c.x, c.y + 5, 13, 5);
                    ctx.beginPath();
                    ctx.ellipse(c.x, c.y + 3, 15, 7, 0, 0, Math.PI * 2);
                    ctx.strokeStyle = '#facc15';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                    drawEmoji(cfg.getHero().emoji, c.x, c.y - 9 + hop, 36);
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

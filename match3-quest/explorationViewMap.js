// Carte plein écran de la vue d'exploration (pose d'un repère), voyage, arène, boussole du repère.
// Extrait de explorationView.js : fabrique appelée une fois par createExplorationView, `env` donne accès à l'état partagé de la vue.
import * as X from './exploration.js';
import { BIOMES } from './explorationViewConsts.js';

export function createMapOverlay(env) {
    const { cfg } = env;
    const { ctx, root, vis } = env;
    // ── Carte plein écran et repère ─────────────────────────────────────
    // Un clic sur la minimap ouvre la carte entière (brouillard de guerre compris) ; toucher une case y pose un repère temporaire : une flèche violette
    // (autre couleur que la quête dorée et la perception rouge) y mène, et il disparaît dès qu'on y arrive (exploration.js `setMarker`).
    const MARKER_COLOR = '#c084fc';
    function closeMapOverlay() {
        if (!env.mapEl) return;
        env.mapEl.remove();
        env.mapEl = null;
    }
    function openMapOverlay() {
        env.ensureSession();
        if (env.mapEl || !env.session || env.inCombat) return;
        env.held = null; env.walk = null; env.stopHoldRepeat();
        const screen = X.currentScreen(env.session);
        const biome = BIOMES[screen.biome] || BIOMES.paddy;
        env.mapEl = document.createElement('div');
        env.mapEl.className = 'explore-map';
        env.mapEl.innerHTML = `<div class="explore-map-card" role="dialog" aria-label="Carte de la zone">
  <div class="explore-map-head"><b></b><span>Touchez la carte pour poser un repère · zoomez (+/−, molette, pincement) pour viser juste</span></div>
  <div class="explore-map-view"><canvas class="explore-map-canvas"></canvas></div>
  <div class="explore-map-actions"><button type="button" data-act="zoom-out" aria-label="Dézoomer" disabled>−</button><button type="button" data-act="zoom-in" aria-label="Zoomer">+</button><button type="button" data-act="clear">Retirer le repère</button><button type="button" data-act="close">Fermer</button></div></div>`;
        env.mapEl.querySelector('b').textContent = screen.name;
        const cv = env.mapEl.querySelector('canvas');
        const view = env.mapEl.querySelector('.explore-map-view');
        const openedAt = performance.now();   // le relâchement du doigt qui a ouvert la carte ne doit ni la fermer ni poser de repère
        const fit = Math.max(3, Math.min((window.innerWidth - 32) / screen.w, (window.innerHeight - 190) / screen.h));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const MAX_ZOOM = 8;
        let zoom = 1, cell = fit;
        const resize = (keepCenter = true) => {
            const old = { w: cv.clientWidth || 1, h: cv.clientHeight || 1 };
            const cx = keepCenter ? (view.scrollLeft + view.clientWidth / 2) / old.w : 0.5;
            const cy = keepCenter ? (view.scrollTop + view.clientHeight / 2) / old.h : 0.5;
            cell = fit * zoom;
            cv.style.width = `${Math.round(screen.w * cell)}px`;
            cv.style.height = `${Math.round(screen.h * cell)}px`;
            const k = Math.min(dpr, 4096 / Math.max(screen.w * cell, screen.h * cell));
            cv.width = Math.max(1, Math.round(screen.w * cell * k));
            cv.height = Math.max(1, Math.round(screen.h * cell * k));
            cv.dataset.k = String(k);
            view.scrollLeft = cx * screen.w * cell - view.clientWidth / 2;
            view.scrollTop = cy * screen.h * cell - view.clientHeight / 2;
        };
        const setZoom = (z, atX, atY) => {
            const nz = Math.max(1, Math.min(MAX_ZOOM, z));
            if (nz === zoom) return;
            // garde sous le doigt (ou au centre) la case qui y était
            const rect = cv.getBoundingClientRect(), vr = view.getBoundingClientRect();
            const fx = atX == null ? 0.5 : (atX - rect.left) / rect.width, fy = atY == null ? 0.5 : (atY - rect.top) / rect.height;
            const px = atX == null ? vr.width / 2 : atX - vr.left, py = atY == null ? vr.height / 2 : atY - vr.top;
            zoom = nz;
            resize(false);
            view.scrollLeft = fx * screen.w * cell - px;
            view.scrollTop = fy * screen.h * cell - py;
            paint();
            env.mapEl.querySelector('[data-act="zoom-in"]').disabled = zoom >= MAX_ZOOM;
            env.mapEl.querySelector('[data-act="zoom-out"]').disabled = zoom <= 1;
        };
        // Fond : la capture de la carte déjà produite pour la soluce (nette même zoomée), quand elle existe ; sinon la minimap agrandie.
        let bg = null;
        try {
            const img = new Image();
            img.onload = () => { if (env.mapEl) { bg = img; paint(); } };
            img.src = new URL(`soluce/img/${screen.id}.jpg`, document.baseURI).href;
        } catch { /* repli : minimap */ }
        const paint = () => {
            const g = cv.getContext('2d');
            const k = Number(cv.dataset.k) || dpr;
            g.setTransform(k, 0, 0, k, 0, 0);
            g.imageSmoothingEnabled = false;
            g.clearRect(0, 0, cv.width, cv.height);
            const W = screen.w * cell, H = screen.h * cell;
            g.imageSmoothingEnabled = Boolean(bg);
            g.drawImage(bg || env.miniBase(screen, biome), 0, 0, W, H);
            const fog = X.fogMask(env.session, screen);
            const seen = (x, y) => fog[Math.floor(y) * screen.w + Math.floor(x)] === 1;
            const dot = (x, y, color, r) => { g.fillStyle = color; g.fillRect((x + 0.5) * cell - r, (y + 0.5) * cell - r, r * 2, r * 2); };
            (screen.exits || []).forEach(e => { if (seen(e.x, e.y)) dot(e.x, e.y, '#7dd3fc', Math.max(2, cell * 0.35)); });
            if (!bg) {   // la capture montre déjà les personnages et les ennemis
                screen.npcs.forEach(n => { if (seen(n.x, n.y)) dot(n.x, n.y, '#5ab0ff', Math.max(1.5, cell * 0.28)); });
                X.aliveEnemies(env.session).forEach(e => { if (seen(e.x, e.y)) dot(e.x, e.y, '#ff4a3a', Math.max(1.5, cell * 0.28)); });
            }
            g.drawImage(env.miniFog(screen), 0, 0, W, H);   // le brouillard : cases jamais vues
            if (bg) g.drawImage(env.miniFog(screen), 0, 0, W, H);   // sur la capture il doit masquer pour de bon (la minimap, elle, laisse deviner)
            const mk = X.markerOf(env.session);
            if (mk) {
                const cx = (mk.x + 0.5) * cell, cy = (mk.y + 0.5) * cell, r = Math.max(5, cell * 0.9);
                g.fillStyle = MARKER_COLOR; g.strokeStyle = '#2b1b17'; g.lineWidth = 2;
                g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.7, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r * 0.7, cy); g.closePath(); g.fill(); g.stroke();
            }
            g.fillStyle = '#ffe14a'; g.strokeStyle = '#2b1b17'; g.lineWidth = 2;
            const hr = Math.max(3, cell * 0.6);
            g.beginPath(); g.arc((env.session.data.x + 0.5) * cell, (env.session.data.y + 0.5) * cell, hr, 0, Math.PI * 2); g.fill(); g.stroke();
        };
        cv.addEventListener('click', ev => {
            if (performance.now() - openedAt < 450 || pinched) return;
            const rect = cv.getBoundingClientRect();
            const x = Math.floor((ev.clientX - rect.left) / (rect.width / screen.w)), y = Math.floor((ev.clientY - rect.top) / (rect.height / screen.h));
            if (X.setMarker(env.session, x, y)) { paint(); env.toast('Repère posé : une flèche violette y mène.', 2600); }   // la carte reste ouverte : seul « Fermer » la ferme
            else env.toast('Repère impossible ici.', 1800);
        });
        env.mapEl.addEventListener('click', ev => {
            if (performance.now() - openedAt < 450) return;
            const act = ev.target.closest('[data-act]')?.dataset.act;
            if (act === 'clear') { X.clearMarker(env.session); paint(); env.toast('Repère retiré.', 1500); }
            else if (act === 'zoom-in') setZoom(zoom * 1.6);
            else if (act === 'zoom-out') setZoom(zoom / 1.6);
            else if (act === 'close') closeMapOverlay();
        });
        view.addEventListener('wheel', ev => { ev.preventDefault(); setZoom(zoom * (ev.deltaY < 0 ? 1.25 : 0.8), ev.clientX, ev.clientY); }, { passive: false });
        // pincement à deux doigts : zoom centré sur le milieu des doigts
        const pts = new Map();
        let pinchDist = 0, pinched = false, dragged = 0;
        view.addEventListener('pointerdown', ev => { if (!pts.size) dragged = 0; pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); pinched = true; } });
        view.addEventListener('pointermove', ev => {
            if (!pts.has(ev.pointerId)) return;
            const prev = pts.get(ev.pointerId);
            pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
            if (pts.size === 1) {   // glisser d'un doigt : déplacer la carte zoomée (au-delà de 6 px, ce n'est plus un toucher)
                dragged += Math.abs(ev.clientX - prev.x) + Math.abs(ev.clientY - prev.y);
                if (dragged > 6) { view.scrollLeft -= ev.clientX - prev.x; view.scrollTop -= ev.clientY - prev.y; pinched = true; }
            }
            if (pts.size === 2 && pinchDist > 0) {
                const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
                setZoom(zoom * (d / pinchDist), (a.x + b.x) / 2, (a.y + b.y) / 2);
                pinchDist = d;
            }
        });
        const endPtr = ev => { pts.delete(ev.pointerId); if (!pts.size) setTimeout(() => { pinched = false; }, 250); };
        view.addEventListener('pointerup', endPtr);
        view.addEventListener('pointercancel', endPtr);
        root.appendChild(env.mapEl);
        resize(false);
        paint();
    }

    // Flèche violette vers le repère posé, et pastille sur sa case ; rien quand le repère est tout près.
    function drawMarkerCompass(P, vis, tile, pulse) {
        const mk = X.markerOf(env.session);
        if (!mk) return;
        const dest = P(mk.x + 0.5, mk.y + 0.5);
        ctx.save();
        // pastille posée sur la case du repère
        ctx.fillStyle = MARKER_COLOR; ctx.strokeStyle = '#2b1b17'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        const r = tile * (0.3 + 0.04 * pulse);
        ctx.beginPath(); ctx.moveTo(dest.x, dest.y - r * 1.3); ctx.lineTo(dest.x + r, dest.y); ctx.lineTo(dest.x, dest.y + r * 1.3); ctx.lineTo(dest.x - r, dest.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        const hero = P(vis.px + 0.5, vis.py + 0.5);
        const dx = dest.x - hero.x, dy = dest.y - hero.y;
        if (Math.hypot(dx, dy) >= tile * 1.3) {
            const ang = Math.atan2(dy, dx), rr = tile * (0.95 + 0.08 * pulse);
            ctx.translate(hero.x + Math.cos(ang) * rr, hero.y + Math.sin(ang) * rr - tile * 0.1);
            ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(tile * 0.26, 0); ctx.lineTo(-tile * 0.12, -tile * 0.2); ctx.lineTo(-tile * 0.04, 0); ctx.lineTo(-tile * 0.12, tile * 0.2); ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    }

    // Voyage rapide vers une pierre activée (hors combat).
    function travelTo(screenId) {
        env.ensureSession();
        if (env.inCombat || !X.fastTravel(env.session, screenId)) return false;
        env.held = null;
        env.walk = null;
        vis.enemies = {};
        env.syncVisual(true);
        const screen = X.currentScreen(env.session);
        cfg.onRegionVisited?.(screen.region);
        env.refreshHud();
        env.toast(`Voyage rapide : ${screen.name}`, 2600);
        cfg.onSave();
        return true;
    }

    function changeArena(enter) {
        env.ensureSession();
        if (env.inCombat || env.isDialogOpen()) return false;
        if (!(enter ? X.enterArena(env.session) : X.leaveArena(env.session))) return false;
        env.held = null;
        env.walk = null;
        vis.enemies = {};
        env.syncVisual(true);
        env.refreshHud();
        const screen = X.currentScreen(env.session);
        if (!enter) cfg.onRegionVisited?.(screen.region);
        env.toast(enter ? screen.name : `Vous quittez l'arène : ${screen.name}`, 2600);
        if (enter && !env.session.data.arenaIntroSeen) {
            env.session.data.arenaIntroSeen = true;
            if (screen.arrival?.length) env.openDialog({ ...env.NARRATOR, title: screen.name }, screen.arrival);
        }
        cfg.onSave();
        return true;
    }

    function closeJournal() {
        env.journalEl?.remove();
        env.journalEl = null;
    }

    return { MARKER_COLOR, changeArena, closeJournal, closeMapOverlay, drawMarkerCompass, openMapOverlay, travelTo };
}

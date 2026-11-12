// Superpositions de la vue d'exploration : minimap, brouillard de guerre, obscurité, aura, boussole de quête.
// Extrait de explorationView.js : fabrique appelée une fois par createExplorationView, `env` donne accès à l'état partagé de la vue.
import * as X from './exploration.js';
import { vibrate } from './gameOptions.js';
import { gridsOf } from './explorationGrids.js';

export function createOverlays(env) {
    const { cfg } = env;
    const { canvas, ctx, vis } = env;
    // Minimap : coin bas droit, glisse à gauche quand le héros s'approche de ce coin (pour ne pas le cacher).
    // Le fond (sol, chemins, obstacles, liquides) est peint une fois par écran à 1 px par case, puis agrandi.
    const miniCache = new WeakMap();
    function overMinimap(ev) {
        if (!env.miniRect) return false;
        const r = canvas.getBoundingClientRect();
        const x = ev.clientX - r.left, y = ev.clientY - r.top;
        return x >= env.miniRect.x && x <= env.miniRect.x + env.miniRect.w && y >= env.miniRect.y && y <= env.miniRect.y + env.miniRect.h;
    }
    function miniBase(screen, biome) {
        const hit = miniCache.get(screen);
        if (hit && hit.biome === biome) return hit.canvas;
        const off = document.createElement('canvas');
        off.width = screen.w;
        off.height = screen.h;
        const g = off.getContext('2d');
        const img = g.createImageData(screen.w, screen.h);
        const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
        const [fa, fp, fc, fl] = [biome.a, biome.path, biome.cliff, biome.liquid].map(rgb);
        const grids = gridsOf(screen);
        for (let i = 0; i < screen.w * screen.h; i++) {
            const c = grids.liq[i] ? fl : grids.obst[i] ? fc : grids.path[i] ? fp : fa;
            img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        miniCache.set(screen, { biome, canvas: off });
        return off;
    }

    // Voile du brouillard de guerre : une image w x h (cases jamais vues = noir bleuté), refaite quand le masque change.
    const fogLayer = { screen: null, rev: -1, canvas: null };
    function miniFog(screen) {
        const rev = env.session.rt.fogRev || 0;
        if (fogLayer.screen === screen && fogLayer.rev === rev && fogLayer.canvas) return fogLayer.canvas;
        const mask = X.fogMask(env.session, screen);
        const off = fogLayer.canvas && fogLayer.canvas.width === screen.w && fogLayer.canvas.height === screen.h ? fogLayer.canvas : document.createElement('canvas');
        off.width = screen.w;
        off.height = screen.h;
        const g = off.getContext('2d');
        const img = g.createImageData(screen.w, screen.h);
        for (let i = 0; i < screen.w * screen.h; i++) {
            if (mask[i]) continue;
            img.data[i * 4] = 14; img.data[i * 4 + 1] = 16; img.data[i * 4 + 2] = 30; img.data[i * 4 + 3] = 238;
        }
        g.putImageData(img, 0, 0);
        Object.assign(fogLayer, { screen, rev, canvas: off });
        return off;
    }

    // Brouillard de guerre de la vue principale : les cases jamais vues (masque X.fogMask, rayon X.FOG_RADIUS autour du héros) sont voilées,
    // personnages et ennemis compris, jusqu'à ce que le héros s'en approche (définitif). Le voile est une image w x h (1 px par case, opaque
    // sur l'inconnu) agrandie avec lissage : la lisière est un dégradé d'environ une case. Seule la partie visible est recopiée.
    const viewFog = { screen: null, rev: -1, canvas: null, mask: null, seenKey: '', box: null };
    function drawFogOfWar(P, screen, tile, vw, vh) {
        if (NO_FOG || !screen.w || !screen.h) return;
        const cell = `${screen.id}|${env.session.data.x},${env.session.data.y}`;
        if (cell !== env.fogHeroCell) { env.fogHeroCell = cell; X.revealFog(env.session); }   // téléportation, reprise…
        const rev = env.session.rt.fogRev || 0;
        if (viewFog.screen !== screen || viewFog.rev !== rev || !viewFog.canvas) {
            const mask = X.fogMask(env.session, screen);
            const off = viewFog.canvas || document.createElement('canvas');
            off.width = screen.w;
            off.height = screen.h;
            const g = off.getContext('2d');
            const img = g.createImageData(screen.w, screen.h);
            for (let i = 0; i < screen.w * screen.h; i++) {
                if (mask[i]) continue;
                img.data[i * 4] = 10; img.data[i * 4 + 1] = 12; img.data[i * 4 + 2] = 24; img.data[i * 4 + 3] = 255;
            }
            g.putImageData(img, 0, 0);
            Object.assign(viewFog, { screen, rev, canvas: off, mask, seenKey: '' });
        }
        const o = P(0, 0);
        const x0 = Math.max(0, Math.floor(-o.x / tile) - 1), y0 = Math.max(0, Math.floor(-o.y / tile) - 1);
        const x1 = Math.min(screen.w, Math.ceil((vw - o.x) / tile) + 1), y1 = Math.min(screen.h, Math.ceil((vh - o.y) / tile) + 1);
        if (x1 <= x0 || y1 <= y0) return;
        // On ne recopie que le rectangle qui contient des cases inconnues (plus une case de marge pour le dégradé de lisière), et rien du
        // tout quand toute la partie visible est explorée (village connu, zone finie) : sinon c'est plus d'un plein écran de pixels
        // transparents mélangés à chaque image. Recalculé seulement quand la vue ou le masque change.
        const seenKey = `${x0},${y0},${x1},${y1}`;
        if (viewFog.seenKey !== seenKey) {
            let bx0 = Infinity, by0 = Infinity, bx1 = -1, by1 = -1;
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!viewFog.mask[y * screen.w + x]) {
                if (x < bx0) bx0 = x;
                if (x > bx1) bx1 = x;
                if (y < by0) by0 = y;
                if (y > by1) by1 = y;
            }
            viewFog.seenKey = seenKey;
            viewFog.box = bx1 < 0 ? null : [Math.max(x0, bx0 - 1), Math.max(y0, by0 - 1), Math.min(x1, bx1 + 2), Math.min(y1, by1 + 2)];
        }
        if (!viewFog.box) return;
        const [fx0, fy0, fx1, fy1] = viewFog.box;
        const smoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(viewFog.canvas, fx0, fy0, fx1 - fx0, fy1 - fy0, o.x + fx0 * tile, o.y + fy0 * tile, (fx1 - fx0) * tile, (fy1 - fy0) * tile);
        ctx.imageSmoothingEnabled = smoothing;
    }

    // `?shot=1` (captures de la soluce, tools/build-soluce-shots.mjs) : pas de minimap, elle cacherait un coin de la carte.
    // Pas de brouillard non plus sur ces captures (elles montrent toute la carte).
    const NO_FOG = typeof location !== 'undefined' && /[?&]shot=1(&|$)/.test(location.search);
    const NO_MINIMAP = typeof location !== 'undefined' && /[?&]shot=1(&|$)/.test(location.search);
    function drawMinimap(screen, biome, hero, { ox, oy, tile, vw, vh, dpr }) {
        env.miniRect = null;
        if (NO_MINIMAP) return;
        if (!screen.w || !screen.h) return;
        const MARGIN = 8;
        const scale = Math.max(1, Math.floor(Math.min(vw * 0.3 / screen.w, vh * 0.28 / screen.h, 4) * 2) / 2);
        const mw = Math.round(screen.w * scale), mh = Math.round(screen.h * scale);
        if (mw < 24 || mh < 16) return;
        // le héros est « dans le coin » s'il est sous la minimap placée à droite (plus une case de garde)
        const rightX = vw - MARGIN - mw, y0 = vh - MARGIN - mh;
        const nearCorner = hero.x > rightX - tile && hero.y > y0 - tile;
        env.miniShift += ((nearCorner ? 1 : 0) - env.miniShift) * 0.2;
        if (Math.abs(env.miniShift - (nearCorner ? 1 : 0)) < 0.01) env.miniShift = nearCorner ? 1 : 0;
        const x0 = Math.round(rightX + (MARGIN - rightX) * env.miniShift);
        env.miniRect = { x: x0 - 4, y: y0 - 4, w: mw + 8, h: mh + 8 };
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // bord différenciant : liseré doré, filet sombre, puis la carte
        ctx.fillStyle = '#f2c94c';
        ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
        ctx.fillStyle = '#1a0f0a';
        ctx.fillRect(x0 - 2, y0 - 2, mw + 4, mh + 4);
        ctx.globalAlpha = 0.88;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(miniBase(screen, biome), x0, y0, mw, mh);
        const dot = (cx, cy, color, r) => {
            ctx.fillStyle = color;
            ctx.fillRect(x0 + cx * scale - r, y0 + cy * scale - r, r * 2, r * 2);
        };
        const fog = X.fogMask(env.session, screen);
        const seen = (x, y) => fog[Math.floor(y) * screen.w + Math.floor(x)] === 1;   // le brouillard cache aussi les personnages
        screen.npcs.forEach(n => { if (seen(n.x, n.y)) dot(n.x + 0.5, n.y + 0.5, '#5ab0ff', 1.5); });
        X.aliveEnemies(env.session).forEach(e => { if (seen(e.x, e.y)) dot(e.x + 0.5, e.y + 0.5, '#ff4a3a', 1.5); });
        ctx.globalAlpha = 1;
        ctx.drawImage(miniFog(screen), x0, y0, mw, mh);   // brouillard de guerre : la minimap seule, le jeu n'est pas voilé
        ctx.globalAlpha = 0.88;
        // zone visible à l'écran
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        const vx = Math.max(0, -ox / tile), vy = Math.max(0, -oy / tile);
        const vwT = Math.min(screen.w - vx, (vw - Math.max(0, ox)) / tile), vhT = Math.min(screen.h - vy, (vh - Math.max(0, oy)) / tile);
        ctx.strokeRect(x0 + vx * scale + 0.5, y0 + vy * scale + 0.5, Math.max(1, vwT * scale - 1), Math.max(1, vhT * scale - 1));
        const mk = X.markerOf(env.session);
        if (mk) dot(mk.x + 0.5, mk.y + 0.5, env.MARKER_COLOR, 2.5);
        dot(vis.px + 0.5, vis.py + 0.5, '#ffe14a', 2);
        ctx.restore();
    }

    // Souterrain : tout est noir sauf un halo autour du héros (étroit à tâtons, large et vacillant avec la torche).
    function drawDarkness(c, tile, torch, now, vw, vh) {
        const r = tile * (torch ? 4.6 + 0.12 * Math.sin(now / 140) : 1.5);
        const g = ctx.createRadialGradient(c.x, c.y, r * 0.2, c.x, c.y, r);
        const tint = torch ? '30,14,0' : '0,0,0';
        g.addColorStop(0, `rgba(${tint},0)`);
        g.addColorStop(0.55, `rgba(${tint},${torch ? 0.25 : 0.55})`);
        g.addColorStop(1, `rgba(${tint},0.97)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, vw, vh);
    }

    // Perception du qì (gǎn qì, code « aura ») : ondes concentriques autour du héros quand une cache invisible est proche ; plus elle est proche, plus l'onde est large,
    // vive et rapprochée (et le téléphone vibre). Aucune direction : à lui de chercher.
    function drawAura(P, vis, tile, now) {
        const level = cfg.getPlayerLevel();
        if (!X.hasAura(level)) return;
        if (!env.auraAnnounced) { env.auraAnnounced = true; if (!env.session.rt.auraSeen) { env.session.rt.auraSeen = true; env.toast('Perception du qì acquise : touchez votre héros pour sentir les trésors cachés (5 s).', 5200); } }
        const sig = X.auraSignal(env.session, level, now);   // null tant que la perception n'est pas lancée (clic sur le héros)
        if (!sig) return;
        const c = P(vis.px + 0.5, vis.py + 0.5);
        const period = 1800 - 900 * sig.strength;   // ms par onde
        const left = Math.max(0, (env.session.rt.perceptionUntil - now) / X.PERCEPTION_MS);   // 1 → 0 sur 5 s
        ctx.save();
        // ondes discrètes : deux anneaux fins, translucides, qui s'élargissent peu
        for (let k = 0; k < 2; k++) {
            const t = ((now + k * period / 2) % period) / period;
            ctx.strokeStyle = `rgba(170,235,255,${((1 - t) * (0.08 + 0.22 * sig.strength)).toFixed(3)})`;
            ctx.lineWidth = 1 + 1.2 * sig.strength;
            ctx.beginPath();
            ctx.arc(c.x, c.y, tile * (0.45 + t * (0.7 + 1.1 * sig.strength)), 0, Math.PI * 2);
            ctx.stroke();
        }
        // flèche rouge vers la cache la plus proche (s'efface avec le temps restant)
        const r = tile * 1.05;
        ctx.translate(c.x + Math.cos(sig.angle) * r, c.y + Math.sin(sig.angle) * r - tile * 0.1);
        ctx.rotate(sig.angle);
        ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, left * 2);
        ctx.beginPath();
        ctx.moveTo(tile * 0.3, 0);
        ctx.lineTo(-tile * 0.14, -tile * 0.22);
        ctx.lineTo(-tile * 0.04, 0);
        ctx.lineTo(-tile * 0.14, tile * 0.22);
        ctx.closePath();
        ctx.fillStyle = '#e53935';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2b1b17';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
        if (sig.strength > 0.12 && now - env.lastBuzz > period) {
            env.lastBuzz = now;
            vibrate([60 + Math.round(60 * sig.strength)]);   // coupée par l'option « Vibrations »
        }
    }

    // Indicateur de direction de la quête suivie : flèche dorée autour du héros, trait pointillé vers la cible
    // (ou vers la sortie / la porte à prendre quand la cible est dans un autre écran), nom de la destination.
    function drawQuestCompass(P, vis, tile, pulse, now, labelSize) {
        const dir = X.questDirection(env.session);
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
            env.drawLabel(dest.x, dest.y - tile * 0.75, `➜ ${dir.label}`, '#fef08a', '#5a3e1b', labelSize);
        }
    }

    return { NO_MINIMAP, drawAura, drawDarkness, drawFogOfWar, drawMinimap, drawQuestCompass, miniBase, miniFog, overMinimap };
}

// Dessin d'une image de la vue d'exploration (carte, décors, héros, ennemis, PNJ, effets).
// Extrait de explorationView.js : fabrique appelée une fois par createExplorationView, `env` donne accès à l'état partagé de la vue.
import { REGION_UNLOCK_LEVEL } from './story.js';
import * as X from './exploration.js';
import { heroSprite, npcSprite, chestSprite, enemySprite, gbaSprite, gbaWalkSprite } from './sprites/index.js';
import { viewSprite, viewDir, HERO_VIEW_OPTS } from './sprites/side.js';
import { archiSprite } from './sprites/archi.js';
import { DEAD_TREES } from './sprites/deadtrees.js';
import { connectionRows } from './mapConnections.js';
import { pickDecor, hash, houseDecor, decorCell, decorScale, npcScale } from './decor.js';
import { creatureSize } from './creatureScale.js';
import { gridsOf } from './explorationGrids.js';
import { wallDecoOf, drawBorderTree, borderKindOf, drawBoulder, drawWallTile, darkHex, drawGrassFront } from './tilePainter.js';
import { HUD_TOP, HUD_BOTTOM, MOUNTED_SPRITE_TILES, DIRECTIONS, BIOMES } from './explorationViewConsts.js';

export function createDraw(env) {
    const { cfg } = env;
    const { canvas, ctx, slideProgress, vis } = env;
    function draw(now) {
        const screen = X.currentScreen(env.session);
        const biome = BIOMES[screen.biome] || BIOMES.paddy;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const vw = Math.max(1, canvas.clientWidth);
        const vh = Math.max(1, canvas.clientHeight);
        if (canvas.width !== Math.round(vw * dpr) || canvas.height !== Math.round(vh * dpr)) {
            canvas.width = Math.round(vw * dpr);
            canvas.height = Math.round(vh * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        env.drawDpr = dpr;
        // Défilement entre deux cartes : ancienne image qui sort, nouvelle carte qui entre (poussée dans le sens de la marche).
        const sp = slideProgress(now);
        let slideX = 0, slideY = 0;   // décalage de la carte pendant le défilement (repère pour ne dessiner que ce qui est à l'écran)
        if (env.slide) {
            const d = DIRECTIONS[env.slide.dir === 'north' ? 'up' : env.slide.dir === 'south' ? 'down' : env.slide.dir === 'west' ? 'left' : 'right'] || { dx: 0, dy: 0 };
            const ease = 1 - (1 - sp) * (1 - sp);
            ctx.drawImage(env.slide.snap, -d.dx * vw * ease, -d.dy * vh * ease, vw, vh);
            slideX = d.dx * vw * (1 - ease);
            slideY = d.dy * vh * (1 - ease);
            ctx.translate(slideX, slideY);
        }

        // taille de tuile et caméra
        const availH = Math.max(1, vh - HUD_TOP - HUD_BOTTOM);
        const tile = env.tileFor(screen, vw, vh);
        const mapW = tile * screen.w;
        const mapH = tile * screen.h;
        const follow = (size, avail, offset, pos) =>
            size <= avail ? offset + (avail - size) / 2
                : offset + Math.min(0, Math.max(avail - size, avail / 2 - (pos + 0.5) * tile));
        const ox = follow(mapW, vw, 0, vis.cx ?? vis.px);
        const oy = follow(mapH, availH, HUD_TOP, vis.cy ?? vis.py);
        env.cam = { ox, oy, tile, vw };
        const P = (x, y) => ({ x: ox + x * tile, y: oy + y * tile });
        // fond sans cadre : de l'eau (carte de mer) ou la couleur du sol du biome jusqu'au bord de l'écran. Les cases de la carte sont opaques
        // et repeintes juste après : on ne peint que ce qui est autour d'elles (jamais tout l'écran quand la carte le recouvre).
        ctx.fillStyle = screen.aquatic ? biome.liquid : biome.a;
        const mx0 = Math.max(0, ox), my0 = Math.max(0, oy), mx1 = Math.min(vw, ox + mapW), my1 = Math.min(vh, oy + mapH);
        if (env.slide || mx1 <= mx0 || my1 <= my0) ctx.fillRect(0, 0, vw, vh);
        else {
            // Chaque bande déborde d'un pixel sous la carte : le bord de la carte tombe sur des coordonnées fractionnaires (anti-crénelage),
            // la carte repeint ce pixel et la couture reste celle de l'ancien fond plein.
            if (my0 > 0) ctx.fillRect(0, 0, vw, my0 + 1);
            if (my1 < vh) ctx.fillRect(0, my1 - 1, vw, vh - my1 + 1);
            if (mx0 > 0) ctx.fillRect(0, my0, mx0 + 1, my1 - my0);
            if (mx1 < vw) ctx.fillRect(mx1 - 1, my0, vw - mx1 + 1, my1 - my0);
        }
        // La carte (jusqu'à 48 colonnes) déborde de l'écran : tout ce qui est hors champ (avec `margin` cases de marge pour les grands sprites
        // et les étiquettes) n'est pas dessiné. Rendu identique, beaucoup moins d'appels canvas.
        const inView = (x, y, w = 1, h = 1, margin = 1) => {
            const px = ox + x * tile + slideX, py = oy + y * tile + slideY;
            return px + (w + margin) * tile >= 0 && px - margin * tile <= vw && py + (h + margin) * tile >= 0 && py - margin * tile <= vh;
        };

        const level = cfg.getPlayerLevel();
        const aura = X.getAuraTiles(env.session);
        const pulse = 0.5 + 0.5 * Math.sin(now / 320);
        const grids = gridsOf(screen);
        const isLiquidAt = (x, y) => x >= 0 && y >= 0 && x < screen.w && y < screen.h && grids.liq[y * screen.w + x] === 1;
        const cell = (x, y, fill, inset = 0) => {
            if (!inView(x, y)) return;
            const p = P(x, y);
            ctx.fillStyle = fill;
            ctx.fillRect(p.x + inset, p.y + inset, tile - inset * 2, tile - inset * 2);
        };

        // 1. Sol, chemins, liquides, zones de vigilance
        // Le fond statique (sol, chemins, base des liquides) est dessiné une seule fois dans un calque hors écran puis
        // simplement recopié à chaque image : des centaines de fillRect par image étaient le principal coût de rendu
        // sur les vieux appareils. Rendu identique.
        const ground = env.getGroundLayer(screen, biome, tile, dpr);
        if (ground) {
            // Seule la partie visible du calque est recopiée (le calque d'une carte de 64 × 32 cases fait ~10 millions de pixels : le recopier en entier
            // à chaque image coûtait plus de 60 ms en rendu logiciel) ; pendant un glissement d'écran, tout le calque (la scène est décalée).
            const gx = ox - env.GROUND_MARGIN, gy = oy - env.GROUND_MARGIN, gw = ground.canvas.width / ground.gd, gh = ground.canvas.height / ground.gd;
            if (slideX || slideY) ctx.drawImage(ground.canvas, gx, gy, gw, gh);
            else {
                const x0 = Math.max(0, gx), y0 = Math.max(0, gy), x1 = Math.min(vw, gx + gw), y1 = Math.min(vh, gy + gh);
                if (x1 > x0 && y1 > y0) ctx.drawImage(ground.canvas, (x0 - gx) * ground.gd, (y0 - gy) * ground.gd, (x1 - x0) * ground.gd, (y1 - y0) * ground.gd, x0, y0, x1 - x0, y1 - y0);
            }
        } else {
            // Carte trop grande pour le calque (GROUND_MAX_PIXELS, p. ex. 44 × 64 cases en haute densité) : seules les cases visibles sont peintes à chaque image
            // (peindre toute la carte, hautes herbes comprises, faisait ramer le jeu).
            env.paintGroundCells(ctx, screen, biome, tile, ox, oy, (x, y) => inView(x, y));
        }
        // Parties animées : reflets des liquides et zones de vigilance qui pulsent
        const liquidCells = env.getLiquidCells(screen);
        liquidCells.forEach(([x, y]) => {
            if (!inView(x, y)) return;
            const shimmer = 0.10 + 0.10 * Math.sin(now / 500 + x * 1.7 + y * 1.1);
            cell(x, y, `rgba(255,255,255,${shimmer.toFixed(3)})`, tile * 0.08);
        });
        if (aura.size) {
            const auraFill = `rgba(220,38,38,${(0.16 + 0.12 * pulse).toFixed(3)})`;
            aura.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                if (!isLiquidAt(x, y)) cell(x, y, auraFill);
            });
        }
        // contour des zones de vigilance (lecture claire de « où ne pas passer »)
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(220,38,38,${(0.35 + 0.25 * pulse).toFixed(3)})`;
        aura.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            if (isLiquidAt(x, y) || !inView(x, y)) return;
            const p = P(x, y);
            ctx.strokeRect(p.x + 0.75, p.y + 0.75, tile - 1.5, tile - 1.5);
        });

        // sens du regard : un chevron par case de la zone, pointant vers l'avant de l'ennemi
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(255,255,255,${(0.35 + 0.25 * pulse).toFixed(3)})`;
        X.aliveEnemies(env.session).filter(e => !X.isShielded(env.session, e.def) && X.aggroOf(e.def) > 0).forEach(e => {
            const f = e.face || { dx: 0, dy: 1 };
            const fx = Math.abs(f.dx) >= Math.abs(f.dy) ? Math.sign(f.dx) : 0;
            const fy = fx ? 0 : (Math.sign(f.dy) || 1);
            X.auraCellsOf(env.session, e).forEach(({ x, y }) => {
                if ((x === e.x && y === e.y) || isLiquidAt(x, y) || !inView(x, y)) return;
                const c = P(x + 0.5, y + 0.5), a = tile * 0.14;
                ctx.beginPath();
                ctx.moveTo(c.x - fy * a - fx * a, c.y - fx * a - fy * a);
                ctx.lineTo(c.x + fx * a, c.y + fy * a);
                ctx.lineTo(c.x + fy * a - fx * a, c.y + fx * a - fy * a);
                ctx.stroke();
            });
        });

        // trajet du déplacement au clic : points le long du chemin et cercle sur la destination
        if (env.walk && env.walk.path?.length) {
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            env.walk.path.slice(0, -1).forEach(step => {
                const c = P(step.x + 0.5, step.y + 0.5);
                ctx.beginPath();
                ctx.arc(c.x, c.y, Math.max(3, tile * 0.07), 0, Math.PI * 2);
                ctx.fill();
            });
            const t = P(env.walk.tx + 0.5, env.walk.ty + 0.5);
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
            if (ex.stairs) {
                // escalier (étage caché) : volée de marches lumineuse et flèche ; vers le haut dans la maison, vers le bas à l'étage
                const p = P(ex.x, ex.y), up = ex.stairs === 'up';
                for (let k = 0; k < 5; k++) {
                    const t = up ? k : 4 - k;
                    ctx.fillStyle = `rgb(${150 + t * 14},${104 + t * 10},${60 + t * 6})`;
                    ctx.fillRect(p.x + tile * 0.1, p.y + tile * (0.12 + k * 0.17), tile * 0.8, tile * 0.15);
                }
                ctx.fillStyle = `rgba(255,236,150,${(0.2 + 0.2 * pulse).toFixed(3)})`;
                ctx.fillRect(p.x, p.y, tile, tile);
                ctx.fillStyle = '#5a3e1b';
                ctx.font = `bold ${Math.round(tile * 0.4)}px system-ui, sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(up ? '▲' : '▼', p.x + tile / 2, p.y + tile / 2);
                env.drawLabel(p.x + tile / 2, p.y - tile * 0.35, up ? 'Étage' : 'Escalier', '#fff8e1', '#5a3e1b', Math.max(11, Math.round(tile * 0.2)));
                return;
            }
            if (screen.interior) {
                // sortie d'une maison : porte de bois dans le mur du bas
                const p = P(ex.x, ex.y);
                ctx.fillStyle = '#7a4a26';
                ctx.fillRect(p.x + tile * 0.12, p.y + tile * 0.05, tile * 0.76, tile * 0.95);
                ctx.fillStyle = `rgba(255,236,150,${(0.25 + 0.2 * pulse).toFixed(3)})`;
                ctx.fillRect(p.x + tile * 0.2, p.y + tile * 0.15, tile * 0.6, tile * 0.85);
                env.drawLabel(p.x + tile / 2, p.y - tile * 0.35, 'Sortie', '#fff8e1', '#5a3e1b', Math.max(11, Math.round(tile * 0.2)));
                return;
            }
            // Passage de bord : aucune porte ni flèche, le terrain se prolonge sur la carte voisine (les gardes et piliers dessinent le barrage).
            if (ex.edge) return;
            const minLevel = REGION_UNLOCK_LEVEL[env.session.screens[ex.to].region] || 1;
            const locked = X.isExitLocked(env.session, ex);
            const gated = locked || (level < minLevel && env.session.screens[ex.to].region !== screen.region);
            // Porte illustrée (`exit.sprite`, ex. la porte du royaume des âmes errantes) : halo vert qui pulse, sprite posé sur la case, nom au-dessus.
            // Fermée par une quête, elle retombe sur la case grise habituelle.
            if (ex.sprite && !locked) {
                const base = P(ex.x + 0.5, ex.y + 1), c = P(ex.x + 0.5, ex.y + 0.5), size = tile * env.GATE_SCALE;
                env.drawGateAura(base.x, base.y - tile * 0.2, tile, now, 'back');
                cell(ex.x, ex.y, `rgba(120,184,160,${(0.16 + 0.16 * pulse).toFixed(3)})`, tile * 0.08);
                env.drawDecor(ex.sprite, base.x, base.y + tile * 0.1, size);
                env.drawGateAura(base.x, base.y - tile * 0.2, tile, now, 'front');
                env.drawLabel(c.x, ex.y === 0 ? c.y + tile * 0.75 : base.y - size * 0.92 - tile * 0.25, ex.label, '#dff5ea', '#1d3a30', Math.max(11, Math.round(tile * 0.2)));
                return;
            }
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
            env.drawLabel(c.x, labelY, labelText,
                gated ? '#e5e7eb' : '#fff8e1', '#5a3e1b', Math.max(11, Math.round(tile * 0.2)));
        });

        // Passages de bord fermés par une quête : une grande porte de bois cerclée de fer barre les 3 cases (plutôt que du vide)
        const questGateRows = connectionRows(env.session.screens, screen).filter(r => r.requires && (r.wall || env.session.quests.some(q => q.id === r.requires)) && X.isExitLocked(env.session, r));
        questGateRows.forEach(r => {
            const p = P(r.x, r.y), pad = tile * 0.04;
            if (r.wall === 'sand') {   // mur de sable : blocs de grès empilés, levés quand le boss tombe
                ctx.fillStyle = '#d8b878';
                ctx.fillRect(p.x, p.y, tile, tile);
                ctx.strokeStyle = '#a8864a';
                ctx.lineWidth = Math.max(1, tile * 0.05);
                for (let i = 0; i < 3; i++) {
                    const by = p.y + tile * i / 3;
                    ctx.strokeRect(p.x + pad, by + pad, tile - pad * 2, tile / 3 - pad * 2);
                    ctx.beginPath(); ctx.moveTo(p.x + tile * (i % 2 ? 0.35 : 0.65), by + pad); ctx.lineTo(p.x + tile * (i % 2 ? 0.35 : 0.65), by + tile / 3 - pad); ctx.stroke();
                }
                if (!r.span) env.drawLabel(p.x + tile / 2, p.y + tile / 2 - tile * 0.75, `${r.label} (muré)`, '#e5e7eb', '#5a3e1b', Math.max(11, Math.round(tile * 0.2)));
                return;
            }
            ctx.fillStyle = '#5a3a22';
            ctx.fillRect(p.x + pad, p.y + pad, tile - pad * 2, tile - pad * 2);
            ctx.strokeStyle = '#3b2415';
            ctx.lineWidth = Math.max(1, tile * 0.04);
            const vertical = r.edge === 'west' || r.edge === 'east';   // planches le long du passage
            for (let i = 1; i < 4; i++) {
                ctx.beginPath();
                if (vertical) { ctx.moveTo(p.x + tile * i / 4, p.y + pad); ctx.lineTo(p.x + tile * i / 4, p.y + tile - pad); }
                else { ctx.moveTo(p.x + pad, p.y + tile * i / 4); ctx.lineTo(p.x + tile - pad, p.y + tile * i / 4); }
                ctx.stroke();
            }
            ctx.fillStyle = '#8a8d96';   // bandes de fer
            if (vertical) { ctx.fillRect(p.x + pad, p.y + tile * 0.18, tile - pad * 2, tile * 0.1); ctx.fillRect(p.x + pad, p.y + tile * 0.72, tile - pad * 2, tile * 0.1); }
            else { ctx.fillRect(p.x + tile * 0.18, p.y + pad, tile * 0.1, tile - pad * 2); ctx.fillRect(p.x + tile * 0.72, p.y + pad, tile * 0.1, tile - pad * 2); }
            if (!r.span) {   // case centrale : cadenas et nom du passage
                const c = P(r.x + 0.5, r.y + 0.5);
                ctx.fillStyle = '#f2c14e';
                ctx.strokeStyle = '#2b1b17';
                ctx.lineWidth = Math.max(1, tile * 0.05);
                ctx.fillRect(c.x - tile * 0.14, c.y - tile * 0.02, tile * 0.28, tile * 0.22);
                ctx.strokeRect(c.x - tile * 0.14, c.y - tile * 0.02, tile * 0.28, tile * 0.22);
                ctx.beginPath(); ctx.arc(c.x, c.y - tile * 0.02, tile * 0.1, Math.PI, 0); ctx.stroke();
                env.drawLabel(c.x, r.edge === 'north' ? c.y + tile * 0.75 : c.y - tile * 0.75, `${r.label} (fermé)`, '#e5e7eb', '#5a3e1b', Math.max(11, Math.round(tile * 0.2)));
            }
        });

        // 2. Décors, PNJ, coffres, ennemis, héros (du haut vers le bas de l'écran)
        const items = grids.blocks.slice();   // décors fixes mis en cache (voir gridsOf)
        (screen.buildings || []).forEach(b => items.push({ depth: b.y + b.h - 0.5, kind: 'building', b, x: b.x, y: b.y }));
        (screen.structures || []).forEach(st => items.push({ depth: st.cross ? st.y - 0.4 : st.y + st.h - 0.5, kind: 'structure', st, x: st.x, y: st.y }));   // bâtiments, tours, ponts… à leur échelle (world/structures.js)
        X.bossWallsOf(env.session).forEach(w => items.push({ depth: w.y, kind: w.fire ? 'fire' : 'pillar', x: w.x, y: w.y }));   // piliers (flammes pour un Soleil) qui ferment le passage d'un boss, retirés à sa mort
        if (screen.waypoint) items.push({ depth: screen.waypoint.y + 0.1, kind: 'waypoint', x: screen.waypoint.x, y: screen.waypoint.y });
        (screen.spots || []).forEach(sp => items.push({ depth: sp.y + 0.05, kind: 'spot', sp, x: sp.x, y: sp.y }));
        X.visibleNpcs(env.session).forEach(n => {
            const a = vis.npcAnim?.id === n.id ? vis.npcAnim : null;   // PNJ en train d'accourir : position et saut animés
            if (n.ambient) {   // habitant de passage : glisse en douceur vers sa case logique (2,2 cases par seconde), léger rebond en marchant
                const v = ((vis.amb ||= {})[n.id] ||= { x: n.x, y: n.y, t: now });
                const step = Math.min(100, now - v.t) / 1000 * 2.2; v.t = now;
                const d = Math.hypot(n.x - v.x, n.y - v.y);
                if (d <= step) { v.x = n.x; v.y = n.y; } else { v.x += (n.x - v.x) / d * step; v.y += (n.y - v.y) / d * step; }
                items.push({ depth: v.y + 0.1, kind: 'npc', n, x: v.x, y: v.y, hop: d > 0.02 ? 0.35 * Math.abs(Math.sin(now / 110)) : 0 });
                return;
            }
            items.push({ depth: (a ? a.y : n.y) + 0.1, kind: 'npc', n, x: a ? a.x : n.x, y: a ? a.y : n.y, hop: a && !a.idle ? Math.abs(Math.sin(a.phase)) : 0 });
        });
        X.visibleChests(env.session).filter(c => X.isChestShown(env.session, c, cfg.getPlayerLevel(), performance.now())).forEach(c => items.push({ depth: c.y + 0.1, kind: 'chest', c, x: c.x, y: c.y }));
        X.aliveEnemies(env.session).forEach(e => {
            const v = vis.enemies[e.def.id] || e;
            items.push({ depth: v.y + 0.2, kind: 'enemy', e, x: v.x, y: v.y });
        });
        items.push({ depth: vis.py + 0.3, kind: 'player', x: vis.px, y: vis.py });
        if (vis.trail && vis.trail.x !== null && X.activeCompanionOf(env.session)) items.push({ depth: vis.trail.y + 0.29, kind: 'companion', x: vis.trail.x, y: vis.trail.y });
        items.sort((a, b) => a.depth - b.depth);
        const drawItems = items.filter(it => it.kind === 'player' || it.kind === 'companion' || (it.kind === 'building' ? inView(it.b.x, it.b.y, it.b.w, it.b.h, 3) : it.kind === 'structure' ? inView(it.st.x, it.st.y, it.st.w, it.st.h, 3) : inView(it.x, it.y, 1, 1, 3)));

        const labelSize = Math.max(11, Math.round(tile * 0.2));
        const houseMk = X.inChangeMode(env.session) ? [] : X.houseMarkers(env.session);   // mode Chang'e : pas de « ! » de quête
        // anneaux dorés sur les cibles de la quête suivie
        X.trackedMarkers(env.session).forEach(t => {
            let pos = null;
            if (t.kind === 'npc') pos = screen.npcs.find(n => n.id === t.id);
            else if (t.kind === 'chest') pos = screen.chests.find(ch => ch.id === t.id);
            else if (t.kind === 'enemy') pos = X.aliveEnemies(env.session).find(e => e.def.id === t.id);
            if (!pos) return;
            const c = P(pos.x + 0.5, pos.y + 0.5);
            ctx.lineWidth = 3;
            ctx.strokeStyle = `rgba(250,204,21,${(0.55 + 0.4 * pulse).toFixed(3)})`;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y + tile * 0.3, tile * (0.42 + 0.05 * pulse), tile * 0.17, 0, 0, Math.PI * 2);
            ctx.stroke();
        });
        drawItems.forEach(it => {
            const c = P(it.x + 0.5, it.y + 0.5);
            switch (it.kind) {
                case 'building': {
                    env.drawBuilding(it.b, P(it.b.x, it.b.y), tile, labelSize, screen.biome === 'tides');
                    // indicateur de quête : « ! » (quête à prendre) ou « ? » (à rendre / cible de la quête suivie) dans la maison
                    const hm = houseMk.find(h => h.exit.x === it.b.door.x && h.exit.y === it.b.door.y);
                    if (hm) {
                        const top = P(it.b.x + it.b.w / 2, it.b.y);
                        env.drawMarker(top.x, top.y - tile * 0.28 - 4 * Math.abs(Math.sin(now / 300)), hm.marker, tile, 1.35);
                    }
                    break;
                }
                case 'structure': {
                    const cv = archiSprite(it.st.id);
                    if (it.st.cross) { const q = P(it.st.x, it.st.y); ctx.fillStyle = biome.liquid; ctx.fillRect(Math.round(q.x), Math.round(q.y), Math.round(it.st.w * tile), Math.round(it.st.h * tile)); }   // l'eau sous le pont
                    if (cv) {
                        const p = P(it.st.x, it.st.y), was = ctx.imageSmoothingEnabled;
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(cv, Math.round(p.x), Math.round(p.y), Math.round(it.st.w * tile), Math.round(it.st.h * tile));
                        ctx.imageSmoothingEnabled = was;
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
                    const active = env.session.data.waypoints.includes(env.session.data.screenId);
                    const feet = c.y + tile * 0.38;
                    env.drawShadow(c.x, feet, tile * 0.3, tile * 0.1);
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
                    env.drawDecor('swirl', c.x, c.y - tile * 0.05 + tile * 0.17, tile * 0.34);
                    break;
                }
                case 'fire':
                    env.drawDecor('campfire', c.x, c.y + tile * 0.4, tile * 0.95);
                    break;
                case 'pillar':
                    env.drawShadow(c.x, c.y + tile * 0.34, tile * 0.34, tile * 0.11);
                    env.drawDecor('pillar', c.x, c.y + tile * 0.4, tile * 0.95);
                    break;
                case 'block': {
                    const px = c.x - tile / 2, py = c.y - tile / 2;
                    if (screen.interior && (it.x === 0 || it.y === 0 || it.x === screen.w - 1 || it.y === screen.h - 1)) {
                        const deco = screen.biome === 'house' && it.y === 0 ? wallDecoOf(it.x, screen.w) : 0;   // fenêtre à treillis ou rouleau au mur du fond
                        env.drawCachedObject(`wall:${screen.biome}:${it.y === 0}:${deco}`, px, py, tile, tile, [0, 0, 0, 0], (g, ox, oy) => drawWallTile(g, biome, tile, ox, oy, it.y === 0, deco));
                        break;
                    }
                    const depth = Math.min(it.x, it.y, screen.w - 1 - it.x, screen.h - 1 - it.y);
                    const border = depth === 0 || (screen.treeBorder && depth <= 1) || env.isRimTree(screen, it.x, it.y);   // couronne d'arbres (Rizières) : deux rangées d'arbres, et forêt hors du terrain d'une carte agrandie
                    if (border && !screen.interior && !screen.aquatic && screen.kind !== 'arena') {
                        // pourtour de la carte : rangée de sapins serrés, comme les routes de Pokémon
                        const seed = (it.x * 31 + it.y * 17) % 8, kind = borderKindOf(screen.biome);
                        env.drawCachedObject(`tree:${screen.biome}:${kind}:${seed}`, px, py, tile, tile, [tile * 0.6, tile * 1.1, tile * 0.6, tile * 0.3],
                            (g, ox, oy) => drawBorderTree(g, tile, ox, oy - tile * 0.2, kind, { leaf: darkHex(biome.a, -90), seed }));
                        break;
                    }
                    const decor = screen.interior ? houseDecor((x, y) => gridsOf(screen).obst[y * screen.w + x] === 1, it.x, it.y, screen.furnishing) : pickDecor(biome.decor, ...decorCell(screen, it.x, it.y));
                    if (decor === 'rock') {
                        env.drawCachedObject('boulder', px, py, tile, tile, [tile * 0.3, tile * 0.3, tile * 0.3, tile * 0.3], (g, ox, oy) => drawBoulder(g, tile, ox, oy));
                        break;
                    }
                    if (decor === 'deadtree') {   // arbre mort (objets Pixel Lab) : une des variantes, au hasard stable selon la case
                        env.drawShadow(c.x, c.y + tile * 0.3, tile * 0.36, tile * 0.12);
                        env.drawSprite(DEAD_TREES[Math.floor(hash(it.y + 5, it.x + 11) * DEAD_TREES.length)], c.x, c.y + tile * 0.4, tile * 1.35);
                        break;
                    }
                    // échelle propre à chaque décor (decor.js : un lit n'a pas la taille d'un coquillage) ; l'ombre suit
                    const dk = decorScale(decor), shadowK = Math.min(1.7, Math.max(0.6, dk / 0.85));
                    env.drawShadow(c.x, c.y + tile * 0.3, tile * 0.32 * shadowK, tile * 0.11 * shadowK);
                    env.drawDecor(decor, c.x, c.y + tile * 0.36, tile * dk);
                    break;
                }
                case 'npc': {
                    const feet = c.y + tile * 0.4;
                    env.drawShadow(c.x, feet, tile * 0.28, tile * 0.1);
                    const bob = Math.sin(now / 520 + it.x * 1.3) * tile * 0.012;
                    // mode Chang'e : liseré qui passe du rouge (blessé) au vert (soigné) à mesure des soins, en halo autour du personnage puis en anneau
                    const careT = it.n.injured ? (env.session.data.change.healed.includes(it.n.id) ? 1 : Math.min(1, (env.session.data.change.hp[it.n.id] || 0) / (it.n.need || 1))) : 0;
                    const careCol = it.n.injured ? `rgb(${Math.round(222 + (70 - 222) * careT)},${Math.round(56 + (200 - 56) * careT)},${Math.round(60 + (120 - 60) * careT)})` : null;
                    if (careCol) { ctx.save(); ctx.shadowColor = careCol; ctx.shadowBlur = tile * 0.16; }
                    env.drawSprite(gbaSprite(it.n.id) || npcSprite(it.n.id), c.x, feet + bob - (it.hop || 0) * tile * 0.32, tile * (it.n.span || 1.02 * npcScale(it.n.id)));
                    if (careCol) ctx.restore();   // `span` : PNJ immense (Changxi) ; `hop` : saut d'un PNJ qui accourt
                    const marker = it.n.injured || it.n.ambient ? null : env.npcMarkerCached(it.n.id);   // mode Chang'e : pas de « ! » de quête
                    if (it.n.merchant) env.drawMerchantBadge(c.x, c.y - tile * 0.74 - 3 * Math.abs(Math.sin(now / 340)), tile);
                    else if (marker) env.drawMarker(c.x, c.y - tile * 0.72 - 4 * Math.abs(Math.sin(now / 300)), marker, tile);
                    env.drawLabel(c.x, c.y + tile * 0.55, it.n.name, '#fff8e1', '#5a3e1b', labelSize);
                    if (it.n.injured) {   // mode Chang'e : anneau doux sous un blessé, coche verte une fois soigné
                        const healed = env.session.data.change.healed.includes(it.n.id);
                        ctx.lineWidth = 4;
                        ctx.strokeStyle = careCol;
                        ctx.beginPath();
                        ctx.ellipse(c.x, feet, tile * (0.4 + (healed ? 0 : 0.04 * pulse)), tile * 0.15, 0, 0, Math.PI * 2);
                        ctx.stroke();
                        if (healed) {   // coche verte au-dessus de la tête
                            const mx = c.x, my = c.y - tile * 0.72, r = tile * 0.13;
                            ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fillStyle = '#7fe0a8'; ctx.fill();
                            ctx.lineWidth = 2; ctx.strokeStyle = '#2b2140'; ctx.stroke();
                            ctx.beginPath(); ctx.moveTo(mx - r * 0.5, my); ctx.lineTo(mx - r * 0.1, my + r * 0.4); ctx.lineTo(mx + r * 0.55, my - r * 0.4); ctx.stroke();
                        }
                    }
                    break;
                }
                case 'chest': {
                    const opened = env.session.data.openedChests.includes(it.c.id);
                    const feet = c.y + tile * 0.36;
                    env.drawShadow(c.x, feet, tile * 0.28, tile * 0.1);
                    if (it.c.altar) {
                        // autel : décor dessiné (pas de sprite de coffre), orné une fois l'offrande déposée
                        const glow = opened ? 0.25 : 0.55 + 0.25 * Math.sin(now / 400);
                        ctx.beginPath();
                        ctx.ellipse(c.x, feet - tile * 0.04, tile * 0.42, tile * 0.15, 0, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(255,248,200,${glow.toFixed(3)})`;
                        ctx.fill();
                        env.drawDecor(opened ? 'altarLit' : 'altar', c.x, feet, tile * 0.9);
                    } else {
                        env.drawSprite(chestSprite(opened), c.x, feet, tile * 0.85);
                    }
                    break;
                }
                case 'enemy': {
                    const def = it.e.def;
                    const illusion = Boolean(def.illusion);
                    // un mirage copie en tout point le vrai soleil (silhouette, ombre, étiquette « Boss · Nv »)
                    const twin = illusion ? screen.enemies.find(e => e.boss && e.id === def.spriteKey) : null;
                    const boss = Boolean(def.boss || twin);
                    const big = boss || illusion;
                    const shielded = X.isShielded(env.session, def);
                    const lvl = X.levelFor(env.session, twin || def);
                    // taille propre à chaque gabarit (creatureScale.js : un crapaud n'a pas la taille d'un dragon) ; `span` : boss immense (Changxi, 6 cases)
                    const size = tile * (def.span || creatureSize((twin || def).templateId, big));
                    const sizeK = Math.min(2.2, Math.max(0.6, size / (tile * (big ? 1.55 : 1.08))));   // l'ombre suit la taille
                    const feet = c.y + tile * 0.4;
                    env.drawShadow(c.x, feet, tile * (boss ? 0.46 : 0.3) * sizeK, tile * 0.1 * sizeK);
                    const bob = Math.sin(now / 430 + it.x * 2.1 + it.y) * tile * 0.015;
                    ctx.save();
                    const eKey = def.spriteKey || def.id;
                    const eDir = viewDir(it.e.face);
                    const baseSprite = enemySprite(eKey, def.templateId, screen.biome);
                    const eSprite = gbaSprite(eKey, eDir) || gbaSprite(def.templateId, eDir)
                        || viewSprite(baseSprite, eDir);
                    env.drawSprite(eSprite, c.x, feet + bob, size, baseSprite);
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
                        env.drawCrown(c.x, feet - size * 0.98 - 3 * Math.abs(Math.sin(now / 350)), tile * 0.42);
                        ctx.restore();
                    }
                    const color = lvl > level ? '#dc2626' : lvl < level ? '#16a34a' : '#ca8a04';
                    env.drawLabel(c.x, c.y + tile * (boss ? 0.68 : 0.58), `${shielded ? 'Bouclier · ' : boss ? 'Boss · ' : ''}Nv ${lvl}`, '#ffffff', color, labelSize);
                    break;
                }
                case 'companion': {
                    if (env.NO_MINIMAP) break;
                    // Compagnon actif : sprite animé `companion_<id>` (4 directions, 3 images de marche) s'il est chargé, sinon son PNJ figé qui sautille.
                    const comp = X.activeCompanionOf(env.session);
                    const tr = vis.trail;
                    if (!comp || !tr) break;
                    const key = `companion_${comp.id}`;
                    const scale = comp.size || 0.8;
                    const feet = c.y + tile * 0.4;
                    const hover = comp.hover ? -tile * 0.16 + Math.sin(now / 260) * tile * 0.025 : 0;
                    // Seules les vues gauche/droite servent (face et dos : la dernière vue latérale est conservée) ; en marche, un petit sautillement remplace le cycle des pattes.
                    if (tr.dir === 'left' || tr.dir === 'right') vis.compSide = tr.dir;
                    const view = gbaSprite(key, vis.compSide || 'right');
                    const hop = comp.hover ? 0 : tr.moving ? -tile * 0.06 * Math.abs(Math.sin(now / 85 + 1.2)) : Math.sin(now / 480 + 1.2) * tile * 0.01;   // les esprits volants flottent (`hover`), sans sautiller
                    if (!comp.noShadow) env.drawShadow(c.x, feet, tile * 0.2 * scale + tile * 0.06, tile * 0.07);
                    if (view) {
                        env.drawSprite(view, c.x, feet + hop + hover + tile * 0.04, tile * scale * 1.06);
                    } else {
                        env.drawSprite(npcSprite(comp.id === 'xiao_gui' ? 'xiao_gui' : comp.npc), c.x, feet + hop + hover + tile * 0.04, tile * scale * 0.85);
                    }
                    break;
                }
                case 'player': {
                    if (env.NO_MINIMAP) break;   // `?shot=1` : captures de la soluce et de la carte plein écran, sans le héros
                    const moving = now - (vis.lastMoveAt || -1e9) < 130 || Math.hypot(env.session.data.x - vis.px, env.session.data.y - vis.py) > 0.05;
                    const walkPhase = vis.walkPhase || 0;
                    const hop = moving ? -tile * 0.07 * Math.abs(Math.sin(walkPhase * Math.PI)) : Math.sin(now / 500) * tile * 0.01;
                    const feet = c.y + tile * 0.4;
                    env.drawShadow(c.x, feet, tile * 0.28, tile * 0.1);
                    ctx.beginPath();
                    ctx.ellipse(c.x, feet - tile * 0.02, tile * 0.36, tile * 0.13, 0, 0, Math.PI * 2);
                    ctx.strokeStyle = '#facc15';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    // Pas de Yu : sur l'eau, le héros glisse à la surface et des rides s'étendent sous ses pieds
                    if (isLiquidAt(Math.round(vis.px), Math.round(vis.py))) {
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
                    const heroKey = X.inChangeMode(env.session) ? 'change_jouable' : hero.classId;   // mode Chang'e : c'est elle qu'on voit marcher
                    const heroBase = heroSprite(hero.classId);
                    const heroDir = viewDir(env.session.rt.facing);
                    const heroView = (moving && gbaWalkSprite(heroKey, heroDir, Math.floor(walkPhase)))
                        || gbaSprite(heroKey, heroDir)
                        || viewSprite(heroBase, heroDir, HERO_VIEW_OPTS);
                    // fondu entre l'image de marche courante et la suivante (progression fractionnaire de la phase)
                    const nextView = moving ? gbaWalkSprite(heroKey, heroDir, Math.floor(walkPhase) + 1) : null;
                    const blend = walkPhase - Math.floor(walkPhase);

                    const mountKey = `${hero.classId}_horse`;
                    const mountView = env.riding() && ((moving && gbaWalkSprite(mountKey, heroDir, Math.floor(walkPhase))) || gbaSprite(mountKey, heroDir));
                    if (mountView) {
                        // à cheval : sprite du cavalier de la classe (tools/gen-mounted-heroes.py), 48 px au même grain que le héros à pied (32 px)
                        const mountNext = moving ? gbaWalkSprite(mountKey, heroDir, Math.floor(walkPhase) + 1) : null;
                        env.drawSprite(mountView, c.x, feet + hop * 0.5 + tile * 0.055, tile * MOUNTED_SPRITE_TILES);
                        if (mountNext && mountNext !== mountView) { ctx.save(); ctx.globalAlpha = blend; env.drawSprite(mountNext, c.x, feet + hop * 0.5 + tile * 0.055, tile * MOUNTED_SPRITE_TILES); ctx.restore(); }
                    } else if (env.riding()) {
                        // repli (sprite du cavalier pas encore chargé) : la monture au sol, le héros en selle
                        env.drawSprite(npcSprite('horse_mount'), c.x, feet + hop * 0.5, tile * 1.2);
                        env.drawSprite(heroView, c.x, feet + hop - tile * 0.34, tile * 0.86, heroBase);
                        if (nextView && nextView !== heroView) { ctx.save(); ctx.globalAlpha = blend; env.drawSprite(nextView, c.x, feet + hop - tile * 0.34, tile * 0.86, heroBase); ctx.restore(); }
                    } else {
                        env.drawSprite(heroView, c.x, feet + hop, tile * 1.06, heroBase);
                        if (nextView && nextView !== heroView) { ctx.save(); ctx.globalAlpha = blend; env.drawSprite(nextView, c.x, feet + hop, tile * 1.06, heroBase); ctx.restore(); }
                    }
                    // hautes herbes : des brins devant ses pieds, qui frémissent (davantage en marchant)
                    if (X.isGrassCell(screen, Math.round(vis.px), Math.round(vis.py)) || X.isLowObstacle(screen, Math.round(vis.px), Math.round(vis.py))) {
                        drawGrassFront(ctx, tile, c.x - tile / 2, c.y - tile / 2, biome, now, moving);
                    }
                    break;
                }
                default:
                    break;
            }
        });
        env.drawFogOfWar(P, screen, tile, vw, vh);
        env.drawQuestCompass(P, vis, tile, pulse, now, labelSize);
        env.drawMarkerCompass(P, vis, tile, pulse);
        env.drawAura(P, vis, tile, now);
        if (screen.dark) { env.miniRect = null; env.drawDarkness(P(vis.px + 0.5, vis.py + 0.5), tile, Boolean(cfg.getHero().torch), now, vw, canvas.clientHeight); }
        else env.drawMinimap(screen, biome, P(vis.px + 0.5, vis.py + 0.5), { ox, oy, tile, vw, vh, dpr });
    }

    return { draw };
}

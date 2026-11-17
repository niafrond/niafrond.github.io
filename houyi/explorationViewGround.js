// Calque de sol mis en cache de la vue d'exploration (peinture du sol par tranches, pré-construction des cartes voisines).
// Extrait de explorationView.js : fabrique appelée une fois par createExplorationView, `env` donne accès à l'état partagé de la vue.
import * as X from './exploration.js';
import { houseRug } from './decor.js';
import { gridsOf, rectGrid } from './explorationGrids.js';
import { paintGroundTile, drawLedge } from './tilePainter.js';
import { PREBUILD_RANGE, PREBUILD_BUDGET_MS, ARRIVAL_BUDGET_MS, MIN_TILE, MAX_TILE, HUD_TOP, HUD_BOTTOM, BIOMES } from './explorationViewConsts.js';

export function createGroundLayer(env) {
    const { canvas } = env;
    // ── Calque de sol mis en cache ─────────────────────────────────────────
    const GROUND_MARGIN = 32;                 // marge (px CSS) du calque de sol autour de la carte (plus de falaise : simple tampon)
    const GROUND_MAX_PIXELS = 10.5e6;         // au-delà, la densité du calque baisse (groundDpr), puis on retombe sur le dessin direct (mémoire, durée de préparation)

    // Sol à la Pokémon (tilePainter.js) : herbe à touffes, chemins bordés, eau à reflets, dalles de salle.
    // Retourne la fonction qui peint les lignes [y0, y1[ du sol : le calque peut ainsi être construit d'un coup ou par tranches (carte voisine).
    // Hautes-Eaux : l'eau des zones de combat est une « haute herbe » marine (algues), celle du village (sans rencontre) reste calme.
    const tileBiomeId = screen => (screen.biome === 'tides' && !X.grassOf(screen) ? 'tides_calm' : screen.biome);
    function groundPainter(g, screen, biome, tile, ox, oy) {
        const inMap = (x, y) => x >= 0 && y >= 0 && x < screen.w && y < screen.h;
        const grids = gridsOf(screen);
        // carte de mer : les récifs (obstacles) reposent sur l'eau, pas sur une case de sable
        const isLiquid = (x, y) => inMap(x, y) && (grids.liq[y * screen.w + x] === 1 || (screen.aquatic && grids.obst[y * screen.w + x] === 1));
        const isPath = (x, y) => !inMap(x, y) || (grids.path[y * screen.w + x] === 1 && !isLiquid(x, y));
        const tiled = !!(screen.interior || screen.kind === 'arena');
        // maison : un tapis au centre de la pièce, sur des cases libres (ni meuble ni sortie)
        const rug = screen.interior ? houseRug((x, y) => grids.obst[y * screen.w + x] === 1 || (screen.exits || []).some(e => e.x === x && e.y === y), screen.w, screen.h) : null;
        // hautes herbes (rencontres aléatoires) : touffes sombres peintes dans le calque de sol
        const grassCells = X.grassOf(screen)?.cells || [];
        const grassGrid = grassCells.length ? rectGrid(screen, grassCells) : null;
        const isTall = grassGrid ? (x, y) => inMap(x, y) && grassGrid[y * screen.w + x] === 1 : null;
        g.imageSmoothingEnabled = false;
        return (y0, y1, visible) => {
            for (let y = y0; y < y1; y++) {
                for (let x = 0; x < screen.w; x++) {
                    if (visible && !visible(x, y)) continue;
                    paintGroundTile(g, biome, tile, ox + x * tile, oy + y * tile, x, y, { isPath, isLiquid, tiled, biomeId: tileBiomeId(screen), isTall, rug });
                    const ledge = screen.ledges ? X.ledgeAt(screen, x, y) : null;
                    if (ledge) drawLedge(g, biome, tile, ox + x * tile, oy + y * tile, ledge[0], ledge[1], x, y);
                }
            }
        };
    }

    // `visible(x, y)` (facultatif) : ne peint que les cases vues (repli sans calque, voir getGroundLayer).
    function paintGroundCells(g, screen, biome, tile, ox, oy, visible) {
        groundPainter(g, screen, biome, tile, ox, oy)(0, screen.h, visible);
    }

    function getLiquidCells(screen) {
        if (env.liquidCache.screen === screen) return env.liquidCache.cells;
        const cells = [];
        const liq = gridsOf(screen).liq;
        for (let y = 0; y < screen.h; y++) for (let x = 0; x < screen.w; x++) if (liq[y * screen.w + x] === 1) cells.push([x, y]);
        env.liquidCache = { screen, cells };
        return cells;
    }

    // Taille de tuile d'un écran (la carte rétrécit jusqu'à MIN_TILE puis défile avec le héros).
    function tileFor(screen, vw, vh) {
        const availH = Math.max(1, vh - HUD_TOP - HUD_BOTTOM);
        return Math.max(MIN_TILE, Math.min(MAX_TILE, Math.floor(Math.min(vw / screen.w, availH / screen.h))));
    }

    // Calque de sol de la carte voisine, construit par tranches pendant que le héros s'approche d'une sortie : à la transition il n'y a plus
    // qu'à l'échanger, au lieu de peindre d'un coup des milliers de cases (0,5 à 0,8 s d'arrêt à CPU ×4).
    const sameGround = (c, screen, biome, tile, dpr) => c && c.screen === screen && c.biome === biome && c.tile === tile && c.dpr === dpr;

    // Densité du calque de sol : celle de l'écran, abaissée au besoin pour que le calque tienne dans GROUND_MAX_PIXELS (les grandes cartes de 64 × 32
    // cases dépassaient d'un rien le plafond à densité 2 et retombaient sur le dessin direct, bien plus lent). Pixel art : agrandi sans lissage.
    function groundDpr(screen, tile, dpr) {
        const M = GROUND_MARGIN;
        const css = (tile * screen.w + 2 * M) * (tile * screen.h + 2 * M);
        return Math.max(1, Math.min(dpr, Math.sqrt(0.97 * GROUND_MAX_PIXELS / css)));   // 3 % de marge : les dimensions sont arrondies à l'entier supérieur
    }
    function groundCanvasSize(screen, tile, dpr) {
        const M = GROUND_MARGIN, gd = groundDpr(screen, tile, dpr);
        return [Math.ceil((tile * screen.w + 2 * M) * gd), Math.ceil((tile * screen.h + 2 * M) * gd)];
    }

    function startGroundJob(screen, biome, tile, dpr) {
        const [w, h] = groundCanvasSize(screen, tile, dpr);
        if (w * h > GROUND_MAX_PIXELS || typeof document === 'undefined') return null;
        const canvas = env.spareCanvas || document.createElement('canvas');
        env.spareCanvas = null;
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext('2d');
        if (!g) return null;
        const gd = groundDpr(screen, tile, dpr);
        g.setTransform(gd, 0, 0, gd, 0, 0);
        return { screen, biome, tile, dpr, gd, canvas, paintRows: groundPainter(g, screen, biome, tile, GROUND_MARGIN, GROUND_MARGIN), y: 0, done: false };
    }

    function dropGroundJob() {
        if (env.groundJob) env.spareCanvas = env.groundJob.canvas;
        env.groundJob = null;
    }

    // Avance la construction d'au plus `budgetMs` ; true quand le calque est terminé.
    function stepGroundJob(job, budgetMs) {
        const t0 = performance.now();
        while (job.y < job.screen.h && performance.now() - t0 < budgetMs) job.paintRows(job.y++, job.y);
        job.done = job.y >= job.screen.h;
        return job.done;
    }

    function getGroundLayer(screen, biome, tile, dpr) {
        const c = env.groundCache;
        if (sameGround(c, screen, biome, tile, dpr)) return c;
        if (sameGround(env.groundJob, screen, biome, tile, dpr)) {
            // la carte voisine préparée est celle où l'on arrive : on l'adopte une fois terminée. Si des lignes manquent encore, elles sont peintes par tranches
            // (le sol visible est dessiné directement en attendant) : tout finir d'un coup bloquait plus d'une demi-seconde sur une grande carte.
            if (!env.groundJob.done) { stepGroundJob(env.groundJob, ARRIVAL_BUDGET_MS); if (!env.groundJob.done) return null; }
            if (c?.canvas) env.spareCanvas = c.canvas;
            env.groundCache = { screen, biome, tile, dpr, gd: env.groundJob.gd, canvas: env.groundJob.canvas };
            env.groundJob = null;
            return env.groundCache;
        }
        const [w, h] = groundCanvasSize(screen, tile, dpr);
        if (w * h > GROUND_MAX_PIXELS || typeof document === 'undefined') return null;
        const canvas = c?.canvas || env.spareCanvas || document.createElement('canvas');
        if (canvas === env.spareCanvas) env.spareCanvas = null;
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext('2d');
        if (!g) return null;
        const gd = groundDpr(screen, tile, dpr);
        g.setTransform(gd, 0, 0, gd, 0, 0);
        // Aucune bordure : ni falaise ni ombre autour de la carte (le décor se prolonge jusqu'au bord de l'écran).
        paintGroundCells(g, screen, biome, tile, GROUND_MARGIN, GROUND_MARGIN);
        env.groundCache = { screen, biome, tile, dpr, gd, canvas };
        return env.groundCache;
    }

    // Héros à moins de PREBUILD_RANGE cases d'une sortie : prépare (par tranches) le sol de la carte où elle mène ; ailleurs, libère le travail en cours.
    function prebuildNeighborGround() {
        const screen = X.currentScreen(env.session);
        const hx = env.session.data.x, hy = env.session.data.y;
        const exit = (screen.exits || []).find(e => e.to && e.to !== screen.id && env.session.screens[e.to] && Math.abs(e.x - hx) + Math.abs(e.y - hy) <= PREBUILD_RANGE);
        if (!exit) { dropGroundJob(); return; }
        const target = env.session.screens[exit.to];
        const biome = BIOMES[target.biome] || BIOMES.paddy;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const tile = tileFor(target, Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight));
        if (!sameGround(env.groundJob, target, biome, tile, dpr)) {
            dropGroundJob();
            if (sameGround(env.groundCache, target, biome, tile, dpr)) return;
            env.groundJob = startGroundJob(target, biome, tile, dpr);
        }
        if (env.groundJob && !env.groundJob.done) stepGroundJob(env.groundJob, PREBUILD_BUDGET_MS);
    }

    // Indicateur de quête d'un PNJ : parcourt toutes les quêtes, donc mémorisé 250 ms par PNJ (il ne change qu'aux événements de quête).
    const markerCache = new Map();
    function npcMarkerCached(id) {
        const now = performance.now();
        const hit = markerCache.get(id);
        if (hit && now - hit.at < 250) return hit.value;
        const value = X.npcMarker(env.session, id);
        markerCache.set(id, { at: now, value });
        return value;
    }

    return { GROUND_MARGIN, getGroundLayer, getLiquidCells, npcMarkerCached, paintGroundCells, prebuildNeighborGround, tileFor };
}

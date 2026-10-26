import { jest } from '@jest/globals';
import { TILE_NAMES, STYLE_ID, tileBitmapPx, tileBitmapRules, createTileBitmaps } from '../../tileBitmaps.js';

// Les 9 SVG des tuiles sont rastérisés une fois en PNG à la taille d'affichage et servent de fond (voir tileBitmaps.js).

function makeEnv({ dpr = 2, failDecode = null, noContext = false } = {}) {
    const created = { images: [], canvases: [] };
    const head = { children: [], appendChild(el) { this.children.push(el); return el; } };
    const env = {
        devicePixelRatio: dpr,
        created,
        head,
        Image: class {
            constructor() { created.images.push(this); }
            set src(v) { this._src = v; }
            get src() { return this._src; }
            decode() { return failDecode && this._src.includes(failDecode) ? Promise.reject(new Error('illisible')) : Promise.resolve(); }
        },
        document: {
            head,
            getElementById: id => head.children.find(e => e.id === id) || null,
            createElement: tag => {
                if (tag === 'style') return { tag, id: '', textContent: '' };
                const canvas = {
                    tag, width: 0, height: 0, draws: [], ctxOptions: null,
                    getContext(kind, options) { this.ctxOptions = options; return noContext ? null : { drawImage: (...a) => canvas.draws.push(a) }; },
                    toDataURL: () => `data:image/png;base64,${canvas.width}x${canvas.height}-${created.canvases.indexOf(canvas)}`
                };
                created.canvases.push(canvas);
                return canvas;
            }
        }
    };
    return env;
}

function setup(envOptions) {
    const env = makeEnv(envOptions);
    const timers = [];
    const tb = createTileBitmaps(env, {
        svgUrl: n => `sprites/tiles/tile-${n}.svg?v=1`,
        schedule: (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length; },
        cancel: id => { if (timers[id - 1]) timers[id - 1].live = false; }
    });
    const style = () => env.document.getElementById(STYLE_ID);
    const fire = async () => { for (const t of timers) if (t.live) { t.live = false; t.fn(); } await tb.ready(); await new Promise(r => setImmediate(r)); };
    return { env, tb, timers, style, fire };
}

describe('tileBitmapPx / tileBitmapRules', () => {
    test('côté en pixels écran : taille CSS × densité, arrondi, borné', () => {
        expect(tileBitmapPx(45, 2)).toBe(90);
        expect(tileBitmapPx(45.4, 2)).toBe(91);
        expect(tileBitmapPx(45, 1)).toBe(45);
        expect(tileBitmapPx(45)).toBe(45);
        expect(tileBitmapPx(45, 3)).toBe(135);
        expect(tileBitmapPx(2, 1)).toBe(16);
        expect(tileBitmapPx(400, 3)).toBe(256);
        expect(tileBitmapPx(NaN, 2)).toBe(16);
    });

    test('une règle par tuile, avec le sélecteur de retro.css', () => {
        const urls = Object.fromEntries(TILE_NAMES.map(n => [n, `data:image/png;base64,${n}`]));
        const css = tileBitmapRules(urls);
        TILE_NAMES.forEach(n => expect(css).toContain(`body.rt .tile.${n}{background-image:url("data:image/png;base64,${n}")}`));
        expect(css.match(/\{/g).length).toBe(TILE_NAMES.length);
        expect(tileBitmapRules({ red: 'x' })).toBe('body.rt .tile.red{background-image:url("x")}');
    });
});

describe('createTileBitmaps', () => {
    test('première demande : les 9 tuiles sont rastérisées tout de suite à la taille exacte, dans un seul <style> ajouté au <head>', async () => {
        const { env, tb, style } = setup({ dpr: 2 });
        tb.request(45);
        expect(await tb.ready()).toBe(true);
        expect(tb.currentPx).toBe(90);
        expect(env.created.canvases.length).toBe(TILE_NAMES.length);
        env.created.canvases.forEach(c => { expect([c.width, c.height]).toEqual([90, 90]); expect(c.draws[0].slice(1)).toEqual([0, 0, 90, 90]); });
        expect(env.created.images.map(i => i.src)).toEqual(TILE_NAMES.map(n => `sprites/tiles/tile-${n}.svg?v=1`));
        const css = style().textContent;
        TILE_NAMES.forEach(n => expect(css).toContain(`body.rt .tile.${n}{background-image:url("data:image/png;base64,90x90-`));
        expect(env.head.children.filter(e => e.id === STYLE_ID).length).toBe(1);
    });

    test('canvas logiciel (willReadFrequently) : pas d\'attente synchrone du GPU pour toDataURL', async () => {
        const { env, tb } = setup();
        tb.request(45);
        await tb.ready();
        env.created.canvases.forEach(c => expect(c.ctxOptions).toEqual({ willReadFrequently: true }));
    });

    test('même taille redemandée : rien n\'est refait', async () => {
        const { env, tb, timers } = setup();
        tb.request(45);
        await tb.ready();
        const canvases = env.created.canvases.length;
        tb.request(45);
        tb.request(45);
        await tb.ready();
        expect(env.created.canvases.length).toBe(canvases);
        expect(timers.length).toBe(0);
    });

    test('changement de taille : attend la stabilisation (une seule fabrication pour une série de redimensionnements), puis remplace le <style>', async () => {
        const { env, tb, timers, style, fire } = setup({ dpr: 2 });
        tb.request(45);
        await tb.ready();
        const first = style().textContent;
        tb.request(44); tb.request(43); tb.request(40);   // redimensionnement en cours
        expect(env.created.canvases.length).toBe(TILE_NAMES.length);      // rien de refait pendant le geste
        expect(timers.filter(t => t.live).length).toBe(1);
        await fire();
        expect(tb.currentPx).toBe(80);
        expect(env.created.canvases.length).toBe(2 * TILE_NAMES.length);
        expect(style().textContent).not.toBe(first);
        expect(style().textContent).toContain('80x80');
        expect(env.head.children.filter(e => e.id === STYLE_ID).length).toBe(1);
    });

    test('retour à la taille déjà appliquée pendant l\'attente : la fabrication prévue est annulée', async () => {
        const { env, tb, timers, fire } = setup();
        tb.request(45);
        await tb.ready();
        tb.request(40);
        tb.request(45);
        expect(timers.filter(t => t.live).length).toBe(0);
        await fire();
        expect(env.created.canvases.length).toBe(TILE_NAMES.length);
    });

    test('une image illisible : aucun style n\'est écrit (les SVG d\'origine restent), et pas de nouvel essai en boucle pour cette taille', async () => {
        const { env, tb, style } = setup({ failDecode: 'tile-skull' });
        tb.request(45);
        expect(await tb.ready()).toBe(false);
        expect(style()).toBeNull();
        expect(tb.currentPx).toBe(0);
        const images = env.created.images.length;
        tb.request(45);
        await tb.ready();
        expect(env.created.images.length).toBe(images);
    });

    test('pas de canvas 2D : aucun style, aucune exception', async () => {
        const { tb, style } = setup({ noContext: true });
        tb.request(45);
        expect(await tb.ready()).toBe(false);
        expect(style()).toBeNull();
    });

    test('sans document ni Image (environnement sans DOM) : ne fait rien et ne lève pas', async () => {
        const tb = createTileBitmaps({ devicePixelRatio: 2 }, { svgUrl: n => n });
        expect(() => tb.request(45)).not.toThrow();
        expect(await tb.ready()).toBe(false);
        expect(tb.currentPx).toBe(0);
    });

    test('un échec n\'empêche pas une autre taille de réussir', async () => {
        const env = makeEnv({ failDecode: 'tile-skull' });
        const timers = [];
        const tb = createTileBitmaps(env, { svgUrl: n => `sprites/tiles/tile-${n}.svg`, schedule: (fn, ms) => { timers.push({ fn }); return timers.length; }, cancel: () => {} });
        tb.request(45);
        expect(await tb.ready()).toBe(false);
        env.Image.prototype.decode = function () { return Promise.resolve(); };   // l'image redevient lisible
        tb.request(50);
        timers.forEach(t => t.fn());
        expect(await tb.ready()).toBe(true);
        expect(tb.currentPx).toBe(100);
    });
});

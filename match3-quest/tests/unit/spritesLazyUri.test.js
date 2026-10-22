import { jest } from '@jest/globals';

// `toDataURL` relit tout le canvas : sur GPU c'est une attente synchrone du thread principal. L'URI d'un sprite pixellisé n'est donc calculée
// que si une balise <img> la demande (spriteUri) ; la carte d'exploration dessine le canvas directement.

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#c33"/></svg>';
const PNG = 'data:image/png;base64,AAAA';

let canvases, images, domImages;

function fakeCanvas() {
    const c = {
        width: 0, height: 0,
        toDataURL: jest.fn(() => `data:image/png;base64,CANVAS${canvases.indexOf(c)}`),
        getContext: () => ({
            imageSmoothingEnabled: true,
            drawImage() {},
            getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }),
            createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
            putImageData() {}
        })
    };
    canvases.push(c);
    return c;
}

beforeEach(() => {
    jest.resetModules();
    canvases = [];
    images = [];
    domImages = [];
    globalThis.document = { createElement: () => fakeCanvas(), querySelectorAll: () => domImages };
    // Comme dans un navigateur : l'image n'est « complète » qu'après son chargement (la préparation du sprite attend donc `decode()`)
    globalThis.Image = class {
        constructor() { this.complete = false; this.naturalWidth = 0; images.push(this); }
        decode() { return new Promise(resolve => setImmediate(() => { this.complete = true; this.naturalWidth = 32; resolve(); })); }
        set src(value) { this._src = value; queueMicrotask(() => { this.complete = true; this.naturalWidth = 32; if (this.onload) this.onload(); }); }
        get src() { return this._src; }
    };
});
afterEach(() => { delete globalThis.document; delete globalThis.Image; });

const load = async () => import('../../sprites/index.js');
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(resolve => setImmediate(resolve)); };
const readbacks = () => canvases.reduce((sum, c) => sum + c.toDataURL.mock.calls.length, 0);

describe('sprites/index.js — URI des sprites pixellisés calculée à la demande', () => {
    test('SVG : préparer ou dessiner un sprite ne relit pas le canvas (toDataURL) tant qu\'aucune <img> n\'attend', async () => {
        const { preparePixelSprite, pixelSprite } = await load();
        await preparePixelSprite(SVG);
        expect(pixelSprite(SVG)).not.toBeNull();   // le canvas est prêt à être dessiné
        expect(readbacks()).toBe(0);
    });

    test('SVG : spriteUri calcule l\'URI à la première demande seulement, puis la mémorise', async () => {
        const { preparePixelSprite, spriteUri } = await load();
        await preparePixelSprite(SVG);
        const first = spriteUri(SVG);
        expect(first).toMatch(/^data:image\/png;base64,CANVAS/);
        expect(spriteUri(SVG)).toBe(first);
        expect(readbacks()).toBe(1);
    });

    test('SVG : une <img> qui affichait la version de repli reçoit l\'URI nette dès que le sprite est prêt (un seul calcul pour toutes)', async () => {
        const { spriteUri } = await load();
        const fallback = spriteUri(SVG);   // lance la préparation et renvoie la version de repli
        expect(fallback).toMatch(/^data:image\/svg\+xml/);
        const waiting = [1, 2].map(() => ({ attrs: { src: fallback }, getAttribute(n) { return this.attrs[n]; }, setAttribute(n, v) { this.attrs[n] = v; } }));
        const other = { attrs: { src: 'autre.png' }, getAttribute(n) { return this.attrs[n]; }, setAttribute(n, v) { this.attrs[n] = v; } };
        domImages.push(...waiting, other);
        await settle();
        waiting.forEach(el => expect(el.attrs.src).toMatch(/^data:image\/png;base64,CANVAS/));
        expect(waiting[0].attrs.src).toBe(waiting[1].attrs.src);
        expect(other.attrs.src).toBe('autre.png');
        expect(readbacks()).toBe(1);
    });

    test('SVG : sans <img> en attente, spriteUri appelé plus tard renvoie quand même la version nette', async () => {
        const { spriteUri, preparePixelSprite } = await load();
        await preparePixelSprite(SVG);
        expect(readbacks()).toBe(0);
        expect(spriteUri(SVG)).toMatch(/^data:image\/png;base64,CANVAS/);
        expect(readbacks()).toBe(1);
    });

    test('PNG pré-généré : même comportement (pas de relecture à la préparation, une seule à la demande)', async () => {
        const { pixelSprite, spriteUri } = await load();
        expect(pixelSprite(PNG)).toBeNull();   // en cours de préparation
        await settle();
        expect(pixelSprite(PNG)).not.toBeNull();
        expect(readbacks()).toBe(0);
        const uri = spriteUri(PNG);
        expect(uri).toMatch(/^data:image\/png;base64,CANVAS/);
        expect(spriteUri(PNG)).toBe(uri);
        expect(readbacks()).toBe(1);
    });

    test('PNG : spriteUri avant que le sprite soit prêt renvoie le PNG d\'origine, puis la version nette', async () => {
        const { spriteUri } = await load();
        expect(spriteUri(PNG)).toBe(PNG);
        await settle();
        expect(spriteUri(PNG)).toMatch(/^data:image\/png;base64,CANVAS/);
    });
});

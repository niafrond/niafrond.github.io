import { createRequire } from 'node:module';
import { walkFrames } from '../../tools/gen-companion-walk.mjs';

const { PNG } = createRequire(import.meta.url)('pngjs');

// Petit « personnage » 32×32 : tête, corps et deux jambes (colonnes 13 et 18) posées sur la ligne 28.
function dummy() {
    const img = new PNG({ width: 32, height: 32 });
    const put = (x, y) => { const i = (y * 32 + x) * 4; img.data[i] = 200; img.data[i + 1] = 90; img.data[i + 2] = 40; img.data[i + 3] = 255; };
    for (let y = 8; y < 14; y++) for (let x = 12; x < 20; x++) put(x, y);        // tête
    for (let y = 14; y < 24; y++) for (let x = 11; x < 21; x++) put(x, y);       // corps
    for (let y = 24; y < 29; y++) { put(13, y); put(14, y); put(17, y); put(18, y); }   // jambes
    return img;
}
const opaque = (img) => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) n++; return n; };
const key = (img) => Buffer.from(img.data).toString('base64');

describe('images de marche des compagnons (gen-companion-walk.mjs)', () => {
    test('trois images différentes par direction, sans perdre le dessin', () => {
        for (const dir of ['front', 'back', 'left', 'right']) {
            const base = dummy();
            const frames = walkFrames(base, dir);
            expect(frames).toHaveLength(3);
            expect(new Set(frames.map(key)).size).toBe(3);
            frames.forEach((f) => expect(opaque(f)).toBeGreaterThan(opaque(base) * 0.9));   // quelques pixels se recouvrent
        }
    });
    test('de face, une jambe puis l\'autre se lève ; de profil, les pieds avancent puis reculent', () => {
        const front = walkFrames(dummy(), 'front');
        const bottom = (img, x) => { for (let y = 31; y >= 0; y--) if (img.data[(y * 32 + x) * 4 + 3] > 0) return y; return -1; };
        expect(bottom(front[0], 13)).toBeLessThan(bottom(front[0], 18));    // gauche levée
        expect(bottom(front[2], 18)).toBeLessThan(bottom(front[2], 13));    // droite levée
        const side = walkFrames(dummy(), 'left');
        const footX = (img) => { let m = 99; for (let x = 0; x < 32; x++) if (img.data[(27 * 32 + x) * 4 + 3] > 0) m = Math.min(m, x); return m; };
        expect(footX(side[0])).toBeGreaterThan(footX(side[2]));
    });
    test('créature volante : tout le corps monte et descend, les pieds ne bougent pas l\'un sans l\'autre', () => {
        const frames = walkFrames(dummy(), 'front', true);
        const top = (img) => { for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (img.data[(y * 32 + x) * 4 + 3] > 0) return y; return -1; };
        expect(top(frames[1])).toBeLessThan(top(frames[0]));
        expect(top(frames[2])).toBeGreaterThan(top(frames[0]));
    });
});

// Manifeste de l'application installable (manifest.json) : nom « Match Quest », icônes présentes aux bonnes tailles, liens de l'index.
import { readFileSync, existsSync } from 'fs';
import { describe, test, expect } from '@jest/globals';

const dir = new URL('../../', import.meta.url);
const read = f => readFileSync(new URL(f, dir), 'utf8');
const manifest = JSON.parse(read('manifest.json'));

// Dimensions d'un PNG : octets 16 à 23 de l'en-tête IHDR.
const pngSize = f => { const b = readFileSync(new URL(f, dir)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

describe('manifeste de la PWA', () => {
    test('l\'application s\'appelle Match Quest', () => {
        expect(manifest.name).toBe('Match Quest');
        expect(manifest.short_name).toBe('Match Quest');
        expect(manifest.short_name.length).toBeLessThanOrEqual(12);   // reste lisible sous l'icône de l'écran d'accueil
        expect(read('index.html')).toMatch(/<title>Match Quest<\/title>/);
        expect(read('index.html')).toMatch(/apple-mobile-web-app-title" content="Match Quest"/);
    });

    test('chaque icône existe, avec la taille annoncée', () => {
        manifest.icons.forEach(icon => {
            expect(existsSync(new URL(icon.src, dir))).toBe(true);
            if (icon.type === 'image/png') {
                const [w, h] = icon.sizes.split('x').map(Number);
                expect(pngSize(icon.src)).toEqual([w, h]);
            }
        });
    });

    test('icônes de base : 192 et 512 px, une version maskable, un SVG', () => {
        const by = (size, purpose) => manifest.icons.find(i => i.sizes === size && i.purpose === purpose);
        expect(by('192x192', 'any')).toBeTruthy();
        expect(by('512x512', 'any')).toBeTruthy();
        expect(by('512x512', 'maskable')).toBeTruthy();
        expect(manifest.icons.some(i => i.type === 'image/svg+xml')).toBe(true);
    });

    test('l\'index lie le manifeste, l\'icône de l\'onglet et l\'icône Apple', () => {
        const html = read('index.html');
        expect(html).toMatch(/rel="manifest" href="manifest.json"/);
        expect(html).toMatch(/rel="icon" href="icon.svg"/);
        const apple = /rel="apple-touch-icon" href="([^"]+)"/.exec(html);
        expect(apple).not.toBeNull();
        expect(pngSize(apple[1])).toEqual([180, 180]);
    });
});

/** @jest-environment jsdom */
// Cinématiques plein écran des ultimes (SPEC : une scène portrait par ultime, passable au toucher, repli sans planches).
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { playUltimateCinematic } from '../../ultimates.js';
import { ultimateSpells } from '../../spells.js';
import { ULTIMATE_COLORS, ULTIMATE_SIZE, loadPlans, loadSequence, sequenceRect, preloadUltimateCinematic, deviceFetch } from '../../ultimateCinematics.js';

describe('stockage permanent sur l\'appareil', () => {
    test('premier accès : réseau puis Cache Storage ; ensuite servi sans réseau ; versions anciennes purgées', async () => {
        const store = new Map(), deleted = [];
        const fakeCache = { match: async u => store.get(u), put: async (u, r) => { store.set(u, r); } };
        globalThis.caches = { open: async () => fakeCache, keys: async () => ['match3-ultimates-v0', 'autre'], delete: async k => { deleted.push(k); } };
        let calls = 0;
        globalThis.fetch = async () => { calls++; return { ok: true, clone() { return this; } }; };
        try {
            await deviceFetch('https://x/a.png');
            await deviceFetch('https://x/a.png');
            expect(calls).toBe(1);
            expect(store.has('https://x/a.png')).toBe(true);
            await new Promise(r => setTimeout(r, 0));
            expect(deleted).toEqual(['match3-ultimates-v0']);
            globalThis.fetch = async () => ({ ok: false, status: 404 });
            await expect(deviceFetch('https://x/absent.png')).rejects.toThrow('404');
        } finally {
            delete globalThis.caches;
            delete globalThis.fetch;
        }
    });
});

describe('mémoire des planches', () => {
    test('index téléchargé une seule fois, planches partagées ; un échec n\'est pas mémorisé', async () => {
        let calls = 0;
        let fail = true;
        globalThis.fetch = async () => { calls++; if (fail) throw new Error('hors ligne'); return { json: async () => ({}) }; };
        expect(await loadPlans('ultimateSkyWolf')).toBeNull();   // échec : pas gardé
        fail = false;
        expect(await loadPlans('ultimateSkyWolf')).toBeNull();   // index vide : planches absentes
        const before = calls;
        preloadUltimateCinematic([{ id: 'ultimateSkyWolf' }, { id: 'ultimateFiveElements' }]);
        await loadPlans('ultimateFiveElements');
        expect(calls).toBe(before);                              // index déjà en mémoire
        delete globalThis.fetch;
    });
});

describe('cinématiques des ultimes', () => {
    test('chaque ultime a une couleur et une scène portrait qui se ferme au toucher', async () => {
        window.matchMedia = () => ({ matches: false });
        HTMLCanvasElement.prototype.getContext = () => null;   // jsdom n'a pas de canvas 2D
        for (const sp of ultimateSpells) {
            expect(ULTIMATE_COLORS[sp.id]).toBeTruthy();
            const p = playUltimateCinematic(sp);
            const overlay = document.querySelector('.cine-ultimate');
            expect(overlay).not.toBeNull();
            expect(overlay.querySelector('.cine-ultimate-title').textContent).toBe(sp.name);
            const canvas = overlay.querySelector('canvas');
            expect(canvas.classList.contains('portrait')).toBe(true);
            expect([canvas.width, canvas.height]).toEqual(ULTIMATE_SIZE);
            overlay.dispatchEvent(new Event('pointerdown'));
            await p;
            expect(document.querySelector('.cine-ultimate')).toBeNull();
        }
    });
});

describe('plans-séquences', () => {
    const seq = { frames: 50, fps: 24, size: [144, 256], cols: 16 };

    test('sequenceRect : image i = rectangle de la planche en grille, borné à la première et à la dernière image', () => {
        expect(sequenceRect(seq, 0)).toEqual([0, 0, 144, 256]);
        expect(sequenceRect(seq, 15.9)).toEqual([15 * 144, 0, 144, 256]);
        expect(sequenceRect(seq, 16)).toEqual([0, 256, 144, 256]);
        expect(sequenceRect(seq, 49)).toEqual([(49 % 16) * 144, 3 * 256, 144, 256]);
        expect(sequenceRect(seq, 999)).toEqual(sequenceRect(seq, 49));
        expect(sequenceRect(seq, -3)).toEqual(sequenceRect(seq, 0));
    });

    test('loadSequence : null sans entrée `<id>-seq` dans l\'index (les 4 planches ou le repli jouent alors)', async () => {
        globalThis.fetch = async () => ({ json: async () => ({ 'ultimateSunPiercer-1': { frames: 13, fps: 6, size: [144, 256] } }) });
        try { expect(await loadSequence('ultimateSunPiercer')).toBeNull(); } finally { delete globalThis.fetch; }
    });

    test('l\'index déclare les séquences rangées avec des champs cohérents', async () => {
        const { readFileSync } = await import('fs');
        const index = JSON.parse(readFileSync(new URL('../../sprites/ultimates/index.json', import.meta.url), 'utf8'));
        Object.entries(index).filter(([k]) => k.endsWith('-seq')).forEach(([k, m]) => {
            expect(ULTIMATE_COLORS[k.replace(/-seq$/, '')]).toBeTruthy();
            expect(m.frames).toBeGreaterThan(24);
            expect(m.cols * m.size[0]).toBeLessThanOrEqual(16384);
            expect(Math.ceil(m.frames / m.cols) * m.size[1]).toBeLessThanOrEqual(16384);
            expect(readFileSync(new URL(`../../sprites/ultimates/${k}.png`, import.meta.url)).length).toBeGreaterThan(1000);
        });
    });
});

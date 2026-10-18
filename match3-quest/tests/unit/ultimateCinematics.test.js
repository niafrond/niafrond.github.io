/** @jest-environment jsdom */
// Cinématiques plein écran des ultimes (SPEC : une scène portrait par ultime, passable au toucher, repli sans planches).
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { playUltimateCinematic } from '../../ultimates.js';
import { ultimateSpells } from '../../spells.js';
import { ULTIMATE_COLORS, ULTIMATE_SIZE, loadPlans, preloadUltimateCinematic, deviceFetch } from '../../ultimateCinematics.js';

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
